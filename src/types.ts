import { Vectors, WeaviateObject } from 'weaviate-client'

export type Memory = {
    content: string
    summary: string
    tags: string[]
    source: string
    term: 'long' | 'short'
    isCore: boolean
}

export type WeaviateMemory = WeaviateObject<Memory, number[] | Vectors>