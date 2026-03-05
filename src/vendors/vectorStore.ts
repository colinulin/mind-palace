import { Memory } from '../types'

/**
 * Parent types for Vector Store integration
 */
export interface IVectorStore {
    returnMetadata: string[]
    returnProperties: string[]

    insertMemoriesIntoVectorStore (
        memories: Memory[],
        metadata?: { groupId?: string; userId?: string },
    ): Promise<void>
    deleteStaleMemories (dataObjectIds: string[]): Promise<void>
    searchMemories(params: {
        queryString: string
        filters?: { key: keyof Memory; value: string | boolean }[]
        limit: number
        mode: 'hybrid' | 'bm25' | 'nearText'
        alpha?: number
        includeNullWithFilter?: boolean
    }): Promise<{ memory: Memory; uuid: string; score: number }[] | undefined>
    fetchMemoriesById(memoryIds: string[]): Promise<Memory[]>
    fetchMemories(params?: { 
        filter?: { key: keyof Memory; value: string | boolean }
        limit?: number
    }): Promise<Memory[]>
}
