import type { MetricResult, MetricsSnapshot } from '../types'

export interface Status {
  color: string
  label: string
}

export function getStatus(
  value: number,
  p50: number,
  p75: number,
  p90: number,
  inverse = false,
): Status {
  if (inverse) {
    if (value >= 0.7) return { color: '#2ecc71', label: 'В норме' }
    if (value >= 0.5) return { color: '#f1c40f', label: 'Требует внимания' }
    if (value >= 0.3) return { color: '#e67e22', label: 'Повышенное трение' }
    return { color: '#e74c3c', label: 'Аномалия' }
  }
  if (value <= p50) return { color: '#2ecc71', label: 'В норме' }
  if (value <= p75) return { color: '#f1c40f', label: 'Требует внимания' }
  if (value <= p90) return { color: '#e67e22', label: 'Повышенное трение' }
  return { color: '#e74c3c', label: 'Аномалия' }
}

export function metricStatus(m: MetricResult): Status {
  return getStatus(m.value, m.p50, m.p75, m.p90, m.inverse)
}

export function getSeverity(m: MetricResult): number {
  if (m.inverse) return Math.max(0, 0.5 - m.value)
  return Math.max(0, (m.value - m.p75) / (m.p90 - m.p75 + 1e-9))
}

export function getTrend(m: MetricResult): { arrow: string; color: string } {
  if (m.base_value === 0) return { arrow: '→', color: '#95a5a6' }
  const pctChange = (m.value - m.base_value) / Math.abs(m.base_value)
  if (Math.abs(pctChange) < 0.20) return { arrow: '→', color: '#95a5a6' }
  if (pctChange > 0) {
    return { arrow: '↑', color: m.inverse ? '#2ecc71' : '#e74c3c' }
  }
  return { arrow: '↓', color: m.inverse ? '#e74c3c' : '#2ecc71' }
}

export function groupStatus(snapshot: MetricsSnapshot, group: number): Status {
  const groups: Record<number, MetricResult[]> = {
    1: [snapshot.m01, snapshot.m02, snapshot.m03, snapshot.m04],
    2: [snapshot.m05, snapshot.m06, snapshot.m07],
    3: snapshot.m10_available
      ? [snapshot.m08, snapshot.m09, snapshot.m10]
      : [snapshot.m08, snapshot.m09],
    4: [snapshot.m11, snapshot.m12],
    5: [snapshot.m13, snapshot.m14],
  }
  const metrics = groups[group] ?? []
  if (!metrics.length) return { color: '#95a5a6', label: 'Нет данных' }
  const worst = metrics.reduce((a, b) => (getSeverity(a) >= getSeverity(b) ? a : b))
  return metricStatus(worst)
}

export function topProblems(
  snapshot: MetricsSnapshot,
  n = 3,
): Array<[string, MetricResult]> {
  const candidates: Array<[string, MetricResult]> = [
    ['M01', snapshot.m01], ['M02', snapshot.m02], ['M03', snapshot.m03],
    ['M04', snapshot.m04], ['M05', snapshot.m05], ['M06', snapshot.m06],
    ['M07', snapshot.m07], ['M08', snapshot.m08], ['M09', snapshot.m09],
    ['M11', snapshot.m11], ['M12', snapshot.m12],
  ]
  if (snapshot.m10_available) candidates.push(['M10', snapshot.m10])
  return candidates
    .filter(([, m]) => getSeverity(m) > 0)
    .sort((a, b) => getSeverity(b[1]) - getSeverity(a[1]))
    .slice(0, n)
}

export function formatHours(h: number): string {
  if (h < 24) return `${h.toFixed(1)} ч`
  const days = Math.floor(h / 24)
  const rem  = Math.round(h % 24)
  return rem > 0 ? `${days} д ${rem} ч` : `${days} д`
}

export function formatPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`
}

export function formatMetric(id: string, value: number): string {
  if (['M01', 'M02', 'M04', 'M10'].includes(id)) return formatHours(value)
  if (id === 'M09') return formatPct(value)
  return value.toFixed(2)
}

export function generateExplanation(id: string, m: MetricResult): string {
  const val = formatMetric(id, m.value)
  const p75 = formatMetric(id, m.p75)
  const p90 = formatMetric(id, m.p90)

  const trendPct = m.base_value !== 0
    ? ((m.value - m.base_value) / Math.abs(m.base_value) * 100)
    : 0
  const trendStr = trendPct === 0
    ? 'стабильно'
    : `${trendPct > 0 ? '+' : ''}${trendPct.toFixed(0)}%`

  const status = m.inverse
    ? (m.value >= 0.7 ? 'в норме' : m.value >= 0.5 ? 'требует внимания' : 'тревожная зона')
    : (m.value <= m.p50 ? 'в норме'
       : m.value <= m.p75 ? 'превышает медиану репозитория'
       : m.value <= m.p90 ? `превышает P75 (${p75})`
       : `превышает P90 (${p90})`)

  const templates: Record<string, string> = {
    M01: `Медианное ожидание первого ответа — ${val}, ${status}. Тренд: ${trendStr}`,
    M02: `Медианное суммарное время ожидания на PR — ${val}, ${status}. Тренд: ${trendStr}`,
    M03: `Медиана уникальных контекстов в час — ${val}, ${status}. Тренд: ${trendStr}`,
    M04: `Медианное время возврата к своей задаче после прерывания — ${val}, ${status}. Тренд: ${trendStr}`,
    M05: `Медианная сложность ревью — ${val}, ${status}. Тренд: ${trendStr}`,
    M06: `Ясность требований — ${val} (1.0 = идеально, нет переделок), ${status}. Тренд: ${trendStr}`,
    M07: `Доля тупиковых правок в коммитах — ${val}, ${status}. Тренд: ${trendStr}`,
    M08: `Безопасность среды — ${val} (1.0 = нет хотфиксов и откатов), ${status}. Тренд: ${trendStr}`,
    M09: `Доля закрытых элементов переоткрытых за 14 дней — ${val}, ${status}. Тренд: ${trendStr}`,
    M10: `Медианное время ожидания CI — ${val}, ${status}. Тренд: ${trendStr}`,
    M11: `Медианное коммуникационное трение на PR — ${val}, ${status}. Тренд: ${trendStr}`,
    M12: `Сигнал психологической безопасности — ${val} (1.0 = только позитив), ${status}. Тренд: ${trendStr}`,
    M13: `Доля активности команды вне привычного ритма — ${val}, ${status}. Тренд: ${trendStr}`,
    M14: `Доля модулей с концентрацией знаний у одного человека — ${val}, ${status}. Тренд: ${trendStr}`,
  }

  return templates[id] ?? `Значение: ${val} · P75: ${p75} · P90: ${p90} · Тренд: ${trendStr}`
}

export function heatColor(v: number): string {
  if (v <= 0) return '#2ecc71'
  if (v < 0.4) {
    const t = v / 0.4
    const r = Math.round(46  + (241 - 46)  * t)
    const g = Math.round(204 + (196 - 204) * t)
    const b = Math.round(113 + (15  - 113) * t)
    return `rgb(${r},${g},${b})`
  }
  const t = Math.min((v - 0.4) / 0.6, 1)
  const r = Math.round(241 + (231 - 241) * t)
  const g = Math.round(196 + (76  - 196) * t)
  const b = Math.round(15  + (60  - 15)  * t)
  return `rgb(${r},${g},${b})`
}
