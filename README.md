# Mind Palace
Mind Palace is a drop-in memory storage for LLM-enabled features with smart storage, maintenance, and retrieval. It is strongly typed, easy to implement, and has built-in support for major LLMs and Vector Stores. Upgrade your AI chat or other generative AI feature with persistent and scaleable memory. How does it work?
1. After a chat session or inference generation, call `mp.remember()` to mine the messages for important information. This is like saying to the LLM, "Hey! Remember this information!"
2. Mined data is transformed and stored as "memories" in a Vector store ([Pinecone](https://pinecone.io) and [Weaviate](https://weaviate.io/) are supported natively).
3. Before processing the next LLM request, call `mp.recall()` to intelligently find memories that provide important context for the given request. Additionally, "core" memories (memories that contain information that is relevant to all LLM requests) are also returned. This is like saying to the LLM, "Have we ever talked about anything related to this? Get me everything I should remember before I answer this request."
4. Include the `message` property returned by `recall()` before the user's message in the LLM request.

Behind the scenes, memories are being deduplicated, short-term memories are becoming stale and being removed, and metadata is being automatically generated that helps improve memory storage and retrieval and ensure every chat session and LLM call has the context it needs.

## Quick Setup
1. If you just wanted to jump in and start testing, first acquire an OpenAI API Key and a Weaviate API Key (these are just the default LLM and Vector Store but feel free to skip to the config section and setup Mind Palace with your preferred tools).
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
3. Before running your LLM inference generation, pass the user request and any relevant request context to your Mind Palace class.
```ts
const messages = [
    {
        role: 'user',
        content: 'Can you help me write an email to my boss so I can get a raise?'
    }
]
const memories = await mp.recall({
    context: userRequest,
    contextFormat: 'GPT'
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
        ...messages,
    ]
})
```
5. After the LLM session is complete, pass the messages from the session back to the Mind Palace class so it can pull out and store any new important information for next time.
```ts
mp.remember({
    context: messages,
    contextFormat: 'GPT'
})
```

*NOTE:* You can let this call happen asynchronously by omitting the `await`
*NOTE 2:* It's a good idea to filter out extraneous content and content that you always include at the beginning of every session before you pass the data to the Mind Palace class. The point of the Mind Palace is to store information that can be learned from user interaction with the LLM. Memories that were fetched with `recall()` are automatically filtered out!

### Complete Example Code
```ts
import MindPalace from 'mind-palace'
import OpenAI from 'openai'

const makeAIRequest = async (userRequest: string) => {
    const messages = [
        {
            role: 'user',
            content: userRequest,
        }
    ]

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
        contextFormat: 'GPT'
    })
    const response = await openaiClient.responses.create({
        model: "gpt-5.4",
        input: [
            {
                role: 'user',
                content: memories.message,
            },
            ...messages,
        ]
    })
    mp.remember({
        context: messages,
        contextFormat: 'GPT',
    })

    return response
}

makeAIRequest('Can you help me draft this email to my boss so I can get a raise?')
```


## Testing
If you would like to test drive the Mind Palace, experiment with different configurations, or try out different prompts, I've created a simple UI with a chat interface and debugging features that can be run directly from this project. To get started with the chat UI, clone this repo and then follow these steps:

1. In your shell, enter the following commands:
```sh
npm ci
npm run dev
``` 

2. In your console you should see the frontend and backend services startup. When they're ready, you'll see a message that says: "Mind Palace dev server running on http://localhost:62000". Navigate to http://localhost:61000 in your browser.

3. Fill out the configuration field with your preferred configuration and click "Initialize".
```js
/** Example */
{
  gptConfig: {
    apiKey: 'MY-API-KEY'
  },
  weaviateConfig: {
    apiKey: 'MY-WEAVIATE-API-KEY',
    clusterUrl: 'WEAVIATE-CLUSTER-URL'
  }
}
```

4. Start chatting! The chat will just use whatever config you entered to generate messages.

## Configuration
### `new MindPalace()`
|Parameter|Type|Description|Options|
|-|-|-|-|
|`llm?`|`string`|Name of the LLM if using a built-in LLM integration (defaults to `GPT`).|`Claude` &#124; `GPT` &#124; `Gemini`|
|`customLLM?`|`ILLM`|Implement your own custom LLM class to use other LLM providers.|See [Custom Classes](#custom-classes) section below|
|`vectorStore?`|`string`|Name of the Vector Store if using a built-in Vector Store integration (defaults to `Weaviate`).|`Pinecone` &#124; `Weaviate`|
|`customVectorStore?`|`IVectorStore`|Implement a custom Vector Store class to use other vector store providers.|See [Custom Classes](#custom-classes) section below|
|`claudeConfig?`|`object`|Configuration for Claude LLM. Required if using Claude.|`{}`|
|`claudeConfig?.apiKey`|`string`|API key for Claude.|`string`|
|`claudeConfig?.generativeModel?`|`string`|Generative model to use for all text generation (defaults to `claude-haiku-4-5`). Available models can be found in the [Claude API docs](https://platform.claude.com/docs/en/about-claude/models/overview).|`string`|
|`gptConfig?`|`object`|Configuration for GPT LLM. Required if using GPT and/or using Weaviate as your vector store.|`{}`|
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
|`pineconeConfig?.embeddingModel?`|`string`|Pinecone has built-in embedding generation so you can choose which model to use (defaults to `multilingual-e5-large`). See section on [Pinecone](#pinecone) for more information.|`string`|
|`memoryConfig?`|`object`|Configuration for memory storage including special properties and memory tags.|`MemoryConfig`|
|`memoryConfig?.includeQuote?`|`boolean`|If true, a passage from the conversation containing the memory information will be included on the memory. This greatly increases vector memory size and creation time but can be useful for validating memories (Default: `false`).|`boolean`|
|`memoryConfig?.includeSource?`|`boolean`|If true, a 1-5 word label identifying where the information orginated will be included on the memory object (Default: `false`).|`boolean`|
|`memoryConfig?.includeTags?`|`boolean`|If true, each memory will include a list of tags from the predefined list. This must be set to true for the `memoryConfig.tags` property to be used (Default: `false`).|`boolean`|
|`memoryConfig?.includeTerm?`|`boolean`|If true, memories will be marked as short- or long-term and short-term memories will become stale and be removed from recall results after a set period of time (Default: `true`).|`boolean`|
|`memoryConfig?.includeCore?`|`boolean`|If true, memories will be marked as "core" memories if the information they contain is considered universally relevant. Core memories can be returned all together as part of the recall method (Default: `true`).|`boolean`|
|`memoryConfig?.tags?`|`array[]`|Array of tags used for memory organization. A memory can be assigned multiple tags. Default: `[ 'database schema', 'response formatting', 'code style', 'institutional knowledge' ]`|`string[]`|

#### Example
```ts
new MindPalace({
    llm: 'GPT',
    vectorStore: 'Weaviate',
    gptConfig: {
        apiKey: 'sk-proj-123fakeapikey',
    },
    weaviateConfig: {
        apiKey: 'faKEaPIKey123',
        clusterUrl: 'someclusterurl.c2.us-east1.gcp.weaviate.cloud',
    },
    tags: [ 'database schema', 'response formatting', 'code style', 'institutional knowledge' ]
})
```

### `recall()`
|Parameter|Type|Description|Options|
|-|-|-|-|
|`context`|`string` &#124; `string[]` &#124; `object`|This is the request that will be used to search for relevant memories. Its goal will be to find memories that provide relevant context and help better respond to the request.|See [Ingesting Message Formats](#ingesting-message-formats) below for options|
|`contextFormat?`|`string`|If passing context in the Claude, GPT, or Gemini response format, you must include this parameter.|`Claude` &#124; `GPT` &#124; `Gemini`|
|`queryVectorStoreDirectly?`|`boolean`|Bypass LLM vector query generation to query the vector store directly and return the top N memories. See [instructions below](#queryvectorstoredirectly) for more information on how to use this feature.|`boolean`|
|`limit?`|`number`|Total number of memories to return (Default: `5`). **NOTE:** This is only used if `queryVectorStoreDirectly: true`.|`number`|
|`includeAllCoreMemories?`|`boolean`|If `true`, all memories stored as "core" will be included in the return.|`boolean`|
|`maxHoursShortTermLength?`|`number`|Defines the maximum number of hours that a memory stored as "short-term" will be considered relevant (Default: `72`).|`number`|
|`userId?`|`string` &#124; `number`|Filters memories by the specified user ID.|`string`|
|`groupId?`|`string` &#124; `number`|Filters memories by a custom ID. This can be used with or separate from `userId` for added levels of memory grouping.|`string`|

#### `queryVectorStoreDirectly`
If you would like to bypass the LLM request process of recalling memories to save on token usage and greatly speed up recall timep, you can pass `queryVectorStoreDirectly: true` to the `recall()` method. This requires you to write your own vector query string and pass it to the `context` property. This will almost always result in less accurate or complete memory results, but it is much faster and cheaper. If you would like to try it out in your implementation, I recommend passing the user's request message as the `context`.

```ts
const userRequest = 'What is my favorite color?'
mp.recall({
    context: userRequest,
    queryVectorStoreDirectly: true
})
```

### `remember()`
|Parameter|Type|Description|Options|
|-|-|-|-|
|`context`|`string` &#124; `string[]` &#124; `object`|This is the context that will be mined for important information to create and update memories.|See [Ingesting Message Formats](#ingesting-message-formats) below for options|
|`contextFormat`|`string`|If passing context in the Claude, GPT, or Gemini response format, you must include this parameter.|`Claude` &#124; `GPT` &#124; `Gemini`|
|`userId?`|`string` &#124; `number`|Filters memories by the specified user ID.|`string`|
|`groupId?`|`string` &#124; `number`|Filters memories by a custom ID. This can be used with or separate from `userId` for added levels of memory grouping.|`string`|

### Ingesting Message Formats
When sending your context to `recall` or `remember`, you can choose from various formats. The most basic context is just a `string`, but various more complex formats are also supported.

To make things as easy as possible, Mind Palace supports the default message input type for standard Claude, GPT (responses API), and Gemini generation requests. In other words, you can pass the entire request message array from any of the major LLMs directly to Mind Palace and let it do all of the work parsing it. Examples:
```ts
const messages = [
    {
        role: 'user',
        content: memories.message,
    },
    {
        role: 'user',
        content: 'What would be a good tagline for my company?',
    },
    {
        role: 'assistant',
        content: 'Can you tell me a little about the company first?',
    },
    {
        role: 'user',
        content: 'Sure. It\'s a small startup just trying to make its name in the big world of AI. Its called OpenAI.'
    }
]

/* GPT */
const response = await openaiClient.responses.create({
    model: "gpt-5.4",
    input: messages
})
mp.remember({
    context: messages,
    contextFormat: 'GPT'
})

/* Claude */
const response = await this.claudeClient.beta.messages.create({
    messages,
    model: "claude-opus-4-6"
})
mp.remember({
    context: messages
})
```

#### Custom Message Formats
Using a custom LLM or just want to use a less complex format to send the context? Mind Palace uses a generic message format, typed as `ContentBlock`, that might be helpful. It supports 4 different content types: text, thinking, tool use, and tool result.
```ts
type TextBlock = {
    id?: string
    text: string
    type: 'text'
}
type ThinkingBlock = {
    signature: string
    thinking: string
    type: 'thinking'
}
type ToolUseBlock = {
    type: 'tool_use'
    name: string
    id: string
    input: Record<string, unknown>
}
type ToolResultBlock = {
    id: string
    type: 'tool_result'
    content: string | TextBlock[]
    isError?: boolean
}
type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock
```

## Vector Database
Mind Palace uses vector databases (like Pinecone and Weaviate) to store the contextual information it pulls from user interactions. By using a vector database as opposed to a traditional database or knowledge graph, Mind Palace is able to perform keyword and semanatic similarity searches to find more relevant memories.

Both Weaviate and Pinecone offer decent free tier options for testing.

### Weaviate
Weaviate is the default vector database just because it's my personal preference and I've used it the most. If you choose to use Weaviate, you MUST supply an OpenAI API Key. This is because Weaviate does not generate its own embeddings and, therefore, we use OpenAI's embedding models to generate them. Don't worry, OpenAI's embedding model is fantastic and cheap.

To get started using Weaviate, [create a Weaviate account](https://console.weaviate.cloud/signin?next=%2F) and then create a new Cluster. You can create a Sandbox cluster for free or a paid cluster if you don't want it to be automatically deleted after 14 days. Once your cluster is created, you may need to wait a few hours, but eventually you'll be able to add an API Key and get your REST Endpoint to include when initializing the Mind Palace class.

### Pinecone
Pinecone has the option to use an "integrated embedding" which just means it handles embedding creation without you having to use a third-party. For this reason, if you're using Pinecone, you don't have to provide OpenAI API credentials. When creating your index in Pinecone, you can configure the embedding model of your choice. Make sure you choose an embedding model that is listed as an "integrated embedding" and that has a vector type of "dense." The only downside to Pinecone's current integration embedding feature is that none of the models support hybrid search. If you need hybrid search, use Weaviate and supply an OpenAI API Key.

**NOTE:** In the future, I'd like to add the ability to inject a custom embedding integration. If that's something you would use, post a request or open up a PR!

## Custom Classes
If the available custom configuration options aren't enough for you, you can override the entire LLM and Vector Store classes simply by passing the initialized class with the request. I've provided Typescript interfaces and parent classes for both things to make implementation easier. To get started, create your classes like this:
```ts
class CustomLLM extends LLM implements ILLM {
    // start writing here
}

class CustomVectorStore extends VectorStore implements IVectorStore {
    // start writing here
}
```

Once your typecheck is passing, you've correctly implemented the custom class. Now just initialize it and pass it to the Mind Palace class initialization:
```ts
const customLLM = new CustomLLM()
const customVectorStore = new CustomVectorStore()

const mp = new MindPalace({
    customLLM: customLLM,
    customVectorStore: customVectorStore,
})
```

## Tracking Token Usage
Anytime an LLM returns a response, token usage is logged to the `tokenUsage` property on the initialized Mind Palace class. You can access the token usage data directly or via the helper methods.

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

const tokenCounter = mp.tokenUsage
console.log('All inference generations:', tokenCounter.references)
console.log('Cost by model:', tokenCounter.getModelTotals)
```

**NOTE:** Embedding generation is not currently tracked. That said, embedding models are extremely cheap and memories are small so each embedding generation will likely cost less than a fraction of a cent. The most expensive embedding model that Mind Palace uses is the `text-embedding-3-large` model by OpenAI and that model costs $0.13 per million tokens.

## Troubleshooting

### Debugging
If you're running into issues using this package, you can enable console logging by adding `MIND_PALACE_LOG_LEVEL` to your environment variables. By default, all messages and errors are suppressed. When enabled, messages are logged to the console.

**Options**
|Option|Description|
|-|-|
|`off`|Default. All messages will be suppressed.|
|`error`|Show only error level messages.|
|`info`|Show error, warn, and info level messages.|
|`debug`|Show all message levels: error, warn, info, and debug. NOTE: This mode is VERY verbose.|

### "This model is experiencing high demand...." or "You've reached your usage limit"
If you JUST created an account and added credit to access the Gemini/OpenAI/Claude APIs, you sometimes have to wait a few hours for the API to recognize that your account is funded and you have access to the respective models. Wait awhile and try again. If the error persists and you're sure your API key is correct and your account has money in it, it might be that the LLM is just experiencing a lot of traffic or is down. In that case, check the relevant status page:
#### [Google Gemini Status](https://status.gemini.com/)
#### [OpenAI GPT Status](https://status.openai.com/)
#### [Anthropic Claude Status](https://status.claude.com/)

## Future Updates:
- [ ] Make it possible for pinecone to also search in non-namespaced areas when passing a userId
- [ ] Add CONTRIBUTION.md
- [ ] Add reranker support
- [ ] Add prompt customization support
- [ ] Add custom embedding model support
- [ ] Add fun logo to README.md
- [ ] Add those cool badge shield things to README.md
- [ ] Do first release to NPM package! 