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
    deleteStaleMemories(dataObjectIds: string[]): Promise<void>
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
    createFilters(params: { groupId?: string | number; userId?: string | number }): {
        key: keyof Memory
        value: string
    }[]
}

/**
 * Parent class for Vector Store implementations
 */
export abstract class VectorStore {
    /**
     * Create filter array for vector store searching
     */
    createFilters (params: { groupId?: string | number; userId?: string | number }) {
        const userId = params.userId ? String(params.userId) : undefined
        const groupId = params.groupId ? String(params.groupId) : undefined
        const filters: { key: keyof Memory; value: string }[] = []
        if (groupId) {
            filters.push({
                key: 'groupId',
                value: groupId,
            })
        }
        if (userId) {
            filters.push({
                key: 'userId',
                value: userId,
            })
        }

        return filters
    }
}
