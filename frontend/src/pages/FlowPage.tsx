import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine, ReferenceArea, CartesianGrid,
} from 'recharts'
import { useDashboard } from '../store'
import { getCharts } from '../api'
import { formatHours, generateExplanation } from '../utils/metrics'
import MetricCard from '../components/MetricCard'
import EmptyState from '../components/EmptyState'

function buildHistBins(vals: number[], nbins = 20): { bin: string; binNum: number; count: number }[] {
  if (!vals.length) return []
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const step = (max - min) / nbins || 1
  const bins = Array.from({ length: nbins }, (_, i) => ({
    bin: `${(min + i * step).toFixed(1)}`,
    binNum: min + i * step,
    count: 0,
  }))
  vals.forEach(v => {
    const i = Math.min(Math.floor((v - min) / step), nbins - 1)
    bins[i].count++
  })
  return bins
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.floor((p / 100) * sorted.length)
  return sorted[Math.min(idx, sorted.length - 1)]
}

function closestBin(bins: { bin: string; binNum: number }[], value: number): string {
  let best = bins[0].bin
  let bestDist = Math.abs(bins[0].binNum - value)
  for (const b of bins) {
    const d = Math.abs(b.binNum - value)
    if (d < bestDist) { bestDist = d; best = b.bin }
  }
  return best
}

function valueColor(value: number, p50: number, p75: number, p90: number): string {
  if (value <= p50) return '#2ecc71'
  if (value <= p75) return '#f1c40f'
  if (value <= p90) return '#e67e22'
  return '#e74c3c'
}

