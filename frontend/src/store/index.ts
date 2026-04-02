import { create } from 'zustand'
import type { MetricsSnapshot, BundleInfo, Role, ChartsData } from '../types'

const savedRole = (localStorage.getItem('dx_role') as Role) || 'Tech Lead'
const savedPassword = sessionStorage.getItem('dx_auth') || ''

interface DashboardState {
  bundle: BundleInfo | null
  snapshot: MetricsSnapshot | null
  charts: ChartsData | null

  role: Role
  authPassword: string
  windowDays: number
  viewFrom: number
  viewTo: number

  loading: boolean
  error: string | null

  setBundle: (bundle: BundleInfo) => void
  setSnapshot: (snapshot: MetricsSnapshot) => void
  setCharts: (charts: ChartsData) => void
  setRole: (role: Role) => void
  setAuthPassword: (pw: string) => void
  setWindowDays: (days: number) => void
  setViewRange: (from: number, to: number) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

export const useDashboard = create<DashboardState>((set) => ({
  bundle: null,
  snapshot: null,
  charts: null,
  role: savedRole,
  authPassword: savedPassword,
  windowDays: 90,
  viewFrom: 90,
  viewTo: 0,
  loading: false,
  error: null,

  setBundle:       (bundle)   => set({ bundle }),
  setSnapshot:     (snapshot) => set({ snapshot }),
  setCharts:       (charts)   => set({ charts }),
  setRole:         (role)     => { localStorage.setItem('dx_role', role); set({ role }) },
  setAuthPassword: (authPassword) => { sessionStorage.setItem('dx_auth', authPassword); set({ authPassword }) },
  setWindowDays:   (windowDays) => set({ windowDays }),
  setViewRange:    (viewFrom, viewTo) => set({ viewFrom, viewTo }),
  setLoading:      (loading)  => set({ loading }),
  setError:        (error)    => set({ error }),
  reset: () => set({ bundle: null, snapshot: null, charts: null, error: null }),
}))
