import { ContentBlock, ToolUseBlock } from './vendors/types'
import Claude from './vendors/claude'
import GPT from './vendors/gpt'
import responseSchemas from './responseSchemas'
import prompts from './prompts'
import TokenCounter from './tokenCounter'
import { IngestingMessage, Memory } from './types'
import Weaviate from './vendors/weaviate'
import { chunkArray, transformLLMMessagesToGenericBlocks } from './utils'

// Memory store
export class MindPalace {
    logLevel: 'off' | 'error' | 'debug'
    tags = [ 'database schema', 'response formatting', 'code style', 'institutional knowledge' ]
    tokenUsage = new TokenCounter()
    Weaviate: Weaviate
    LLM!: Claude | GPT
    Claude: Claude | undefined
    GPT: GPT

    constructor (config: {
        logLevel?: 'off' | 'error' | 'debug'
        llm: 'Claude' | 'GPT' | 'Gemini'
        claudeConfig?: {
            apiKey: string
            embeddingModel?: string
            generativeModel?: string
        }
        gptConfig: { // GPT config is currently required for embedding generation
            apiKey: string
            embeddingModel?: string
            generativeModel?: string
        }
        weaviateConfig: {
            apiKey: string
            clusterUrl: string
            collectionName?: string
        }
    }) {
        const { logLevel, llm, claudeConfig, gptConfig, weaviateConfig } = config

        this.logLevel = logLevel ?? 'off'
        
        this.Weaviate = new Weaviate({
            ...weaviateConfig,
            openaiApiKey: gptConfig?.apiKey,
        })
        
        this.GPT = new GPT(gptConfig)

        if (claudeConfig?.apiKey) {
            this.Claude = new Claude(claudeConfig)
        }

        if (llm === 'Claude' && this.Claude) {
            this.LLM = this.Claude
        }
        if (llm === 'GPT' && this.GPT) {
            this.LLM = this.GPT
        }

        if (!('LLM' in this)) {
            throw new Error('You must configure at least one LLM ')
        }
    }

    // Extract memories from context
    async extractMemories (params: IngestingMessage) {
        let context: string | ContentBlock[]
        if ('llm' in params) {
            if (params.llm === 'claude') {
                context = transformLLMMessagesToGenericBlocks({ messages: params.context, llm: params.llm })
            }
            else if (params.llm === 'gpt') {
                context = transformLLMMessagesToGenericBlocks({ messages: params.context, llm: params.llm })
            }
            else {
                throw new Error('Invalid context format.')
            }
        } else {
            context = params.context
        }

        const responseSchema = responseSchemas.extractedMemories(this.tags)
        const { messages, systemMessage } = prompts.memoryExtraction(context)
        const { structuredResponse, tokenUsage, model } = await this.LLM.generateInference({
            responseSchema,
            messages,
            systemMessage,
        })
        this.tokenUsage.trackInference(tokenUsage, model)

        return structuredResponse?.memories || []
    }

    // Search memory based on a search string and return top N relevant memories
    async searchMemories (params: { queryString: string; limit?: number; alpha?: number }) {
        const { queryString, limit, alpha } = params

        const vectorStoreResults = await this.Weaviate.searchMemories({
            queryString,
            limit: limit ?? 5,
            mode: 'hybrid',
            alpha: alpha || 0.5,
        })
        
        return vectorStoreResults
    }

