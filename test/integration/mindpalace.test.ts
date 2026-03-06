import { describe, expect, test } from 'vitest'
import MindPalace from '../../src/index'

const openaiApiKey = process.env.OPENAI_API_KEY || ''
const weaviateApiKey = process.env.WEAVIATE_API_KEY || ''
const weaviateClusterUrl = process.env.WEAVIATE_CLUSTER_URL || ''

describe('Basic memory storage functionality', () => {
    test.only('New session with no memories', async () => {
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

        // const newMemories = await mp.remember({
        //     context: 'My name is Colin and I\'m a developer at Pocket Prep. I hate when you use emdashes in your responses and dont like sycophancy. Make sure you only ever refer to me as sir. The Pocket Prep logo is blue.'
        // })

        const retrievedMemories = await mp.recall({
            context: 'What should I do today?'
        })
    })
})