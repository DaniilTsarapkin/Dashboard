import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../store'
import type { Role } from '../types'

const ROLES: { value: Role; label: string; description: string }[] = [
  { value: 'Developer',           label: 'Developer',           description: 'Главная и Нагрузка' },
  { value: 'Tech Lead',           label: 'Tech Lead',           description: 'Все экраны + таймлайн PR' },
  { value: 'Engineering Manager', label: 'Engineering Manager', description: 'Главная, Риски, обзор остальных' },
  { value: 'Admin',               label: 'Admin',               description: 'Все экраны + Настройки' },
]

const ROLE_PASSWORDS: Record<Role, string> = {
  'Developer': '123',
  'Tech Lead': '123',
  'Engineering Manager': '123',
  'Admin': '123',
}

export default function LoadPage() {
  const navigate = useNavigate()
  const { setRole, setAuthPassword } = useDashboard()

  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleRoleClick(role: Role) {
    setSelectedRole(role)
    setPassword('')
    setError('')
  }

  function handleLogin() {
    if (!selectedRole) return
    if (password !== ROLE_PASSWORDS[selectedRole]) {
      setError('Неверный пароль')
      return
    }
    setRole(selectedRole)
    setAuthPassword(password)
    navigate('/dashboard')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <div className="max-w-md mx-auto mt-20">
      <div className="text-center mb-8">
        <span className="text-5xl"></span>
        <h1 className="text-2xl font-bold mt-3">DX Dashboard</h1>
        <p className="text-gray-400 mt-1">Диагностика трения в процессах разработки</p>
      </div>

      <div className="bg-gray-900 rounded-xl p-6">
        {!selectedRole ? (
          <>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
              Выберите роль
            </h2>
            <div className="flex flex-col gap-3">
              {ROLES.map(({ value, label, description }) => (
                <button
                  key={value}
                  onClick={() => handleRoleClick(value)}
                  className="flex items-center justify-between bg-gray-800 hover:bg-gray-700 rounded-lg px-4 py-3 text-left transition-colors group"
                >
                  <div>
                    <div className="font-medium text-gray-100 group-hover:text-yellow-400 transition-colors">
                      {label}
                    </div>
                    <div className="text-xs text-gray-400">{description}</div>
                  </div>
                  <span className="text-gray-600 group-hover:text-yellow-400 transition-colors">→</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setSelectedRole(null)}
                className="text-gray-400 hover:text-white text-sm"
              >
                ← Назад
              </button>
              <span className="text-gray-600">|</span>
              <span className="text-sm text-yellow-400 font-medium">{selectedRole}</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Пароль</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  onKeyDown={handleKeyDown}
                  placeholder="Введите пароль"
                  autoFocus
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-yellow-400"
                />
              </div>

              {error && (
                <div className="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-sm text-red-300">
                  {error}
                </div>
              )}

              <button
                onClick={handleLogin}
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-semibold rounded px-4 py-2 text-sm transition-colors"
              >
                Войти
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
