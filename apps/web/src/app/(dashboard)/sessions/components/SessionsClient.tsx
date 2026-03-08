'use client'
import { useState } from 'react'
import NewSessionForm from './NewSessionForm'
import SessionControlPanel from './SessionControlPanel'

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
  createdAt: Date
}

type Playlist = {
  id: string
  name: string
}

type Props = {
  initialSessions: Session[]
  playlists: Playlist[]
}

const STATUS_COLORS: Record<SessionStatus, string> = {
  pending: 'bg-yellow-500',
  active: 'bg-green-500',
  paused: 'bg-orange-500',
  ended: 'bg-gray-500',
  test_ended: 'bg-gray-500',
}

export default function SessionsClient({ initialSessions, playlists }: Props) {
  const [sessions] = useState<Session[]>(initialSessions)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)

  const selectedSession = sessions.find((s) => s.id === selectedId) ?? null

  function handleCreated(_sessionId: string) {
    setShowNewForm(false)
    window.location.reload()
  }

  function handleSessionUpdated(_sessionId: string) {
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Sessions</h1>
        {!showNewForm && (
          <button
            onClick={() => { setShowNewForm(true); setSelectedId(null) }}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded font-medium"
          >
            New Session
          </button>
        )}
      </div>

      {showNewForm && (
        <NewSessionForm
          playlists={playlists}
          onCreated={handleCreated}
          onCancel={() => setShowNewForm(false)}
        />
      )}

      {selectedSession && !showNewForm && (
        <SessionControlPanel
          session={selectedSession}
          playlists={playlists}
          onSessionUpdated={handleSessionUpdated}
        />
      )}

      {sessions.length === 0 ? (
        <p className="text-gray-400">No sessions yet. Create your first session above.</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => {
            const playlist = playlists.find((p) => p.id === session.playlistId)
            return (
              <div
                key={session.id}
                onClick={() => { setSelectedId(session.id); setShowNewForm(false) }}
                className={`flex items-center justify-between p-4 rounded-lg cursor-pointer border transition-colors ${
                  selectedId === session.id
                    ? 'bg-gray-700 border-purple-500'
                    : 'bg-gray-800 border-gray-700 hover:border-gray-500'
                }`}
              >
                <div>
                  <p className="text-white font-medium capitalize">
                    {session.gameType} — {playlist?.name ?? 'Unknown playlist'}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    {new Date(session.createdAt).toLocaleString()}
                    {session.isTestMode === 'true' && ' · Test mode'}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-bold text-white ${STATUS_COLORS[session.status]}`}>
                  {session.status}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
