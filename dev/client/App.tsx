import { Collapse, Layout, Space, Typography } from 'antd'
import ConfigPanel from './components/ConfigPanel'
import ChatWindow from './components/ChatWindow'
import ChatInput from './components/ChatInput'
import RememberButton from './components/RememberButton'
import TokenUsage from './components/TokenUsage'
import LogViewer from './components/LogViewer'
import { useSession } from './hooks/useSession'
import { useChat } from './hooks/useChat'

const { Sider, Content } = Layout
const { Title } = Typography

const App = () => {
    const session = useSession()
    const chat = useChat({
        userId: session.userId,
        groupId: session.groupId,
        updateTokenUsage: session.updateTokenUsage,
        appendLogs: session.appendLogs,
    })

    const isReady = session.status === 'connected'

    const siderPanels = [
        {
            key: 'config',
            label: 'Configuration',
            children: (
                <ConfigPanel
                    configText={session.configText}
                    setConfigText={session.setConfigText}
                    userId={session.userId}
                    setUserId={session.setUserId}
                    groupId={session.groupId}
                    setGroupId={session.setGroupId}
                    status={session.status}
                    error={session.error}
                    onInitialize={session.initialize}
                    onReset={session.resetSession}
                />
            ),
        },
        {
            key: 'tokens',
            label: 'Token Usage',
            children: <TokenUsage tokenUsage={session.tokenUsage} />,
        },
        {
            key: 'logs',
            label: `Logs (${session.logs.length})`,
            children: <LogViewer logs={session.logs} />,
        },
    ]

    return (
        <Layout style={{ height: '100vh' }}>
            <Sider
                width={360}
                theme="light"
                style={{
                    padding: 16,
                    overflowY: 'auto',
                    borderRight: '1px solid #f0f0f0',
                }}
            >
                <Title level={4} style={{ margin: '0 0 16px' }}>Mind Palace</Title>
                <Collapse
                    items={siderPanels}
                    defaultActiveKey={[ 'config' ]}
                    size="small"
                />
            </Sider>

            <Content style={{ display: 'flex', flexDirection: 'column', padding: 16 }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                }}>
                    <Title level={5} style={{ margin: 0 }}>Chat</Title>
                    <Space>
                        <RememberButton
                            onRemember={chat.rememberChat}
                            disabled={!isReady || !chat.messages.length}
                            isLoading={chat.isLoading}
                        />
                    </Space>
                </div>

                <ChatWindow messages={chat.messages} isLoading={chat.isLoading} />

                <div style={{ marginTop: 12 }}>
                    <ChatInput
                        onSend={chat.sendMessage}
                        disabled={!isReady}
                        isLoading={chat.isLoading}
                    />
                </div>
            </Content>
        </Layout>
    )
}

export default App
