import { ZodType } from 'zod'
import {
    GenerateInference,
    GenerateInferenceParams,
    GenerateInferenceReturn,
    TextBlock,
    ToolUseBlock,
    userRole,
} from './types'
import { Memory } from '../types'
import logger from '../logger'
import MPCore from '../mindPalace'

/**
 * Helper class interface definition for LLM implementations
 */
export interface ILLM {
    generativeModel: string

    generateInference: GenerateInference<Record<string, unknown>, ZodType<Record<string, unknown>>>
}

/**
 * Parent class for LLM implementations
 */
export class LLM {
    /**
     * Convert and validate structured return to object from JSON string
     */
    extractStructuredReturn <T extends Record<string, unknown>, U extends ZodType<T>> (
        textBlock: TextBlock,
        responseFormat: U,
    ) {
        const parsedJson = textBlock.text && JSON.parse(textBlock.text)
        const validatedReturn = responseFormat.parse(parsedJson)
    
        return validatedReturn
    }
        
    /**
     * If the final content block in a generation response is a tool, this method
     * processes that request and optionally kicks off another inference request
     * with the tool response.
     */
    // overload for not coninuing generation
    processToolUsage (params: { 
        toolUseBlocks: ToolUseBlock[]
        MindPalace: MPCore
        metadata?: { groupId?: string; userId?: string }
        continueGenerationAfterProcessing?: false
        tokenUsage?: {
            input: number
            output: number
        }
    }): Promise<
        {
            response: {
                summary: string
                source: string
            }[]
            toolName: string
            toolId: string
        }[]
    >
    // overload for continuing generation
    processToolUsage <T extends Record<string, unknown>, U extends ZodType<T>>(params: { 
        toolUseBlocks: ToolUseBlock[]
        MindPalace: MPCore
        metadata?: { groupId?: string; userId?: string }
        continueGenerationAfterProcessing: true
        generationConfig: GenerateInferenceParams<U>
        retries?: number
        retryLimit?: number // if we reach retryLimit, tools will be removed from next generation attempt
        stopTool?: string // when stopTool is used, method will stop and return results
        tokenUsage?: {
            input: number
            output: number
        }
    }): Promise<GenerateInferenceReturn<T, U>>
    // implementation
    async processToolUsage (params:  { 
        toolUseBlocks: ToolUseBlock[]
        MindPalace: MPCore
        metadata?: { groupId?: string; userId?: string }
        continueGenerationAfterProcessing?: boolean
        generationConfig?: GenerateInferenceParams<ZodType<Record<string, unknown>>>
        retries?: number
        retryLimit?: number // if we reach retryLimit, tools will be removed from next generation attempt
        stopTool?: string // when stopTool is used, method will stop and return results
        tokenUsage?: {
            input: number
            output: number
        }
    }) {
        logger.info({ label: 'LLM', message: 'Processing tool use block.' })
        
        const {
            toolUseBlocks,
            MindPalace,
            continueGenerationAfterProcessing,
            tokenUsage,
            metadata,
        } = params
        logger.debug({ label: 'LLM', metadata: toolUseBlocks })

        const updatedTokenUsage = tokenUsage || {
            input: 0,
            output: 0,
        }

        // setup metadata filters
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

        // process all tool use blocks
        const toolUsePromises = toolUseBlocks.map(async block => {
            if (block.name === 'search_memories') {
                const toolInput = block.input as { query: string }
                const dataObjects = await MindPalace.VectorStore.searchMemories({
                    queryString: toolInput.query,
                    mode: 'hybrid',
                    limit: 10,
                    filters,
                    includeNullWithFilter: true,
                })
                const memoryResults = dataObjects?.map(m => ({
                    summary: m.memory.summary,
                    source: m.memory.source,
                    uuid: m.uuid,
                }))

                return {
                    response: memoryResults,
                    toolName: block.name,
                    toolId: block.id,
                }
            }
        })
        const toolUseResponses = (await Promise.all(toolUsePromises)).filter(r => !!r)

        // if not rerunning generation with tool results, just return results
        if (!continueGenerationAfterProcessing) {
            return toolUseResponses
        }

        if (!params.generationConfig) {
            throw new Error('Unable to rerun generation without config.')
        }

        const {
            retries,
            retryLimit,
            generationConfig,
            stopTool,
        } = params

        // convert tool results to LLM format and rerun generation
        const llmToolResult = {
            role: userRole,
            content: toolUseResponses.map(r => ({
                type: 'tool_result' as const,
                id: r.toolId,
                content: JSON.stringify(r.response),
            })),
        }
        const {
            response,
            structuredResponse,
            tokenUsage: newTokenUsage, 
            model, 
        } = await MindPalace.LLM.generateInference({
            ...generationConfig,
            messages: [
                ...(generationConfig?.messages || []),
                {
                    role: userRole,
                    content: toolUseBlocks,
                },
                llmToolResult,
            ],
        })
        updatedTokenUsage.input += newTokenUsage?.input || 0
        updatedTokenUsage.output += newTokenUsage?.output || 0

        // if last message is NOT a tool_use block
        // OR we are out of retries
        // OR last tool_use included the stopTool, return response
        const newToolUseBlocks: ToolUseBlock[] = []
        response.contentBlocks.reverse()
        for (const block of response.contentBlocks) {
            if (block.type !== 'tool_use') {
                break
            }

            newToolUseBlocks.push(block)
        }
        if (
            !newToolUseBlocks.length
            || (retries || 0) >= (retryLimit || Infinity)
            || newToolUseBlocks.find(block => block.name === stopTool)
        ) {
            return {
                response,
                structuredResponse,
                tokenUsage: updatedTokenUsage,
                model,
            }
        }

        // otherwise, rerun tool processing
        return this.processToolUsage({
            toolUseBlocks: newToolUseBlocks,
            MindPalace,
            continueGenerationAfterProcessing,
            retries: (retries || 0) + 1,
            retryLimit,
            generationConfig,
            tokenUsage: updatedTokenUsage,
        })
    }
}
