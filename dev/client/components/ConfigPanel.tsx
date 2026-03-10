import { Button, Input, Space, Tag, Typography } from 'antd'
import { SessionStatus } from '../types'

const { Text } = Typography

const CONFIG_PLACEHOLDER = `{
    llm: 'GPT',
    vectorStore: 'Weaviate',
    gptConfig: {
        apiKey: 'sk-...',
    },
    weaviateConfig: {
        apiKey: '...',
        clusterUrl: '...',
    },
}`

const statusColors: Record<SessionStatus, string> = {
    disconnected: 'default',
    connected: 'success',
    loading: 'processing',
    error: 'error',
}

const statusLabels: Record<SessionStatus, string> = {
    disconnected: 'Not Connected',
    connected: 'Connected',
    loading: 'Connecting...',
    error: 'Error',
}

const ConfigPanel = (props: {
    configText: string
    setConfigText: (text: string) => void
    userId: string
    setUserId: (id: string) => void
    groupId: string
    setGroupId: (id: string) => void
    status: SessionStatus
    error: string | null
    onInitialize: () => void
    onReset: () => void
}) => {
    const {
        configText,
        setConfigText,
        userId,
        setUserId,
        groupId,
        setGroupId,
        status,
        error,
        onInitialize,
        onReset,
    } = props

    const isConnected = status === 'connected'

    return (
        <Space direction="vertical" style={{ width: '100%' }} size="small">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text strong>Configuration</Text>
                <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
            </div>

            <Input.TextArea
                value={configText}
                onChange={e => setConfigText(e.target.value)}
                placeholder={CONFIG_PLACEHOLDER}
                autoSize={{ minRows: 6, maxRows: 14 }}
                disabled={isConnected}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
            />

            <Input
                value={userId}
                onChange={e => setUserId(e.target.value)}
                placeholder="userId (optional)"
                size="small"
                disabled={isConnected}
            />

            <Input
                value={groupId}
                onChange={e => setGroupId(e.target.value)}
                placeholder="groupId (optional)"
                size="small"
                disabled={isConnected}
            />

            {error && (
                <Text type="danger" style={{ fontSize: 12, wordBreak: 'break-all' }}>
                    {error}
                </Text>
            )}

            <Space>
                <Button
                    type="primary"
                    onClick={onInitialize}
                    loading={status === 'loading'}
                    disabled={isConnected || !configText.trim()}
                >
                    Initialize
                </Button>
                <Button
                    onClick={onReset}
                    disabled={!isConnected}
                    danger
                >
                    Reset
                </Button>
            </Space>
        </Space>
    )
}

export default ConfigPanel
