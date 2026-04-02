import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ReferenceLine, ReferenceArea, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts'
import { useDashboard } from '../store'
import { getCharts } from '../api'
import { formatPct, heatColor, generateExplanation } from '../utils/metrics'
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

export default function TeamPage() {
  const navigate = useNavigate()
  const { snapshot, charts, setCharts, role, bundle } = useDashboard()

  useEffect(() => {
    if (!charts) getCharts().then(setCharts).catch(console.error)
  }, [charts, setCharts])

  if (!snapshot || !charts) {
    return <EmptyState />
  }

  const { heatmap, m11_hist } = charts.team
  const weekly = charts.weekly

  const weeklyM12 = weekly.labels.map((l, i) => ({ week: l, m12: weekly.m12[i] }))

  const m12Anomalies = weeklyM12.reduce<Array<{ week: string; value: number; drop: number }>>((acc, point, i) => {
    if (i === 0) return acc
    const prev = weeklyM12[i - 1].m12
    const curr = point.m12
    const drop = prev - curr
    if (drop > 0.2) {
      acc.push({ week: point.week, value: curr, drop })
    }
    return acc
  }, [])

  const histBins = buildHistBins(m11_hist, 20)
  const p50_cf = m11_hist.length ? percentile(m11_hist, 50) : 0
  const p75_cf = m11_hist.length ? percentile(m11_hist, 75) : 0
  const p90_cf = m11_hist.length ? percentile(m11_hist, 90) : 0
  const binP50_cf = histBins.length ? closestBin(histBins, p50_cf) : ''
  const binP75_cf = histBins.length ? closestBin(histBins, p75_cf) : ''
  const binP90_cf = histBins.length ? closestBin(histBins, p90_cf) : ''
  const firstBin_cf = histBins.length ? histBins[0].bin : ''
  const lastBin_cf = histBins.length ? histBins[histBins.length - 1].bin : ''

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">💬 Команда — взаимодействие</h1>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <MetricCard
          label="M09 — Доля переделок"
          value={formatPct(snapshot.m09.value)}
          metric={snapshot.m09}
          explanation={generateExplanation('M09', snapshot.m09)}
        />
        <MetricCard
          label="M06 — Requirements Clarity Score (Ясность требований)"
          value={snapshot.m06.value.toFixed(2)}
          metric={snapshot.m06}
          explanation={generateExplanation('M06', snapshot.m06)}
        />
      </div>

      {snapshot.m09.value > 0.15 && snapshot.m06.value < 0.5 && (
        <div className="mt-3 mb-8 p-3 rounded-lg border border-yellow-600/40 bg-yellow-900/20 flex items-start gap-2">
          <span className="text-yellow-400 text-lg flex-shrink-0">⚠️</span>
          <div>
            <div className="text-sm font-semibold text-yellow-400 mb-0.5">
              Системная проблема с постановкой задач
            </div>
            <div className="text-xs text-gray-400">
              Одновременный рост переделок (M09 = {(snapshot.m09.value * 100).toFixed(1)}%)
              и нестабильность требований (M06 = {snapshot.m06.value.toFixed(2)})
              — признак того, что задачи закрываются без чётких критериев приёмки.
              Команда делает работу заново не потому что код плохой,
              а потому что критерии «готово» меняются после закрытия.
            </div>
          </div>
        </div>
      )}

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          M14 — Концентрация знаний (KCR тепловая карта)
        </h2>
        <div className="bg-gray-900 rounded-xl p-4 overflow-auto">
          {heatmap.modules.length === 0 ? (
            <div className="text-gray-500 text-sm">Нет данных о файловых изменениях</div>
          ) : (
            <div>
              <div className="flex gap-px mb-px">
                <div className="w-40 flex-shrink-0" />
                {heatmap.authors.map(a => (
                  <div
                    key={a}
                    className="flex-1 min-w-[40px] text-center text-xs text-gray-500 truncate px-0.5"
                    title={a}
                  >
                    {a.split('/').pop()}
                  </div>
                ))}
              </div>
              {heatmap.modules.map((mod, mi) => (
                <div key={mod} className="flex gap-px mb-px">
                  <div
                    className="w-40 flex-shrink-0 text-xs text-gray-400 truncate pr-2 leading-6"
                    title={mod}
                  >
                    {mod}
                  </div>
                  {heatmap.authors.map((_, ai) => {
                    const v = heatmap.z[mi]?.[ai] ?? 0
                    return (
                      <div
                        key={ai}
                        className="flex-1 min-w-[40px] h-6 rounded-sm"
                        style={{ background: heatColor(v) }}
                        title={`${mod} × ${heatmap.authors[ai]}: ${(v * 100).toFixed(0)}%`}
                      />
                    )
                  })}
                </div>
              ))}
              <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                <div className="h-3 w-24 rounded" style={{
                  background: 'linear-gradient(to right, #2ecc71, #f1c40f, #e74c3c)',
                }} />
                <span>0% → концентрация</span>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          M12 — Культура (безопасность среды, по неделям)
        </h2>
        <div className="bg-gray-900 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={weeklyM12}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis domain={[0, 1.05]} tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: 'none' }}
                formatter={(v) => Number(v).toFixed(3)}
              />
              <ReferenceLine
                y={0.7}
                stroke="#2ecc71"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{ value: 'Норма: 0.7', position: 'insideTopRight', fill: '#2ecc71', fontSize: 10 }}
              />
              <ReferenceLine
                y={0.5}
                stroke="#e74c3c"
                strokeDasharray="4 4"
                label={{ value: 'Порог 0.5', fill: '#e74c3c', fontSize: 10 }}
              />
              {m12Anomalies.map(anomaly => (
                <ReferenceLine
                  key={anomaly.week}
                  x={anomaly.week}
                  stroke="#e74c3c"
                  strokeDasharray="3 3"
                  strokeOpacity={0.6}
                  label={{
                    value: `↓ −${anomaly.drop.toFixed(2)}`,
                    position: 'insideTopRight',
                    fill: '#e74c3c',
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                />
              ))}
              <Line type="monotone" dataKey="m12" stroke="#2ecc71" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {(role === 'Tech Lead' || role === 'Admin') && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            M11 — Распределение покрытия ревью
          </h2>
          <div className="bg-gray-900 rounded-xl p-4">
            {histBins.length < 4 ? (
              <div className="h-40 flex items-center justify-center text-sm text-gray-600">
                Недостаточно данных
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={histBins} margin={{ left: 0, right: 10, top: 15, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="bin"
                    tick={{ fontSize: 8, fill: '#9ca3af' }}
                    interval="preserveStartEnd"
                    label={{ value: 'CF', position: 'insideBottom', offset: -12, fill: '#6b7280', fontSize: 10 }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    label={{ value: 'PR', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: 'none' }}
                    formatter={(v) => [`${v} PR`, 'Количество'] as [string, string]}
                  />
                  <ReferenceArea x1={firstBin_cf} x2={binP50_cf} fill="#2ecc71" fillOpacity={0.06} />
                  <ReferenceArea x1={binP50_cf} x2={binP75_cf} fill="#f1c40f" fillOpacity={0.08} />
                  <ReferenceArea x1={binP75_cf} x2={binP90_cf} fill="#e67e22" fillOpacity={0.10} />
                  <ReferenceArea x1={binP90_cf} x2={lastBin_cf} fill="#e74c3c" fillOpacity={0.10} />
                  <ReferenceLine x={binP50_cf} stroke="#9ca3af" strokeDasharray="4 4"
                    label={{ value: `P50: ${p50_cf.toFixed(2)}`, position: 'top', fill: '#9ca3af', fontSize: 9 }} />
                  <ReferenceLine x={binP75_cf} stroke="#f1c40f" strokeDasharray="4 4"
                    label={{ value: `P75: ${p75_cf.toFixed(2)}`, position: 'top', fill: '#f1c40f', fontSize: 9 }} />
                  <ReferenceLine x={binP90_cf} stroke="#e74c3c" strokeDasharray="4 4"
                    label={{ value: `P90: ${p90_cf.toFixed(2)}`, position: 'top', fill: '#e74c3c', fontSize: 9 }} />
                  <Bar dataKey="count" fill="#3498db" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {charts.team.m11_outliers.length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide">
                PR с CF {'>'} P90 — коммуникационные аутлаеры
              </div>
              <div className="bg-gray-900 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-gray-800">
                      <th className="text-left px-4 py-2">PR</th>
                      <th className="text-left px-4 py-2">Заголовок</th>
                      <th className="text-right px-4 py-2">CF</th>
                      <th className="text-right px-4 py-2">Файлов</th>
                      <th className="text-left px-4 py-2">Автор</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {charts.team.m11_outliers.map(row => (
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
                        <td className="px-4 py-2 text-right font-semibold text-orange-400">{row.cf.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right text-gray-400">{row.changed_files}</td>
                        <td className="px-4 py-2 text-gray-400">{row.author}</td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => navigate(`/dashboard/timeline/${row.number}`)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            Таймлайн →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
