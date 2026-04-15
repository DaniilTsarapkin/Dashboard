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
  const { snapshot, charts, setCharts, bundle } = useDashboard()

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
      <h1 className="text-xl font-bold mb-6">Нагрузка — сложность и потери</h1>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <MetricCard
          label="M03 — Fragmentation Rate"
          value={snapshot.m03.value.toFixed(2)}
          metric={snapshot.m03}
          explanation={generateExplanation('M03', snapshot.m03)}
        />
        <MetricCard
          label="M04 — Post-Interruption Recovery Cost"
          value={formatHours(snapshot.m04.value)}
          metric={snapshot.m04}
          explanation={generateExplanation('M04', snapshot.m04)}
        />
      </div>

      {(() => {
        const fragHigh = snapshot.m03.value > 1.5
        const recoveryExists = snapshot.m04.value > 0
        const bothSignals = fragHigh && recoveryExists
        const onlyFrag = fragHigh && !recoveryExists
        const onlyRecovery = !fragHigh && recoveryExists && snapshot.m04.value > 1

        if (!bothSignals && !onlyFrag && !onlyRecovery) return null

        const fragVal = snapshot.m03.value.toFixed(1)
        const recVal = formatHours(snapshot.m04.value)
        const m07val = snapshot.m07.value

        return (
          <div className="mb-6 p-3 rounded-lg border border-yellow-600/40 bg-yellow-900/20 flex items-start gap-2">
            <span className="text-yellow-400 text-lg flex-shrink-0"></span>
            <div>
              <div className="text-sm font-semibold text-yellow-400 mb-0.5">
                {bothSignals
                  ? 'Частые переключения контекста и высокая цена восстановления'
                  : onlyFrag
                  ? 'Высокая фрагментация рабочего времени'
                  : 'Длительное восстановление после прерываний'}
              </div>
              <div className="text-xs text-gray-400">
                {fragHigh && (
                  <>Разработчики переключаются между {fragVal} контекстами в час (M03). </>
                )}
                {recoveryExists && (
                  <>Возврат к своей задаче после прерывания занимает в среднем {recVal} (M04). </>
                )}
                {bothSignals && m07val > 0.1 && (
                  <>Exploration Overhead = {(m07val * 100).toFixed(0)}% (M07) — разработчики теряют ориентацию
                  в коде после переключений. </>
                )}
                {bothSignals && m07val <= 0.1 && (
                  <>Несмотря на частые переключения, Exploration Overhead низкий (M07 = {(m07val * 100).toFixed(0)}%) —
                  разработчики хорошо знают кодовую базу. </>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          M05 × M01 — Review Complexity vs Feedback Loop Latency
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
                label={{ value: 'Проблемная зона', position: 'insideTopRight', fill: '#e74c3c', fontSize: 11 }}
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
        {(() => {
          if (scatter.length < 4) return null
          const simple = scatter.filter(p => p.rci <= medRci)
          const complex = scatter.filter(p => p.rci > medRci)
          if (!simple.length || !complex.length) return null
          const avgSimple = simple.reduce((s, p) => s + p.m01, 0) / simple.length
          const avgComplex = complex.reduce((s, p) => s + p.m01, 0) / complex.length
          const ratio = avgSimple > 0 ? avgComplex / avgSimple : 0
          if (ratio <= 1.5) return null
          return (
            <div className="mt-3 p-3 rounded-lg border border-yellow-600/40 bg-yellow-900/20 flex items-start gap-2">
              <span className="text-yellow-400 text-lg flex-shrink-0"></span>
              <div>
                <div className="text-sm font-semibold text-yellow-400 mb-0.5">
                  Сложные PR ждут ответа в {ratio.toFixed(1)}× дольше
                </div>
                <div className="text-xs text-gray-400">
                  {complex.length} PR с высокой сложностью (RCI {'>'} {medRci.toFixed(2)}) ждут первого ответа
                  в среднем {formatHours(avgComplex)}. {simple.length} PR с низкой сложностью —
                  в среднем {formatHours(avgSimple)}.
                </div>
              </div>
            </div>
          )
        })()}
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          M06 — Requirements Clarity Score (weekly)
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
          M07 — Exploration Overhead
        </h2>
        {bundle && !bundle.commit_files_loaded && (
          <div className="mb-3 p-3 rounded-lg border border-gray-700 bg-gray-800/50 flex items-start gap-2">
            <span className="text-gray-400 flex-shrink-0"></span>
            <div className="text-xs text-gray-400">
              Данные промежуточных коммитов не загружены. Для расчёта M07
              включите опцию «Загружать данные коммитов» в настройках.
            </div>
          </div>
        )}
        <div className="bg-gray-900 rounded-xl p-4 space-y-2">
          {modules.length === 0 ? (
            <div className="text-gray-400 text-sm">Нет данных о файловых изменениях</div>
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
                        <span className="ml-3 text-gray-400">{mod.activity} PR</span>
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
