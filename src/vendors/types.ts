import { output, ZodType } from 'zod'
import { Tool as AnthropicTool } from '@anthropic-ai/sdk/resources/messages'

// Type for prompt messages role field
export const userRole = 'user' as const
export const assistantRole = 'assistant' as const

// Generic Content Blocks
export type TextBlock = {
    id?: string
    text: string
    type: 'text'
}
export type ThinkingBlock = {
    signature: string
    thinking: string
    type: 'thinking'
}
export type ToolUseBlock = {
    type: 'tool_use'
    name: string
    id: string
    input: Record<string, unknown>
}
export type ToolResultBlock = {
    id: string
    type: 'tool_result'
    content: string | TextBlock[]
    isError?: boolean
}
export type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock
export type GenericMessage = {
    role: typeof userRole | typeof assistantRole
    content: string | ContentBlock[]
}
export type StopReason = string | null

// Generic Tool Use blocks
export type Tool = {
    name: string
    parameters: AnthropicTool.InputSchema
    strict?: boolean
    description: string
}
export type ToolChoice = 'auto' | 'any' | 'none' | { name: string }

// Generic Inference Generation
export type GenerateInferenceParams<U extends ZodType<Record<string, unknown>>> = {
    model?: string
    systemMessage: string
    messages: GenericMessage[]
    responseSchema: U
    tools?: Tool[]
    toolChoice?: ToolChoice
    maxTokens?: number
}
export type GenerateInferenceReturn<T extends Record<string, unknown>, U extends ZodType<T>> = {
    response: {
        contentBlocks: ContentBlock[]
        stopReason: StopReason
    }
    structuredResponse: output<U> | null
    tokenUsage: {
        input: number
        output: number
    }
    model: string
}
export type GenerateInference<T extends Record<string, unknown>, U extends ZodType<T>> = (
    params: GenerateInferenceParams<U>
) => Promise<GenerateInferenceReturn<T, U>>
