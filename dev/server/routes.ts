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

        const result = await mp.recall(req.body)

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

        const memories = await mp.remember(req.body)

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

router.post('/api/memories/edit', async (req: Request, res: Response) => {
    try {
        const mp = getInstance()
        if (!mp) {
            res.status(400).json({ error: 'MindPalace not initialized.' })
            return
        }

        const { memoryId, summary } = req.body
        if (!memoryId || !summary) {
            res.status(400).json({ error: 'memoryId and summary are required.' })
            return
        }

        // Fetch the existing memory, delete it, and re-insert with updated summary
        const [ existing ] = await mp.VectorStore.fetchMemoriesById([ memoryId ])
        if (!existing) {
            res.status(404).json({ error: 'Memory not found.' })
            return
        }

        const metadata: { groupId?: string; userId?: string } = {}
        if (existing.groupId) metadata.groupId = existing.groupId
        if (existing.userId) metadata.userId = existing.userId

        await mp.VectorStore.deleteStaleMemories([ memoryId ], existing.userId ?? undefined)
        await mp.VectorStore.insertMemoriesIntoVectorStore(
            [{ ...existing, summary }],
            metadata,
        )

        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: String(err) })
    }
})

router.post('/api/memories/delete', async (req: Request, res: Response) => {
    try {
        const mp = getInstance()
        if (!mp) {
            res.status(400).json({ error: 'MindPalace not initialized.' })
            return
        }

        const { memoryId } = req.body
        if (!memoryId) {
            res.status(400).json({ error: 'memoryId is required.' })
            return
        }

        // Fetch to get userId for Pinecone namespace support
        const [ existing ] = await mp.VectorStore.fetchMemoriesById([ memoryId ])
        await mp.VectorStore.deleteStaleMemories(
            [ memoryId ],
            existing?.userId ?? undefined,
        )

        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: String(err) })
    }
})

router.post('/api/memories/add', async (req: Request, res: Response) => {
    try {
        const mp = getInstance()
        if (!mp) {
            res.status(400).json({ error: 'MindPalace not initialized.' })
            return
        }

        const { memory } = req.body
        if (!memory?.summary) {
            res.status(400).json({ error: 'memory with summary is required.' })
            return
        }

        const metadata: { groupId?: string; userId?: string } = {}
        if (memory.groupId) metadata.groupId = memory.groupId
        if (memory.userId) metadata.userId = memory.userId

        await mp.VectorStore.insertMemoriesIntoVectorStore([ memory ], metadata)

        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: String(err) })
    }
})

router.post('/api/memories/resolve', async (req: Request, res: Response) => {
    try {
        const mp = getInstance()
        if (!mp) {
            res.status(400).json({ error: 'MindPalace not initialized.' })
            return
        }

        const { summary, userId, groupId } = req.body
        if (!summary) {
            res.status(400).json({ error: 'summary is required.' })
            return
        }

        const filters = mp.VectorStore.createFilters({
            userId: userId || undefined,
            groupId: groupId || undefined,
        })
        const results = await mp.VectorStore.searchMemories({
            queryStrings: [ summary ],
            limit: 1,
            mode: 'nearText',
            filters: filters.length ? filters : undefined,
        })

        if (!results?.length) {
            res.status(404).json({ error: 'Memory not found.' })
            return
        }

        res.json({
            uuid: results[0].uuid,
            memory: results[0].memory,
        })
    } catch (err) {
        res.status(500).json({ error: String(err) })
    }
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
