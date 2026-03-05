import { expect, test } from 'vitest'
import MindPalace from '../../src/index'

const openaiApiKey = process.env.OPENAI_API_KEY || ''
const weaviateApiKey = process.env.WEAVIATE_API_KEY || ''
const weaviateClusterUrl = process.env.WEAVIATE_CLUSTER_URL || ''

test('Basic memory storage functionality', () => {
    test('New session with no memories', () => {
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
            context: 
        })
    })
})