const BASE_URL = '/api'

const post = async <T>(path: string, body: unknown): Promise<T> => {
    const response = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error(error.error || `Request failed: ${response.status}`)
    }

    return response.json()
}

const get = async <T>(path: string, params?: Record<string, string>): Promise<T> => {
    const url = params
        ? `${BASE_URL}${path}?${new URLSearchParams(params)}`
        : `${BASE_URL}${path}`

    const response = await fetch(url)

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error(error.error || `Request failed: ${response.status}`)
    }

    return response.json()
}

export const api = {
    initialize: (config: unknown) =>
        post<{ success: boolean }>('/initialize', { config }),

    recall: (params: Record<string, unknown> & {
        context: string
    }) => post<{
        result: { message: string; memories: unknown[] }
        tokenUsage: unknown
        logs: unknown[]
    }>('/recall', params),

    chat: (params: {
        messages: { role: string; content: string }[]
        systemMessage?: string
    }) => post<{
        response: string
        tokenUsage: unknown
        logs: unknown[]
    }>('/chat', params),

    remember: (params: Record<string, unknown> & {
        context: string
    }) => post<{
        memories: unknown[]
        tokenUsage: unknown
        logs: unknown[]
    }>('/remember', params),

    getTokenUsage: () =>
        get<{ tokenUsage: unknown }>('/token-usage'),

    getLogs: (since?: number) =>
        get<{ logs: unknown[] }>('/logs', since ? { since: String(since) } : undefined),

    addMemory: (params: { memory: Record<string, unknown> }) =>
        post<{ success: boolean }>('/memories/add', params),

    resolveMemory: (params: { summary: string; userId?: string; groupId?: string }) =>
        post<{ uuid: string; memory: unknown }>('/memories/resolve', params),

    editMemory: (params: { memoryId: string; summary: string }) =>
        post<{ success: boolean }>('/memories/edit', params),

    deleteMemory: (params: { memoryId: string }) =>
        post<{ success: boolean }>('/memories/delete', params),

    reset: () =>
        post<{ success: boolean }>('/reset', {}),
}
