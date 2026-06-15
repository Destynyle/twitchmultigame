import { useEffect, useRef } from 'react'
import type { MusicSource } from '../lib/types'

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
  return (
    <iframe
      title="spotify"
      className="h-44 w-full rounded-xl"
      src={`https://open.spotify.com/embed/track/${source.trackId}?utm_source=blindtest`}
      allow="autoplay; encrypted-media"
    />
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
