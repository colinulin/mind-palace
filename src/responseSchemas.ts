/* eslint-disable max-len */
import z from 'zod'

/**
 * Response schema for new memories
 */
const memory = (tags: string[]) => z.object({
    quote: z.string().meta({
        description: 'The exact text including and surrounding the important information. This should be just enough of the original text to give context.',
    }),
    summary: z.string().meta({
        description: 'A concise summary of the important details for future reference.',
    }),
    tags: z.array(z.enum(tags)).meta({
        description: 'Terms to use for grouping and searching for relevant memories.',
    }),
    source: z.string().meta({
        description: '1-5 word reference describing where the information originated.',
    }),
    term: z.enum([ 'long', 'short' ]).meta({
        description: 'Long memories are those that are unlikely to change and are widely applicable across different kinds of requests and Short memories are those that have a high likelihood of changing in the near future or are only relevant for a limited time or context.',
    }),
    isCore: z.boolean().meta({
        description: 'If true, this memory will be included at the beginning of all future chat sessions. Core memories contain information that is relevant in all contexts and can improve most conversations.',
    }),
})

/**
 * Response schema for finding memories relevant to a given context
 */
const relevantMemoryIds = () => z.object({
    memoryIds: z.array(z.string().meta({
        description: 'UUID of memory that is relevant to the conversation.',
    })),
})

/**
 * Response schema for memory extraction from content
 */
const extractedMemories = (tags: string[]) => z.object({
    memories: z.array(memory(tags)),
})

/**
 * Response schema for merging similar memories
 */
const mergedMemories = (tags: string[]) => z.object({
    newMemory: memory(tags).meta({
        description: 'If there is new information that provides context about something new, return a new memory here.',
    }).optional().nullable(),
    originalMemory: memory(tags).meta({
        description: 'The original memory that has either been updated with the new information or left exactly the same as it was.',
    }).required(),
})

export default {
    extractedMemories,
    mergedMemories,
    relevantMemoryIds,
}
