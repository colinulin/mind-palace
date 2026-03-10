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

    recall: (params: {
        context: string
        userId?: string
        groupId?: string
        queryVectorStoreDirectly?: boolean
        includeAllCoreMemories?: boolean
        limit?: number
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

    remember: (params: {
        context: string
        userId?: string
        groupId?: string
    }) => post<{
        memories: unknown[]
        tokenUsage: unknown
        logs: unknown[]
    }>('/remember', params),

    getTokenUsage: () =>
        get<{ tokenUsage: unknown }>('/token-usage'),

    getLogs: (since?: number) =>
        get<{ logs: unknown[] }>('/logs', since ? { since: String(since) } : undefined),

    reset: () =>
        post<{ success: boolean }>('/reset', {}),
}
