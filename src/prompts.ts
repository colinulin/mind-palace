/* eslint-disable max-len */
import { Memory } from './types'
import { ContentBlock, userRole } from './vendors/types'

/**
 * Prompt to find memories relevant to a given context
 */
const relevantMemorySearch = (context: ContentBlock[] | string) => {
    return {
        systemMessage: 'You search a memory database for relevant information to help respond to a conversation.',
        messages: [
            {
                role: userRole,
                content: `<conversation>${JSON.stringify(context)}</conversation>`,
            },
            {
                role: userRole,
                content: `<instructions>
Past conversations and research have been converted into memories and stored in a vector store database. Memories are short pieces of information that provides important context things like preferences, personal information, institutional knowledge, etc. You can search these memories using the search_memories tool to find relevant memories. In the next step, you will be responding to the above conversation. Your job now is to find memories that will help inform and improve a response to this conversation.
</instructions>`,
            },
        ],
        tools: [
            {
                name: 'search_memories',
                description: 'Perform a vector store hybrid search (alpha=0.5) on all available memories. If no relevant memories are found, an empty array will be returned.',
                parameters: {
                    type: 'object' as const,
                    properties: {
                        query: {
                            type: 'string',
                            description: 'The query to use in the vector store hybrid search.',
                        },
                    },
                    required: [ 'query' ],
                },
            },
        ],
    }
}

/**
 * Prompt to extract memories from content blocks
 */
const memoryExtraction = (context: ContentBlock[] | string) => {
    return {
        systemMessage: 'You extract information from conversations to store in a database for future reference. This information is stored as memories that can be searched and used to inform and improve future conversations.',
        messages: [
            {
                role: userRole,
                content: `<conversation>${JSON.stringify(context)}</conversation>`,
            },
            {
                role: userRole,
                content: `<instructions>
Review the conversation and extract important information based on the following criteria:
1. The information is coming directly from the user or an external source (i.e., a website or other tool) and NOT the AI or assistant
2. The information provides important context (i.e., user preferences, personal information, institutional knowledge, etc.) that could be useful in future conversations
3. The information is NOT only applicable to the specific conversation or user request
</instructions>`,
            },
        ],
    }
}

/**
 * Prompt to consider and do memory merge
 */
const memoryMerge = (newMemory: Memory, nearMemory: Memory) => {
    return {
        systemMessage: 'You have obtained new information and your job is to determine if that information is new or should be merged with current information.',
        messages: [
            {
                role: userRole,
                content: `<current>
Quote: ${nearMemory.quote}
Summary: ${nearMemory.summary}
Source: ${nearMemory.source}
Tags: ${nearMemory.tags}
Term: ${nearMemory.term}
</current>`,
            },
            {
                role: userRole,
                content: `<new>
Quote: ${newMemory.quote}
Summary: ${newMemory.summary}
Source: ${newMemory.source}
</new>`,
            },
            {
                role: userRole,
                content: `<instructions>
Review the Current block of information and compare it to the New information to determine if the New should be used to update the Current or if it should be used to create a new memory. If the New information overlaps, compliments, or contradicts Current information, then update current memory with the New information. If the New information provides context about something new (even if it is related to the Current), then create a new memory. If the New information meets both of these criteria, update the current memory and create a new memory with the information that provides new context.
</instructions>`,
            },
        ],
    }
}

export default {
    memoryExtraction,
    memoryMerge,
    relevantMemorySearch,
}
