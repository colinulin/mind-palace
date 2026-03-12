import { useState, useCallback } from 'react'
import { api } from '../services/client'
import { ChatMessage, MemoryEntry, RequestTimings } from '../types'

let messageIdCounter = 0
const nextId = () => `msg-${++messageIdCounter}`

export const useChat = (params: {
    parseConfigText: (text: string) => Record<string, unknown>
    recallConfigText: string
    rememberConfigText: string
    updateTokenUsage: (usage: unknown) => void
    appendLogs: (logs: unknown[]) => void
}) => {
    const { parseConfigText, recallConfigText, rememberConfigText, updateTokenUsage, appendLogs } = params
    const [ messages, setMessages ] = useState<ChatMessage[]>([])
    const [ isLoading, setIsLoading ] = useState(false)

    const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
        const newMsg: ChatMessage = {
            ...msg,
            id: nextId(),
            timestamp: Date.now(),
        }
        setMessages(prev => [ ...prev, newMsg ])
        return newMsg
    }, [])

    const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m))
    }, [])

    const removeMessage = useCallback((id: string) => {
        setMessages(prev => prev.filter(m => m.id !== id))
    }, [])

    const sendMessage = useCallback(async (content: string) => {
        setIsLoading(true)
        const totalStart = performance.now()

        try {
            addMessage({ type: 'user', content })

            const recallConfig = parseConfigText(recallConfigText)

            // Call recall with the user's message
            const recallStart = performance.now()
            const recallResponse = await api.recall({
                context: content,
                ...recallConfig,
            })
            const recallMs = Math.round(performance.now() - recallStart)

            updateTokenUsage(recallResponse.tokenUsage)
            appendLogs(recallResponse.logs)

            // Show recall results if any memories were returned
            if (recallResponse.result.memories?.length) {
                addMessage({
                    type: 'recall',
                    content: recallResponse.result.message,
                    memories: recallResponse.result.memories as MemoryEntry[],
                })
            }

            // Build chat history for LLM — include recall context + conversation
            const llmMessages: { role: string; content: string }[] = []

            if (recallResponse.result.message) {
                llmMessages.push({ role: 'user', content: recallResponse.result.message })
            }

            // Include previous conversation turns
            messages
                .filter(m => m.type === 'user' || m.type === 'assistant')
                .forEach(m => {
                    llmMessages.push({
                        role: m.type === 'user' ? 'user' : 'assistant',
                        content: m.content,
                    })
                })

            llmMessages.push({ role: 'user', content })

            // Call LLM via the backend
            const chatStart = performance.now()
            const chatResponse = await api.chat({ messages: llmMessages })
            const chatMs = Math.round(performance.now() - chatStart)

            updateTokenUsage(chatResponse.tokenUsage)
            appendLogs(chatResponse.logs)

            const totalMs = Math.round(performance.now() - totalStart)
            const timings: RequestTimings = { recallMs, chatMs, totalMs }

            addMessage({ type: 'assistant', content: chatResponse.response, timings })
        } catch (err) {
            addMessage({ type: 'system', content: `Error: ${String(err)}` })
        } finally {
            setIsLoading(false)
        }
    }, [ messages, recallConfigText, parseConfigText, addMessage, updateTokenUsage, appendLogs ])

    const rememberChat = useCallback(async () => {
        setIsLoading(true)
        const totalStart = performance.now()

        try {
            const conversationText = messages
                .filter(m => m.type === 'user' || m.type === 'assistant')
                .map(m => `${m.type === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
                .join('\n\n')

            if (!conversationText) {
                addMessage({ type: 'system', content: 'No conversation to remember.' })
                return
            }

            const rememberConfig = parseConfigText(rememberConfigText)

            const rememberStart = performance.now()
            const response = await api.remember({
                context: conversationText,
                ...rememberConfig,
            })
            const rememberMs = Math.round(performance.now() - rememberStart)

            updateTokenUsage(response.tokenUsage)
            appendLogs(response.logs)

            const memoriesStored = (response.memories as MemoryEntry[]) || []
            const totalMs = Math.round(performance.now() - totalStart)
            const timings: RequestTimings = { rememberMs, totalMs }

            addMessage({
                type: 'remember',
                content: `Stored ${memoriesStored.length} memories.`,
                memories: memoriesStored.map(m => ({ summary: m.summary })),
                timings,
            })
        } catch (err) {
            addMessage({ type: 'system', content: `Remember failed: ${String(err)}` })
        } finally {
            setIsLoading(false)
        }
    }, [ messages, rememberConfigText, parseConfigText, addMessage, updateTokenUsage, appendLogs ])

    const editMemory = useCallback(async (memoryId: string, summary: string) => {
        const response = await api.editMemory({ memoryId, summary })
        return response
    }, [])

    const deleteMemory = useCallback(async (memoryId: string) => {
        const response = await api.deleteMemory({ memoryId })
        return response
    }, [])

    const clearChat = useCallback(() => {
        setMessages([])
    }, [])

    return {
        messages,
        isLoading,
        sendMessage,
        rememberChat,
        editMemory,
        deleteMemory,
        updateMessage,
        removeMessage,
        clearChat,
    }
}
