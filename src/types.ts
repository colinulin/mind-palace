import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { ContentBlock } from './vendors/types'

export type Memory = {
    quote: string
    summary: string
    tags: string[]
    source: string
    term: 'long' | 'short'
    isCore: boolean
}

// Chat ingesting message types
export type IngestingMessage = {
    context: string | ContentBlock[]
} | {
    context: Anthropic.Beta.Messages.BetaMessage | Anthropic.Messages.Message
    llm: 'claude'
} | {
    context: OpenAI.Responses.Response
    llm: 'gpt'
} | {
    context: never
    llm: 'gemini'
}