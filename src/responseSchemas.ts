/* eslint-disable max-len */
import z from 'zod'

/**
 * Response schema for new memories
 */
const memory = (tags: string[]) => z.object({
    quote: z.string().meta({
        description: 'The shortest passage from the conversation that contains the source of this information. This is used for attribution and verification, not for retrieval. Keep to 1-2 sentences maximum. Must be verbatim text from the conversation.',
    }),
    summary: z.string().meta({
        description: 'A concise, declarative statement summarizing a single piece of information for storage in a vector database.',
    }),
    tags: z.array(z.enum(tags)).meta({
        description: 'Broad categories this memory falls under. Select all that apply, but prefer the most specific relevant tags over generic ones. Used for filtering and grouping memories alongside vector search.',
    }),
    source: z.string().meta({
        description: 'A 1-5 word label identifying where the information originated. Use the speaker or tool name, not a description of the content. Examples: "user", "web search", "GitHub API", "uploaded document".',
    }),
    term: z.enum([ 'long', 'short' ]).meta({
        description: 'Long: stable facts unlikely to change — identity, established preferences, architecture decisions, domain knowledge. Short: information that may become outdated or has limited applicability — current project status, temporary goals, time-sensitive details, evolving opinions.',
    }),
    isCore: z.boolean().meta({
        description: 'If true, this memory is prepended to every future conversation regardless of topic. Reserve this for universally relevant information such as the user\'s name, primary role, or a formatting preference that applies to all responses. Most memories should be false. When in doubt, set false.',
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
    action: z.enum([ 'kept_as_is', 'updated', 'created_new', 'updated_and_created_new' ]).meta({
        description:
            'What action was taken. "kept_as_is": existing memory unchanged, candidate was redundant. "updated": existing memory was modified with new information. "created_new": existing memory unchanged, candidate is a distinct fact stored separately. "updated_and_created_new": existing memory was modified AND a separate new fact was extracted.',
    }),
    existingMemory: memory(tags).meta({
        description:
            'The existing memory, either returned exactly as-is or updated with new information. Always required.',
    }),
    newMemory: memory(tags).optional().nullable().meta({
        description:
            'A separate memory to create when the candidate contains a distinct fact that does not belong in the existing memory. Null when the candidate was fully merged or redundant.',
    }),
})

export default {
    extractedMemories,
    mergedMemories,
    relevantMemoryIds,
}
