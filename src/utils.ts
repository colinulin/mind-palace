import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import Claude from './vendors/claude'
import GPT from './vendors/gpt'
import { ContentBlock } from './vendors/types'

/**
 * Chunk an array into groups for processing
 */
export const chunkArray = <T>(arr: T[], size: number): T[][] =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
        arr.slice(i * size, i * size + size),
    )

/**
 * Transform LLM messages from GPT, Claude, or Gemini and convert to standardized generic content block
 */
export const transformLLMMessagesToGenericBlocks = (params: {
    messages: Anthropic.Beta.Messages.BetaMessage | Anthropic.Messages.Message
    llm: 'claude'
} | {
    messages: OpenAI.Responses.Response
    llm: 'gpt'
}): ContentBlock[] => {
    const { messages, llm } = params

    if (llm === 'gpt') {
        return GPT.createGenericContentBlocks(messages)
    }
    if (llm === 'claude') {
        return Claude.createGenericContentBlocks(messages)
    }
    if (llm === 'gemini') {
        // TODO: Implement
    }

    return []
}
