/**
 * Simple token counter for tracking model usage and costs
 */
export default class TokenCounter {
    public inferences: (
        { 
            input?: number
            output?: number
            embeddingTokens?: number
            model: string
        }
    )[] = []

    // store inference token usage
    trackInference (
        tokenUsage: { input?: number; output?: number; embeddingTokens?: number }, 
        model: string,
    ) {
        this.inferences.push({
            input: tokenUsage.input,
            output: tokenUsage.output,
            embeddingTokens: tokenUsage.embeddingTokens,
            model,
        })
    }

    getModelTotals () {
        return this.inferences.reduce((acc, inference) => {
            const model = inference.model
            const modelTokenUsage = acc.get(model) || { input: 0, output: 0, embeddingTokens: 0 }
            modelTokenUsage.input += inference.input || 0
            modelTokenUsage.output += inference.output || 0
            modelTokenUsage.embeddingTokens += inference.embeddingTokens || 0
            
            acc.set(model, modelTokenUsage)

            return acc
        }, new Map<string, { input: number; output: number; embeddingTokens: number }>())
    }
}