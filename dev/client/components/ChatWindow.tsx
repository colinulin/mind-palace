import { useEffect, useRef } from 'react'
import { Empty, Spin } from 'antd'
import { ChatMessage } from '../types'
import MessageBubble from './MessageBubble'

const ChatWindow = (props: { messages: ChatMessage[]; isLoading: boolean }) => {
    const { messages, isLoading } = props
    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [ messages, isLoading ])

    return (
        <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 16px',
            background: '#fafafa',
            borderRadius: 6,
        }}>
            {messages.length === 0 && !isLoading && (
                <Empty
                    description="Send a message to start chatting"
                    style={{ marginTop: 60 }}
                />
            )}

            {messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} />
            ))}

            {isLoading && (
                <div style={{ textAlign: 'center', padding: 16 }}>
                    <Spin size="small" />
                </div>
            )}

            <div ref={bottomRef} />
        </div>
    )
}

export default ChatWindow
