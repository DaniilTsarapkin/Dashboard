import { useEffect } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, ReferenceLine, ReferenceArea,
} from 'recharts'
import { useDashboard } from '../store'
import { getCharts } from '../api'
import { formatHours, generateExplanation } from '../utils/metrics'
import MetricCard from '../components/MetricCard'
import EmptyState from '../components/EmptyState'

export default function LoadMetricsPage() {
  const { snapshot, charts, setCharts } = useDashboard()

  useEffect(() => {
    if (!charts) getCharts().then(setCharts).catch(console.error)
  }, [charts, setCharts])

  if (!snapshot || !charts) {
    return <EmptyState />
  }

  const { scatter, modules } = charts.load
  const weekly = charts.weekly

  const weeklyM06 = weekly.labels.map((l, i) => ({ week: l, m06: weekly.m06[i] }))

  const maxActivity = Math.max(...modules.map(m => m.activity), 1)

  const medRci = scatter.length
    ? [...scatter].sort((a, b) => a.rci - b.rci)[Math.floor(scatter.length / 2)].rci
    : 0
  const medM01 = scatter.length
    ? [...scatter].sort((a, b) => a.m01 - b.m01)[Math.floor(scatter.length / 2)].m01
    : 0
  const maxRci = scatter.length ? Math.max(...scatter.map(d => d.rci)) * 1.1 : 10
  const maxM01 = scatter.length ? Math.max(...scatter.map(d => d.m01)) * 1.1 : 100

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">🧠 Нагрузка — сложность и потери</h1>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <MetricCard
          label="M03 — Fragmentation Rate (Уровень фрагментации)"
          value={snapshot.m03.value.toFixed(2)}
          metric={snapshot.m03}
          explanation={generateExplanation('M03', snapshot.m03)}
        />
        <MetricCard
          label="M04 — Post-Interruption Recovery Cost (Цена восстановления)"
          value={formatHours(snapshot.m04.value)}
          metric={snapshot.m04}
          explanation={generateExplanation('M04', snapshot.m04)}
        />
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          M05 × M01 — Сложность PR vs Задержка обратной связи
        </h2>
        <div className="bg-gray-900 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="rci"
                name="RCI"
                type="number"
                domain={[0, maxRci]}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                label={{ value: 'RCI (сложность)', position: 'insideBottom', offset: -10, fill: '#6b7280', fontSize: 11 }}
              />
              <YAxis
                dataKey="m01"
                name="M01"
                type="number"
                domain={[0, maxM01]}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                label={{ value: 'M01 ч', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: 'none', fontSize: 11 }}
                content={({ payload }) => {
                  if (!payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div className="bg-gray-800 rounded p-2 text-xs text-gray-200 shadow">
                      <div className="font-semibold text-yellow-400">#{d.pr}</div>
                      <div className="text-gray-400 truncate max-w-[180px]">{d.title}</div>
                      <div>RCI: {d.rci.toFixed(2)} · M01: {formatHours(d.m01)}</div>
                      <div>Автор: {d.author}</div>
                    </div>
                  )
                }}
              />
              <ReferenceArea x1={medRci} x2={maxRci} y1={medM01} y2={maxM01}
                fill="#e74c3c" fillOpacity={0.12}
                label={{ value: '⚠ Проблемная зона', position: 'insideTopRight', fill: '#e74c3c', fontSize: 11 }}
              />
              <ReferenceArea x1={medRci} x2={maxRci} y1={0} y2={medM01}
                fill="#e67e22" fillOpacity={0.07}
              />
              <ReferenceArea x1={0} x2={medRci} y1={medM01} y2={maxM01}
                fill="#f1c40f" fillOpacity={0.07}
              />
              <ReferenceArea x1={0} x2={medRci} y1={0} y2={medM01}
                fill="#2ecc71" fillOpacity={0.07}
              />
              <Scatter data={scatter} fill="#3498db" opacity={0.7} r={5} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          M06 — Ясность требований (по неделям)
        </h2>
        <div className="bg-gray-900 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={weeklyM06}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis domain={[0, 1.05]} tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: 'none' }}
                formatter={(v) => Number(v).toFixed(3)}
              />
              <ReferenceLine
                y={0.5}
                stroke="#e74c3c"
                strokeDasharray="4 4"
                label={{ value: 'Порог 0.5', fill: '#e74c3c', fontSize: 10 }}
              />
              <Line type="monotone" dataKey="m06" stroke="#9b59b6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          M07 — Exploration Overhead (Накладные расходы на исследование)
        </h2>
        {modules.length > 0 && modules.every(m => m.eo === 0) && (
          <div className="mb-3 p-3 rounded-lg border border-gray-700 bg-gray-800/50 flex items-start gap-2">
            <span className="text-gray-400 flex-shrink-0">ℹ️</span>
            <div className="text-xs text-gray-400">
              Все значения EO равны нулю — данные промежуточных коммитов
              не загружены. Для расчёта M07 включите опцию
              «Загружать данные коммитов» при загрузке репозитория.
            </div>
          </div>
        )}
        <div className="bg-gray-900 rounded-xl p-4 space-y-2">
          {modules.length === 0 ? (
            <div className="text-gray-500 text-sm">Нет данных о файловых изменениях</div>
          ) : (
            modules
              .slice()
              .sort((a, b) => b.eo - a.eo)
              .map(mod => {
                const barPct = (mod.activity / maxActivity) * 100
                const eoColor = mod.eo > 0.7 ? '#e74c3c' : mod.eo > 0.5 ? '#f1c40f' : '#2ecc71'
                return (
                  <div key={mod.module}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-300 font-mono truncate max-w-[260px]">{mod.module}</span>
                      <span className="text-gray-400 ml-4">
                        EO: <span style={{ color: eoColor }}>{mod.eo.toFixed(2)}</span>
                        <span className="ml-3 text-gray-600">{mod.activity} PR</span>
                      </span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${barPct}%`, background: eoColor }}
                      />
                    </div>
                  </div>
                )
              })
          )}
        </div>
      </section>
    </div>
  )
}