export default function FlowPage() {
  const { snapshot, charts, setCharts, role, bundle } = useDashboard()
  const navigate = useNavigate()

  useEffect(() => {
    if (!charts) getCharts().then(setCharts).catch(console.error)
  }, [charts, setCharts])

  if (!snapshot || !charts) {
    return <EmptyState />
  }

  const { lifecycle, m01_hist, m02_hist, outliers } = charts.flow
  const weekly = charts.weekly

  const lifecycleData = [
    { name: 'Ожидание ревью', value: lifecycle.review_wait, color: '#e74c3c' },
    { name: 'Ожидание CI',    value: lifecycle.ci_wait,    color: '#e67e22' },
    { name: 'Прочее',         value: lifecycle.other_wait, color: '#95a5a6' },
    { name: 'Активная работа',value: lifecycle.active,     color: '#2ecc71' },
  ]

  const weeklyData = weekly.labels.map((l, i) => ({
    week: l, m08: weekly.m08[i],
  }))

  const isReadOnly = role === 'Engineering Manager'

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">⚡ Поток — жизненный цикл PR</h1>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Медианный жизненный цикл PR
        </h2>
        <div className="bg-gray-900 rounded-xl p-4">
          <div className="flex gap-1 h-12 rounded overflow-hidden">
            {lifecycleData.map(seg => {
              const total = lifecycleData.reduce((s, d) => s + d.value, 0)
              const pct = total ? (seg.value / total) * 100 : 0
              return (
                <div
                  key={seg.name}
                  style={{ width: `${pct}%`, background: seg.color, minWidth: pct > 1 ? 2 : 0 }}
                  className="flex items-center justify-center text-xs font-medium text-white/80 overflow-hidden"
                  title={`${seg.name}: ${formatHours(seg.value)}`}
                >
                  {pct > 8 && formatHours(seg.value)}
                </div>
              )
            })}
          </div>
          <div className="flex gap-4 mt-2 flex-wrap">
            {lifecycleData.map(seg => (
              <div key={seg.name} className="flex items-center gap-1.5 text-xs text-gray-400">
                <div className="w-3 h-3 rounded-sm" style={{ background: seg.color }} />
                {seg.name}: {formatHours(seg.value)}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <MetricCard
          label="M01 — Задержка обратной связи"
          value={formatHours(snapshot.m01.value)}
          metric={snapshot.m01}
          explanation={generateExplanation('M01', snapshot.m01)}
        />
        <MetricCard
          label="M02 — Время блокировки"
          value={formatHours(snapshot.m02.value)}
          metric={snapshot.m02}
          explanation={generateExplanation('M02', snapshot.m02)}
        />
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Распределения M01 и M02
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { data: m01_hist, label: 'M01 — Распределение задержки обратной связи' },
            { data: m02_hist, label: 'M02 — Распределение времени блокировки' },
          ].map(({ data, label }) => {
            const bins = buildHistBins(data, 20)
            if (bins.length < 4) {
              return (
                <div key={label} className="bg-gray-900 rounded-xl p-4">
                  <div className="text-xs text-gray-400 mb-2">{label}</div>
                  <div className="h-40 flex items-center justify-center text-sm text-gray-600">
                    Недостаточно данных
                  </div>
                </div>
              )
            }
            const p50 = percentile(data, 50)
            const p75 = percentile(data, 75)
            const p90 = percentile(data, 90)
            const binP50 = closestBin(bins, p50)
            const binP75 = closestBin(bins, p75)
            const binP90 = closestBin(bins, p90)
            const firstBin = bins[0].bin
            const lastBin = bins[bins.length - 1].bin

            return (
              <div key={label} className="bg-gray-900 rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-2">{label}</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={bins} margin={{ top: 5, right: 5, bottom: 20, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="bin"
                      tick={{ fontSize: 8, fill: '#9ca3af' }}
                      interval="preserveStartEnd"
                      label={{ value: 'Часы', position: 'insideBottom', offset: -12, fill: '#6b7280', fontSize: 10 }}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: '#9ca3af' }}
                      label={{ value: 'PR', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: 'none', fontSize: 11 }}
                      formatter={(v) => [`${v} PR`, 'Количество'] as [string, string]}
                    />
                    <ReferenceArea x1={firstBin} x2={binP50} fill="#2ecc71" fillOpacity={0.08} />
                    <ReferenceArea x1={binP50} x2={binP75} fill="#f1c40f" fillOpacity={0.1} />
                    <ReferenceArea x1={binP75} x2={binP90} fill="#e67e22" fillOpacity={0.12} />
                    <ReferenceArea x1={binP90} x2={lastBin} fill="#e74c3c" fillOpacity={0.12} />
                    <ReferenceLine x={binP50} stroke="#2ecc71" strokeDasharray="4 4"
                      label={{ value: `P50 ${formatHours(p50)}`, fill: '#2ecc71', fontSize: 9, position: 'top' }} />
                    <ReferenceLine x={binP75} stroke="#f1c40f" strokeDasharray="4 4"
                      label={{ value: `P75 ${formatHours(p75)}`, fill: '#f1c40f', fontSize: 9, position: 'top' }} />
                    <ReferenceLine x={binP90} stroke="#e74c3c" strokeDasharray="4 4"
                      label={{ value: `P90 ${formatHours(p90)}`, fill: '#e74c3c', fontSize: 9, position: 'top' }} />
                    <Bar dataKey="count" fill="#3498db" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          M08 — Безопасность среды (по неделям)
        </h2>
        <div className="bg-gray-900 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis domain={[0, 1.05]} tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: 'none' }}
                formatter={(v) => Number(v).toFixed(3)}
              />
              <ReferenceArea y1={0} y2={0.5} fill="#e74c3c" fillOpacity={0.07} />
              <ReferenceLine y={0.5} stroke="#e74c3c" strokeDasharray="4 4" label={{ value: 'Порог 0.5', fill: '#e74c3c', fontSize: 10 }} />
              <Line type="monotone" dataKey="m08" stroke="#3498db" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {!isReadOnly && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            PR-аутлаеры (M01 / M02 / M10 {'>'} P90)
          </h2>
          {outliers.length === 0 ? (
            <div className="bg-gray-900 rounded-xl p-4 text-green-400 text-sm">
              ✅ Нет аутлаеров — всё в норме!
            </div>
          ) : (
            <div className="bg-gray-900 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b border-gray-800">
                    <th className="text-left px-4 py-2">PR</th>
                    <th className="text-left px-4 py-2">Заголовок</th>
                    <th className="text-left px-4 py-2">Дата</th>
                    <th className="text-right px-4 py-2">M01 ч</th>
                    <th className="text-right px-4 py-2">M02 ч</th>
                    <th className="text-right px-4 py-2">M10 ч</th>
                    <th className="text-left px-4 py-2">Статус</th>
                    {(role === 'Tech Lead' || role === 'Admin') && <th className="px-4 py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {outliers.map(row => (
                    <tr key={row.number} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-4 py-2 font-mono">
                        <a
                          href={`https://github.com/${bundle?.owner}/${bundle?.repo}/pull/${row.number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-yellow-400 hover:text-yellow-300 hover:underline"
                        >
                          #{row.number}
                        </a>
                      </td>
                      <td className="px-4 py-2 text-gray-300 max-w-xs truncate">{row.title}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{row.created_at}</td>
                      <td className="px-4 py-2 text-right font-medium">
                        <span style={{ color: valueColor(row.m01, snapshot.m01.p50, snapshot.m01.p75, snapshot.m01.p90) }}>
                          {row.m01}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        <span style={{ color: valueColor(row.m02, snapshot.m02.p50, snapshot.m02.p75, snapshot.m02.p90) }}>
                          {row.m02}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        <span style={{ color: valueColor(row.m10, snapshot.m10.p50, snapshot.m10.p75, snapshot.m10.p90) }}>
                          {row.m10}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-400">{row.state}</td>
                      {(role === 'Tech Lead' || role === 'Admin') && (
                        <td className="px-4 py-2">
                          <button
                            onClick={() => navigate(`/dashboard/timeline/${row.number}`)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            Таймлайн →
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
