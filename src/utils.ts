import Anthropic from '@anthropic-ai/sdk'
import Claude from './vendors/claude'
import GPT from './vendors/gpt'
import { ContentBlock } from './vendors/types'
import { Content } from '@google/genai'
import Gemini from './vendors/gemini'
import { ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses.js'

/**
 * Chunk an array into groups for processing
 */
export const chunkArray = <T>(arr: T[], size: number): T[][] =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
        arr.slice(i * size, i * size + size),
    )

/**
 * Transform LLM input messages from GPT, Claude, or Gemini and convert to standardized generic content blocks
 */
export const transformLLMMessagesToGenericBlocks = (params: {
    messages: Anthropic.Beta.Messages.BetaMessageParam[] | Anthropic.Messages.MessageParam[]
    format: 'Claude'
} | {
    messages: ResponseCreateParamsNonStreaming['input']
    format: 'GPT'
} | {
    messages: Content[]
    format: 'Gemini'
}): ContentBlock[] => {
    const { messages, format } = params

    if (format === 'GPT') {
        return GPT.createGenericContentBlocksFromInput(messages)
    }
    if (format === 'Claude') {
        return Claude.createGenericContentBlocksFromInput(messages)
    }
    if (format === 'Gemini') {
        return Gemini.createGenericContentBlocksFromInput(messages)
    }

    return []
}
