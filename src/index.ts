import Claude from './vendors/claude'
import GPT from './vendors/gpt'
import { InputContext, LLMName, MemoryConfig, VectorStoreName } from './types'
import Weaviate from './vendors/weaviate'
import logger from './logger'
import Pinecone from './vendors/pinecone'
import MPCore from './mindPalace'
import Gemini from './vendors/gemini'
import { ILLM } from './vendors/llm'
import { IVectorStore } from './vendors/vectorStore'

// Memory store
export default class MindPalace extends MPCore {
    memoryConfig: MemoryConfig = {
        includeTerm: true,
        includeCore: true,
        includeQuote: true,
        tags: [ 'database schema', 'response formatting', 'code style', 'institutional knowledge' ],
    }

    constructor (config: {
        llm?: LLMName
        vectorStore?: VectorStoreName
        customLLM?: ILLM
        customVectorStore?: IVectorStore
        claudeConfig?: {
            apiKey: string
        }
        gptConfig?: {
            apiKey: string
            embeddingModel?: string
        }
        geminiConfig?: {
            apiKey: string
        }
        weaviateConfig?: {
            apiKey: string
            clusterUrl: string
            collectionName?: string
        }
        pineconeConfig?: {
            apiKey: string
            indexName?: string
        }
        memoryConfig?: MemoryConfig
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
            customLLM,
            customVectorStore,
            memoryConfig,
        } = config

        this.memoryConfig = {
            ...this.memoryConfig,
            ...memoryConfig,
        }
        
        // Setup vector store
        if (customVectorStore) {
            this.VectorStore = customVectorStore
        }
        else if ((!vectorStore || vectorStore === 'Weaviate') && weaviateConfig) {
            this.Weaviate = new Weaviate({
                ...weaviateConfig,
                openaiApiKey: gptConfig?.apiKey,
            })
            this.VectorStore = this.Weaviate
        }
        else if (vectorStore === 'Pinecone' && pineconeConfig) {
            this.Pinecone = new Pinecone(pineconeConfig)
            this.VectorStore = this.Pinecone
        }

        if (!this.VectorStore) {
            const errorMessage = 'No Vector Store configuration provided.'
            logger.error({ label: 'MindPalace', message: errorMessage })
            throw new Error(errorMessage)
        }
        
        // Setup LLM
        if (gptConfig?.apiKey) {
            this.GPT = new GPT(gptConfig)
        }
        if (claudeConfig?.apiKey) {
            this.Claude = new Claude(claudeConfig)
        }
        if (geminiConfig?.apiKey) {
            this.Gemini = new Gemini(geminiConfig)
        }

        this.llmName = llm || 'GPT'
        if (customLLM) {
            this.LLM = customLLM
        }
        else if (llm === 'Claude' && this.Claude) {
            this.LLM = this.Claude
        }
        else if ((!llm || llm === 'GPT') && this.GPT) {
            this.LLM = this.GPT
        }
        else if ((llm === 'Gemini') && this.Gemini) {
            this.LLM = this.Gemini
        }

        if (!this.LLM) {
            const errorMessage = 'No LLM configuration provided.'
            logger.error({ label: 'MindPalace', message: errorMessage })
            throw new Error(errorMessage)
        }
    }

    // Recall everything needed to provide context
    async recall (rawContext: InputContext, config?: {
        groupId?: string
        userId?: string
        queryVectorStoreDirectly?: boolean
        includeAllCoreMemories?: boolean
        maxHoursShortTermLength?: number
        limit?: number
        model?: string
    }) {
        this.validateMemoryMetadata({
            userId: config?.userId,
            groupId: config?.groupId,
        })

        const relevantMemories = await this.findRelevantMemories(rawContext, config)
        if (!relevantMemories?.length) {
            logger.warn({ label: 'MindPalace', message: 'No relevant memories found.' })
            return {
                message: '',
                memories: [],
            }
        }

        // format and optionally group memories by whether they're core
        const formattedMemories = relevantMemories
            .reduce((acc, m) => {
                const memoryMetadata: string[] = []
                if (m.source) memoryMetadata.push(m.source)
                if (m.term) memoryMetadata.push(`${m.term}-term`)
                const memoryMetadataFormatted = memoryMetadata.length ? ` [${memoryMetadata.join(', ')}]` : ''
                const formattedMemory = `- ${m.summary}${memoryMetadataFormatted}`

                if (config?.includeAllCoreMemories && m.isCore) {
                    acc.coreMemories += `\n${formattedMemory}`
                } else {
                    acc.regularMemories += `\n${formattedMemory}`
                }

                return acc
            }, { regularMemories: '', coreMemories: '' })

        // create the memory message text
        /* eslint-disable max-len */
        const messageParts: string[] = []
        messageParts.push(`<memory_context>
The following is information you already know from previous conversations. Incorporate this context naturally into your response without explicitly referencing that you are recalling memories unless the user asks. If any memory conflicts with something the user says in the current conversation, always defer to the current conversation.`)

        if (config?.includeAllCoreMemories && formattedMemories.coreMemories) {
            messageParts.push(`
<core_memories>
These are always-relevant facts about the context:${formattedMemories.coreMemories}
</core_memories>`)
        }

        if (formattedMemories.regularMemories) {
            messageParts.push(`
<recalled_memories>
These were retrieved as potentially relevant to the current conversation:${formattedMemories.regularMemories}
</recalled_memories>`)
        }

        messageParts.push(`
</memory_context>`)
        /* eslint-enable max-len */

        return {
            message: messageParts.join(''),
            memories: relevantMemories,
        }
    }
    
    // Ingest a conversation and store it as memories
    // If groupId/userId is passed, new memories will include these values and 
    // similar memory search will include filters for these values
    async remember (rawContext: InputContext, config?: {
        groupId?: string
        userId?: string
        model?: string
    }) {
        this.validateMemoryMetadata({
            userId: config?.userId,
            groupId: config?.groupId,
        })

        const newMemories = await this.extractMemories(rawContext, config) || []
        const { updatedMemories, staleMemoryIds } = await this.findAndMergeNewMemories(
            { newMemories, model: config?.model },
            config,
        )
        await Promise.all([
            this.VectorStore.deleteStaleMemories(staleMemoryIds, config?.userId),
            this.VectorStore.insertMemoriesIntoVectorStore(
                updatedMemories, 
                config,
            ),
        ])

        return updatedMemories
    }
}
