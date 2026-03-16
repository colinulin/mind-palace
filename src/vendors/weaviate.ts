import weaviate, {
    SearchOptions,
    WeaviateClient,
    PropertyConfigCreate,
    dataType,
    FetchObjectsOptions,
    Collection,
    Filters,
    FilterValue,
} from 'weaviate-client'
import { Memory } from '../types'
import GPT from './gpt'
import logger from '../logger'
import { IVectorStore, VectorMemory, VectorStore } from './vectorStore'

export default class Weaviate extends VectorStore implements IVectorStore {
    // Weaviate connection settings
    private collectionName: string
    private clusterUrl: string
    private apiKey: string

    // OpenAI connection for embedding generation
    private openaiApiKey?: string
    private gptClient?: GPT

    // Initialized and awaited weaviate client and memory collection
    private weaviateClient: WeaviateClient | undefined = undefined
    private memoryCollection: Collection<Memory, string, undefined> | undefined = undefined

    // Query config
    returnMetadata = [ 'creationTime', 'updateTime' ] as const satisfies string[]
    returnProperties = [ 'quote', 'summary', 'tags', 'source', 'term', 'isCore' ] as const satisfies string[]

    // Memory collection properties
    private properties: PropertyConfigCreate<Memory>[] = [
        {
            name: 'quote',
            dataType: dataType.TEXT,
            indexSearchable: true,
        },
        {
            name: 'summary',
            dataType: dataType.TEXT,
            indexSearchable: true,
        },
        {
            name: 'tags',
            dataType: dataType.TEXT_ARRAY,
        },
        {
            name: 'source',
            dataType: dataType.TEXT,
        },
        {
            name: 'term',
            dataType: dataType.TEXT,
            indexFilterable: true,
        },
        {
            name: 'isCore',
            dataType: dataType.BOOLEAN,
            indexFilterable: true,
        },
        {
            name: 'userId',
            dataType: dataType.TEXT,
            indexFilterable: true,
        },
        {
            name: 'groupId',
            dataType: dataType.TEXT,
            indexFilterable: true,
        },
    ]

    constructor (config: { 
        collectionName?: string
        apiKey: string
        clusterUrl: string
        openaiApiKey?: string
    }) {
        super()

        const { clusterUrl, apiKey, collectionName, openaiApiKey } = config

        this.clusterUrl = clusterUrl
        this.apiKey = apiKey
        this.collectionName = collectionName || 'MindPalace'

        this.openaiApiKey = openaiApiKey
        this.gptClient = openaiApiKey ? new GPT({ apiKey: openaiApiKey }) : undefined

        if (!openaiApiKey) {
            throw new Error('No OpenAI API key found.')
        }

        if (!/^[A-Z][_0-9A-Za-z]*$/.test(this.collectionName)) {
            throw new Error('Invalid collection name. Names must start with uppercase letter and only contain letters.')
        }
    }

    // Create single connection to Weaviate cluster and store collection connection
    async initWeaviateClient () {
        if (this.weaviateClient) {
            return
        }

        // Connect to weaviate
        const weaviateClient = await weaviate.connectToWeaviateCloud(
            this.clusterUrl,
            { 
                authCredentials: new weaviate.ApiKey(this.apiKey),
                headers: this.openaiApiKey ? {
                    'X-Openai-Api-Key': this.openaiApiKey,
                } : {},
                skipInitChecks: true,
                timeout: {
                    init: 1000,
                    query: 3000,
                },
            },
        )
        this.weaviateClient = weaviateClient

        logger.info({ label: 'Weaviate', message: 'Initialized client.' })

        // Connect to collection
        const collectionExists = await this.weaviateClient.collections.exists(this.collectionName)
        if (collectionExists) {
            logger.info({ label: 'Weaviate', message: `Collection (${this.collectionName}) found.` })
            this.memoryCollection = this.weaviateClient.collections.get<Memory>(this.collectionName)
            return
        }

        if (this.memoryCollection) {
            return
        }

        const memoryCollection = await this.weaviateClient.collections.create<Memory>({ 
            name: this.collectionName,
            properties: this.properties,
            vectorizers: weaviate.configure.vectors.text2VecOpenAI<Memory>({
                sourceProperties: [ 'quote', 'summary' ] as (keyof Memory)[],
                model: this.gptClient?.embeddingModel,
                dimensions: 3072,
                type: 'text',
            }),
        }).catch(() => { /** noop */ })

        if (!memoryCollection) {
            return
        }

        logger.info({ label: 'Weaviate', message: `Collection (${memoryCollection.name}) created.` })

        this.memoryCollection = memoryCollection
        this.collectionName = memoryCollection.name
    }

