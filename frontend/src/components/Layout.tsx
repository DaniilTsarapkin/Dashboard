import { useEffect, useRef } from 'react'
import { Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom'
import { useDashboard } from '../store'
import { getAdminStatus, getBundleInfo, getSnapshot, getCharts } from '../api'
import RangeSlider from './RangeSlider'
import type { Role } from '../types'

const NAV_ITEMS: { path: string; label: string; roles: Role[] }[] = [
  { path: '/dashboard',       label: 'Главная',    roles: ['Developer', 'Tech Lead', 'Engineering Manager', 'Admin'] },
  { path: '/dashboard/flow',  label: 'Поток',      roles: ['Tech Lead', 'Engineering Manager', 'Admin'] },
  { path: '/dashboard/load',  label: 'Нагрузка',   roles: ['Developer', 'Tech Lead', 'Engineering Manager', 'Admin'] },
  { path: '/dashboard/team',  label: 'Команда',    roles: ['Tech Lead', 'Engineering Manager', 'Admin'] },
  { path: '/dashboard/risks', label: 'Риски',      roles: ['Tech Lead', 'Engineering Manager', 'Admin'] },
  { path: '/dashboard/reference', label: 'Справка',  roles: ['Developer', 'Tech Lead', 'Engineering Manager', 'Admin'] },
  { path: '/admin',              label: 'Настройки',  roles: ['Admin'] },
]

export default function Layout() {
  const {
    bundle, role, setBundle, setSnapshot, setCharts,
    viewFrom, viewTo, setViewRange, windowDays, setWindowDays,
  } = useDashboard()
  const navigate = useNavigate()
  const location = useLocation()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isOnDashboard = location.pathname.startsWith('/dashboard') || location.pathname === '/admin'

  useEffect(() => {
    if (bundle) return
    getAdminStatus()
      .then(status => {
        if (!status.configured) return
        const days = status.window_days || 90
        setWindowDays(days)
        setViewRange(days, 0)
        return getBundleInfo()
          .then(b => {
            setBundle(b)
            return Promise.all([getSnapshot(days), getCharts()])
          })
          .then(([snap, charts]) => {
            setSnapshot(snap)
            setCharts(charts)
          })
      })
      .catch(() => {})
  }, [])

  function handleRangeChange(from: number, to: number) {
    setViewRange(from, to)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (!bundle) return
      Promise.all([
        getSnapshot(90, from, to),
        getCharts(from, to),
      ]).then(([snap, charts]) => {
        setSnapshot(snap)
        setCharts(charts)
      }).catch(() => {})
    }, 400)
  }

  const visibleNav = NAV_ITEMS.filter(item => item.roles.includes(role))

  return (
    <div className="h-screen bg-gray-950 text-gray-100 flex flex-col overflow-hidden">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg">DX Dashboard</span>
          {bundle && (
            <span className="text-gray-400 text-sm ml-2">
              {bundle.owner}/{bundle.repo}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {isOnDashboard && (
            <span className="text-sm text-gray-400">{role}</span>
          )}
          {isOnDashboard && (
            <button
              onClick={() => navigate('/')}
              className="text-sm text-gray-400 hover:text-white"
            >
              Сменить роль
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {isOnDashboard && (
          <nav className="w-48 bg-gray-900 border-r border-gray-800 flex-shrink-0 py-4 flex flex-col overflow-hidden">
            <div className="flex-1">
              {visibleNav.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/dashboard'}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                      isActive
                        ? 'bg-gray-800 text-yellow-400 font-medium border-r-2 border-yellow-400'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>

            {bundle && (
              <div className="px-3 pt-4 border-t border-gray-800 space-y-3">
                <div>
                  <div className="text-xs text-gray-400 mb-2">Период просмотра</div>
                  <RangeSlider
                    min={0}
                    max={windowDays}
                    from={viewFrom}
                    to={viewTo}
                    onChange={handleRangeChange}
                  />
                </div>
                <div>
                  <div className="text-xs text-gray-400">PRs: {bundle.pr_count}</div>
                  <div className="text-xs text-gray-400">Issues: {bundle.issue_count}</div>
                </div>
              </div>
            )}
          </nav>
        )}

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
