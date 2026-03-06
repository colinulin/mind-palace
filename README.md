# Mind Palace
Mind Palace is a drop-in memory storage for LLM-enabled features with smart storage, maintenance, and retrieval. It is strongly typed, easy to implement, and has built-in support for major LLMs and Vector Stores. Upgrade your AI chat or other generative AI feature with persistent and scaleable memory. How does it work?
1. After a chat session or inference generation, call `mp.remember()` to mine the messages for important information.
2. Mined data is transformed and stored in a Vector store ([Pinecone](https://pinecone.io) and [Weaviate](https://weaviate.io/) are supported natively).
3. Before processing the next LLM request, call `mp.recall()` to intelligently find memories that provide important context for the given request. Additionally, "core" memories (memories that contain information that is relevant to all LLM requests) are also returned.
4. Include 

Behind the scenes, memories are being deduplicated, short-term memories are becoming stale and being removed, and metadata is being automatically generated that helps improve memory storage and retrieval and ensure every chat session and LLM call has the context it needs.

## Quick Setup
1. If you just wanted to jump in and start testing, first acquire an OpenAI API Key and a Weaviate API Key. 
2. Next, initialize the Mind Palace class.
```ts
const mp = new MindPalace({
    gptConfig: {
        apiKey: YOUR_OPENAI_API_KEY,
    },
    weaviateConfig: {
        apiKey: YOUR_WEAVIATE_API_KEY,
        clusterUrl: REST_ENDPOINT_FOR_WEAVIATE_CLUSTER,
    },
})
```
3. Before running your LLM inference generation, pass the user request and any relevant request context to your MindPalace class.
```ts
const userRequest = 'Can you help me write an email to my boss so I can get a raise?'
const memories = await mp.recall({
    context: userRequest,
})
```
4. Pass the response from `recall()` at the beginning of your inference generation messages.
```ts
const response = await openaiClient.responses.create({
    model: "gpt-5.4",
    input: [
        {
            role: 'user',
            content: memories.message,
        },
        {
            role: 'user',
            content: userRequest,
        }
    ]
})
```
5. After the LLM session is complete, pass the session back to the MindPalace class so it can pull out and store any new important information for next time.
```ts
mp.remember({
    context: response.output
})
```

*NOTE:* You can let this call happen asynchronously by omitting the `await`
*NOTE 2:* It's a good idea to filter out extraneous content and content that you always include at the beginning of every session before you pass the data to the MindPalace class. The point of the MindPalace is to store information that can be learned from user interaction with the LLM.

### Complete Example Code
```ts
import MindPalace from 'mind-palace'
import OpenAI from 'openai'

const makeAIRequest = async (userRequest: string) => {
    const mp = new MindPalace({
        gptConfig: {
            apiKey: YOUR_OPENAI_API_KEY,
        },
        weaviateConfig: {
            apiKey: YOUR_WEAVIATE_API_KEY,
            clusterUrl: REST_ENDPOINT_FOR_WEAVIATE_CLUSTER,
        },
    })

    const memories = await mp.recall({
        context: userRequest,
    })
    const response = await openaiClient.responses.create({
        model: "gpt-5.4",
        input: [
            {
                role: 'user',
                content: memories.message,
            },
            {
                role: 'user',
                content: userRequest,
            }
        ]
    })
    mp.remember({
        context: response.output
    })

    return response
}

makeAIRequest('Can you help me write an email to my boss so I can get a raise?')
```

## Configuration
### `new MindPalace(config)`
| Parameter | Type | Description | Options |
|-|-|-|-|
|`llm`|`string`|Name of the LLM if using a built-in LLM integration (defaults to `GPT`).|`Claude` &#124; `GPT` &#124; `Gemini`|
|`vectorStore`|`string`|Name of the Vector Store if using a built-in Vector Store integration (defaults to `Weaviate`).|`Pinecone` &#124; `Weaviate`|
|`claudeConfig?`|`object`|Configuration for Claude LLM. Required if using Claude.|`{}`|
|`claudeConfig?.apiKey`|`string`|API key for Claude.|`string`|
|`claudeConfig?.generativeModel?`|`string`|Generative model to use for all text generation (defaults to `claude-haiku-4-5`). Available models can be found in the [Claude API docs](https://platform.claude.com/docs/en/about-claude/models/overview).|`string`|
|`gptConfig?`|`object`|Configuration for GPT LLM. Required of using GPT and/or using Weaviate as your vector store.|`{}`|
|`gptConfig?.apiKey`|`string`|API key for GPT.|`string`|
|`gptConfig?.generativeModel?`|`string`|Generative model to use for all text generation (defaults to `gpt-5-mini`). Available models can be found in the [OpenAI docs](https://developers.openai.com/api/docs/models).|`string`|
|`gptConfig?.embeddingModel?`|`object`|Embedding model to use for all embedding generation (defaults to `text-embedding-3-large`). Available models can be found in the [OpenAI API docs](https://developers.openai.com/api/docs/models).|`string`|
|`geminiConfig?`|`object`|Configuration for Gemini LLM. Required if using Gemini.|`{}`|
|`geminiConfig?.apiKey`|`string`|API key for Gemini.|`string`|
|`geminiConfig?.generativeModel?`|`string`|Generative model to use for all text generation (defaults to `gemini-3-flash-preview`). Available models can be found in the [Gemini API docs](https://ai.google.dev/gemini-api/docs/models).|`string`|
|`weaviateConfig?`|`object`|Configuration for Weaviate. This is the default Vector Store service used.|`{}`|
|`weaviateConfig?.apiKey`|`string`|API key for Weaviate.|`string`|
|`weaviateConfig?.clusterUrl`|`string`|Cluster URL for Weaviate.|`string`|
|`weaviateConfig?.collectionName?`|`string`|Name of collection in Weaviate for storing memories (defaults to `MindPalace`).|`string`|
|`pineconeConfig?`|`object`|Configuration for Pinecone.|`{}`|
|`pineconeConfig?.apiKey`|`string`|API key for Pinecone.|`string`|
|`pineconeConfig?.indexName?`|`string`|Name of index in Pinecone for storing memories (defaults to `mind-palace`)|`string`|
|`pineconeConfig?.embeddingModel?`|`string`|Pinecone has built-in embedding generation so you can choose which model to use here (defaults to `multilingual-e5-large`).|`string`|
|`tags?`|`array[]`|Array of tags used for memory organization. A memory can be assigned multiple tags. Default: `[ 'database schema', 'response formatting', 'code style', 'institutional knowledge' ]`|`string[]`|

#### Example
```ts
new MindPalace({
    llm: 'GPT',
    vectorStore: 'Weaviate',
    gptConfig: {
        apiKey: 'sk-proj-f38u38uf3289f89f8f3',
    },
    weaviateConfig: {
        apiKey: 'FAKEapiKEYhere123',
        clusterUrl: 'someclusterurl.c2.us-east1.gcp.weaviate.cloud',
    },
    tags: [ 'database schema', 'response formatting', 'code style', 'institutional knowledge' ]
})
```

### `recall()`
| Parameter | Type | Description | Options |
|-|-|-|-|

### `remember()`
| Parameter | Type | Description | Options |
|-|-|-|-|