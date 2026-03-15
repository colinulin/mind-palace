import Claude from './vendors/claude'
import GPT from './vendors/gpt'
import responseSchemas from './responseSchemas'
import prompts from './prompts'
import TokenCounter from './tokenCounter'
import { InputContext, LLMName, Memory, MemoryConfig, VectorMetadata } from './types'
import Weaviate from './vendors/weaviate'
import { chunkArray, convertInputToContext } from './utils'
import logger from './logger'
import Pinecone from './vendors/pinecone'
import Gemini from './vendors/gemini'
import { ILLM } from './vendors/llm'
import { IVectorStore } from './vendors/vectorStore'

/**
 * Core Mind Palace functionality
 */
export default class MPCore {
    memoryConfig!: MemoryConfig
    tokenUsage = new TokenCounter()

    // Vector Stores
    VectorStore!: Weaviate | Pinecone | IVectorStore
    protected Weaviate: Weaviate | undefined
    protected Pinecone: Pinecone | undefined

    // LLMs
    llmName!: LLMName
    LLM!: Claude | GPT | Gemini | ILLM
    protected Claude: Claude | undefined
    protected GPT: GPT | undefined
    protected Gemini: Gemini | undefined

    // Extract memories from context
    protected async extractMemories (rawContext: InputContext, config: { model?: string; userId?: string }) {
        const context = convertInputToContext({ 
            context: rawContext, 
            format: this.llmName,
        })

        logger.info({ label: 'MindPalace', message: 'Beginning memory extraction.' })

        const responseSchema = responseSchemas.extractedMemories(this.memoryConfig)
        const { messages, systemMessage } = prompts.memoryExtraction(context, config.userId)
        const { structuredResponse, tokenUsage, model } = await this.LLM.generateInference({
            responseSchema,
            messages,
            systemMessage,
            model: config.model || this.LLM.defaultRememberModel,
            reasoningLevel: 'medium',
        })
        this.tokenUsage.trackInference(tokenUsage, model)

        logger.debug({ label: 'MindPalace', metadata: structuredResponse })
        logger.info({ label: 'MindPalace', message: 'Memory extraction complete.' })

        return structuredResponse?.memories || []
    }

    // Find relevant memories to include in a chat
    protected async findRelevantMemories (rawContext: InputContext, config: {
        groupId?: string
        userId?: string
        queryVectorStoreDirectly?: boolean
        limit?: number
        includeAllCoreMemories?: boolean
        maxHoursShortTermLength?: number
        model?: string
    }) {
        const context = convertInputToContext({ 
            context: rawContext, 
            format: this.llmName,
        })
        
        // if not querying vector store directly, use LLM to generate query strings
        let memorySearchQueries = typeof context === 'string' ? [ context ] : context as string[]
        if (!config.queryVectorStoreDirectly) {
            const { messages, systemMessage } = prompts.relevantMemorySearch(context)
            const responseSchema = responseSchemas.memorySearchQueries()
            const generationConfig = {
                responseSchema,
                messages,
                systemMessage,
                model: config.model || this.LLM.defaultRecallModel,
                reasoningLevel: 'off' as const,
            }
            const { structuredResponse, tokenUsage, model } = await this.LLM.generateInference(generationConfig)
            this.tokenUsage.trackInference({
                input: tokenUsage.input,
                output: tokenUsage.output,
            }, model)

            if (!structuredResponse?.queries) {
                return []
            }
            
            memorySearchQueries = structuredResponse.queries
        }
        
        // query vector store
        const memorySearchPromise = this.VectorStore.searchMemories({
            queryStrings: memorySearchQueries,
            limit: config.limit ?? 10,
            mode: 'nearText',
            groupId: config.groupId,
            userId: config.userId,
            // if including all core memories, we'll fetch them in a separate query so omit them from this query
            omitCoreMemories: !!config.includeAllCoreMemories,
            maxHoursShortTermLength: config.maxHoursShortTermLength,
        })

        // if including all core memories, do a separate core memory fetch
        const coreMemoryPromise = config.includeAllCoreMemories
            ? this.fetchCoreMemories({ userId: config.userId })
            : undefined
        const allMemories = await Promise.all([
            memorySearchPromise,
            coreMemoryPromise,
        ])

        // flatten arrays of memories into a single array
        const memories = allMemories.flat().reduce((acc, m) => {
            if (!m) {
                return acc
            }

            acc.push('memory' in m ? m.memory : m)
            
            return acc
        }, new Array<Memory>())

        // return memories
        logger.debug({ label: 'MindPalace', metadata: memories })
        logger.info({ label: 'MindPalace', message: 'Fetched relevant memories.' })

        return memories
    }

    // Find and merge similar memories in vector store
    protected async findAndMergeNewMemories (
        params: { newMemories: Memory[]; model?: string },
        metadata?: VectorMetadata,
    ) {
        // iterate over all new memories searching for highly similar ones already in the vector db
        const nearMemoryGroups = await Promise.all(params.newMemories.map(async m => {
            const nearMemory = (await this.VectorStore.searchMemories({
                queryStrings: [ m.summary ],
                limit: 1,
                mode: 'nearText',
                groupId: metadata?.groupId,
                userId: metadata?.userId,
            }))?.[0]

            // if no memories in vector store are at least 0.5 relevancy, assume no similar memories
            if ((nearMemory?.score || 0) < 0.5) {
                return {
                    newMemory: m,
                }
            }

            return {
                newMemory: m,
                nearMemory,
            }
        }))

        // process new memories with their similar counterparts for deduping
        // process 10 at a time to prevent rate limiting
        const batchSize = 10
        const chunkedGroups = chunkArray(nearMemoryGroups.filter(nmg => !!nmg), batchSize)
        let updatedMemories: Memory[] = []
        const staleMemoryIds: string[] = []
        const responseSchema = responseSchemas.mergedMemories(this.memoryConfig)
        for (const cg of chunkedGroups) {
            const updatedGroup = await Promise.all(cg.map(async memoryGroup => {
                if (!memoryGroup.nearMemory) {
                    return [ memoryGroup.newMemory ]
                }

                // attempt to merge the memories and/or create a new
                const { messages, systemMessage } = prompts.memoryMerge(
                    memoryGroup.newMemory, 
                    memoryGroup.nearMemory.memory,
                    this.memoryConfig,
                )
                const { structuredResponse, tokenUsage, model } = await this.LLM.generateInference({
                    responseSchema,
                    messages,
                    systemMessage,
                    model: params.model || this.LLM.defaultRememberModel,
                })
                this.tokenUsage.trackInference(tokenUsage, model)

                // log stale memory ID in vector db to delete
                const action = structuredResponse?.action
                if (action === 'updated' || action === 'updated_and_created_new') {
                    staleMemoryIds.push(memoryGroup.nearMemory.uuid)
                }

                if (!structuredResponse || action === 'kept_as_is') {
                    return
                }

                // add userId and groupId onto new/updated memories preserving original values
                return [
                    {
                        ...structuredResponse.existingMemory,
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
    async fetchCoreMemories (params: { userId?: string; groupId?: string }) {
        const { userId, groupId } = params
        const coreMemories = await this.VectorStore.fetchMemoriesWithFilter(
            { 
                filters: [{ key: 'isCore', value: true }],
                userId,
                groupId,
            },
        )

        return coreMemories
    }
}
