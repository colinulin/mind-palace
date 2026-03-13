import { Memory } from '../types'

export type VectorMemory = {
    memory: Memory
    score: number
    uuid: string
    createdAt: Date | undefined
    updatedAt: Date | undefined
}

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
        queryStrings: string[]
        filters?: { key: keyof Memory; value: string | boolean }[]
        limit: number
        mode: 'hybrid' | 'bm25' | 'nearText'
        alpha?: number
    }): Promise<VectorMemory[] | undefined>
    fetchMemoriesById(memoryIds: string[]): Promise<Memory[]>
    fetchMemories(params?: { 
        filter?: { key: keyof Memory; value: string | boolean }
        limit?: number
    }): Promise<Memory[]>
    createFilters(params: { groupId?: string | number; userId?: string | number }): {
        key: keyof Memory
        value: string | boolean
    }[]
}

/**
 * Parent class for Vector Store implementations
 */
export abstract class VectorStore {
    /**
     * Create filter array for vector store searching
     */
    createFilters (params: { 
        groupId?: string | number
        userId?: string | number
        includeCoreMemories?: boolean
    }) {
        const userId = params.userId ? String(params.userId) : undefined
        const groupId = params.groupId ? String(params.groupId) : undefined
        const includeCoreMemories = params.includeCoreMemories
        const filters: { key: keyof Memory; value: string | boolean }[] = []
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

        // if we're explicitly excluding core memories, then we need to filter them out, otherwise
        // they'll be included by default
        if (includeCoreMemories === false) {
            filters.push({
                key: 'isCore',
                value: includeCoreMemories,
            })
        }

        return filters
    }
}
