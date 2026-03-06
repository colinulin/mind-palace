# Mind Palace
Mind Palace is a drop-in memory storage for LLM-enabled features with smart storage, maintenance, and retrieval. Upgrade your AI chat or other generative AI feature with persistent and scaleable memory. How does it work?
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
```
mp.remember({
    context: response.output
})
```

*NOTE:* You can let this call happen asynchronously by omitting the `await`
*NOTE 2:* It's a good idea to filter out extraneous content and content that you always include at the beginning of every session before you pass the data to the MindPalace class. The point of the MindPalace is to store information that can be learned from user interaction with the LLM.