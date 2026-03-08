import { describe, expect, test } from 'vitest'
import MindPalace from '../../src/index'

const openaiApiKey = process.env.OPENAI_API_KEY || ''
const weaviateApiKey = process.env.WEAVIATE_API_KEY || ''
const weaviateClusterUrl = process.env.WEAVIATE_CLUSTER_URL || ''
const pineconeApiKey = process.env.PINECONE_API_KEY || ''
const geminiApiKey = process.env.GEMINI_API_KEY || ''
const anthropicApiKey = process.env.ANTHROPIC_API_KEY || ''

describe('GPT + Weaviate', () => {
    test('New session with no memories to start', async () => {
        const mp = new MindPalace({
            llm: 'GPT',
            vectorStore: 'Weaviate',
            gptConfig: {
                apiKey: openaiApiKey,
            },
            weaviateConfig: {
                apiKey: weaviateApiKey,
                clusterUrl: weaviateClusterUrl,
            }
        })

        const newMemories = await mp.remember({
            context: 'My name is Colin and I\'m a developer. I like the color blue and riding my bike.'
        })

        const retrievedMemories = await mp.recall({
            context: 'What should I do today?'
        })
    })
})

describe('GPT + Pinecone', () => {
    test('New session with no memories to start', async () => {
        const mp = new MindPalace({
            llm: 'GPT',
            vectorStore: 'Pinecone',
            gptConfig: {
                apiKey: openaiApiKey,
            },
            pineconeConfig: {
                apiKey: pineconeApiKey,
            }
        })

        const newMemories = await mp.remember({
            context: 'My name is Colin and I\'m a developer. I like the color blue and riding my bike.'
        })

        const retrievedMemories = await mp.recall({
            context: 'What should I do today?'
        })
    })
})

describe('Gemini + Pinecone', () => {
    test('New session with no memories to start', async () => {
        const mp = new MindPalace({
            llm: 'Gemini',
            vectorStore: 'Pinecone',
            geminiConfig: {
                apiKey: geminiApiKey,
            },
            pineconeConfig: {
                apiKey: pineconeApiKey,
            }
        })

        const newMemories = await mp.remember({
            context: 'My name is Colin and I\'m a developer. I like the color blue and riding my bike.'
        })

        const retrievedMemories = await mp.recall({
            context: 'What should I do today?'
        })

        console.log(retrievedMemories)
    })
})

describe('Claude + Pinecone', () => {
    test('New session with no memories to start', async () => {
        const mp = new MindPalace({
            llm: 'Claude',
            vectorStore: 'Pinecone',
            claudeConfig: {
                apiKey: anthropicApiKey,
            },
            pineconeConfig: {
                apiKey: pineconeApiKey,
            }
        })

        const newMemories = await mp.remember({
            context: 'My name is Colin and I\'m a developer. I like the color blue and riding my bike.'
        })

        const retrievedMemories = await mp.recall({
            context: 'What should I do today?'
        })

        console.log(retrievedMemories)
    })
})