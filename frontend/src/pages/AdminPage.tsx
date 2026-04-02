import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../store'
import { getAdminStatus, saveAdminConfigOnly, saveAdminConfig, clearAdminConfig, getSnapshot } from '../api'
import type { AdminStatus } from '../types'

export default function AdminPage() {
  const navigate = useNavigate()
  const {
    setBundle, setSnapshot,
    setWindowDays: setStoreWindowDays, setViewRange,
    authPassword,
  } = useDashboard()

  const [status, setStatus] = useState<AdminStatus | null>(null)
  const [token, setToken] = useState('')
  const [repo, setRepo] = useState('')
  const [windowDays, setWindowDays] = useState(90)
  const [loadCommitFiles, setLoadCommitFiles] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    getAdminStatus().then(s => {
      setStatus(s)
      if (s.owner && s.repo) setRepo(`${s.owner}/${s.repo}`)
      if (s.window_days) setWindowDays(s.window_days)
    })
  }, [])

  function _validate(): { owner: string; repoName: string } | null {
    if (!repo || !repo.includes('/')) {
      setLocalError('Введите репозиторий в формате owner/repo')
      return null
    }
    if (!token && !status?.configured) {
      setLocalError('Введите GitHub токен')
      return null
    }
    const [owner, repoName] = repo.split('/')
    return { owner, repoName }
  }

  async function handleSaveOnly() {
    const v = _validate()
    if (!v) return
    setLocalError(null)
    setSuccess(null)

    try {
      await saveAdminConfigOnly({
        token, owner: v.owner, repo: v.repoName,
        window_days: windowDays, admin_password: authPassword,
        load_commit_files: loadCommitFiles,
      })
      setStatus({ configured: true, loaded: status?.loaded ?? false, owner: v.owner, repo: v.repoName, window_days: windowDays })
      setStoreWindowDays(windowDays)
      setViewRange(windowDays, 0)
      setSuccess('Конфигурация сохранена')
    } catch (e: any) {
      setLocalError(e.message)
    }
  }

  async function handleLoad() {
    const v = _validate()
    if (!v) return
    setLocalError(null)
    setSuccess(null)

    const payload = {
      token, owner: v.owner, repo: v.repoName,
      window_days: windowDays, admin_password: authPassword,
      load_commit_files: loadCommitFiles,
    }

    try {
      await saveAdminConfigOnly(payload)
      setStatus({ configured: true, loaded: false, owner: v.owner, repo: v.repoName, window_days: windowDays })
      setStoreWindowDays(windowDays)
      setViewRange(windowDays, 0)
      setSuccess('Конфигурация сохранена. Загрузка данных...')
    } catch (e: any) {
      setLocalError(e.message)
      return
    }

    setSaving(true)
    try {
      const bundle = await saveAdminConfig(payload)
      setBundle(bundle)
      setStatus({ configured: true, loaded: true, owner: v.owner, repo: v.repoName, window_days: windowDays })
      setSuccess(`Данные загружены: ${bundle.pr_count} PR, ${bundle.issue_count} issues`)
      getSnapshot(windowDays).then(setSnapshot).catch(() => {})
    } catch (e: any) {
      setLocalError(`Конфигурация сохранена, но загрузка не удалась: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    setLocalError(null)
    setSuccess(null)
    try {
      await clearAdminConfig(authPassword)
      setStatus({ configured: false, loaded: false })
      setSuccess('Конфигурация очищена')
      setToken('')
      setRepo('')
    } catch (e: any) {
      setLocalError(e.message)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold mb-6">Настройки</h1>

      {status && (
        <div className="bg-gray-900 rounded-xl p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Текущий статус
          </h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Конфигурация</span>
              <span className={status.configured ? 'text-green-400' : 'text-red-400'}>
                {status.configured ? 'Сохранена' : 'Не настроена'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Данные</span>
              <span className={status.loaded ? 'text-green-400' : 'text-yellow-400'}>
                {status.loaded ? 'Загружены' : 'Не загружены'}
              </span>
            </div>
            {status.owner && (
              <div className="flex justify-between">
                <span className="text-gray-400">Репозиторий</span>
                <span className="text-gray-200">{status.owner}/{status.repo}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-gray-900 rounded-xl p-6 flex flex-col gap-4">
        <div>
          <label className="text-sm text-gray-400 mb-1 block">GitHub Token</label>
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder={status?.configured ? '••••••• (сохранён на сервере)' : 'ghp_...'}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-yellow-400"
          />
          {status?.configured && !token && (
            <p className="text-xs text-gray-600 mt-1">
              Токен хранится на сервере. Заполните только при смене токена.
            </p>
          )}
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-1 block">Репозиторий</label>
          <input
            type="text"
            value={repo}
            onChange={e => setRepo(e.target.value)}
            placeholder="owner/repo"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-yellow-400"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-1 block">
            Период загрузки: <span className="text-gray-200 font-medium">{windowDays}</span> дней
          </label>
          <input
            type="range"
            min={1} max={180} step={1}
            value={windowDays}
            onChange={e => setWindowDays(Number(e.target.value))}
            className="w-full accent-yellow-400 cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-0.5">
            <span>1</span>
            <span>180</span>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={loadCommitFiles}
            onChange={e => setLoadCommitFiles(e.target.checked)}
            className="accent-yellow-400 w-4 h-4"
          />
          <span className="text-sm text-gray-400">
            Загружать данные коммитов для M07
          </span>
          <span className="text-xs text-gray-600">(медленнее, расходует rate limit)</span>
        </label>

        {localError && (
          <div className="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-sm text-red-300">
            {localError}
          </div>
        )}
        {success && (
          <div className="bg-green-900/40 border border-green-700 rounded px-3 py-2 text-sm text-green-300">
            {success}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSaveOnly}
            disabled={saving}
            className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-semibold rounded px-4 py-2 transition-colors"
          >
            Сохранить
          </button>
          <button
            onClick={handleLoad}
            disabled={saving}
            className="flex-1 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-900 font-bold rounded px-4 py-2 transition-colors"
          >
            {saving ? 'Загрузка...' : 'Загрузить данные'}
          </button>
          {status?.configured && (
            <button
              onClick={handleClear}
              disabled={saving}
              className="bg-red-900/50 hover:bg-red-900 disabled:opacity-50 text-red-300 rounded px-4 py-2 text-sm transition-colors"
            >
              Очистить
            </button>
          )}
        </div>

        {status?.loaded && (
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-blue-400 hover:text-blue-300 text-center"
          >
            Перейти к дашборду →
          </button>
        )}
      </div>
    </div>
  )
}
