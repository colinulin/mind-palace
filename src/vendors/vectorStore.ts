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
        userId?: string
        groupId?: string
        omitCoreMemories?: boolean
        limit: number
        mode: 'hybrid' | 'bm25' | 'nearText'
        alpha?: number
    }): Promise<VectorMemory[] | undefined>
    fetchMemoriesById(memoryIds: string[]): Promise<Memory[]>
    fetchMemoriesWithFilter(params: { 
        filters?: { key: keyof Memory; value: string | boolean }[]
        userId?: string
        groupId?: string
        limit?: number
    }): Promise<Memory[]>
}

/**
 * Parent class for Vector Store implementations
 */
export abstract class VectorStore {

}
