import { randomUUID } from 'crypto'
import logger from '../logger'
import { Memory } from '../types'
import { IVectorStore } from './vectorStore'
import { Pinecone as PineconeClass, Index, RecordMetadata } from '@pinecone-database/pinecone'

type MemoryMetadata = RecordMetadata & Memory

export default class Pinecone implements IVectorStore {
    private indexName: string
    private embeddingModel: string

    private pineconeClient: PineconeClass
    private pineconeIndex: Index<MemoryMetadata> | undefined = undefined

    returnMetadata = [ 'creationTime', 'updateTime' ]
    returnProperties = [ 'quote', 'summary', 'tags', 'source', 'term', 'isCore' ]

    constructor (config: {
        indexName: string
        apiKey: string
        embeddingModel?: string
    }) {
        const { apiKey, indexName, embeddingModel } = config

        this.indexName = indexName || 'mind-palace'
        this.embeddingModel = embeddingModel || 'multilingual-e5-large'

        if (!apiKey) {
            logger.warn({ label: 'Pinecone', message: 'No Pinecone API key provided.' })
        }

        this.pineconeClient = new PineconeClass({
            apiKey,
        })

        logger.info({ label: 'Pinecone', message: 'Initialized client.' })
    }

    /**
     * Get or create the Pinecone index targeted at the configured namespace
     */
    private getIndex () {
        if (this.pineconeIndex) {
            return this.pineconeIndex
        }

        this.pineconeIndex = this.pineconeClient
            .index<MemoryMetadata>({ name: this.indexName })

        logger.info({
            label: 'Pinecone',
            message: `Connected to index, ${this.indexName}.`,
        })
        return this.pineconeIndex
    }

    /**
     * Generate dense embeddings using Pinecone's built-in inference API
     */
    private async generateEmbeddings (inputs: string[], inputType: 'passage' | 'query' = 'passage') {
        const response = await this.pineconeClient.inference.embed({
            model: this.embeddingModel,
            inputs,
            parameters: {
                inputType,
                truncate: 'END',
            },
        })

        logger.debug({ label: 'Pinecone', metadata: response })
        logger.info({ label: 'Pinecone', message: `Generated ${response.data.length} embeddings.` })
        return response.data.map(embedding =>
            'values' in embedding ? embedding.values : [],
        )
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
        const index = this.getIndex()

        const embeddingTexts = memories.map(m => `${m.quote}\n${m.summary}`)
        const embeddings = await this.generateEmbeddings(embeddingTexts)

        const records = memories.map((memory, i) => ({
            id: randomUUID(),
            values: embeddings[i],
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
    async deleteStaleMemories (dataObjectIds: string[]) {
        const index = this.getIndex()
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
        queryString: string
        filters?: { key: keyof Memory; value: string | boolean }[]
        limit: number
        mode: 'hybrid' | 'bm25' | 'nearText'
        alpha?: number
        includeNullWithFilter?: boolean
    }) {
        const index = this.getIndex()
        const { queryString, filters, limit, includeNullWithFilter } = params

        const [ queryVector ] = await this.generateEmbeddings([ queryString ], 'query')

        const filter = filters?.length
            ? this.buildFilter(filters, includeNullWithFilter)
            : undefined

        logger.info({ label: 'Pinecone', message: `Searching for "${queryString}".` })

        const results = await index.query({
            vector: queryVector,
            topK: limit,
            includeMetadata: true,
            filter,
        })

        logger.debug({ label: 'Pinecone', metadata: results })
        logger.info({ label: 'Pinecone', message: `Search returned ${results.matches.length} results.` })

        return results.matches
            .filter(match => match.metadata)
            .map(match => ({
                memory: this.toMemory(match.metadata!),
                score: match.score || 0,
                uuid: match.id,
            }))
    }

    /**
     * Fetch memories by ID
     */
    async fetchMemoriesById (memoryIds: string[]) {
        const index = this.getIndex()

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
    }) {
        const index = this.getIndex()
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
