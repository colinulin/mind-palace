import { useState, useCallback } from 'react'
import { api } from '../services/client'
import { SessionStatus, TokenUsageData, LogEntry } from '../types'

export const useSession = () => {
    const [ status, setStatus ] = useState<SessionStatus>('disconnected')
    const [ configText, setConfigText ] = useState('')
    const [ userId, setUserId ] = useState('')
    const [ groupId, setGroupId ] = useState('')
    const [ tokenUsage, setTokenUsage ] = useState<TokenUsageData | null>(null)
    const [ logs, setLogs ] = useState<LogEntry[]>([])
    const [ error, setError ] = useState<string | null>(null)

    const appendLogs = useCallback((newLogs: unknown[]) => {
        setLogs(prev => [ ...prev, ...(newLogs as LogEntry[]) ])
    }, [])

    const updateTokenUsage = useCallback((usage: unknown) => {
        if (usage) setTokenUsage(usage as TokenUsageData)
    }, [])

    const initialize = useCallback(async () => {
        try {
            setStatus('loading')
            setError(null)

            // Parse the config text — strip `new MindPalace(` wrapper if present
            let configStr = configText.trim()
            const wrapperMatch = configStr.match(/^new\s+MindPalace\s*\(([\s\S]*)\)\s*;?\s*$/)
            if (wrapperMatch) {
                configStr = wrapperMatch[1]
            }

            // Use Function constructor to safely parse JS object literals (supports unquoted keys)
            const config = new Function(`return (${configStr})`)()

            await api.initialize(config)
            setStatus('connected')
        } catch (err) {
            setError(String(err))
            setStatus('error')
        }
    }, [ configText ])

    const resetSession = useCallback(async () => {
        try {
            await api.reset()
            setStatus('disconnected')
            setTokenUsage(null)
            setLogs([])
            setError(null)
        } catch (err) {
            setError(String(err))
        }
    }, [])

    return {
        status,
        configText,
        setConfigText,
        userId,
        setUserId,
        groupId,
        setGroupId,
        tokenUsage,
        updateTokenUsage,
        logs,
        appendLogs,
        error,
        initialize,
        resetSession,
    }
}
