'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import NewPlaylistForm from './NewPlaylistForm'
import type { Playlist } from '@playground/db/schema'

interface PlaylistsClientProps {
  initialPlaylists: Playlist[]
  role: string
}

export default function PlaylistsClient({ initialPlaylists, role }: PlaylistsClientProps) {
  const [showForm, setShowForm] = useState(false)
  const router = useRouter()

  const isFreeTierFull = role === 'free' && initialPlaylists.length >= 3

  function handleSuccess(_playlistId: string) {
    setShowForm(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* New Playlist Button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-md bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 transition-colors"
        >
          + New Playlist
        </button>
      )}

      {/* Free tier upgrade prompt when at limit */}
      {isFreeTierFull && !showForm && (
        <div className="rounded-md border border-yellow-600 bg-yellow-900/30 p-4 text-yellow-300 text-sm">
          <p className="font-medium">You have reached the 3-playlist limit for the Free tier.</p>
          <p className="mt-1">Upgrade to Pro for unlimited playlists.</p>
        </div>
      )}

      {/* New Playlist Form */}
      {showForm && (
        <div className="rounded-lg border border-gray-700 bg-gray-900 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">New Playlist</h2>
          <NewPlaylistForm
            onSuccess={handleSuccess}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Playlist List */}
      {initialPlaylists.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No playlists yet.</p>
          <p className="text-sm mt-1">Create your first playlist to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {initialPlaylists.map((playlist) => (
            <div
              key={playlist.id}
              className="rounded-lg border border-gray-700 bg-gray-900 p-4 hover:border-gray-600 transition-colors"
            >
              <h3 className="text-white font-medium truncate">{playlist.name}</h3>
              <div className="mt-2 flex items-center justify-between text-sm text-gray-400">
                <span>
                  {playlist.trackCount} track{playlist.trackCount !== 1 ? 's' : ''}
                </span>
                <span className="capitalize">{playlist.sourceType}</span>
              </div>
              <p className="mt-1 text-xs text-gray-600">
                {new Date(playlist.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
