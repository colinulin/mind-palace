import { List, Tag, Typography } from 'antd'
import { useEffect, useRef } from 'react'
import { LogEntry } from '../types'

const { Text } = Typography

const levelColors: Record<string, string> = {
    info: 'blue',
    warn: 'orange',
    error: 'red',
    debug: 'default',
}

const LogViewer = (props: { logs: LogEntry[] }) => {
    const { logs } = props
    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [ logs ])

    if (!logs.length) {
        return <Text type="secondary" style={{ fontSize: 12 }}>No logs yet.</Text>
    }

    return (
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <List
                size="small"
                dataSource={logs}
                renderItem={entry => (
                    <List.Item style={{ padding: '2px 0', border: 'none' }}>
                        <div style={{ fontSize: 11, fontFamily: 'monospace', width: '100%' }}>
                            <Tag
                                color={levelColors[entry.level] || 'default'}
                                style={{ fontSize: 10, lineHeight: '16px', marginRight: 4 }}
                            >
                                {entry.level.toUpperCase()}
                            </Tag>
                            <Text strong style={{ fontSize: 11 }}>{entry.label}</Text>
                            {entry.message && (
                                <Text style={{ fontSize: 11, marginLeft: 4 }}>{entry.message}</Text>
                            )}
                        </div>
                    </List.Item>
                )}
            />
            <div ref={bottomRef} />
        </div>
    )
}

export default LogViewer
