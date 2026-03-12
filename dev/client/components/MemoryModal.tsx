import { useState } from 'react'
import { Button, Input, Modal, Space, Typography } from 'antd'
import { DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { MemoryEntry } from '../types'
import { api } from '../services/client'

const { Text } = Typography

type MemoryModalMode = 'edit' | 'delete' | null

const MemoryModal = (props: {
    memory: MemoryEntry
    onEdit: (memoryId: string, summary: string) => Promise<{ success: boolean }>
    onDelete: (memoryId: string) => Promise<{ success: boolean }>
    onEditSuccess: (newSummary: string) => void
    onDeleteSuccess: () => void
}) => {
    const { memory, onEdit, onDelete, onEditSuccess, onDeleteSuccess } = props
    const [ mode, setMode ] = useState<MemoryModalMode>(null)
    const [ editValue, setEditValue ] = useState(memory.summary)
    const [ resolvedUuid, setResolvedUuid ] = useState(memory.uuid)
    const [ isSubmitting, setIsSubmitting ] = useState(false)
    const [ isResolving, setIsResolving ] = useState(false)
    const [ error, setError ] = useState<string | null>(null)

    const resolveUuid = async () => {
        if (resolvedUuid) return resolvedUuid
        setIsResolving(true)
        setError(null)
        try {
            const result = await api.resolveMemory({
                summary: memory.summary,
                userId: memory.userId ?? undefined,
                groupId: memory.groupId ?? undefined,
            })
            setResolvedUuid(result.uuid)
            return result.uuid
        } catch (err) {
            setError(`Could not find memory: ${String(err)}`)
            return null
        } finally {
            setIsResolving(false)
        }
    }

    const openMode = async (targetMode: MemoryModalMode) => {
        if (targetMode === 'edit') setEditValue(memory.summary)
        setError(null)
        const uuid = await resolveUuid()
        if (uuid) setMode(targetMode)
    }

    const handleEdit = async () => {
        if (!resolvedUuid || !editValue.trim()) return
        setIsSubmitting(true)
        try {
            await onEdit(resolvedUuid, editValue.trim())
            // Clear cached UUID since the old memory was deleted and a new one was inserted
            setResolvedUuid(undefined)
            onEditSuccess(editValue.trim())
            setMode(null)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async () => {
        if (!resolvedUuid) return
        setIsSubmitting(true)
        try {
            await onDelete(resolvedUuid)
            onDeleteSuccess()
            setMode(null)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <>
            <Space size={4}>
                <Button
                    size="small"
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => openMode('edit')}
                    loading={isResolving}
                    style={{ fontSize: 11, padding: '0 4px' }}
                />
                <Button
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => openMode('delete')}
                    loading={isResolving}
                    style={{ fontSize: 11, padding: '0 4px' }}
                />
            </Space>

            {error && (
                <Text type="danger" style={{ fontSize: 11, display: 'block' }}>{error}</Text>
            )}

            <Modal
                title="Edit Memory"
                open={mode === 'edit'}
                onCancel={() => setMode(null)}
                onOk={handleEdit}
                confirmLoading={isSubmitting}
                okText="Save"
            >
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                    Update the memory summary below.
                </Text>
                <Input.TextArea
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    autoSize={{ minRows: 3, maxRows: 8 }}
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
            </Modal>

            <Modal
                title="Delete Memory"
                open={mode === 'delete'}
                onCancel={() => setMode(null)}
                onOk={handleDelete}
                confirmLoading={isSubmitting}
                okText="Delete"
                okButtonProps={{ danger: true }}
            >
                <Text>Are you sure you want to delete this memory?</Text>
                <div style={{
                    marginTop: 8,
                    padding: 8,
                    background: '#fafafa',
                    borderRadius: 4,
                    fontSize: 12,
                }}>
                    {memory.summary}
                </div>
            </Modal>
        </>
    )
}

export default MemoryModal
