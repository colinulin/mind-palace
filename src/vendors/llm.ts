import { ZodType } from 'zod'
import {
    GenerateInference,
    GenerateInferenceParams,
    GenerateInferenceReturn,
    TextBlock,
    ToolUseBlock,
    userRole,
} from './types'
import { MindPalace } from '../'

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
        MindPalace: MindPalace
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
        MindPalace: MindPalace
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
        MindPalace: MindPalace
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
        const {
            toolUseBlocks,
            MindPalace,
            continueGenerationAfterProcessing,
            tokenUsage,
        } = params

        const updatedTokenUsage = tokenUsage || {
            input: 0,
            output: 0,
        }

        // process all tool use blocks
        const toolUsePromises = toolUseBlocks.map(async block => {
            if (block.name === 'search_memories') {
                const toolInput = block.input as { query: string }
                const dataObjects = await MindPalace.Weaviate.searchMemories({
                    queryString: toolInput.query,
                    mode: 'hybrid',
                    limit: 10,
                })
                const memoryResults = dataObjects.objects.map(m => ({
                    summary: m.properties.summary,
                    source: m.properties.source,
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