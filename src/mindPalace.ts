import { ContentBlock, ToolUseBlock } from './vendors/types'
import Claude from './vendors/claude'
import GPT from './vendors/gpt'
import responseSchemas from './responseSchemas'
import prompts from './prompts'
import TokenCounter from './tokenCounter'
import { IngestingMessage, Memory, VectorMetadata } from './types'
import Weaviate from './vendors/weaviate'
import { chunkArray, transformLLMMessagesToGenericBlocks } from './utils'
import logger from './logger'
import Pinecone from './vendors/pinecone'

/**
 * Core Mind Palace functionality
 */
export default class MPCore {
    tags = [ 'database schema', 'response formatting', 'code style', 'institutional knowledge' ]
    tokenUsage = new TokenCounter()

    // Vector Stores
    VectorStore!: Weaviate
    protected Weaviate: Weaviate | undefined
    protected Pinecone: Pinecone | undefined

    // LLMs
    LLM!: Claude | GPT
    protected Claude: Claude | undefined
    protected GPT: GPT | undefined

    // Extract memories from context
    protected async extractMemories (params: IngestingMessage) {
        let context: string | ContentBlock[]
        if ('llm' in params) {
            if (params.llm === 'Claude') {
                context = transformLLMMessagesToGenericBlocks({ messages: params.context, llm: params.llm })
            }
            else if (params.llm === 'GPT') {
                context = transformLLMMessagesToGenericBlocks({ messages: params.context, llm: params.llm })
            }
            else {
                logger.error({ label: 'MindPalace', message: 'Invalid message format. Unable to process data.' })
                return
            }
        } else {
            context = params.context
        }

        logger.info({ label: 'MindPalace', message: 'Beginning memory extraction.' })

        const responseSchema = responseSchemas.extractedMemories(this.tags)
        const { messages, systemMessage } = prompts.memoryExtraction(context)
        const { structuredResponse, tokenUsage, model } = await this.LLM.generateInference({
            responseSchema,
            messages,
            systemMessage,
        })
        this.tokenUsage.trackInference(tokenUsage, model)

        logger.debug({ label: 'MindPalace', metadata: structuredResponse })
        logger.info({ label: 'MindPalace', message: 'Memory extraction complete.' })

        return structuredResponse?.memories || []
    }

    // Find relevant memories to include in a chat
    protected async findRelevantMemories (params: IngestingMessage & {
        groupId?: string | number
        userId?: string | number
    }) {
        let context: string | ContentBlock[]
        if ('llm' in params) {
            if (params.llm === 'Claude') {
                context = transformLLMMessagesToGenericBlocks({ messages: params.context, llm: params.llm })
            }
            else if (params.llm === 'GPT') {
                context = transformLLMMessagesToGenericBlocks({ messages: params.context, llm: params.llm })
            }
            else {
                logger.error({ label: 'MindPalace', message: 'Invalid message format. Unable to process data.' })
                return
            }
        } else {
            context = params.context
        }

        logger.info({ label: 'MindPalace', message: 'Searching for relevant memories.' })

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
            const metadata: VectorMetadata = {}
            if (params.groupId) {
                metadata.groupId = String(params.groupId)
            }
            if (params.userId) {
                metadata.userId = String(params.userId)
            }
            const toolUseResponse = await this.LLM.processToolUsage({
                toolUseBlocks,
                MindPalace: this,
                continueGenerationAfterProcessing: true,
                retryLimit: 3,
                generationConfig,
                metadata,
            })
            this.tokenUsage.trackInference({
                input: toolUseResponse.tokenUsage.input,
                output: toolUseResponse.tokenUsage.output,
            }, toolUseResponse.model)
            memoryIds = toolUseResponse.structuredResponse?.memoryIds || []

            logger.info({ label: 'MindPalace', message: 'Completed tool use block processing.' })
        } else {
            memoryIds = structuredResponse?.memoryIds || []
        }

        // get memories from vector store by ID
        const memories = await this.VectorStore.fetchMemoriesById(memoryIds)
        logger.debug({ label: 'MindPalace', metadata: memories })
        logger.info({ label: 'MindPalace', message: 'Fetched relevant memories.' })

        return memories
    }

    // Find and merge similar memories in vector store
    protected async findAndMergeNewMemories (
        newMemories: Memory[],
        metadata?: VectorMetadata,
    ) {
        // iterate over all new memories searching for highly similar ones already in the vector db
        const filters: { key: keyof Memory; value: string | boolean }[] = []
        if (metadata?.groupId) {
            filters.push({
                key: 'groupId',
                value: metadata.groupId,
            })
        }
        if (metadata?.userId) {
            filters.push({
                key: 'userId',
                value: metadata.userId,
            })
        }
        const nearMemoryGroups = await Promise.all(newMemories.map(async m => {
            const nearMemory = (await this.VectorStore.searchMemories({
                queryString: m.quote,
                limit: 1,
                mode: 'nearText',
                filters,
                includeNullWithFilter: true,
            }))?.[0]

            if ((nearMemory?.score || 0) < 0.8) {
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
                    memoryGroup.nearMemory.memory,
                )
                const { structuredResponse, tokenUsage, model } = await this.LLM.generateInference({
                    responseSchema,
                    messages,
                    systemMessage,
                })
                this.tokenUsage.trackInference(tokenUsage, model)

                // log stale memory ID in vector db to delete
                staleMemoryIds.push(memoryGroup.nearMemory.uuid)

                if (!structuredResponse) {
                    return
                }

                // add userId and groupId onto new/updated memories preserving original values
                return [
                    {
                        ...structuredResponse.originalMemory,
                        userId: memoryGroup.nearMemory.memory.userId || null,
                        groupId: memoryGroup.nearMemory.memory.groupId || null,
                    },
                    ...(structuredResponse?.newMemory ? [{
                        ...structuredResponse.newMemory,
                        userId: metadata?.userId || null,
                        groupId: metadata?.groupId || null,
                    }] : []),
                ]
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

    // Fetch all core memories
    async fetchCoreMemories () {
        const coreMemories = await this.VectorStore.fetchMemories({ filter: { key: 'isCore', value: true } })

        return coreMemories.map(cm => cm.summary)
    }

    // Search memory based on a search string and return top N relevant memories
    async searchMemories (params: { 
        queryString: string
        limit?: number
        alpha?: number 
        groupId?: string | number
        userId?: string | number
    }) {
        const { queryString, limit, alpha } = params
        const filters: { key: keyof Memory; value: string | boolean }[] = []
        if (params?.groupId) {
            filters.push({
                key: 'groupId',
                value: String(params.groupId),
            })
        }
        if (params?.userId) {
            filters.push({
                key: 'userId',
                value: String(params.userId),
            })
        }

        const vectorStoreResults = await this.VectorStore.searchMemories({
            queryString,
            limit: limit ?? 5,
            mode: 'hybrid',
            alpha: alpha || 0.5,
            filters,
        })
        
        return vectorStoreResults
    }
}
