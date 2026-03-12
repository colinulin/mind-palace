import { useState } from 'react'
import { Button, Checkbox, Input, Modal, Select, Space, Tooltip, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { api } from '../services/client'

const { Text } = Typography

const AddMemoryButton = (props: {
    disabled: boolean
}) => {
    const { disabled } = props
    const [ open, setOpen ] = useState(false)
    const [ isSubmitting, setIsSubmitting ] = useState(false)
    const [ error, setError ] = useState<string | null>(null)

    // Memory fields
    const [ summary, setSummary ] = useState('')
    const [ source, setSource ] = useState('')
    const [ quote, setQuote ] = useState('')
    const [ term, setTerm ] = useState<'long' | 'short' | undefined>(undefined)
    const [ isCore, setIsCore ] = useState(false)
    const [ tags, setTags ] = useState('')
    const [ userId, setUserId ] = useState('')
    const [ groupId, setGroupId ] = useState('')

    const resetForm = () => {
        setSummary('')
        setSource('')
        setQuote('')
        setTerm(undefined)
        setIsCore(false)
        setTags('')
        setUserId('')
        setGroupId('')
        setError(null)
    }

    const handleOpen = () => {
        resetForm()
        setOpen(true)
    }

    const handleSubmit = async () => {
        if (!summary.trim()) return
        setIsSubmitting(true)
        setError(null)

        try {
            const memory: Record<string, unknown> = {
                summary: summary.trim(),
                userId: userId.trim() || null,
                groupId: groupId.trim() || null,
            }

            if (source.trim()) memory.source = source.trim()
            if (quote.trim()) memory.quote = quote.trim()
            if (term) memory.term = term
            if (isCore) memory.isCore = true
            if (tags.trim()) {
                memory.tags = tags.split(',').map(t => t.trim()).filter(Boolean)
            }

            await api.addMemory({ memory })
            setOpen(false)
        } catch (err) {
            setError(String(err))
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <>
            <Tooltip title="Manually add a memory to the vector store">
                <Button
                    icon={<PlusOutlined />}
                    onClick={handleOpen}
                    disabled={disabled}
                >
                    Add Memory
                </Button>
            </Tooltip>

            <Modal
                title="Add Memory"
                open={open}
                onCancel={() => setOpen(false)}
                onOk={handleSubmit}
                confirmLoading={isSubmitting}
                okText="Add"
                okButtonProps={{ disabled: !summary.trim() }}
                width={520}
            >
                <Space orientation="vertical" style={{ width: '100%' }} size="small">
                    <div>
                        <Text strong style={{ fontSize: 12 }}>Summary *</Text>
                        <Input.TextArea
                            value={summary}
                            onChange={e => setSummary(e.target.value)}
                            placeholder="The main memory content..."
                            autoSize={{ minRows: 2, maxRows: 6 }}
                            style={{ fontSize: 12 }}
                        />
                    </div>

                    <div>
                        <Text strong style={{ fontSize: 12 }}>Source</Text>
                        <Input
                            value={source}
                            onChange={e => setSource(e.target.value)}
                            placeholder="1-5 word label (e.g. 'user preference')"
                            size="small"
                            style={{ fontSize: 12 }}
                        />
                    </div>

                    <div>
                        <Text strong style={{ fontSize: 12 }}>Quote</Text>
                        <Input.TextArea
                            value={quote}
                            onChange={e => setQuote(e.target.value)}
                            placeholder="Original passage containing this information..."
                            autoSize={{ minRows: 1, maxRows: 4 }}
                            style={{ fontSize: 12 }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                            <Text strong style={{ fontSize: 12 }}>Term</Text>
                            <Select
                                value={term}
                                onChange={setTerm}
                                allowClear
                                placeholder="Select term..."
                                size="small"
                                style={{ width: '100%', fontSize: 12 }}
                                options={[
                                    { value: 'short', label: 'Short-term' },
                                    { value: 'long', label: 'Long-term' },
                                ]}
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                            <Checkbox
                                checked={isCore}
                                onChange={e => setIsCore(e.target.checked)}
                            >
                                <Text style={{ fontSize: 12 }}>Core Memory</Text>
                            </Checkbox>
                        </div>
                    </div>

                    <div>
                        <Text strong style={{ fontSize: 12 }}>Tags</Text>
                        <Input
                            value={tags}
                            onChange={e => setTags(e.target.value)}
                            placeholder="Comma-separated (e.g. 'code style, preferences')"
                            size="small"
                            style={{ fontSize: 12 }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                            <Text strong style={{ fontSize: 12 }}>User ID</Text>
                            <Input
                                value={userId}
                                onChange={e => setUserId(e.target.value)}
                                placeholder="Optional"
                                size="small"
                                style={{ fontSize: 12 }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <Text strong style={{ fontSize: 12 }}>Group ID</Text>
                            <Input
                                value={groupId}
                                onChange={e => setGroupId(e.target.value)}
                                placeholder="Optional"
                                size="small"
                                style={{ fontSize: 12 }}
                            />
                        </div>
                    </div>

                    {error && (
                        <Text type="danger" style={{ fontSize: 12 }}>{error}</Text>
                    )}
                </Space>
            </Modal>
        </>
    )
}

export default AddMemoryButton
