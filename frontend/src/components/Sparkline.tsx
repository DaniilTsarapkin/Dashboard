import {
  LineChart, Line, ResponsiveContainer, Tooltip, ReferenceLine,
} from 'recharts'

interface Props {
  labels: string[]
  values: number[]
  color?: string
  refLine?: number
}

export default function Sparkline({ labels, values, color = '#3b82f6', refLine }: Props) {
  if (!values.length) {
    return <div className="h-14 flex items-center justify-center text-xs text-gray-600">нет данных</div>
  }

  const data = labels.map((l, i) => ({ week: l, v: values[i] }))

  return (
    <ResponsiveContainer width="100%" height={56}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <Tooltip
          contentStyle={{ background: '#1e293b', border: 'none', fontSize: 11 }}
          formatter={(v) => Number(v).toFixed(2)}
          labelFormatter={(l) => l}
        />
        {refLine !== undefined && (
          <ReferenceLine y={refLine} stroke="#e67e22" strokeDasharray="3 3" />
        )}
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
