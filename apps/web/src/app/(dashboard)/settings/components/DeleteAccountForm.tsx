'use client'

import { useState, useTransition } from 'react'
import { deleteAccountAction } from '../actions'

/**
 * Requires the user to type "DELETE" before confirming account deletion.
 * On success, the server action destroys the session and redirects to /.
 */
export function DeleteAccountForm() {
  const [confirmation, setConfirmation] = useState('')
  const [isPending, startTransition] = useTransition()
  const isConfirmed = confirmation === 'DELETE'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isConfirmed) return
    startTransition(async () => {
      await deleteAccountAction()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <p className="text-sm text-gray-400">
        This action is <strong className="text-white">irreversible after 30 days</strong>. You
        have a grace period to reactivate your account by signing in again.
      </p>
      <div>
        <label htmlFor="confirm-delete" className="block text-sm text-gray-300">
          Type <span className="font-mono font-bold text-red-400">DELETE</span> to confirm
        </label>
        <input
          id="confirm-delete"
          type="text"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder="DELETE"
          autoComplete="off"
          className="mt-1 w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>
      <button
        type="submit"
        disabled={!isConfirmed || isPending}
        className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? 'Deleting…' : 'Delete my account'}
      </button>
    </form>
  )
}
