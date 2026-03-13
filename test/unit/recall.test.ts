import { describe, it, expect, vi, beforeEach } from 'vitest'
import type OpenAI from 'openai'
import type Anthropic from '@anthropic-ai/sdk'
import {
    mockResponsesCreate,
    mockBetaMessagesCreate,
    mockHybridQuery,
    mockPineconeSearchRecords,
    makeGptResponse,
    makeClaudeResponse,
} from './mocks'
import MindPalace from '../../src/index'

describe('recall', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should recall memories with Claude + Pinecone using Claude-formatted context', async () => {
        // recall flow: generateInference (memorySearchQueries) →
        //   → VectorStore.searchMemories → return formatted memories

        // LLM call: returns structured search queries
        mockBetaMessagesCreate.mockResolvedValueOnce(
            makeClaudeResponse(JSON.stringify({ queries: ['favorite programming language', 'coding preferences'] })),
        )

        // VectorStore.searchMemories returns matching memories from Pinecone
        const searchTime = Date.now()
        mockPineconeSearchRecords
            .mockResolvedValueOnce({
                result: {
                    hits: [
                        {
                            _id: 'mem-uuid-1',
                            _score: 0.92,
                            fields: {
                                summary: 'User loves TypeScript',
                                source: 'chat',
                                term: 'long',
                                isCore: false,
                                userId: null,
                                groupId: null,
                                updatedAtUnix: searchTime,
                                createdAtUnix: searchTime - 50000,
                            },
                        },
                        {
                            _id: 'mem-uuid-2',
                            _score: 0.88,
                            fields: {
                                summary: 'User prefers functional programming',
                                source: 'chat',
                                term: 'long',
                                isCore: true,
                                userId: null,
                                groupId: null,
                                updatedAtUnix: searchTime,
                                createdAtUnix: searchTime - 30000,
                            },
                        },
                    ],
                },
            })
            .mockResolvedValueOnce({
                result: {
                    hits: [
                        {
                            _id: 'mem-uuid-1',
                            _score: 0.80,
                            fields: {
                                summary: 'User loves TypeScript',
                                source: 'chat',
                                term: 'long',
                                isCore: false,
                                userId: null,
                                groupId: null,
                                updatedAtUnix: searchTime,
                                createdAtUnix: searchTime - 50000,
                            },
                        },
                    ],
                },
            })

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

        const result = await mp.recall({
            context: claudeMessages,
            contextFormat: 'Claude',
        })

        // Should have called Claude LLM once to generate search queries
        expect(mockBetaMessagesCreate).toHaveBeenCalledTimes(1)

        // Should have searched Pinecone for memories
        expect(mockPineconeSearchRecords).toHaveBeenCalled()

        // Should return formatted message containing memories
        expect(result.message).toContain('<memory_context>')
        expect(result.message).toContain('User loves TypeScript')
        expect(result.message).toContain('User prefers functional programming')
        expect(result.message).toContain('</memory_context>')

        // Should return the memory objects
        expect(result.memories).toHaveLength(2)
        expect(result.memories[0].summary).toBe('User loves TypeScript')
        expect(result.memories[1].summary).toBe('User prefers functional programming')
    })

    it('should recall memories with GPT + Weaviate using GPT-formatted context', async () => {
        // LLM call: returns structured search queries
        mockResponsesCreate.mockResolvedValueOnce(
            makeGptResponse(JSON.stringify({ queries: ['user work details', 'employer info'] })),
        )

        // VectorStore.searchMemories returns matching memories from Weaviate
        mockHybridQuery
            .mockResolvedValueOnce({
                objects: [
                    {
                        uuid: 'wv-mem-1',
                        properties: {
                            summary: 'User works at Acme Corp as a senior engineer',
                            source: 'onboarding',
                            term: 'long',
                            isCore: true,
                        },
                        metadata: {
                            score: 0.95,
                            creationTime: new Date(),
                            updateTime: new Date(),
                        },
                    },
                ],
            })
            .mockResolvedValueOnce({
                objects: [
                    {
                        uuid: 'wv-mem-1',
                        properties: {
                            summary: 'User works at Acme Corp as a senior engineer',
                            source: 'onboarding',
                            term: 'long',
                            isCore: true,
                        },
                        metadata: {
                            score: 0.85,
                            creationTime: new Date(),
                            updateTime: new Date(),
                        },
                    },
                ],
            })

        const mp = new MindPalace({
            llm: 'GPT',
            vectorStore: 'Weaviate',
            gptConfig: { apiKey: 'test-openai-key' },
            weaviateConfig: { apiKey: 'test-weaviate-key', clusterUrl: 'https://test.weaviate.cloud' },
        })

        // Pass GPT-formatted context
        const gptMessages: OpenAI.Responses.ResponseCreateParamsNonStreaming['input'] = [
            {
                role: 'user',
                content: 'Tell me about your work experience.',
            },
        ]

        const result = await mp.recall({
            context: gptMessages,
            contextFormat: 'GPT',
        })

        // Should have called GPT LLM once to generate search queries
        expect(mockResponsesCreate).toHaveBeenCalledTimes(1)

        // Should have searched Weaviate via hybrid query
        expect(mockHybridQuery).toHaveBeenCalled()

        // Should return formatted message containing the memory
        expect(result.message).toContain('<memory_context>')
        expect(result.message).toContain('User works at Acme Corp as a senior engineer')
        expect(result.message).toContain('[onboarding, long-term]')
        expect(result.message).toContain('</memory_context>')

        // Should return memory objects
        expect(result.memories).toHaveLength(1)
        expect(result.memories[0].summary).toBe('User works at Acme Corp as a senior engineer')
        expect(result.memories[0].isCore).toBe(true)
    })
})
