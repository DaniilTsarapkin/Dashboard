import type { LoadRequest, MetricsSnapshot, BundleInfo, ChartsData, PRDetail, AdminStatus } from '../types'

const BASE = '/api'

export async function loadData(req: LoadRequest): Promise<BundleInfo> {
  const res = await fetch(`${BASE}/load`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Ошибка загрузки данных')
  }
  return res.json()
}

export async function getSnapshot(window_days: number, fromDays?: number, toDays?: number): Promise<MetricsSnapshot> {
  const params = new URLSearchParams({ window_days: String(window_days) })
  if (fromDays !== undefined) params.set('from_days', String(fromDays))
  if (toDays !== undefined) params.set('to_days', String(toDays))
  const res = await fetch(`${BASE}/metrics/snapshot?${params}`)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Ошибка получения метрик')
  }
  return res.json()
}

export async function getCharts(fromDays?: number, toDays?: number): Promise<ChartsData> {
  const params = new URLSearchParams()
  if (fromDays !== undefined) params.set('from_days', String(fromDays))
  if (toDays !== undefined) params.set('to_days', String(toDays))
  const qs = params.toString()
  const res = await fetch(`${BASE}/charts/all${qs ? '?' + qs : ''}`)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Ошибка получения данных графиков')
  }
  return res.json()
}

export async function getPRTimeline(prNumber: number): Promise<PRDetail> {
  const res = await fetch(`${BASE}/prs/${prNumber}`)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || `PR #${prNumber} не найден`)
  }
  return res.json()
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`)
    return res.ok
  } catch {
    return false
  }
}

export async function getAdminStatus(): Promise<AdminStatus> {
  const res = await fetch(`${BASE}/admin/status`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Ошибка получения статуса: ${res.status}`)
  }
  return res.json()
}

export async function getBundleInfo(): Promise<BundleInfo> {
  const res = await fetch(`${BASE}/bundle`)
  if (!res.ok) throw new Error('Данные не загружены')
  return res.json()
}

export async function saveAdminConfigOnly(data: {
  token: string; owner: string; repo: string;
  window_days: number; admin_password: string;
  load_commit_files?: boolean
}): Promise<void> {
  const res = await fetch(`${BASE}/admin/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Ошибка сохранения конфигурации')
  }
}

export async function saveAdminConfig(data: {
  token: string; owner: string; repo: string;
  window_days: number; admin_password: string;
  load_commit_files?: boolean
}): Promise<BundleInfo> {
  const res = await fetch(`${BASE}/admin/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Ошибка сохранения конфигурации')
  }
  return res.json()
}

export async function clearAdminConfig(admin_password: string): Promise<void> {
  const res = await fetch(`${BASE}/admin/config`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ admin_password }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Ошибка очистки конфигурации')
  }
}
