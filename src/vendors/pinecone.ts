import { randomUUID } from 'crypto'
import logger from '../logger'
import { Memory } from '../types'
import { IVectorStore, VectorStore } from './vectorStore'
import { Pinecone, Index, RecordMetadata } from '@pinecone-database/pinecone'

type MemoryMetadata = RecordMetadata & Memory

export default class MPPinecone extends VectorStore implements IVectorStore {
    private indexName: string

    private pineconeClient: Pinecone
    private pineconeIndex: Index<MemoryMetadata> | undefined = undefined

    returnMetadata = [ 'creationTime', 'updateTime' ]
    returnProperties = [ 'quote', 'summary', 'tags', 'source', 'term', 'isCore' ]

    constructor (config: {
        indexName?: string
        apiKey: string
    }) {
        super()

        const { apiKey, indexName } = config

        this.indexName = indexName || 'mind-palace'

        if (!apiKey) {
            logger.warn({ label: 'Pinecone', message: 'No Pinecone API key provided.' })
        }

        this.pineconeClient = new Pinecone({
            apiKey,
        })

        logger.info({ label: 'Pinecone', message: 'Initialized client.' })
    }

    /**
     * Get or create the Pinecone index targeted at the configured namespace
     */
    private getIndex (userId?: string) {
        const namespace = userId ? `user_${userId}` : undefined
        this.pineconeIndex = this.pineconeClient
            .index<MemoryMetadata>({ name: this.indexName, namespace })

        logger.info({
            label: 'Pinecone',
            message: `Connected to index, ${this.indexName}.`,
        })
        return this.pineconeIndex
    }

    /**
     * Convert Pinecone metadata back to a Memory object
     */
    private toMemory (meta: MemoryMetadata): Memory {
        return {
            quote: meta.quote,
            summary: meta.summary,
            tags: meta.tags,
            source: meta.source,
            term: meta.term as Memory['term'],
            isCore: meta.isCore,
            userId: meta.userId || null,
            groupId: meta.groupId || null,
        }
    }

    /**
     * Build a Pinecone metadata filter from generic filter params
     */
    private buildFilter (
        filters: { key: keyof Memory; value: string | boolean }[],
        includeNullWithFilter?: boolean,
    ) {
        const conditions = filters.map(({ key, value }) => {
            const equalCondition = { [key]: { $eq: value } }
            if (includeNullWithFilter) {
                return {
                    $or: [
                        equalCondition,
                        { [key]: { $eq: '' } },
                    ],
                }
            }
            return equalCondition
        })

        return conditions.length === 1 ? conditions[0] : { $and: conditions }
    }