    // Close connection to Weaviate cluster
    async closeWeaviateClients () {
        this.memoryCollection = undefined
        await this.weaviateClient?.close()
        logger.info({ label: 'Weaviate', message: 'Connection successfully closed.' })
    }

    /**
     * Insert memories into collection
     */
    async insertMemoriesIntoVectorStore (
        memories: Memory[],
        metadata?: { groupId?: string; userId?: string },
    ) {
        await this.initWeaviateClient()
        if (!this.memoryCollection) {
            logger.error({ 
                label: 'Weaviate', 
                message: 'Unable to insert memories. You must initialize Weaviate connection first.', 
            })
            return
        }

        // convert memories into Weaviate data objects for storage
        const dataObjects = memories.map(m => ({
            properties: {
                quote: m.quote,
                summary: m.summary,
                tags: m.tags,
                source: m.source,
                term: m.term,
                isCore: m.isCore,
                // default userId and groupId to null so we don't have to have a null index
                userId: metadata?.userId || 'null',
                groupId: metadata?.groupId || 'null',
            },
        }))

        // insert memories into Weaviate collection
        const insertResponse = await this.memoryCollection.data.insertMany(dataObjects)

        logger.debug({ label: 'Weaviate', metadata: insertResponse })
        logger.info({ label: 'Weaviate', message: `Inserted ${dataObjects.length} memories into vector store.` })
    }

    /**
     * Create query filters
     */
    createFilters (params: {
        propertyFilters?: { key: keyof Memory; value: string | boolean }[]
        userId?: string
        groupId?: string
        omitCoreMemories?: boolean
    }): FilterValue[] {
        const { propertyFilters, userId, groupId, omitCoreMemories } = params

        // if a userId is passed, limit to only records with that userId otherwise limit to those without ANY userId
        const filters: FilterValue[] = []
        if (userId) {
            filters.push(this.memoryCollection!.filter.byProperty('userId').equal(userId))
        } else {
            filters.push(this.memoryCollection!.filter.byProperty('userId').equal('null'))
        }

        // if groupId is passed, limit to only records with that groupId, otherwise no filter on groupId
        if (groupId) {
            filters.push(this.memoryCollection!.filter.byProperty('groupId').equal(groupId))
        }

        // if omitting core memories, filter all isCore out otherwise apply no filter to isCore
        if (omitCoreMemories) {
            filters.push(this.memoryCollection!.filter.byProperty('isCore').equal(false))
        }

        // convert array of filters into Weaviate filters
        if (propertyFilters?.length) {
            filters.push(...(propertyFilters || []).map(f =>
                this.memoryCollection!.filter.byProperty(f.key).equal(f.value),
            ))
        }

        return filters
    }

    /**
     * Delete stale memories by ID
     */
    async deleteStaleMemories (dataObjectIds: string[]) {
        if (!dataObjectIds.length) {
            return
        }

        await this.initWeaviateClient()
        if (!this.memoryCollection) {
            logger.error({
                label: 'Weaviate',
                message: 'Unable to delete memories. You must initialize Weaviate connection first.', 
            })
            return
        }
        await this.memoryCollection.data.deleteMany(
            this.memoryCollection.filter.byId().containsAny(dataObjectIds),
        )
        logger.info({ label: 'Weaviate', message: `Deleted ${dataObjectIds.length} memories from vector store.` })
    }

