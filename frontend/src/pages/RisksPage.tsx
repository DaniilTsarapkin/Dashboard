import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { useDashboard } from '../store'
import { getCharts } from '../api'
import { formatHours, generateExplanation } from '../utils/metrics'
import MetricCard from '../components/MetricCard'
import EmptyState from '../components/EmptyState'

export default function RisksPage() {
  const { snapshot, charts, setCharts, role } = useDashboard()
  const [hourlyRate, setHourlyRate] = useState<number>(0)

  useEffect(() => {
    if (!charts) getCharts().then(setCharts).catch(console.error)
  }, [charts, setCharts])

  if (!snapshot || !charts) {
    return <EmptyState />
  }

  const weekly = charts.weekly
  const { m15_funnel, m14_modules } = charts.risks

  const weeklyM13 = weekly.labels.map((l, i) => ({ week: l, m13: weekly.m13[i] }))

  const funnelSteps = [
    { label: 'Все новые участники', value: m15_funnel.step1 },
    { label: 'Первый вклад', value: m15_funnel.step2 },
    { label: 'Первое ревью', value: m15_funnel.step3 },
  ]
  const maxStep = funnelSteps[0].value || 1

  const waste = snapshot.m16_waste
  const wasteRows = [
    { label: '🏗 Инфраструктурные ожидания', hours_raw: waste.infra_wait_hours },
    { label: '⏳ Блокировки', hours_raw: waste.blockage_hours },
    { label: '🔁 Переделки', hours_raw: waste.rework_hours },
  ]

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">🏢 Риски — организационное здоровье</h1>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <MetricCard
          label="M13 — Концентрация BIC"
          value={snapshot.m13.value.toFixed(2)}
          metric={snapshot.m13}
          explanation={generateExplanation('M13', snapshot.m13)}
        />
        <MetricCard
          label="M14 — Концентрация знаний KCR"
          value={snapshot.m14.value.toFixed(2)}
          metric={snapshot.m14}
          explanation={generateExplanation('M14', snapshot.m14)}
        />
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          M13 — BIC-концентрация по неделям
        </h2>
        <div className="bg-gray-900 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyM13} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: 'none' }}
                formatter={(v) => Number(v).toFixed(3)}
              />
              <ReferenceLine
                y={snapshot.m13.p75}
                stroke="#f1c40f"
                strokeDasharray="4 4"
                label={{ value: 'P75', fill: '#f1c40f', fontSize: 10 }}
              />
              <ReferenceLine
                y={snapshot.m13.p90}
                stroke="#e74c3c"
                strokeDasharray="4 4"
                label={{ value: 'P90', fill: '#e74c3c', fontSize: 10 }}
              />
              <Bar dataKey="m13" fill="#e67e22" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          M15 — Воронка онбординга
          {m15_funnel.onboarding_days > 0 && (
            <span className="ml-3 font-normal text-gray-400 normal-case">
              Медиана: <span className="text-white">{m15_funnel.onboarding_days.toFixed(1)} дн.</span>
              {m15_funnel.step3 > 0 && (
                <span className="ml-1 text-gray-500">({m15_funnel.step3} уч.)</span>
              )}
            </span>
          )}
        </h2>
        <div className="bg-gray-900 rounded-xl p-4 space-y-3">
          {funnelSteps.map((step, i) => {
            const pct = (step.value / maxStep) * 100
            return (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">{step.label}</span>
                  <span className="text-gray-300 font-medium">{step.value}</span>
                </div>
                <div className="h-6 bg-gray-800 rounded overflow-hidden">
                  <div
                    className="h-full rounded flex items-center justify-end pr-2 text-xs text-white/80 font-medium transition-all"
                    style={{
                      width: `${pct}%`,
                      background: i === 0 ? '#3498db' : i === 1 ? '#2ecc71' : '#9b59b6',
                      minWidth: step.value > 0 ? 32 : 0,
                    }}
                  >
                    {pct > 10 && `${pct.toFixed(0)}%`}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {m15_funnel.step3 > 0 && m15_funnel.step3 < 5 && (
          <div className="mt-3 p-3 rounded-lg border border-yellow-600/40 bg-yellow-900/20 flex items-start gap-2">
            <span className="text-yellow-400 flex-shrink-0">⚠️</span>
            <div className="text-xs text-gray-400">
              Менее 5 новых участников ({m15_funnel.step3}) —
              метрика статистически неустойчива.
              Значение может сильно меняться при появлении одного нового контрибутора.
            </div>
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          M14 — Концентрация знаний по модулям
        </h2>
        <div className="bg-gray-900 rounded-xl overflow-hidden">
          {m14_modules.length === 0 ? (
            <div className="p-4 text-gray-500 text-sm">Нет данных о файловых изменениях</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800">
                  <th className="text-left px-4 py-2">Модуль</th>
                  <th className="text-right px-4 py-2">KCR</th>
                  <th className="text-left px-4 py-2 w-40">Топ авторы</th>
                </tr>
              </thead>
              <tbody>
                {m14_modules.map(mod => {
                  const kcrColor = mod.max_share > 0.7 ? '#e74c3c' : mod.max_share > 0.5 ? '#f1c40f' : '#2ecc71'
                  const topAuthors = Object.entries(mod.authors)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 2)
                  return (
                    <tr key={mod.module} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-4 py-2 font-mono text-gray-300 text-xs truncate max-w-[200px]">
                        {mod.module}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold" style={{ color: kcrColor }}>
                        {(mod.max_share * 100).toFixed(0)}%
                      </td>
                      <td className="px-4 py-2 text-gray-400 text-xs">
                        {topAuthors.map(([a, pct]) => (
                          <span key={a} className="mr-2">
                            {a.split('/').pop()}: {(pct * 100).toFixed(0)}%
                          </span>
                        ))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {(role === 'Engineering Manager' || role === 'Admin') && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            M16 — Стоимость потерь
          </h2>
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm text-gray-400">Ставка (₽/час):</label>
            <input
              type="number"
              min={0}
              step={500}
              value={hourlyRate || ''}
              onChange={e => setHourlyRate(Number(e.target.value))}
              placeholder="например 3000"
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white w-36 focus:outline-none focus:border-yellow-400"
            />
            {hourlyRate > 0 && (
              <span className="text-xs text-gray-500">
                Итого: {(waste.total_hours * hourlyRate).toLocaleString('ru-RU')} ₽
              </span>
            )}
          </div>
          <div className="bg-gray-900 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800">
                  <th className="text-left px-4 py-2">Категория</th>
                  <th className="text-right px-4 py-2">Часы</th>
                  <th className="text-right px-4 py-2">Доля</th>
                  {hourlyRate > 0 && <th className="text-right px-4 py-2">Стоимость</th>}
                </tr>
              </thead>
              <tbody>
                {wasteRows.map(row => (
                  <tr key={row.label} className="border-b border-gray-800/50">
                    <td className="px-4 py-2 text-gray-300">{row.label}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatHours(row.hours_raw)}</td>
                    <td className="px-4 py-2 text-right text-gray-400">
                      {waste.total_hours > 0
                        ? `${((row.hours_raw / waste.total_hours) * 100).toFixed(1)}%`
                        : '—'}
                    </td>
                    {hourlyRate > 0 && (
                      <td className="px-4 py-2 text-right font-mono text-yellow-400">
                        {(row.hours_raw * hourlyRate).toLocaleString('ru-RU')} ₽
                      </td>
                    )}
                  </tr>
                ))}
                <tr className="border-t border-gray-700 bg-gray-800/30">
                  <td className="px-4 py-2 font-semibold text-white">Итого</td>
                  <td className="px-4 py-2 text-right font-bold text-white font-mono">
                    {formatHours(waste.total_hours)}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-400">100%</td>
                  {hourlyRate > 0 && (
                    <td className="px-4 py-2 text-right font-bold font-mono text-yellow-400">
                      {(waste.total_hours * hourlyRate).toLocaleString('ru-RU')} ₽
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
