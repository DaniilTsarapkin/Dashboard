import type { MetricResult } from '../types'
import { metricStatus, getTrend } from '../utils/metrics'

interface Props {
  label: string
  value: string
  metric: MetricResult
  explanation?: string
}

export default function MetricCard({ label, value, metric, explanation }: Props) {
  const { color, label: statusLabel } = metricStatus(metric)
  const { arrow, color: arrowColor }  = getTrend(metric)

  return (
    <div
      className="bg-gray-900 rounded-lg p-4 mb-3"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-400 font-medium">{label}</span>
        <span
          className="text-xs px-2 py-0.5 rounded font-semibold"
          style={{ background: color + '33', color }}
        >
          {statusLabel}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white">{value}</span>
        <span className="text-lg font-bold" style={{ color: arrowColor }}>{arrow}</span>
      </div>
      {explanation && (
        <p className="text-xs text-gray-500 mt-2">{explanation}</p>
      )}
    </div>
  )
}
