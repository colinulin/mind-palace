import { IVectorStore } from './vectorStore'

export default class Pinecone implements IVectorStore {
    constructor (config: { 
        indexName?: string
        apiKey: string
    }) {
        
    }
}
