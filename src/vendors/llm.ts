import { ZodType } from 'zod'
import {
    GenerateInferenceParams,
    GenerateInferenceReturn,
    TextBlock,
} from './types'

/**
 * Helper class interface definition for LLM implementations.
 *
 * Note: All implementations also share a static `createGenericContentBlocks` method
 * and protected methods for converting generic tools/messages to vendor-specific formats,
 * but TypeScript interfaces cannot enforce static or protected members.
 */
export interface ILLM {
    defaultRecallModel: string
    defaultRememberModel: string

    generateInference: <T extends Record<string, unknown>, U extends ZodType<T>>(
        params: GenerateInferenceParams<U>,
    ) => Promise<GenerateInferenceReturn<T, U>>

    extractStructuredReturn: <T extends Record<string, unknown>, U extends ZodType<T>>(
        textBlock: TextBlock,
        responseFormat: U,
    ) => T
}

/**
 * Parent class for LLM implementations
 */
export abstract class LLM {
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
}
