import { Card, Tag, Typography } from 'antd'
import { ClockCircleOutlined } from '@ant-design/icons'
import { ChatMessage, MemoryEntry } from '../types'
import MemoryModal from './MemoryModal'

const { Text, Paragraph } = Typography

const typeStyles: Record<string, { align: 'left' | 'right' | 'center'; color: string; label: string }> = {
    user: { align: 'right', color: '#1677ff', label: 'You' },
    assistant: { align: 'left', color: '#52c41a', label: 'Assistant' },
    recall: { align: 'left', color: '#722ed1', label: 'Recalled Memories' },
    remember: { align: 'left', color: '#fa8c16', label: 'Remember' },
    system: { align: 'center', color: '#8c8c8c', label: 'System' },
}

const formatMs = (ms: number) =>
    ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`

const TimingsBadge = (props: { timings: ChatMessage['timings'] }) => {
    const { timings } = props
    if (!timings) return null

    const parts: string[] = []
    if (timings.recallMs !== undefined) parts.push(`recall: ${formatMs(timings.recallMs)}`)
    if (timings.chatMs !== undefined) parts.push(`chat: ${formatMs(timings.chatMs)}`)
    if (timings.rememberMs !== undefined) parts.push(`remember: ${formatMs(timings.rememberMs)}`)
    parts.push(`total: ${formatMs(timings.totalMs)}`)

    return (
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {parts.join(' | ')}
        </Text>
    )
}

const MemoryItem = (props: {
    memory: MemoryEntry
    onEdit: (memoryId: string, summary: string) => Promise<{ success: boolean }>
    onDelete: (memoryId: string) => Promise<{ success: boolean }>
    onEditSuccess: (newSummary: string) => void
    onDeleteSuccess: () => void
}) => {
    const { memory, onEdit, onDelete, onEditSuccess, onDeleteSuccess } = props

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            padding: '2px 0',
            gap: 4,
        }}>
            <Text style={{ fontSize: 12, flex: 1 }}>- {memory.summary}</Text>
            <MemoryModal
                memory={memory}
                onEdit={onEdit}
                onDelete={onDelete}
                onEditSuccess={onEditSuccess}
                onDeleteSuccess={onDeleteSuccess}
            />
        </div>
    )
}

const MessageBubble = (props: {
    message: ChatMessage
    onEditMemory: (memoryId: string, summary: string) => Promise<{ success: boolean }>
    onDeleteMemory: (memoryId: string) => Promise<{ success: boolean }>
    onUpdateMessage: (id: string, updates: Partial<ChatMessage>) => void
    onRemoveMessage: (id: string) => void
}) => {
    const { message, onEditMemory, onDeleteMemory, onUpdateMessage, onRemoveMessage } = props
    const style = typeStyles[message.type] || typeStyles.system

    const hasMemories = !!message.memories?.length
    const isMemoryMessage = message.type === 'recall' || message.type === 'remember'

    const handleEditSuccess = (memoryIndex: number, newSummary: string) => {
        if (!message.memories) return
        const updated = message.memories.map((m, i) =>
            i === memoryIndex ? { ...m, summary: newSummary } : m,
        )
        onUpdateMessage(message.id, { memories: updated })
    }

    const handleDeleteSuccess = (memoryIndex: number) => {
        if (!message.memories) return
        const updated = message.memories.filter((_, i) => i !== memoryIndex)
        if (updated.length === 0) {
            onRemoveMessage(message.id)
        } else {
            onUpdateMessage(message.id, {
                memories: updated,
                content: message.type === 'remember'
                    ? `Stored ${updated.length} memories.`
                    : message.content,
            })
        }
    }

    if (message.type === 'system') {
        return (
            <div style={{ textAlign: 'center', padding: '4px 0' }}>
                <Text type="secondary" italic style={{ fontSize: 12 }}>
                    {message.content}
                </Text>
            </div>
        )
    }

    return (
        <div style={{
            display: 'flex',
            justifyContent: style.align === 'right' ? 'flex-end' : 'flex-start',
            padding: '4px 0',
        }}>
            <Card
                size="small"
                style={{
                    maxWidth: '80%',
                    borderLeft: `3px solid ${style.color}`,
                }}
            >
                <Tag color={style.color} style={{ marginBottom: 4 }}>{style.label}</Tag>

                {isMemoryMessage && hasMemories ? (
                    <div style={{ marginTop: 4 }}>
                        {message.type === 'remember' && (
                            <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                                {message.content}
                            </Text>
                        )}
                        {message.memories!.map((mem, i) => (
                            <MemoryItem
                                key={mem.uuid || i}
                                memory={mem}
                                onEdit={onEditMemory}
                                onDelete={onDeleteMemory}
                                onEditSuccess={(newSummary) => handleEditSuccess(i, newSummary)}
                                onDeleteSuccess={() => handleDeleteSuccess(i)}
                            />
                        ))}
                    </div>
                ) : (
                    <Paragraph
                        style={{
                            margin: 0,
                            fontSize: 13,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                        }}
                    >
                        {message.content}
                    </Paragraph>
                )}

                <TimingsBadge timings={message.timings} />
            </Card>
        </div>
    )
}

export default MessageBubble
