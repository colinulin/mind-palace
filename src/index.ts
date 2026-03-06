import Claude from './vendors/claude'
import GPT from './vendors/gpt'
import { IngestingMessage, LLMName, VectorMetadata, VectorStoreName } from './types'
import Weaviate from './vendors/weaviate'
import logger from './logger'
import Pinecone from './vendors/pinecone'
import MPCore from './mindPalace'
import Gemini from './vendors/gemini'

// Memory store
export default class MindPalace extends MPCore {
    tags = [ 'database schema', 'response formatting', 'code style', 'institutional knowledge' ]

    constructor (config: {
        llm?: LLMName
        vectorStore?: VectorStoreName
        claudeConfig?: {
            apiKey: string
            generativeModel?: string
        }
        gptConfig?: {
            apiKey: string
            embeddingModel?: string
            generativeModel?: string
        }
        geminiConfig?: {
            apiKey: string
            generativeModel?: string
        }
        weaviateConfig?: {
            apiKey: string
            clusterUrl: string
            collectionName?: string
        }
        pineconeConfig?: {
            apiKey: string
            indexName?: string
            embeddingModel?: string
        }
        tags?: string[]
    }) {
        super()

        const {
            llm,
            vectorStore,
            pineconeConfig,
            claudeConfig,
            gptConfig,
            geminiConfig,
            weaviateConfig,
            tags,
        } = config

        if (tags) {
            this.tags = tags
        }
        
        if ((!vectorStore || vectorStore === 'Weaviate') && weaviateConfig) {
            this.Weaviate = new Weaviate({
                ...weaviateConfig,
                openaiApiKey: gptConfig?.apiKey,
            })
            this.VectorStore = this.Weaviate
        }
        if (vectorStore === 'Pinecone' && pineconeConfig) {
            this.Pinecone = new Pinecone(pineconeConfig)
            this.VectorStore = this.Pinecone
        }

        if (!('VectorStore' in this)) {
            logger.error({ label: 'MindPalace', message: 'No Vector Store configuration provided.' })
        }
        
        if (gptConfig?.apiKey) {
            this.GPT = new GPT(gptConfig)
        }

        if (claudeConfig?.apiKey) {
            this.Claude = new Claude(claudeConfig)
        }

        if (geminiConfig?.apiKey) {
            this.Gemini = new Gemini(geminiConfig)
        }

        if (llm === 'Claude' && this.Claude) {
            this.LLM = this.Claude
        }
        if ((!llm || llm === 'GPT') && this.GPT) {
            this.LLM = this.GPT
        }
        if ((!llm || llm === 'Gemini') && this.Gemini) {
            this.LLM = this.Gemini
        }

        if (!('LLM' in this)) {
            logger.error({ label: 'MindPalace', message: 'No LLM configuration provided.' })
        }
    }

    // Recall everything needed to provide context
    async recall (params: IngestingMessage & {
        groupId?: string | number
        userId?: string | number
    }) {
        const relevantMemories = await this.findRelevantMemories(params)
        if (!relevantMemories) {
            logger.warn({ label: 'MindPalace', message: 'No relevant memories found.' })
            return
        }

        const formattedMemories = relevantMemories
            .map(m => `Information: ${m.summary}\nMemory: "${m.quote}"`)
            .join('\n\n')

        return {
            // eslint-disable-next-line max-len
            message: `Below is a list of memories and information from previous conversations to help you better respond to the following request.\n<memories>${formattedMemories}</memories>`,
            memories: relevantMemories,
        }
    }
    
    // Ingest a converstion and store it as memories
    // If groupId/userId is passed, new memories will include these values and 
    // similar memory search will include filters for these values
    async remember (params: IngestingMessage & {
        groupId?: string | number
        userId?: string | number
    }) {
        const metadata: VectorMetadata = {}
        if (params.groupId) {
            metadata.groupId = String(params.groupId)
        }
        if (params.userId) {
            metadata.userId = String(params.userId)
        }
        const newMemories = await this.extractMemories(params) || []
        const { updatedMemories, staleMemoryIds } = await this.findAndMergeNewMemories(
            newMemories.map(m => ({ ...m, userId: metadata.userId || null, groupId: metadata.groupId || null })),
            metadata,
        )
        await Promise.all([
            this.VectorStore.deleteStaleMemories(staleMemoryIds),
            this.VectorStore.insertMemoriesIntoVectorStore(
                updatedMemories, 
                metadata,
            ),
        ])

        return updatedMemories
    }
}

/**
 * TODO:
 * - Add automated tests
 * - Determine max lengths for memories
 * - Add Gemini
 * - Implement namespaces in Pinecone for userId tracking
 * - Add Readme.md
 * - Add Contribution.md
 * - Add customization params
 * 
 * Future stuff:
 * - Improve isCore prompt
 * - Improve tags
 * - Add support for package-specific env vars
 */
