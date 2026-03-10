import { Router, Request, Response } from 'express'
import { getInstance, initialize, reset } from './session'
import { getLogsSince, markCheckpoint } from './log-capture'

const router = Router()

router.post('/api/initialize', async (req: Request, res: Response) => {
    try {
        const { config } = req.body
        if (!config || typeof config !== 'object') {
            res.status(400).json({ error: 'Missing or invalid config object.' })
            return
        }

        initialize(config)
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: String(err) })
    }
})

router.post('/api/recall', async (req: Request, res: Response) => {
    try {
        const mp = getInstance()
        if (!mp) {
            res.status(400).json({ error: 'MindPalace not initialized.' })
            return
        }

        const checkpoint = markCheckpoint()
        const { context, userId, groupId, queryVectorStoreDirectly, includeAllCoreMemories, limit } = req.body

        const result = await mp.recall({
            context,
            userId,
            groupId,
            queryVectorStoreDirectly,
            includeAllCoreMemories,
            limit,
        })

        const tokenUsage = serializeTokenUsage(mp)

        res.json({
            result: result ?? { message: '', memories: [] },
            tokenUsage,
            logs: getLogsSince(checkpoint),
        })
    } catch (err) {
        res.status(500).json({ error: String(err) })
    }
})

router.post('/api/chat', async (req: Request, res: Response) => {
    try {
        const mp = getInstance()
        if (!mp) {
            res.status(400).json({ error: 'MindPalace not initialized.' })
            return
        }

        const checkpoint = markCheckpoint()
        const { messages, systemMessage } = req.body

        // Use a minimal schema for free-form chat responses
        const { default: z } = await import('zod')
        const responseSchema = z.object({
            response: z.string().meta({ description: 'Your response to the user.' }),
        })

        const { structuredResponse, tokenUsage, model } = await mp.LLM.generateInference({
            messages,
            systemMessage: systemMessage || 'You are a helpful assistant.',
            responseSchema,
        })

        mp.tokenUsage.trackInference(tokenUsage, model)

        res.json({
            response: structuredResponse?.response ?? '',
            tokenUsage: serializeTokenUsage(mp),
            logs: getLogsSince(checkpoint),
        })
    } catch (err) {
        res.status(500).json({ error: String(err) })
    }
})

router.post('/api/remember', async (req: Request, res: Response) => {
    try {
        const mp = getInstance()
        if (!mp) {
            res.status(400).json({ error: 'MindPalace not initialized.' })
            return
        }

        const checkpoint = markCheckpoint()
        const { context, userId, groupId } = req.body

        const memories = await mp.remember({ context, userId, groupId })

        res.json({
            memories,
            tokenUsage: serializeTokenUsage(mp),
            logs: getLogsSince(checkpoint),
        })
    } catch (err) {
        res.status(500).json({ error: String(err) })
    }
})

router.get('/api/token-usage', (_req: Request, res: Response) => {
    const mp = getInstance()
    if (!mp) {
        res.status(400).json({ error: 'MindPalace not initialized.' })
        return
    }

    res.json({ tokenUsage: serializeTokenUsage(mp) })
})

router.get('/api/logs', (req: Request, res: Response) => {
    const since = Number(req.query.since) || 0
    res.json({ logs: getLogsSince(since) })
})

router.post('/api/reset', (_req: Request, res: Response) => {
    reset()
    res.json({ success: true })
})

const serializeTokenUsage = (mp: ReturnType<typeof getInstance>) => {
    if (!mp) return {}

    const totals = mp.tokenUsage.getModelTotals()
    const serialized: Record<string, { input: number; output: number; embeddingTokens: number }> = {}
    totals.forEach((value, key) => {
        serialized[key] = value
    })

    return {
        inferences: mp.tokenUsage.inferences,
        modelTotals: serialized,
    }
}

export default router
