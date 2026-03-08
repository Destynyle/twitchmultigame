'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import NewPlaylistForm from './NewPlaylistForm'
import EditPlaylistForm from './EditPlaylistForm'
import { SpotifyImportModal } from './SpotifyImportModal'
import { deletePlaylistAction, updatePlaylistAction } from '../actions'
import type { TrackInput } from '../actions'
import type { Playlist, Track } from '@playground/db/schema'

interface PlaylistsClientProps {
  initialPlaylists: Playlist[]
  role: string
}

type EditingState =
  | { mode: 'none' }
  | { mode: 'rename'; playlistId: string; currentName: string }
  | { mode: 'edit'; playlist: Playlist & { tracks?: Track[] } }

export default function PlaylistsClient({ initialPlaylists, role }: PlaylistsClientProps) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<EditingState>({ mode: 'none' })
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const isFreeTierFull = role === 'free' && initialPlaylists.length >= 3

  function handleSuccess(_playlistId: string) {
    setShowForm(false)
    setEditing({ mode: 'none' })
    router.refresh()
  }

  function startRename(playlist: Playlist) {
    setEditing({ mode: 'rename', playlistId: playlist.id, currentName: playlist.name })
    setRenameValue(playlist.name)
    setActionError(null)
  }

  function startEdit(playlist: Playlist) {
    setEditing({ mode: 'edit', playlist })
    setActionError(null)
  }

  function cancelEditing() {
    setEditing({ mode: 'none' })
    setActionError(null)
  }

  function handleRenameSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editing.mode !== 'rename') return
    const playlistId = editing.playlistId

    startTransition(async () => {
      const result = await updatePlaylistAction({ id: playlistId, name: renameValue })
      if (result.success) {
        setEditing({ mode: 'none' })
        router.refresh()
      } else {
        setActionError(result.error)
      }
    })
  }

  function handleDelete(playlistId: string) {
    setDeletingId(playlistId)
    setActionError(null)
  }

  function confirmDelete(playlistId: string) {
    startTransition(async () => {
      const result = await deletePlaylistAction(playlistId)
      if (result.success) {
        setDeletingId(null)
        router.refresh()
      } else {
        setActionError(result.error)
        setDeletingId(null)
      }
    })
  }

  function cancelDelete() {
    setDeletingId(null)
    setActionError(null)
  }

  function handleExport(playlist: Playlist) {
    const url = `/api/playlists/${playlist.id}/export`
    const link = document.createElement('a')
    link.href = url
    link.download = `${playlist.name.replace(/[^a-z0-9\-_]/gi, '_')}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* New Playlist Button + Spotify Import */}
      {!showForm && editing.mode === 'none' && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-md bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 transition-colors"
          >
            + New Playlist
          </button>
          <SpotifyImportModal onSuccess={() => router.refresh()} />
        </div>
      )}

      {/* Free tier upgrade prompt when at limit */}
      {isFreeTierFull && !showForm && editing.mode === 'none' && (
        <div className="rounded-md border border-yellow-600 bg-yellow-900/30 p-4 text-yellow-300 text-sm">
          <p className="font-medium">You have reached the 3-playlist limit for the Free tier.</p>
          <p className="mt-1">Upgrade to Pro for unlimited playlists.</p>
        </div>
      )}

      {/* Global action error */}
      {actionError && (
        <div className="rounded-md p-3 text-sm bg-red-900/50 border border-red-600 text-red-300">
          <p>{actionError}</p>
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

      {/* Edit Playlist Form */}
      {editing.mode === 'edit' && (
        <div className="rounded-lg border border-gray-700 bg-gray-900 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Edit &ldquo;{editing.playlist.name}&rdquo;
          </h2>
          <EditPlaylistForm
            playlistId={editing.playlist.id}
            initialName={editing.playlist.name}
            initialTracks={
              (editing.playlist.tracks ?? []).map((t): TrackInput => ({
                title: t.title,
                ...(t.artist != null && { artist: t.artist }),
                ...(t.durationSeconds != null && { durationSeconds: t.durationSeconds }),
                ...(t.sourceType != null && { sourceType: t.sourceType }),
                ...(t.sourceId != null && { sourceId: t.sourceId }),
                position: t.position,
              }))
            }
            onSuccess={handleSuccess}
            onCancel={cancelEditing}
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
              {/* Rename inline form */}
              {editing.mode === 'rename' && editing.playlistId === playlist.id ? (
                <form onSubmit={handleRenameSubmit} className="space-y-2">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    autoFocus
                    required
                    className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-white text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isPending}
                      className="px-3 py-1 rounded-md bg-purple-600 text-white text-xs font-medium hover:bg-purple-500 transition-colors disabled:opacity-50"
                    >
                      {isPending ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      disabled={isPending}
                      className="px-3 py-1 text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
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

                  {/* Delete confirmation */}
                  {deletingId === playlist.id ? (
                    <div className="mt-3 rounded-md border border-red-700 bg-red-900/30 p-3">
                      <p className="text-xs text-red-300 mb-2">
                        Delete &ldquo;{playlist.name}&rdquo;? This cannot be undone.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => confirmDelete(playlist.id)}
                          disabled={isPending}
                          className="px-3 py-1 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-500 transition-colors disabled:opacity-50"
                        >
                          {isPending ? 'Deleting...' : 'Delete'}
                        </button>
                        <button
                          onClick={cancelDelete}
                          disabled={isPending}
                          className="px-3 py-1 text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Action buttons */
                    <div className="mt-3 flex gap-2 flex-wrap">
                      <button
                        onClick={() => startEdit(playlist)}
                        className="px-2.5 py-1 rounded text-xs text-gray-300 border border-gray-600 hover:border-gray-400 hover:text-white transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => startRename(playlist)}
                        className="px-2.5 py-1 rounded text-xs text-gray-300 border border-gray-600 hover:border-gray-400 hover:text-white transition-colors"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => handleExport(playlist)}
                        className="px-2.5 py-1 rounded text-xs text-gray-300 border border-gray-600 hover:border-gray-400 hover:text-white transition-colors"
                      >
                        Export
                      </button>
                      <button
                        onClick={() => handleDelete(playlist.id)}
                        className="px-2.5 py-1 rounded text-xs text-red-400 border border-red-800 hover:border-red-600 hover:text-red-300 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
