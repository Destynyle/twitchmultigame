'use client'

import { useState, useTransition } from 'react'
import { updatePlaylistAction, type TrackInput } from '../actions'

interface EditPlaylistFormProps {
  playlistId: string
  initialName: string
  initialTracks: TrackInput[]
  onSuccess?: (playlistId: string) => void
  onCancel?: () => void
}

export default function EditPlaylistForm({
  playlistId,
  initialName,
  initialTracks,
  onSuccess,
  onCancel,
}: EditPlaylistFormProps) {
  const [name, setName] = useState(initialName)
  const [trackList, setTrackList] = useState<TrackInput[]>(
    initialTracks.length > 0 ? initialTracks : [{ title: '', artist: '' }]
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function addTrack() {
    setTrackList((prev) => [...prev, { title: '', artist: '' }])
  }

  function removeTrack(index: number) {
    setTrackList((prev) => prev.filter((_, i) => i !== index))
  }

  function updateTrack(index: number, field: keyof TrackInput, value: string) {
    setTrackList((prev) =>
      prev.map((track, i) =>
        i === index ? { ...track, [field]: value } : track
      )
    )
  }

  function moveTrackUp(index: number) {
    if (index === 0) return
    setTrackList((prev) => {
      const next = [...prev]
      const temp = next[index - 1]!
      next[index - 1] = next[index]!
      next[index] = temp
      return next
    })
  }

  function moveTrackDown(index: number) {
    setTrackList((prev) => {
      if (index >= prev.length - 1) return prev
      const next = [...prev]
      const temp = next[index + 1]!
      next[index + 1] = next[index]!
      next[index] = temp
      return next
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await updatePlaylistAction({
        id: playlistId,
        name,
        tracks: trackList,
      })
      if (result.success) {
        onSuccess?.(result.playlistId)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="edit-playlist-name"
          className="block text-sm font-medium text-gray-300 mb-1"
        >
          Playlist Name
        </label>
        <input
          id="edit-playlist-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Playlist name"
          required
          className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-300">Tracks</h3>
          <button
            type="button"
            onClick={addTrack}
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            + Add Track
          </button>
        </div>

        {trackList.map((track, index) => (
          <div key={index} className="flex gap-2 items-start">
            {/* Reorder controls */}
            <div className="flex flex-col gap-1 pt-2">
              <button
                type="button"
                onClick={() => moveTrackUp(index)}
                disabled={index === 0}
                aria-label={`Move track ${index + 1} up`}
                className="text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed text-xs leading-none"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => moveTrackDown(index)}
                disabled={index === trackList.length - 1}
                aria-label={`Move track ${index + 1} down`}
                className="text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed text-xs leading-none"
              >
                ▼
              </button>
            </div>

            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={track.title}
                onChange={(e) => updateTrack(index, 'title', e.target.value)}
                placeholder={`Track ${index + 1} title (required)`}
                required
                className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <input
                type="text"
                value={track.artist ?? ''}
                onChange={(e) => updateTrack(index, 'artist', e.target.value)}
                placeholder="Artist (optional)"
                className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {trackList.length > 1 && (
              <button
                type="button"
                onClick={() => removeTrack(index)}
                className="mt-2 text-red-400 hover:text-red-300 transition-colors text-sm"
                aria-label={`Remove track ${index + 1}`}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-md p-3 text-sm bg-red-900/50 border border-red-600 text-red-300">
          <p>{error}</p>
        </div>
      )}

      <div className="flex gap-3 justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded-md bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
