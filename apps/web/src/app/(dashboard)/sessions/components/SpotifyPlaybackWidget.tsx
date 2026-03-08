'use client'
import { useState, useEffect, useRef } from 'react'
import Script from 'next/script'
import { getSpotifyAccessTokenAction, getCurrentTrackAction } from '../actions'

// ─── Spotify Web Playback SDK type declarations ────────────────────────────────

interface SpotifyPlayer {
  connect(): Promise<boolean>
  disconnect(): void
  addListener(event: 'ready', cb: (state: { device_id: string }) => void): void
  addListener(event: 'not_ready', cb: (state: { device_id: string }) => void): void
  addListener(event: 'authentication_error', cb: (err: { message: string }) => void): void
  addListener(event: 'account_error', cb: (err: { message: string }) => void): void
  addListener(event: 'initialization_error', cb: (err: { message: string }) => void): void
  addListener(event: 'player_state_changed', cb: (state: SpotifyPlaybackState | null) => void): void
}

interface SpotifyPlaybackState {
  paused: boolean
  track_window: {
    current_track: {
      name: string
      artists: { name: string }[]
    }
  }
}

interface SpotifyPlayerConstructorOptions {
  name: string
  getOAuthToken: (cb: (token: string) => void) => void
  volume?: number
}

declare global {
  interface Window {
    Spotify: {
      Player: new (options: SpotifyPlayerConstructorOptions) => SpotifyPlayer
    }
    onSpotifyWebPlaybackSDKReady: () => void
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  sessionId: string
  currentTrackIndex: number
  playlistSourceType: string
}

export default function SpotifyPlaybackWidget({ sessionId, currentTrackIndex, playlistSourceType }: Props) {
  const [token, setToken] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [isPremiumRequired, setIsPremiumRequired] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentTrackName, setCurrentTrackName] = useState<string | null>(null)
  const [sdkReady, setSdkReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const playerRef = useRef<SpotifyPlayer | null>(null)
  const tokenRef = useRef<string | null>(null)

  // Only render for Spotify playlists
  if (playlistSourceType !== 'spotify') return null

  // Fetch access token on mount
  useEffect(() => {
    void (async () => {
      const result = await getSpotifyAccessTokenAction()
      if ('error' in result) {
        setError(result.error)
      } else {
        setToken(result.token)
        tokenRef.current = result.token
      }
    })()
  }, [])

  // Initialize Spotify player when both token and SDK are ready
  useEffect(() => {
    if (!token || !sdkReady || playerRef.current) return

    const player = new window.Spotify.Player({
      name: 'Playground',
      getOAuthToken: (cb) => {
        if (tokenRef.current) cb(tokenRef.current)
      },
      volume: 0.5,
    })

    player.addListener('ready', ({ device_id }) => {
      setDeviceId(device_id)
    })

    player.addListener('not_ready', ({ device_id }) => {
      console.warn('[SpotifyWidget] Device went offline:', device_id)
      setDeviceId(null)
    })

    player.addListener('authentication_error', ({ message }) => {
      console.error('[SpotifyWidget] Auth error:', message)
      setIsPremiumRequired(true)
    })

    player.addListener('account_error', ({ message }) => {
      console.error('[SpotifyWidget] Account error:', message)
      setIsPremiumRequired(true)
    })

    player.addListener('initialization_error', ({ message }) => {
      console.error('[SpotifyWidget] Init error:', message)
      setError(`Initialization error: ${message}`)
    })

    player.addListener('player_state_changed', (state) => {
      if (!state) return
      setIsPlaying(!state.paused)
      setCurrentTrackName(
        `${state.track_window.current_track.name} — ${state.track_window.current_track.artists.map((a) => a.name).join(', ')}`
      )
    })

    void player.connect()
    playerRef.current = player

    return () => {
      player.disconnect()
      playerRef.current = null
    }
  }, [token, sdkReady])

  // Auto-play when track index changes
  useEffect(() => {
    if (!deviceId) return

    void (async () => {
      const trackResult = await getCurrentTrackAction(sessionId)
      if ('error' in trackResult) {
        setError(trackResult.error)
        return
      }
      if (trackResult.sourceType !== 'spotify' || !trackResult.sourceId) return

      try {
        const res = await fetch('/api/spotify/play', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spotifyTrackId: trackResult.sourceId, deviceId }),
        })
        if (!res.ok) {
          const data = (await res.json()) as { error?: string }
          setError(data.error ?? 'Failed to play track')
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to play track')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrackIndex, deviceId, sessionId])

  if (isPremiumRequired) {
    return (
      <div className="bg-yellow-900/40 border border-yellow-600 rounded-lg p-4 text-sm text-yellow-200">
        Spotify Premium is required for in-app playback. Play from your Spotify app instead.
      </div>
    )
  }

  return (
    <>
      <Script
        src="https://sdk.scdn.co/spotify-player.js"
        strategy="afterInteractive"
        onLoad={() => {
          window.onSpotifyWebPlaybackSDKReady = () => setSdkReady(true)
          // If already loaded (e.g. hot reload), fire immediately
          if (typeof window.Spotify !== 'undefined') setSdkReady(true)
        }}
      />

      <div className="bg-gray-700 rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-600 text-white">
            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            Spotify
          </span>
          {isPlaying && <span className="text-xs text-green-400">Playing</span>}
          {!isPlaying && deviceId && <span className="text-xs text-gray-400">Ready</span>}
          {!deviceId && !error && <span className="text-xs text-gray-400">Connecting…</span>}
        </div>

        {currentTrackName && (
          <p className="text-white text-sm truncate">{currentTrackName}</p>
        )}

        {error && (
          <p className="text-red-400 text-xs">{error}</p>
        )}
      </div>
    </>
  )
}
