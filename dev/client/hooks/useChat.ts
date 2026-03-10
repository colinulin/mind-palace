import { useState, useCallback } from 'react'
import { api } from '../api/client'
import { ChatMessage } from '../types'

let messageIdCounter = 0
const nextId = () => `msg-${++messageIdCounter}`

export const useChat = (params: {
    userId: string
    groupId: string
    updateTokenUsage: (usage: unknown) => void
    appendLogs: (logs: unknown[]) => void
}) => {
    const { userId, groupId, updateTokenUsage, appendLogs } = params
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

    const sendMessage = useCallback(async (content: string) => {
        setIsLoading(true)

        try {
            // Add user message to chat
            addMessage({ type: 'user', content })

            // Call recall with the user's message
            const recallResponse = await api.recall({
                context: content,
                userId: userId || undefined,
                groupId: groupId || undefined,
            })

            updateTokenUsage(recallResponse.tokenUsage)
            appendLogs(recallResponse.logs)

            // Show recall results if any memories were returned
            if (recallResponse.result.memories?.length) {
                addMessage({
                    type: 'recall',
                    content: recallResponse.result.message,
                    memories: recallResponse.result.memories as ChatMessage['memories'],
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

            // Add current user message
            llmMessages.push({ role: 'user', content })

            // Call LLM via the backend
            const chatResponse = await api.chat({ messages: llmMessages })

            updateTokenUsage(chatResponse.tokenUsage)
            appendLogs(chatResponse.logs)

            addMessage({ type: 'assistant', content: chatResponse.response })
        } catch (err) {
            addMessage({ type: 'system', content: `Error: ${String(err)}` })
        } finally {
            setIsLoading(false)
        }
    }, [ messages, userId, groupId, addMessage, updateTokenUsage, appendLogs ])

    const rememberChat = useCallback(async () => {
        setIsLoading(true)

        try {
            // Build conversation text from chat messages
            const conversationText = messages
                .filter(m => m.type === 'user' || m.type === 'assistant')
                .map(m => `${m.type === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
                .join('\n\n')

            if (!conversationText) {
                addMessage({ type: 'system', content: 'No conversation to remember.' })
                return
            }

            const response = await api.remember({
                context: conversationText,
                userId: userId || undefined,
                groupId: groupId || undefined,
            })

            updateTokenUsage(response.tokenUsage)
            appendLogs(response.logs)

            const memoriesStored = (response.memories as { summary: string }[]) || []
            addMessage({
                type: 'remember',
                content: `Stored ${memoriesStored.length} memories.`,
                memories: memoriesStored.map(m => ({ summary: m.summary })),
            })
        } catch (err) {
            addMessage({ type: 'system', content: `Remember failed: ${String(err)}` })
        } finally {
            setIsLoading(false)
        }
    }, [ messages, userId, groupId, addMessage, updateTokenUsage, appendLogs ])

    const clearChat = useCallback(() => {
        setMessages([])
    }, [])

    return {
        messages,
        isLoading,
        sendMessage,
        rememberChat,
        clearChat,
    }
}