    // Find relevant memories to include in a chat
    async findRelevantMemories (context: ContentBlock[] | string) {
        const { messages, systemMessage, tools } = prompts.relevantMemorySearch(context)
        const responseSchema = responseSchemas.relevantMemoryIds()
        const generationConfig = {
            responseSchema,
            messages,
            systemMessage,
            tools,
        }
        const { response, structuredResponse, tokenUsage, model } = await this.LLM.generateInference(generationConfig)
        this.tokenUsage.trackInference({
            input: tokenUsage.input,
            output: tokenUsage.output,
        }, model)
        
        // grab all of the last content blocks that are tool_use type
        const toolUseBlocks: ToolUseBlock[] = []
        response.contentBlocks.reverse()
        for (const block of response.contentBlocks) {
            if (block.type !== 'tool_use') {
                return
            }

            toolUseBlocks.push(block)
        }

        // process tool use blocks (if present) to generate a list of relevant memory IDs
        let memoryIds: string[]
        if (toolUseBlocks.length) {
            const toolUseResponse = await this.LLM.processToolUsage({
                toolUseBlocks,
                MindPalace: this,
                continueGenerationAfterProcessing: true,
                retryLimit: 3,
                generationConfig,
            })
            this.tokenUsage.trackInference({
                input: toolUseResponse.tokenUsage.input,
                output: toolUseResponse.tokenUsage.output,
            }, toolUseResponse.model)
            memoryIds = toolUseResponse.structuredResponse?.memoryIds || []
        } else {
            memoryIds = structuredResponse?.memoryIds || []
        }

        // get memories from vector store by ID
        const memories = await this.Weaviate.fetchMemoriesById(memoryIds)

        return memories
    }

    // Fetch all core memories
    async fetchCoreMemories () {
        const coreMemories = await this.Weaviate.fetchMemories({ filter: { key: 'isCore', value: true } })

        return coreMemories.map(cm => cm.properties.summary)
    }

    // Find and merge similar memories in vector store
    async findAndMergeNewMemories (
        newMemories: Memory[],
    ) {
        // iterate over all new memories searching for highly similar ones already in the vector db
        const nearMemoryGroups = await Promise.all(newMemories.map(async m => {
            const nearMemory = (await this.Weaviate.searchMemories({
                queryString: m.quote,
                limit: 1,
                mode: 'nearText',
            })).objects[0]

            if ((nearMemory.metadata?.score || 0) < 0.8) {
                return {
                    newMemory: m,
                }
            }

            return {
                newMemory: m,
                nearMemory,
            }
        }))

        // process 10 at a time to prevent rate limiting
        const chunkedGroups = chunkArray(nearMemoryGroups.filter(nmg => !!nmg), 10)
        let updatedMemories: Memory[] = []
        const staleMemoryIds: string[] = []
        const responseSchema = responseSchemas.mergedMemories(this.tags)
        for (const cg of chunkedGroups) {
            const updatedGroup = await Promise.all(cg.map(async memoryGroup => {
                if (!memoryGroup.nearMemory) {
                    return [ memoryGroup.newMemory ]
                }

                // attempt to merge the memories and/or create a new
                const { messages, systemMessage } = prompts.memoryMerge(
                    memoryGroup.newMemory, 
                    memoryGroup.nearMemory,
                )
                const { structuredResponse, tokenUsage, model } = await this.LLM.generateInference({
                    responseSchema,
                    messages,
                    systemMessage,
                })
                this.tokenUsage.trackInference(tokenUsage, model)

                // log stale memory ID in vector db to delete
                staleMemoryIds.push(memoryGroup.nearMemory.uuid)

                return structuredResponse?.memories
            }))
            updatedMemories = [
                ...updatedMemories,
                ...updatedGroup.flat().filter(ug => !!ug),
            ]
        }

        return {
            staleMemoryIds,
            updatedMemories,
        }
    }
    
    // Ingest a converstion and store it as memories
    async processConversation (params: IngestingMessage & {
        metadata: Record<string, unknown>
    }) {
        const { metadata } = params
        const newMemories = await this.extractMemories(params)
        const { updatedMemories, staleMemoryIds } = await this.findAndMergeNewMemories(newMemories)
        await Promise.all([
            this.Weaviate.deleteStaleMemories(staleMemoryIds),
            this.Weaviate.insertMemoriesIntoVectorStore(updatedMemories),
        ])
    }
}

/**
 * TODO:
 * - Integrate metadata (i.e., userId)
 * - Add logging
 * - Add automated tests
 * - Determine max lengths for memories
 * - Add Gemini
 * - Add Readme.md
 * - Add Contribution.md
 * - Make it possible to write your own LLM and Vector Store classes
 * 
 * Future cleanup:
 * - Abstract longer methods from MindPalace
 * - Improve isCore prompt
 * - Figure out how to keep track of IDs of memories during merge so we can update and not delete
 * - Improve tags
 */