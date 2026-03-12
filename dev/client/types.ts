export type ChatMessageType = 'user' | 'assistant' | 'recall' | 'remember' | 'system'

export type ChatMessage = {
    id: string
    type: ChatMessageType
    content: string
    timestamp: number
    memories?: MemoryEntry[]
    timings?: RequestTimings
}

export type MemoryEntry = {
    uuid?: string
    summary: string
    source?: string
    term?: string
    isCore?: boolean
    tags?: string[]
    quote?: string
    userId?: string | null
    groupId?: string | null
}

export type TokenUsageData = {
    inferences: {
        input?: number
        output?: number
        embeddingTokens?: number
        model: string
    }[]
    modelTotals: Record<string, { input: number; output: number; embeddingTokens: number }>
}

export type LogEntry = {
    timestamp: number
    level: string
    label: string
    message: string
    metadata?: unknown
}

export type SessionStatus = 'disconnected' | 'connected' | 'loading' | 'error'

export type RequestTimings = {
    recallMs?: number
    chatMs?: number
    rememberMs?: number
    totalMs: number
}
