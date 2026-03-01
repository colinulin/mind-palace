import { ContentBlock } from './vendors/types'
import Claude from './vendors/claude'
import GPT from './vendors/gpt'
import responseSchemas from './responseSchemas'
import prompts from './prompts'
import TokenCounter from './tokenCounter'
import { Memory } from './types'
import Weaviate from './vendors/weaviate'
import { chunkArray } from './utils'

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
        gptConfig: { // GPT config is required for embedding generation
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
    async extractMemories (context: ContentBlock[] | string) {
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

    // Search memory and return top N relevant memories
    async searchMemories (queryString: string, alpha?: number) {
        const vectorStoreResults = await this.Weaviate.searchMemories({
            queryString,
            limit: 5,
            mode: 'hybrid',
            alpha: alpha || 0.5,
        })
        
        return vectorStoreResults
    }

    // Find relevant memories to include in a chat
    async findRelevantMemories (context: ContentBlock[] | string) {
        const { messages, systemMessage, tools } = prompts.relevantMemorySearch(context)
        const responseSchema = responseSchemas.relevantMemoryIds()
        const { response, tokenUsage, model } = await this.LLM.generateInference({
            responseSchema,
            messages,
            systemMessage,
            tools,
        })
        // TODO: handle tool calling
        // TODO: call Weaviate to fetch memories based on IDs
        // TODO: return memories
    }

    // Fetch all core memories and concat
    async fetchCoreMemories () {
        const coreMemories = await this.Weaviate.fetchMemories({ filter: { key: 'isCore', value: true } })

        return coreMemories.map(cm => cm.properties.content)
    }

    // Find and merge similar memories in vector store
    async findAndMergeNewMemories (
        newMemories: Memory[],
    ) {
        // iterate over all new memories searching for highly similar ones already in the vector db
        const nearMemoryGroups = await Promise.all(newMemories.map(async m => {
            const nearMemory = (await this.Weaviate.searchMemories({
                queryString: m.content,
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
    async processConversation (
        conversation: ContentBlock[] | string, 
        metadata: Record<string, unknown>,
    ) {
        const newMemories = await this.extractMemories(conversation)
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
 * 
 * Future cleanup:
 * - Abstract longer methods from MindPalace
 * - Improve isCore prompt
 * - Figure out how to keep track of IDs of memories during merge so we can update and not delete
 */