    /**
     * Insert memories into Pinecone index
     */
    async insertMemoriesIntoVectorStore (
        memories: Memory[],
        metadata?: { groupId?: string; userId?: string },
    ) {
        const index = this.getIndex(metadata?.userId)

        const records = memories.map(memory => ({
            id: randomUUID(),
            metadata: {
                quote: memory.quote,
                summary: memory.summary,
                tags: memory.tags,
                source: memory.source,
                term: memory.term,
                isCore: memory.isCore,
                userId: metadata?.userId || '',
                groupId: metadata?.groupId || '',
            },
        }))

        // Pinecone upsert has a batch limit of 100 records
        const batchSize = 100
        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize)
            const upsertResponse = await index.upsert({ records: batch })
            logger.debug({ label: 'Pinecone', metadata: upsertResponse })
        }

        logger.info({ label: 'Pinecone', message: `Inserted ${memories.length} memories into vector store.` })
    }

    /**
     * Delete stale memories by ID
     */
    async deleteStaleMemories (dataObjectIds: string[], userId?: string) {
        if (!dataObjectIds.length) {
            return
        }

        const index = this.getIndex(userId)
        await index.deleteMany({ ids: dataObjectIds })
        logger.info({ label: 'Pinecone', message: `Deleted ${dataObjectIds.length} memories from vector store.` })
    }

    /**
     * Search memories and return top N results
     *
     * Pinecone uses vector similarity search for all modes.
     * The mode param is accepted for interface compatibility.
     */
    async searchMemories (params: {
        queryStrings: string[]
        filters?: { key: keyof Memory; value: string | boolean }[]
        limit: number
        mode: 'hybrid' | 'bm25' | 'nearText'
        alpha?: number
        includeNullWithFilter?: boolean
        userId?: string
    }) {
        const { queryStrings, filters, limit, includeNullWithFilter, userId } = params
        const index = this.getIndex(userId)

        const filter = filters?.length
            ? this.buildFilter(filters, includeNullWithFilter)
            : undefined

        logger.info({ label: 'Pinecone', message: `Searching for "${queryStrings.join(', ')}".` })

        const searchPromises = queryStrings.map(text => index.searchRecords({
            query: {
                topK: limit,
                inputs: { text },
                filter,
            },
        }))

        // combine and dedupe all results
        const resultsMap = (await Promise.all(searchPromises)).reduce((acc, response) => {
            response.result.hits.forEach(result => {
                acc.set(result._id, {
                    memory: result.fields as Memory,
                    score: result._score,
                    uuid: result._id,
                })
            })

            return acc
        }, new Map<
            string, 
            { memory: Memory; score: number; uuid: string }
        >())
        const results = [ ...resultsMap.values() ]

        logger.debug({ label: 'Pinecone', metadata: results })
        logger.info({ label: 'Pinecone', message: `Search returned ${results.length} results.` })

        return results
    }

    /**
     * Fetch memories by ID
     */
    async fetchMemoriesById (memoryIds: string[], userId?: string) {
        const index = this.getIndex(userId)

        logger.info({ label: 'Pinecone', message: 'Fetching memories by ID.' })
        const response = await index.fetch({ ids: memoryIds })

        logger.debug({ label: 'Pinecone', metadata: response })

        const memories = Object.values(response.records)
            .filter(record => record.metadata)
            .map(record => this.toMemory(record.metadata!))

        logger.info({ label: 'Pinecone', message: `Fetched ${memories.length} memories.` })
        return memories
    }

    /**
     * Fetch memories by specific property values
     */
    async fetchMemories (params?: {
        filter?: { key: keyof Memory; value: string | boolean }
        limit?: number
        userId?: string
    }) {
        const index = this.getIndex(params?.userId)
        const limit = params?.limit || 100

        logger.info({ label: 'Pinecone', message: 'Fetching memories.' })

        const filter = params?.filter
            ? { [params.filter.key]: { $eq: params.filter.value } }
            : undefined

        if (filter) {
            const response = await index.fetchByMetadata({
                filter,
                limit,
            })

            logger.debug({ label: 'Pinecone', metadata: response })

            const memories = Object.values(response.records)
                .filter(record => record.metadata)
                .map(record => this.toMemory(record.metadata!))

            logger.info({ label: 'Pinecone', message: `Fetched ${memories.length} memories.` })
            return memories
        }

        // No filter: list vector IDs and fetch them
        const listResponse = await index.listPaginated({ limit })
        logger.debug({ label: 'Pinecone', metadata: listResponse })

        const ids = (listResponse.vectors || [])
            .map(v => v.id)
            .filter((id): id is string => !!id)

        if (ids.length === 0) {
            logger.info({ label: 'Pinecone', message: 'Fetched 0 memories.' })
            return []
        }

        const fetchResponse = await index.fetch({ ids })
        logger.debug({ label: 'Pinecone', metadata: fetchResponse })

        const memories = Object.values(fetchResponse.records)
            .filter(record => record.metadata)
            .map(record => this.toMemory(record.metadata!))

        logger.info({ label: 'Pinecone', message: `Fetched ${memories.length} memories.` })
        return memories
    }
}
