import { Button, Tooltip } from 'antd'
import { SaveOutlined } from '@ant-design/icons'

const RememberButton = (props: {
    onRemember: () => void
    disabled: boolean
    isLoading: boolean
}) => {
    const { onRemember, disabled, isLoading } = props

    return (
        <Tooltip title="Send current conversation to remember()">
            <Button
                icon={<SaveOutlined />}
                onClick={onRemember}
                disabled={disabled}
                loading={isLoading}
            >
                Remember
            </Button>
        </Tooltip>
    )
}

export default RememberButton
