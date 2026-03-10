import { Card, Tag, Typography } from 'antd'
import { ChatMessage } from '../types'

const { Text, Paragraph } = Typography

const typeStyles: Record<string, { align: 'left' | 'right' | 'center'; color: string; label: string }> = {
    user: { align: 'right', color: '#1677ff', label: 'You' },
    assistant: { align: 'left', color: '#52c41a', label: 'Assistant' },
    recall: { align: 'left', color: '#722ed1', label: 'Recalled Memories' },
    remember: { align: 'left', color: '#fa8c16', label: 'Remember' },
    system: { align: 'center', color: '#8c8c8c', label: 'System' },
}

const MessageBubble = (props: { message: ChatMessage }) => {
    const { message } = props
    const style = typeStyles[message.type] || typeStyles.system

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
            </Card>
        </div>
    )
}

export default MessageBubble
