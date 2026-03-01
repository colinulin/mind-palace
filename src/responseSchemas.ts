/* eslint-disable max-len */
import z from 'zod'

/**
 * Response schema for new memories
 */
const memory = (tags: string[]) => z.object({
    content: z.string().meta({
        description: 'The full memory including all important details for future reference',
    }),
    summary: z.string().meta({
        description: '3-5 word summary of the memory for easier searching',
    }),
    tags: z.array(z.enum(tags)).meta({
        description: 'Terms to use for grouping and searching for relevant memories',
    }),
    source: z.string().meta({
        description: '1-5 word reference describing where the information originated',
    }),
    term: z.enum([ 'long', 'short' ]).meta({
        description: 'Long memories are those that are unlikely to change and Short memories are those that have a high likelihood of changing in the near future',
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
    memories: z.array(memory(tags)).meta({
        description: 'If information can be merged into a single memory, this array should only contain 1 memory. Otherwise, return 2 memories: the original memory without any changes and the new memory.',
    }),
})

export default {
    extractedMemories,
    mergedMemories,
    relevantMemoryIds,
}