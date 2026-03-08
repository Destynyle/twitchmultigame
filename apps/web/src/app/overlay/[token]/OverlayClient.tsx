'use client'

import { useEffect, useRef, useState } from 'react'

interface ScoringEvent {
  type: 'scoring'
  sessionId: string
  viewerUsername: string
  viewerDisplayName: string
  points: number
  reason: 'correct_title' | 'correct_artist' | 'correct_answer' | 'partial'
  timestamp: string
}

interface StateEvent {
  type: 'state'
  status: 'idle' | 'active' | 'paused' | 'ended'
  trackTitle?: string
  trackArtist?: string
  leaderboard?: Array<{ username: string; displayName: string; score: number }>
}

interface ConnectedEvent {
  type: 'connected'
  tenantId: string
}

type OverlayEvent = ScoringEvent | StateEvent | ConnectedEvent

const REASON_LABEL: Record<ScoringEvent['reason'], string> = {
  correct_title: 'found the title',
  correct_artist: 'found the artist',
  correct_answer: 'got it all',
  partial: 'partial match',
}

export default function OverlayClient({
  token,
  sseUrl,
}: {
  token: string
  sseUrl: string
}) {
  const [lastScore, setLastScore] = useState<ScoringEvent | null>(null)
  const [leaderboard, setLeaderboard] = useState<StateEvent['leaderboard']>([])
  const [gameStatus, setGameStatus] = useState<StateEvent['status']>('idle')
  const [trackInfo, setTrackInfo] = useState<{ title?: string; artist?: string }>({})
  const [showScore, setShowScore] = useState(false)
  const [cssVars, setCssVars] = useState<Record<string, string>>({})
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch theme CSS variables
  useEffect(() => {
    void fetch(`/api/overlay/${token}/theme`)
      .then((r) => r.json())
      .then((data: { cssVariables?: Record<string, string> }) => {
        if (data.cssVariables) setCssVars(data.cssVariables)
      })
      .catch(() => {})
  }, [token])

  useEffect(() => {
    let es: EventSource

    function connect() {
      es = new EventSource(sseUrl)

      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data as string) as OverlayEvent

          if (event.type === 'scoring') {
            setLastScore(event)
            setShowScore(true)
            if (hideTimer.current) clearTimeout(hideTimer.current)
            hideTimer.current = setTimeout(() => setShowScore(false), 5000)
          }

          if (event.type === 'state') {
            setGameStatus(event.status)
            if (event.leaderboard) setLeaderboard(event.leaderboard)
            if (event.trackTitle !== undefined)
              setTrackInfo({
                title: event.trackTitle,
                ...(event.trackArtist != null && { artist: event.trackArtist }),
              })
          }
        } catch {
          // ignore malformed messages
        }
      }

      es.onerror = () => {
        // EventSource auto-reconnects on error
      }
    }

    connect()

    return () => {
      es?.close()
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [sseUrl])

  return (
    <div
      style={{
        fontFamily: 'sans-serif',
        background: 'transparent',
        color: cssVars['--overlay-text'] ?? '#fff',
        padding: '16px',
        minHeight: '100vh',
        position: 'relative',
        ...cssVars,
      }}
    >
      {/* Scoring event banner */}
      {showScore && lastScore && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(124, 58, 237, 0.95)',
            borderRadius: '12px',
            padding: '12px 24px',
            textAlign: 'center',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            animation: 'fadeInDown 0.3s ease',
            zIndex: 100,
          }}
        >
          <div style={{ fontSize: '18px', fontWeight: 700 }}>
            🎉 {lastScore.viewerDisplayName}
          </div>
          <div style={{ fontSize: '14px', opacity: 0.85 }}>
            {REASON_LABEL[lastScore.reason]} — <strong>+{lastScore.points} pts</strong>
          </div>
        </div>
      )}

      {/* Track info (shown when game active) */}
      {gameStatus === 'active' && trackInfo.title && (
        <div
          style={{
            position: 'fixed',
            bottom: '80px',
            left: '16px',
            background: 'rgba(0,0,0,0.7)',
            borderRadius: '8px',
            padding: '8px 16px',
          }}
        >
          <div style={{ fontSize: '13px', opacity: 0.7 }}>Now playing</div>
          <div style={{ fontWeight: 600 }}>{trackInfo.title}</div>
          {trackInfo.artist && (
            <div style={{ fontSize: '13px', opacity: 0.8 }}>{trackInfo.artist}</div>
          )}
        </div>
      )}

      {/* Leaderboard */}
      {(leaderboard ?? []).length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: '16px',
            right: '16px',
            background: 'rgba(0,0,0,0.75)',
            borderRadius: '8px',
            padding: '10px 16px',
            minWidth: '180px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, opacity: 0.7, marginBottom: '6px' }}>
            LEADERBOARD
          </div>
          {(leaderboard ?? []).slice(0, 5).map((entry, i) => (
            <div
              key={entry.username}
              style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px', marginBottom: '3px' }}
            >
              <span>{i + 1}. {entry.displayName}</span>
              <span style={{ fontWeight: 700 }}>{entry.score}</span>
            </div>
          ))}
        </div>
      )}

      {/* Idle state CTA */}
      {gameStatus === 'idle' && (
        <div
          style={{
            position: 'fixed',
            bottom: '16px',
            left: '16px',
            background: 'rgba(0,0,0,0.6)',
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '12px',
            opacity: 0.8,
          }}
        >
          🎮 Start your own stream games at <strong>playground.gg</strong>
        </div>
      )}

      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      {/* Viewer-to-streamer CTA (FR39) */}
      {(gameStatus === 'active' || gameStatus === 'idle') && (
        <a
          href="https://playground.gg?utm_source=overlay&utm_campaign=viewer_cta&utm_medium=overlay"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            position: 'fixed',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(124, 58, 237, 0.75)',
            borderRadius: '20px',
            padding: '5px 14px',
            fontSize: '11px',
            color: '#fff',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(4px)',
          }}
        >
          🎮 Stream your own games → playground.gg
        </a>
      )}

      {/* Hidden token for debugging */}
      <span style={{ display: 'none' }} data-overlay-token={token} />
    </div>
  )
}
