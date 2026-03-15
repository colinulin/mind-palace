import Anthropic from '@anthropic-ai/sdk'
import Claude from './vendors/claude'
import GPT from './vendors/gpt'
import { ContentBlock } from './vendors/types'
import { Content } from '@google/genai'
import Gemini from './vendors/gemini'
import { ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses.js'
import { InputContext } from './types'

/**
 * Chunk an array into groups for processing
 */
export const chunkArray = <T>(arr: T[], size: number): T[][] =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
        arr.slice(i * size, i * size + size),
    )

/**
 * Transform LLM input context to standardized generic content blocks
 */
export const convertInputToContext = (params: {
    context: InputContext
    format?: 'Claude' | 'GPT' | 'Gemini'
}): ContentBlock[] | string[] | string => {
    const { context, format } = params

    // Context is string or string array just return
    if (
        typeof context === 'string' 
        || (Array.isArray(context) && context.every(i => typeof i === 'string'))
    ) {
        return context
    }

    // Custom LLM format conversions
    if (format === 'GPT') {
        return GPT.createGenericContentBlocksFromInput(
            context as ResponseCreateParamsNonStreaming['input'],
        )
    }
    if (format === 'Claude') {
        return Claude.createGenericContentBlocksFromInput(
            context as Anthropic.Beta.Messages.BetaMessageParam[] | Anthropic.Messages.MessageParam[],
        )
    }
    if (format === 'Gemini') {
        return Gemini.createGenericContentBlocksFromInput(
            context as Content[],
        )
    }

    return []
}
