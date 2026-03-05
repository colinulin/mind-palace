import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { ContentBlock } from './vendors/types'

// Logger types
export type LogLevel = 'off' | 'error' | 'info' | 'debug'
export type LogType = 'info' | 'error' | 'warn' | 'debug'

// Memory types
export type Memory = {
    quote: string
    summary: string
    tags: string[]
    source: string
    term: 'long' | 'short'
    isCore: boolean
    userId: string | null
    groupId: string | null
}

// Chat ingesting message types
export type IngestingMessage = {
    context: string | ContentBlock[]
} | {
    context: Anthropic.Beta.Messages.BetaMessage | Anthropic.Messages.Message
    llm: 'Claude'
} | {
    context: OpenAI.Responses.Response
    llm: 'GPT'
} | {
    context: never
    llm: 'Gemini'
}

// Metadata for vector store searching
export type VectorMetadata = {
    userId?: string
    groupId?: string
}

// LLM
export type LLMName = 'Claude' | 'GPT' | 'Gemini'

// Vector Store
export type VectorStoreName =  'Pinecone' | 'Weaviate'
