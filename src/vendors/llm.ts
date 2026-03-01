import { ZodObject, ZodType } from 'zod'
import { GenerateInference, GenericMessage, TextBlock, Tool, ToolUseBlock } from './types'

/**
 * Helper class interface definition for LLM implementations
 */
export interface ILLM {
    generativeModel: string

    generateInference: GenerateInference
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
    processToolUsage <T extends ZodObject> (params: { 
        toolUseBlocks: ToolUseBlock[]
        inferenceGenerationConfig: {
            responseSchema: T
            messages: GenericMessage[]
            systemMessage: string
            tools: Tool[]
        }
        continueGenerationAfterProcessing?: boolean
    }) {
        const { inferenceGenerationConfig, toolUseBlocks, continueGenerationAfterProcessing } = params

        // process each tool use block
        const toolRequestPromises = toolUseBlocks.map(async tub => {
            if (tub.name === 'search_memories') {

            }
        })

        // pass results back to model to continue generation (if requested)
        if (continueGenerationAfterProcessing) {

        }
    }
}