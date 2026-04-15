import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPRTimeline } from '../api'
import type { PRDetail, TimelineEvent } from '../types'

function gapHours(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000
}

function GapBadge({ hours }: { hours: number }) {
  if (hours < 1) return null
  const color = hours >= 48 ? '#e74c3c' : hours >= 8 ? '#e67e22' : '#f1c40f'
  const label = hours >= 24
    ? `${Math.floor(hours / 24)} д ${Math.round(hours % 24)} ч перерыв`
    : `${hours.toFixed(1)} ч перерыв`
  return (
    <div className="flex items-center justify-center my-2">
      <div
        className="text-xs px-3 py-0.5 rounded-full font-medium"
        style={{ background: color + '22', color, border: `1px solid ${color}44` }}
      >
        {label}
      </div>
    </div>
  )
}

function EventCard({ event }: { event: TimelineEvent }) {
  const time = event.time
    ? new Date(event.time).toLocaleString('ru-RU', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—'

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400 flex-shrink-0">
          {event.type.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 w-px bg-gray-800 mt-1" />
      </div>
      <div className="bg-gray-900 rounded-lg p-3 mb-1 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-xs font-semibold text-gray-300">{event.type}</span>
            {event.actor && (
              <span className="text-xs text-gray-400 ml-2">@{event.actor}</span>
            )}
            {event.detail && (
              <p className="text-xs text-gray-400 mt-0.5">{event.detail}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xs text-gray-600">{time}</div>
            {event.metric && (
              <div className="text-xs text-yellow-400 font-mono mt-0.5">{event.metric}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TimelinePage() {
  const { prNumber } = useParams<{ prNumber: string }>()
  const navigate = useNavigate()
  const [pr, setPr] = useState<PRDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!prNumber) return
    getPRTimeline(Number(prNumber))
      .then(setPr)
      .catch(e => setError(e.message))
  }, [prNumber])

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-400 text-sm mb-3">{error}</div>
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-400 hover:text-white"
        >
          ← Назад
        </button>
      </div>
    )
  }

  if (!pr) {
    return <div className="text-gray-400">Загрузка…</div>
  }

  const events = pr.events
  const stateColor = pr.state === 'merged' ? '#9b59b6' : pr.state === 'closed' ? '#e74c3c' : '#2ecc71'

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-400 hover:text-gray-300 mb-4 flex items-center gap-1"
      >
        ← Назад
      </button>

      <div className="bg-gray-900 rounded-xl p-4 mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-yellow-400 text-sm">#{pr.number}</span>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: stateColor + '22', color: stateColor }}
              >
                {pr.state}
              </span>
            </div>
            <h1 className="text-base font-bold text-white">{pr.title}</h1>
            <div className="text-xs text-gray-400 mt-1">
              @{pr.author} · {pr.changed_files} файлов
            </div>
          </div>
        </div>
      </div>

      <div>
        {events.map((ev, i) => (
          <div key={i}>
            {i > 0 && ev.time && events[i - 1].time && (
              <GapBadge hours={gapHours(events[i - 1].time!, ev.time)} />
            )}
            <EventCard event={ev} />
          </div>
        ))}
      </div>
    </div>
  )
}
