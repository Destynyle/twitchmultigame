'use client'

import { useState, useTransition } from 'react'
import { importSpotifyPlaylistAction } from '../spotify-import-action'

type SpotifyPlaylist = {
  id: string
  name: string
  trackCount: number
  imageUrl: string | null
}

export function SpotifyImportModal({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([])
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleOpen() {
    setOpen(true)
    setError(null)
    const res = await fetch('/api/spotify/playlists')
    if (!res.ok) {
      const d = (await res.json()) as { error: string }
      setError(
        d.error === 'Spotify not connected'
          ? 'Spotify not connected. Go to Settings to connect your account.'
          : 'Failed to load Spotify playlists.'
      )
      return
    }
    const d = (await res.json()) as { playlists: SpotifyPlaylist[] }
    setPlaylists(d.playlists)
  }

  function handleImport(pl: SpotifyPlaylist) {
    setImporting(pl.id)
    startTransition(async () => {
      const result = await importSpotifyPlaylistAction(pl.id, pl.name)
      if (result.success) {
        setOpen(false)
        onSuccess()
      } else {
        setError(result.error)
        setImporting(null)
      }
    })
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="rounded bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600"
      >
        Import from Spotify
      </button>
    )
  }

  return (
    <div className="mt-4 rounded-lg border border-gray-700 bg-gray-900 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Import from Spotify</h2>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">
          ✕
        </button>
      </div>
      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
      {playlists.length === 0 && !error && (
        <p className="text-sm text-gray-400">Loading your Spotify playlists…</p>
      )}
      <ul className="max-h-80 space-y-2 overflow-y-auto">
        {playlists.map((pl) => (
          <li key={pl.id} className="flex items-center justify-between rounded bg-gray-800 px-4 py-3">
            <div>
              <p className="font-medium text-white">{pl.name}</p>
              <p className="text-sm text-gray-400">{pl.trackCount} tracks</p>
            </div>
            <button
              onClick={() => handleImport(pl)}
              disabled={isPending && importing === pl.id}
              className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isPending && importing === pl.id ? 'Importing…' : 'Import'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
