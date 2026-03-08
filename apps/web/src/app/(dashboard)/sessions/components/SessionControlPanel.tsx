'use client'
import { useState, useTransition, useEffect, useCallback } from 'react'
import { updateSessionStatusAction, nextTrackAction, getSessionScoresAction } from '../actions'

type SessionStatus = 'pending' | 'active' | 'paused' | 'ended' | 'test_ended'

type Session = {
  id: string
  gameType: 'blindtest' | 'quiz'
  status: SessionStatus
  playlistId: string | null
  currentTrackIndex: number
  isTestMode: string
  startedAt: Date | null
  endedAt: Date | null
}

type Playlist = {
  id: string
  name: string
}

type ScoreRow = {
  id: string
  viewerUsername: string
  viewerDisplayName: string
  score: number
  correctAnswers: number
}

type Props = {
  session: Session
  playlists: Playlist[]
  onSessionUpdated: (sessionId: string) => void
}

const STATUS_LABELS: Record<SessionStatus, string> = {
  pending: 'Pending',
  active: 'Active',
  paused: 'Paused',
  ended: 'Ended',
  test_ended: 'Test Ended',
}

const STATUS_COLORS: Record<SessionStatus, string> = {
  pending: 'bg-yellow-500',
  active: 'bg-green-500',
  paused: 'bg-orange-500',
  ended: 'bg-gray-500',
  test_ended: 'bg-gray-500',
}

export default function SessionControlPanel({ session, playlists, onSessionUpdated }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [scores, setScores] = useState<ScoreRow[] | null>(null)
  const [scoresLoading, setScoresLoading] = useState(false)

  const playlist = playlists.find((p) => p.id === session.playlistId)

  const isActiveOrPaused = session.status === 'active' || session.status === 'paused'

  function handleAction(action: 'launch' | 'pause' | 'resume' | 'end') {
    setError(null)
    startTransition(async () => {
      const result = await updateSessionStatusAction(session.id, action)
      if ('error' in result && result.error) {
        setError(String(result.error))
      } else {
        onSessionUpdated(session.id)
      }
    })
  }

  function handleNextTrack() {
    setError(null)
    startTransition(async () => {
      const result = await nextTrackAction(session.id)
      if ('error' in result && result.error) {
        setError(String(result.error))
      } else {
        onSessionUpdated(session.id)
      }
    })
  }

  const loadScores = useCallback(async () => {
    setScoresLoading(true)
    try {
      const result = await getSessionScoresAction(session.id)
      if (Array.isArray(result)) {
        setScores(result as ScoreRow[])
      }
    } finally {
      setScoresLoading(false)
    }
  }, [session.id])

  // Keyboard hotkeys
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        return
      }

      if (e.code === 'Space') {
        e.preventDefault()
        if (session.status === 'active') handleAction('pause')
        else if (session.status === 'paused') handleAction('resume')
      } else if (e.code === 'ArrowRight' || e.key === 'n') {
        if (isActiveOrPaused) handleNextTrack()
      } else if (e.code === 'Escape') {
        if (isActiveOrPaused) handleAction('end')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.status, isActiveOrPaused])

  return (
    <div className="bg-gray-800 p-6 rounded-lg space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Session Control</h2>
        <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${STATUS_COLORS[session.status]}`}>
          {STATUS_LABELS[session.status]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-400">Game Type</span>
          <p className="text-white capitalize">{session.gameType}</p>
        </div>
        <div>
          <span className="text-gray-400">Playlist</span>
          <p className="text-white">{playlist?.name ?? 'Unknown'}</p>
        </div>
        <div>
          <span className="text-gray-400">Current Track</span>
          <p className="text-white">#{session.currentTrackIndex + 1}</p>
        </div>
        <div>
          <span className="text-gray-400">Mode</span>
          <p className="text-white">{session.isTestMode === 'true' ? 'Test' : 'Live'}</p>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3 flex-wrap">
        {session.status === 'pending' && (
          <button
            onClick={() => handleAction('launch')}
            disabled={isPending}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded font-medium"
          >
            Launch
          </button>
        )}
        {session.status === 'active' && (
          <button
            onClick={() => handleAction('pause')}
            disabled={isPending}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-4 py-2 rounded font-medium"
          >
            Pause
          </button>
        )}
        {session.status === 'paused' && (
          <button
            onClick={() => handleAction('resume')}
            disabled={isPending}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded font-medium"
          >
            Resume
          </button>
        )}
        {isActiveOrPaused && (
          <button
            onClick={handleNextTrack}
            disabled={isPending}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded font-medium"
          >
            Next Track
          </button>
        )}
        {isActiveOrPaused && (
          <button
            onClick={() => handleAction('end')}
            disabled={isPending}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded font-medium"
          >
            End
          </button>
        )}
      </div>

      {isActiveOrPaused && (
        <p className="text-gray-500 text-xs">
          Hotkeys: <kbd>Space</kbd> pause/resume &nbsp; <kbd>→</kbd> or <kbd>N</kbd> next track &nbsp; <kbd>Esc</kbd> end
        </p>
      )}

      {/* Leaderboard section */}
      <div className="border-t border-gray-700 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-medium">Leaderboard</h3>
          <button
            onClick={() => void loadScores()}
            disabled={scoresLoading}
            className="text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 px-3 py-1 rounded"
          >
            {scoresLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {scores === null ? (
          <p className="text-gray-500 text-sm">Click Refresh to load scores.</p>
        ) : scores.length === 0 ? (
          <p className="text-gray-500 text-sm">No scores yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-left">
                <th className="pb-1 w-8">#</th>
                <th className="pb-1">Viewer</th>
                <th className="pb-1 text-right">Score</th>
                <th className="pb-1 text-right">Correct</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((row, index) => (
                <tr key={row.id} className="text-white border-t border-gray-700">
                  <td className="py-1 text-gray-400">{index + 1}</td>
                  <td className="py-1">{row.viewerDisplayName}</td>
                  <td className="py-1 text-right font-medium">{row.score}</td>
                  <td className="py-1 text-right text-gray-400">{row.correctAnswers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
