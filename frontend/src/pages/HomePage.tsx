import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../store'
import { getCharts } from '../api'
import { groupStatus, topProblems, formatHours, formatMetric, generateExplanation } from '../utils/metrics'
import MetricCard from '../components/MetricCard'
import Sparkline from '../components/Sparkline'
import EmptyState from '../components/EmptyState'

const GROUP_META = [
  { id: 1, icon: '', name: 'Поток и трение',       path: '/dashboard/flow' },
  { id: 2, icon: '', name: 'Когнитивная нагрузка', path: '/dashboard/load' },
  { id: 3, icon: '', name: 'Безопасность',         path: '/dashboard/flow' },
  { id: 4, icon: '', name: 'Культура',             path: '/dashboard/team' },
  { id: 5, icon: '', name: 'Орг. здоровье',        path: '/dashboard/risks' },
]

const SPARKLINE_DEFS = [
  { key: 'm01' as const, label: 'M01 Latency',    color: '#e74c3c', refLine: undefined },
  { key: 'm02' as const, label: 'M02 Blockage',   color: '#3498db', refLine: undefined },
  { key: 'm05' as const, label: 'M05 Complexity', color: '#9b59b6', refLine: undefined },
  { key: 'm09' as const, label: 'M09 Rework',     color: '#e67e22', refLine: 0.15 },
  { key: 'm12' as const, label: 'M12 Safety',     color: '#2ecc71', refLine: 0.5 },
  { key: 'm16' as const, label: 'M16 Waste',       color: '#f1c40f', refLine: undefined },
]

export default function HomePage() {
  const { bundle, snapshot, charts, setCharts, role } = useDashboard()
  const navigate = useNavigate()

  useEffect(() => {
    if (!charts) {
      getCharts().then(setCharts).catch(console.error)
    }
  }, [charts, setCharts])

  if (!bundle || !snapshot) {
    return <EmptyState />
  }

  const waste = snapshot.m16_waste

  return (
    <div>
      <h1 className="text-xl font-bold mb-6 text-gray-100">
        Пульс репозитория
      </h1>

      <div className="grid grid-cols-5 gap-3 mb-6">
        {GROUP_META.map(({ id, icon, name, path }) => {
          const { color, label } = groupStatus(snapshot, id)
          return (
            <div
              key={id}
              className="bg-gray-900 rounded-xl p-3 text-center cursor-pointer hover:bg-gray-800 transition-colors"
              style={{ border: `2px solid ${color}` }}
              onClick={() => navigate(path)}
            >
              <div className="text-2xl mb-1">{icon}</div>
              <div className="text-xs text-gray-400 mb-1">{name}</div>
              <div className="text-xs font-semibold" style={{ color }}>{label}</div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="col-span-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Главные проблемы
          </h2>
          {topProblems(snapshot, 3).length === 0 ? (
            <div className="bg-gray-900 rounded-xl p-4 text-green-400 text-sm">
              Все метрики в норме
            </div>
          ) : (
            topProblems(snapshot, 3).map(([id, m]) => (
              <MetricCard
                key={id}
                label={id}
                value={formatMetric(id, m.value)}
                metric={m}
                explanation={generateExplanation(id, m)}
              />
            ))
          )}
        </div>

        <div className="col-span-2">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Стоимость потерь
          </h2>
          <div className="bg-gray-900 rounded-xl p-4">
            <div className="text-3xl font-bold text-white mb-3">
              {formatHours(waste.total_hours)}
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Инфраструктура</span>
                <span>{formatHours(waste.infra_wait_hours)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Блокировки</span>
                <span>{formatHours(waste.blockage_hours)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Переделки</span>
                <span>{formatHours(waste.rework_hours)}</span>
              </div>
            </div>
            {(role === 'Engineering Manager' || role === 'Admin') && (
              <div className="mt-4 pt-3 border-t border-gray-800">
                <div className="text-xs text-gray-400">M15 Онбординг</div>
                <div className="text-lg font-semibold">
                  {snapshot.m15_days.toFixed(1)} дн.
                  <span className="text-sm text-gray-400 ml-1">
                    ({snapshot.m15_n} уч.)
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Динамика по неделям
      </h2>
      <div className="grid grid-cols-6 gap-3">
        {SPARKLINE_DEFS.map(({ key, label, color, refLine }) => {
          const labels  = charts?.weekly.labels  ?? []
          const values  = charts?.weekly[key] ?? []
          return (
            <div key={key} className="bg-gray-900 rounded-xl p-3">
              <div className="text-xs text-gray-400 mb-1">{label}</div>
              <Sparkline labels={labels} values={values} color={color} refLine={refLine} />
              <div className="text-xs text-gray-400 mt-1">
                Сейчас: {key === 'm16'
                  ? formatHours(snapshot.m16_waste.total_hours)
                  : formatMetric(key.toUpperCase(), (snapshot as any)[key].value)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
