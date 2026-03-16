import { describe, it, expect, vi, beforeEach } from 'vitest'
import type OpenAI from 'openai'
import type Anthropic from '@anthropic-ai/sdk'
import {
    mockResponsesCreate,
    mockBetaMessagesCreate,
    mockInsertMany,
    mockHybridQuery,
    mockPineconeSearchRecords,
    mockPineconeDeleteMany,
    mockPineconeUpsertRecords,
    makeGptResponse,
    makeClaudeResponse,
} from './mocks'
import MindPalace from '../../src/index'

const extractedMemoriesJson = (memories: { summary: string; term?: string; isCore?: boolean }[]) =>
    JSON.stringify({ memories })

describe('remember', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should extract and store memories with GPT + Weaviate using GPT-formatted context', async () => {
        const extractedMemories = [
            { summary: 'User prefers dark mode', term: 'long', isCore: false, quote: 'I always use dark mode' },
            { summary: 'User works at Acme Corp', term: 'long', isCore: true, quote: 'I work at Acme Corp' },
        ]

        // First call: extractMemories
        mockResponsesCreate.mockResolvedValueOnce(
            makeGptResponse(extractedMemoriesJson(extractedMemories)),
        )

        // searchMemories for each new memory (finding similar) - no matches
        mockHybridQuery.mockResolvedValue({ objects: [] })

        const mp = new MindPalace({
            llm: 'GPT',
            vectorStore: 'Weaviate',
            gptConfig: { apiKey: 'test-openai-key' },
            weaviateConfig: { apiKey: 'test-weaviate-key', clusterUrl: 'https://test.weaviate.cloud' },
        })

        // Pass GPT-formatted context (cast to satisfy SDK type; only fields used by
        // GPT.createGenericContentBlocks are needed at runtime)
        const gptMessages: OpenAI.Responses.ResponseCreateParamsNonStreaming['input'] = [
            {
                role: 'user',
                content: 'Tell me about your work experience.',
            },
        ]

        const result = await mp.remember(gptMessages)

        // Should have called LLM to extract memories
        expect(mockResponsesCreate).toHaveBeenCalled()

        // Should have searched for similar memories for each extracted memory
        expect(mockHybridQuery).toHaveBeenCalledTimes(2)

        // Should have inserted memories into Weaviate
        expect(mockInsertMany).toHaveBeenCalled()
        const insertedData = mockInsertMany.mock.calls[0][0]
        expect(insertedData).toHaveLength(2)
        expect(insertedData[0].properties.summary).toBe('User prefers dark mode')
        expect(insertedData[1].properties.summary).toBe('User works at Acme Corp')

        // Should return the updated memories
        expect(result).toHaveLength(2)
        expect(result[0].summary).toBe('User prefers dark mode')
        expect(result[1].summary).toBe('User works at Acme Corp')
    })

    it('should extract and store memories with Claude + Pinecone using Claude-formatted context', async () => {
        const extractedMemories = [
            { summary: 'User is learning Rust', term: 'short', isCore: false, quote: 'I am learning Rust' },
        ]

        // extractMemories call
        mockBetaMessagesCreate.mockResolvedValueOnce(
            makeClaudeResponse(extractedMemoriesJson(extractedMemories)),
        )

        // searchMemories for finding similar - returns a near match with high score
        const nearMatchTime = Date.now()
        mockPineconeSearchRecords.mockResolvedValueOnce({
            result: {
                hits: [{
                    _id: 'existing-uuid-1',
                    _score: 0.85,
                    fields: {
                        summary: 'User is interested in Rust programming',
                        term: 'long',
                        isCore: false,
                        userId: null,
                        groupId: null,
                        updatedAtUnix: nearMatchTime,
                        createdAtUnix: nearMatchTime - 100000,
                    },
                }],
            },
        })

        // merge LLM call (merging new memory with near match)
        mockBetaMessagesCreate.mockResolvedValueOnce(
            makeClaudeResponse(JSON.stringify({
                action: 'updated',
                existingMemory: {
                    summary: 'User is actively learning Rust programming',
                    term: 'long',
                    isCore: false,
                    quote: 'I am learning Rust',
                },
                newMemory: null,
            })),
        )

        const mp = new MindPalace({
            llm: 'Claude',
            vectorStore: 'Pinecone',
            claudeConfig: { apiKey: 'test-claude-key' },
            pineconeConfig: { apiKey: 'test-pinecone-key' },
        })

        // Pass Claude-formatted context
        const claudeMessages: Anthropic.Messages.MessageParam[] = [
                    {
                        role: 'user' as const,
                        content: [{
                            type: 'text' as const, 
                            text: 'What programming language should I use for my next project?' 
                        }]
                    },
                ]

        const result = await mp.remember(claudeMessages, {
            userId: 'user-42',
        })

        // Should have called Claude LLM twice: extract + merge
        expect(mockBetaMessagesCreate).toHaveBeenCalledTimes(2)

        // Should have searched for similar memories in Pinecone
        expect(mockPineconeSearchRecords).toHaveBeenCalledTimes(1)

        // Should delete the stale memory (existing-uuid-1) since action was 'updated'
        expect(mockPineconeDeleteMany).toHaveBeenCalledWith({
            ids: ['existing-uuid-1'],
        })

        // Should insert the updated/merged memory
        expect(mockPineconeUpsertRecords).toHaveBeenCalled()

        // Result should contain the merged memory
        expect(result).toHaveLength(1)
        expect(result[0].summary).toBe('User is actively learning Rust programming')
    })
})
