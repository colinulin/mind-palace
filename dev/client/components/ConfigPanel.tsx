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

const RECALL_CONFIG_PLACEHOLDER = `{
    userId: 'user-123',
    includeAllCoreMemories: true,
}`

const REMEMBER_CONFIG_PLACEHOLDER = `{
    userId: 'user-123',
    groupId: 'group-456',
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
    recallConfigText: string
    setRecallConfigText: (text: string) => void
    rememberConfigText: string
    setRememberConfigText: (text: string) => void
    status: SessionStatus
    error: string | null
    onInitialize: () => void
    onReset: () => void
}) => {
    const {
        configText,
        setConfigText,
        recallConfigText,
        setRecallConfigText,
        rememberConfigText,
        setRememberConfigText,
        status,
        error,
        onInitialize,
        onReset,
    } = props

    return (
        <Space orientation="vertical" style={{ width: '100%' }} size="small">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text strong>MindPalace Config</Text>
                <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
            </div>

            <Input.TextArea
                value={configText}
                onChange={e => setConfigText(e.target.value)}
                placeholder={CONFIG_PLACEHOLDER}
                autoSize={{ minRows: 6, maxRows: 14 }}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
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
                    disabled={status === 'loading' || !configText.trim()}
                >
                    {status !== 'connected' ? 'Initialize' : 'Re-Initialize'}
                </Button>
            </Space>

            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8, marginTop: 4 }}>
                <Text strong style={{ fontSize: 12 }}>Recall Config</Text>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                    Options spread onto every recall() call (e.g. userId, groupId, limit)
                </Text>
                <Input.TextArea
                    value={recallConfigText}
                    onChange={e => setRecallConfigText(e.target.value)}
                    placeholder={RECALL_CONFIG_PLACEHOLDER}
                    autoSize={{ minRows: 2, maxRows: 8 }}
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
            </div>

            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8, marginTop: 4 }}>
                <Text strong style={{ fontSize: 12 }}>Remember Config</Text>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                    Options spread onto every remember() call (e.g. userId, groupId)
                </Text>
                <Input.TextArea
                    value={rememberConfigText}
                    onChange={e => setRememberConfigText(e.target.value)}
                    placeholder={REMEMBER_CONFIG_PLACEHOLDER}
                    autoSize={{ minRows: 2, maxRows: 8 }}
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
            </div>
        </Space>
    )
}

export default ConfigPanel
