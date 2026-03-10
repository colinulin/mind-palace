import { Table, Typography } from 'antd'
import { TokenUsageData } from '../types'

const { Text } = Typography

const columns = [
    { title: 'Model', dataIndex: 'model', key: 'model' },
    { title: 'Input', dataIndex: 'input', key: 'input', render: (v: number) => v.toLocaleString() },
    { title: 'Output', dataIndex: 'output', key: 'output', render: (v: number) => v.toLocaleString() },
]

const TokenUsage = (props: { tokenUsage: TokenUsageData | null }) => {
    const { tokenUsage } = props

    if (!tokenUsage?.modelTotals || !Object.keys(tokenUsage.modelTotals).length) {
        return <Text type="secondary" style={{ fontSize: 12 }}>No token usage yet.</Text>
    }

    const dataSource = Object.entries(tokenUsage.modelTotals).map(([ model, totals ]) => ({
        key: model,
        model,
        input: totals.input,
        output: totals.output,
    }))

    return (
        <Table
            dataSource={dataSource}
            columns={columns}
            pagination={false}
            size="small"
            style={{ fontSize: 12 }}
        />
    )
}

export default TokenUsage
