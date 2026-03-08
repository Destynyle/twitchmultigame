'use client'
import { useRef, useState, useTransition } from 'react'
import { createSessionAction } from '../actions'

type Playlist = {
  id: string
  name: string
}

type Props = {
  playlists: Playlist[]
  onCreated: (sessionId: string) => void
  onCancel: () => void
}

export default function NewSessionForm({ playlists, onCreated, onCancel }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const result = await createSessionAction(formData)
      if (result?.error) {
        setError(result.error)
      } else if (result?.sessionId) {
        onCreated(result.sessionId)
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 bg-gray-800 p-6 rounded-lg">
      <h2 className="text-xl font-semibold text-white">New Session</h2>

      <div>
        <label htmlFor="gameType" className="block text-sm font-medium text-gray-300 mb-1">
          Game Type
        </label>
        <select
          id="gameType"
          name="gameType"
          defaultValue="blindtest"
          className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600"
        >
          <option value="blindtest">Blindtest</option>
          <option value="quiz">Quiz</option>
        </select>
      </div>

      <div>
        <label htmlFor="playlistId" className="block text-sm font-medium text-gray-300 mb-1">
          Playlist
        </label>
        <select
          id="playlistId"
          name="playlistId"
          required
          className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600"
        >
          <option value="">Select a playlist...</option>
          {playlists.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isTestMode"
          name="isTestMode"
          value="true"
          className="rounded"
        />
        <label htmlFor="isTestMode" className="text-sm text-gray-300">
          Test mode (session won't be visible to viewers)
        </label>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded font-medium"
        >
          {isPending ? 'Creating...' : 'Create Session'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
