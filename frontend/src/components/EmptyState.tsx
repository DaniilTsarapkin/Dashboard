import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../store'

export default function EmptyState() {
  const { role } = useDashboard()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <span className="text-5xl mb-4 opacity-40"></span>
      <h2 className="text-lg font-semibold text-gray-300 mb-2">Нет данных</h2>
      <p className="text-sm text-gray-400 mb-6 max-w-xs">
        Данные ещё не загружены. Попросите администратора настроить репозиторий в разделе «Настройки».
      </p>
      {role === 'Admin' && (
        <button
          onClick={() => navigate('/admin')}
          className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-semibold rounded px-4 py-2 text-sm transition-colors"
        >
          Перейти в настройки
        </button>
      )}
    </div>
  )
}
