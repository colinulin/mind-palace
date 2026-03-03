import weaviate, {
    SearchOptions,
    WeaviateClient,
    PropertyConfigCreate,
    PrimitiveKeys,
    dataType,
    FetchObjectsOptions,
    Collection,
    Filters,
} from 'weaviate-client'
import { Memory } from '../types'
import GPT from './gpt'

export default class Weaviate {
    // Weaviate connection settings
    private collectionName: string
    private clusterUrl: string
    private apiKey: string

    // OpenAI connection for embedding generation
    private openaiApiKey: string
    private gptClient: GPT

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
        },
        {
            name: 'summary',
            dataType: dataType.TEXT,
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
        },
        {
            name: 'isCore',
            dataType: dataType.BOOLEAN,
        },
        {
            name: 'userId',
            dataType: dataType.TEXT,
        },
        {
            name: 'groupId',
            dataType: dataType.TEXT,
        },
    ]

    constructor (config: { 
        collectionName?: string
        apiKey: string
        clusterUrl: string
        openaiApiKey: string
    }) {
        const { clusterUrl, apiKey, collectionName, openaiApiKey } = config

        this.clusterUrl = clusterUrl
        this.apiKey = apiKey
        this.collectionName = collectionName || 'MindPalace'

        this.openaiApiKey = openaiApiKey
        this.gptClient = new GPT({ apiKey: openaiApiKey })
    }

    // Create single connection to Weaviate cluster and store collection connection
    async initWeaviateClient () {
        if (this.weaviateClient) {
            return this.weaviateClient
        }

        // Connect to weaviate
        const weaviateClient = await weaviate.connectToWeaviateCloud(
            this.clusterUrl,
            { 
                authCredentials: new weaviate.ApiKey(this.apiKey),
                headers: this.openaiApiKey ? {
                    'X-Openai-Api-Key': this.openaiApiKey,
                } : {},
            },
        )
        this.weaviateClient = weaviateClient

        // Connect to collection
        const collectionExists = await this.weaviateClient.collections.exists(this.collectionName)
        if (collectionExists) {
            return this.weaviateClient.collections.get<Memory>(this.collectionName)
        }

        const memoryCollection = await this.weaviateClient.collections.create<Memory>({ 
            name: this.collectionName,
            properties: this.properties,
            vectorizers: weaviate.configure.vectors.text2VecOpenAI<Memory>({
                sourceProperties: [ 'content', 'summary' ] as PrimitiveKeys<Memory>[],
                model: this.gptClient.embeddingModel,
                dimensions: 3072,
                type: 'text',
            }),
        })

        this.memoryCollection = memoryCollection
    }

    // Close connection to Weaviate cluster
    async closeWeaviateClients () {
        this.memoryCollection = undefined
        await this.weaviateClient?.close()
    }

    /**
     * Insert memories into collection
     */
    async insertMemoriesIntoVectorStore (
        memories: Memory[],
        metadata?: { groupId?: string; userId?: string },
    ) {
        if (!this.memoryCollection) {
            throw new Error('You must initialize the Weaviate connection first.')
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
                userId: metadata?.userId || null,
                groupId: metadata?.groupId || null,
            },
        }))

        // insert memories into Weaviate collection
        return this.memoryCollection.data.insertMany(dataObjects)
    }

    /**
     * Delete stale memories by ID
     */
    async deleteStaleMemories (dataObjectIds: string[]) {
        if (!this.memoryCollection) {
            throw new Error('You must initialize the Weaviate connection first.')
        }
        await this.memoryCollection.data.deleteMany(
            this.memoryCollection.filter.byId().containsAny(dataObjectIds),
        )
    }

    /**
     * Search memories and return top N
     */
    async searchMemories (params: {
        queryString: string
        filters?: { key: PrimitiveKeys<Memory>; value: string | boolean }[]
        limit: number
        mode: 'hybrid' | 'bm25' | 'nearText'
        alpha?: number
        includeNullWithFilter?: boolean
    }) {
        if (!this.memoryCollection) {
            throw new Error('You must initialize the Weaviate connection first.')
        }

        const { includeNullWithFilter, queryString, limit, mode, filters, alpha: customAlpha } = params

        // configure return options for weaviate request
        const returnOpts: SearchOptions<Memory, undefined> = {
            returnMetadata: [ 'score', ...this.returnMetadata ],
            returnProperties: this.returnProperties,
            limit,
        }

        // apply property filter if passed
        if (filters?.length) {
            returnOpts.filters = Filters.and(
                ...filters.map(filter =>
                    includeNullWithFilter
                        ? Filters.or(
                            this.memoryCollection!.filter.byProperty(filter.key).equal(filter.value),
                            this.memoryCollection!.filter.byProperty(filter.key).isNull(true),
                        )
                        : this.memoryCollection!.filter.byProperty(filter.key).equal(filter.value),
                ),
            )
        }

        // calculate hybrid search alpha based on search mode
        // alpha=1 is pure vector search, alpha=0 is pure keyword search
        const alpha = mode === 'bm25'
            ? 0
            : mode === 'nearText'
                ? 1
                : (customAlpha || 0.5)

        return await this.memoryCollection.query.hybrid(
            queryString,
            {
                ...returnOpts,
                alpha,
            },
        )
    }

    /**
     * Fetch memories by ID
     */
    async fetchMemoriesById (memoryIds: string[]) {
        if (!this.memoryCollection) {
            throw new Error('You must initialize the Weaviate connection first.')
        }
        
        const results = await this.memoryCollection.query.fetchObjects(
            {
                filters: this.memoryCollection.filter.byId().containsAny(memoryIds),
                returnMetadata: this.returnMetadata,
                returnProperties: this.returnProperties,
            },
        )

        return results.objects
    }

    /**
     * Fetch memories by specific property values
     */
    async fetchMemories (params?: { 
        filter?: { key: PrimitiveKeys<Memory>; value: string | boolean }
        limit?: number 
    }) {
        if (!this.memoryCollection) {
            throw new Error('You must initialize the Weaviate connection first.')
        }

        const query: FetchObjectsOptions<Memory, undefined> = {
            limit: params?.limit || 100,
            returnMetadata: this.returnMetadata,
            returnProperties: this.returnProperties,
        }
        if (params?.filter) {
            query.filters = this.memoryCollection.filter.byProperty(params.filter.key).equal(params.filter.value)
        }

        const results = await this.memoryCollection.query.fetchObjects(query)
        return results.objects
    }
}
