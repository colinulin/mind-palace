import { useState } from 'react'
import { Button, Input, Space } from 'antd'
import { SendOutlined } from '@ant-design/icons'

const ChatInput = (props: {
    onSend: (message: string) => void
    disabled: boolean
    isLoading: boolean
}) => {
    const { onSend, disabled, isLoading } = props
    const [ value, setValue ] = useState('')

    const handleSend = () => {
        const trimmed = value.trim()
        if (!trimmed) return

        onSend(trimmed)
        setValue('')
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <Space.Compact style={{ width: '100%' }}>
            <Input.TextArea
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={disabled ? 'Initialize MindPalace first...' : 'Type a message...'}
                disabled={disabled || isLoading}
                autoSize={{ minRows: 1, maxRows: 4 }}
                style={{ borderRadius: '6px 0 0 6px' }}
            />
            <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSend}
                disabled={disabled || isLoading || !value.trim()}
                loading={isLoading}
                style={{ height: 'auto', borderRadius: '0 6px 6px 0' }}
            />
        </Space.Compact>
    )
}

export default ChatInput
