import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { ContentBlock } from './vendors/types'
import * as Gemini from '@google/genai'

// Logger types
export type LogLevel = 'off' | 'error' | 'info' | 'debug'
export type LogType = 'info' | 'error' | 'warn' | 'debug'

// Memory
export type MemoryConfig = {
    includeQuote?: boolean
    includeSource?: boolean
    includeTags?: boolean
    includeTerm?: boolean
    includeCore?: boolean
    tags?: string[]
}
export type Memory = {
    quote?: string | undefined
    summary: string
    tags?: string[] | undefined
    source?: string | undefined
    term?: 'long' | 'short'
    isCore?: boolean | undefined
    userId: string | null
    groupId: string | null
}

// Chat ingesting message types
export type IngestingMessage = {
    context: string | string[] | ContentBlock[]
} | {
    context: Anthropic.Beta.Messages.BetaMessageParam[] | Anthropic.Messages.MessageParam[]
    contextFormat: 'Claude'
} | {
    context: OpenAI.Responses.ResponseCreateParamsNonStreaming['input']
    contextFormat: 'GPT'
} | {
    context: Gemini.Content[]
    contextFormat: 'Gemini'
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
