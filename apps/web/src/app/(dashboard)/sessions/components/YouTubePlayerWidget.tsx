'use client'
import { useState, useEffect } from 'react'
import { getCurrentTrackAction } from '../actions'

type Props = {
  sessionId: string
  currentTrackIndex: number
  playlistSourceType: string
}

export default function YouTubePlayerWidget({ sessionId, currentTrackIndex, playlistSourceType }: Props) {
  const [videoId, setVideoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  // Only render for YouTube playlists
  if (playlistSourceType !== 'youtube') return null

  // Load the current track whenever the index changes
  useEffect(() => {
    setError(null)
    setUnavailable(false)

    void (async () => {
      const result = await getCurrentTrackAction(sessionId)
      if ('error' in result) {
        setError(result.error)
        setVideoId(null)
        return
      }

      if (!result.sourceId) {
        setError('No video for this track')
        setVideoId(null)
        return
      }

      setVideoId(result.sourceId)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrackIndex, sessionId])

  return (
    <div className="bg-gray-700 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
          <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
          YouTube
        </span>
      </div>

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      {unavailable && !error && (
        <div className="bg-gray-800 rounded p-4 text-center text-gray-400 text-sm">
          Video unavailable or access-restricted
        </div>
      )}

      {videoId && !unavailable && (
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            key={videoId}
            className="absolute inset-0 w-full h-full rounded"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onError={() => setUnavailable(true)}
          />
        </div>
      )}
    </div>
  )
}
