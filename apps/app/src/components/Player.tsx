import { useEffect, useRef, useState } from 'react'
import type { MusicSource } from '../lib/types'
import { getPlaybackMode, getSpotifyDevice } from '../lib/playback'
import { playTrack, pausePlayback } from '../lib/spotify'

// Unified player. YouTube uses the IFrame API for programmatic play/pause/seek;
// Spotify uses its embed (playback control limited to the embed's own UI).

declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
  }
}

let ytApiPromise: Promise<void> | null = null
function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  if (ytApiPromise) return ytApiPromise
  ytApiPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve()
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
  return ytApiPromise
}

export default function Player({ source, active }: { source: MusicSource | null; active: boolean }) {
  if (!source) {
    return (
      <div className="grid h-44 place-items-center rounded-xl bg-white/5 text-sm text-white/40">
        Aucune piste
      </div>
    )
  }
  if (source.kind === 'youtube') {
    return <YouTubePlayer videoId={source.videoId} active={active} />
  }
  // Spotify: Connect mode drives the desktop app (full song, VOD-safe via OBS);
  // otherwise fall back to the 30s embed.
  if (getPlaybackMode() === 'connect') {
    return <SpotifyConnectPlayer trackId={source.trackId} active={active} />
  }
  return (
    <iframe
      title="spotify"
      className="h-44 w-full rounded-xl"
      src={`https://open.spotify.com/embed/track/${source.trackId}?utm_source=blindtest`}
      allow="autoplay; encrypted-media"
    />
  )
}

function SpotifyConnectPlayer({ trackId, active }: { trackId: string; active: boolean }) {
  const [error, setError] = useState('')
  const device = getSpotifyDevice()

  useEffect(() => {
    let cancelled = false
    if (active) {
      // Only the play path surfaces errors (no device / not Premium / re-auth).
      playTrack(trackId, device?.id)
        .then(() => !cancelled && setError(''))
        .catch((e) => !cancelled && setError((e as Error).message))
    } else {
      // Pause is best-effort; stay quiet when idle (e.g. no active device yet).
      void pausePlayback(device?.id).catch(() => {})
    }
    return () => {
      cancelled = true
    }
    // Re-issue on track change or play/pause toggle. device id read once per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId, active])

  return (
    <div className="flex h-44 flex-col items-center justify-center gap-1 rounded-xl bg-[#1DB954]/10 text-center">
      <div className="text-2xl">{active ? '▶️' : '⏸️'}</div>
      <div className="text-sm font-medium text-[#1DB954]">Lecture sur l'app Spotify</div>
      <div className="text-xs text-white/40">
        {device ? `Appareil : ${device.name}` : 'Appareil actif'} · son complet
      </div>
      {error ? (
        <div className="mt-1 max-w-xs px-3 text-xs text-red-400">{error}</div>
      ) : (
        <div className="text-[10px] text-white/30">Route ce son vers une piste OBS hors-VOD (voir Guide)</div>
      )}
    </div>
  )
}

function YouTubePlayer({ videoId, active }: { videoId: string; active: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const readyRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    loadYouTubeApi().then(() => {
      if (cancelled || !hostRef.current) return
      playerRef.current = new window.YT.Player(hostRef.current, {
        videoId,
        playerVars: { autoplay: 1, controls: 1, rel: 0 },
        events: { onReady: () => (readyRef.current = true) },
      })
    })
    return () => {
      cancelled = true
      playerRef.current?.destroy?.()
      playerRef.current = null
      readyRef.current = false
    }
    // Recreate the player when the track changes.
  }, [videoId])

  useEffect(() => {
    const p = playerRef.current
    if (!p || !readyRef.current) return
    if (active) p.playVideo?.()
    else p.pauseVideo?.()
  }, [active])

  return <div className="h-44 w-full overflow-hidden rounded-xl"><div ref={hostRef} className="h-full w-full" /></div>
}