    /**
     * Search memories and return top N
     */
    async searchMemories (params: {
        queryStrings: string[]
        userId?: string
        groupId?: string
        omitCoreMemories?: boolean
        limit: number
        mode: 'hybrid' | 'bm25' | 'nearText'
        alpha?: number
        maxHoursShortTermLength?: number
    }) {
        await this.initWeaviateClient()
        if (!this.memoryCollection) {
            logger.error({ 
                label: 'Weaviate', 
                message: 'Unable to search memories. You must initialize Weaviate connection first.',
            })
            return
        }

        const { queryStrings, limit, mode, userId, groupId, omitCoreMemories, alpha: customAlpha } = params

        // configure return options for weaviate request
        const returnOpts: SearchOptions<Memory, undefined> = {
            returnMetadata: [ 'score', ...this.returnMetadata ],
            returnProperties: this.returnProperties,
            limit,
        }
        
        // apply any filters passed
        const filters = this.createFilters({
            userId,
            groupId,
            omitCoreMemories,
        })
        if (filters.length) {
            returnOpts.filters = Filters.and(...filters)
        }

        // calculate hybrid search alpha based on search mode
        // alpha=1 is pure vector search, alpha=0 is pure keyword search
        const alpha = mode === 'bm25'
            ? 0
            : mode === 'nearText'
                ? 1
                : (customAlpha || 0.5)

        logger.info({ label: 'Weaviate', message: `Searching for "${queryStrings.join(', ')}".` })

        const searchPromises = queryStrings.map(queryString => this.memoryCollection?.query.hybrid(
            queryString,
            {
                ...returnOpts,
                alpha,
            },
        ))

        // combine and dedupe all results
        const searchResults = await Promise.all(searchPromises)
        const resultsMap = searchResults.reduce((acc, result) => {
            if (!result) {
                return acc
            }

            result.objects.forEach(result => {
                // determine if short-term expiration has passed and omit memory if so (default: 72 hours)
                const updateTime = (result.metadata?.updateTime || new Date()).getTime()
                const shortTermExpiration = 
                    updateTime + ((params.maxHoursShortTermLength || 72) * 1000 * 60 * 60)

                if (result.properties.term === 'short' && Date.now() > shortTermExpiration) {
                    return
                }

                acc.set(result.uuid, {
                    createdAt: result.metadata?.creationTime,
                    updatedAt: result.metadata?.updateTime,
                    memory: result.properties,
                    score: result.metadata?.score || 0,
                    uuid: result.uuid,
                })
            })

            return acc
        }, new Map<string, VectorMemory>())
        const results = [ ...resultsMap.values() ]

        logger.debug({ label: 'Weaviate', metadata: results })
        logger.info({ label: 'Weaviate', message: `Search returned ${results.length} results.` })

        const memories = results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)

        return memories
    }

    /**
     * Fetch memories by ID
     */
    async fetchMemoriesById (memoryIds: string[]) {
        await this.initWeaviateClient()
        if (!this.memoryCollection) {
            logger.error({ 
                label: 'Weaviate', 
                message: 'Unable to fetch memories by ID. You must initialize Weaviate connection first.', 
            })
            return []
        }
        
        logger.info({ label: 'Weaviate', message: 'Fetching memories by ID.' })
        const results = await this.memoryCollection.query.fetchObjects(
            {
                filters: this.memoryCollection.filter.byId().containsAny(memoryIds),
                returnMetadata: this.returnMetadata,
                returnProperties: this.returnProperties,
            },
        )
        logger.debug({ label: 'Weaviate', metadata: results })
        logger.info({ label: 'Weaviate', message: `Fetched ${results.objects.length} memories.` })

        return results.objects.map(r => r.properties)
    }

    /**
     * Fetch memories by specific property values
     */
    async fetchMemoriesWithFilter (params: { 
        filters?: { key: keyof Memory; value: string | boolean }[]
        userId?: string
        groupId?: string
        limit?: number 
    }) {
        const { userId, groupId } = params
        await this.initWeaviateClient()
        if (!this.memoryCollection) {
            logger.error({ 
                label: 'Weaviate', 
                message: 'Unable to fetch memories. You must initialize Weaviate connection first.', 
            })
            return []
        }

        logger.info({ label: 'Weaviate', message: 'Fetching memories.' })
        const query: FetchObjectsOptions<Memory, undefined> = {
            limit: params?.limit || 100,
            returnMetadata: this.returnMetadata,
            returnProperties: this.returnProperties,
        }

        // if a userId is passed, limit to only records with that userId otherwise limit to those without ANY userId
        const filters = this.createFilters({
            propertyFilters: params.filters,
            userId,
            groupId,
        })
        if (filters?.length) {
            query.filters = Filters.and(...filters)
        }

        const results = await this.memoryCollection.query.fetchObjects(query)
        logger.debug({ label: 'Weaviate', metadata: results })
        logger.info({ label: 'Weaviate', message: `Fetched ${results.objects.length} memories.` })
        
        return results.objects.map(r => r.properties)
    }
}
