import { vi } from 'vitest'

// ── Weaviate mocks ──────────────────────────────────────────────────────────
export const mockInsertMany = vi.fn().mockResolvedValue({})
export const mockDeleteMany = vi.fn().mockResolvedValue({})
export const mockHybridQuery = vi.fn().mockResolvedValue({ objects: [] })
export const mockFetchObjects = vi.fn().mockResolvedValue({ objects: [] })
export const mockByProperty = vi.fn().mockReturnValue({
    equal: vi.fn().mockReturnValue({}),
    isNull: vi.fn().mockReturnValue({}),
})
export const mockByIdContainsAny = vi.fn().mockReturnValue({})
export const mockWeaviateCollection = {
    data: {
        insertMany: mockInsertMany,
        deleteMany: mockDeleteMany,
    },
    query: {
        hybrid: mockHybridQuery,
        fetchObjects: mockFetchObjects,
    },
    filter: {
        byProperty: mockByProperty,
        byId: vi.fn().mockReturnValue({ containsAny: mockByIdContainsAny }),
    },
}

vi.mock('weaviate-client', () => {
    const mockConnectToWeaviateCloud = vi.fn().mockResolvedValue({
        collections: {
            exists: vi.fn().mockResolvedValue(true),
            get: vi.fn().mockReturnValue(mockWeaviateCollection),
            create: vi.fn().mockResolvedValue(mockWeaviateCollection),
        },
        close: vi.fn(),
    })

    return {
        default: {
            connectToWeaviateCloud: mockConnectToWeaviateCloud,
            ApiKey: vi.fn(),
            configure: {
                vectors: {
                    text2VecOpenAI: vi.fn().mockReturnValue({}),
                },
            },
        },
        Filters: {
            and: vi.fn((...args: unknown[]) => args),
            or: vi.fn((...args: unknown[]) => args),
        },
        dataType: {
            TEXT: 'text',
            TEXT_ARRAY: 'text[]',
            BOOLEAN: 'boolean',
        },
    }
})

// ── Pinecone mocks ──────────────────────────────────────────────────────────
export const mockPineconeUpsertRecords = vi.fn().mockResolvedValue({})
export const mockPineconeDeleteMany = vi.fn().mockResolvedValue({})
export const mockPineconeSearchRecords = vi.fn().mockResolvedValue({
    result: { hits: [] },
})
export const mockPineconeFetch = vi.fn().mockResolvedValue({ records: {} })
export const mockPineconeFetchByMetadata = vi.fn().mockResolvedValue({ records: {} })
export const mockPineconeListPaginated = vi.fn().mockResolvedValue({ vectors: [] })
export const mockPineconeIndex = {
    upsertRecords: mockPineconeUpsertRecords,
    deleteMany: mockPineconeDeleteMany,
    searchRecords: mockPineconeSearchRecords,
    fetch: mockPineconeFetch,
    fetchByMetadata: mockPineconeFetchByMetadata,
    listPaginated: mockPineconeListPaginated,
}

vi.mock('@pinecone-database/pinecone', () => ({
    Pinecone: class {
        index = vi.fn().mockReturnValue(mockPineconeIndex)
    },
}))

// ── OpenAI mock ─────────────────────────────────────────────────────────────
export const mockResponsesCreate = vi.fn()
export const mockEmbeddingsCreate = vi.fn()

vi.mock('openai', () => ({
    default: class {
        responses = { create: mockResponsesCreate }
        embeddings = { create: mockEmbeddingsCreate }
    },
}))

// ── Anthropic (Claude) mock ─────────────────────────────────────────────────
export const mockBetaMessagesCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
    default: class {
        beta = {
            messages: { create: mockBetaMessagesCreate },
        }
    },
}))

vi.mock('@anthropic-ai/sdk/helpers/beta/zod', () => ({
    betaZodOutputFormat: vi.fn().mockReturnValue({}),
}))

// ── Helpers ─────────────────────────────────────────────────────────────────
export const makeGptResponse = (text: string) => ({
    id: 'resp-1',
    output: [
        {
            type: 'message',
            id: 'msg-1',
            content: [{ type: 'output_text', text }],
        },
    ],
    usage: { input_tokens: 10, output_tokens: 20 },
})

export const makeClaudeResponse = (text: string) => ({
    id: 'msg-1',
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 20 },
})

export const makeGptToolUseResponse = (toolCalls: { name: string; id: string; arguments: string }[]) => ({
    id: 'resp-tool',
    output: toolCalls.map(tc => ({
        type: 'function_call',
        name: tc.name,
        call_id: tc.id,
        arguments: tc.arguments,
        id: tc.id,
    })),
    usage: { input_tokens: 15, output_tokens: 25 },
})

export const makeClaudeToolUseResponse = (toolCalls: { name: string; id: string; input: Record<string, unknown> }[]) => ({
    id: 'msg-tool',
    content: toolCalls.map(tc => ({
        type: 'tool_use',
        name: tc.name,
        id: tc.id,
        input: tc.input,
    })),
    stop_reason: 'tool_use',
    usage: { input_tokens: 15, output_tokens: 25 },
})
