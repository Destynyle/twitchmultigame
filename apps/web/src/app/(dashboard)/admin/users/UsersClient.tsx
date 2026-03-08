'use client'

import { useState, useTransition } from 'react'
import {
  searchUsersAction,
  quarantineAccountAction,
  restoreAccountAction,
} from '~/server/actions/admin/quarantine'

interface UserResult {
  tenantId: string
  twitchLogin: string
  displayName: string
  role: string
  subscriptionStatus: string
  createdAt: Date
}

interface QuarantinedUser {
  tenantId: string
  twitchLogin: string
  displayName: string
  quarantinedAt: Date
  reason: string
  actorId: string
}

export function UsersClient({ initialQueue }: { initialQueue: QuarantinedUser[] }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserResult[]>([])
  const [queue, setQueue] = useState<QuarantinedUser[]>(initialQueue)
  const [reasonMap, setReasonMap] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await searchUsersAction(query)
      if ('results' in res) setResults(res.results)
    })
  }

  function handleQuarantine(tenantId: string) {
    const reason = reasonMap[tenantId]?.trim()
    if (!reason) {
      setFeedback((p) => ({ ...p, [tenantId]: 'Reason is required' }))
      return
    }
    startTransition(async () => {
      const res = await quarantineAccountAction(tenantId, reason)
      if ('error' in res) {
        setFeedback((p) => ({ ...p, [tenantId]: res.error }))
      } else {
        setFeedback((p) => ({ ...p, [tenantId]: 'Quarantined' }))
        setResults((prev) => prev.map((u) => u.tenantId === tenantId ? { ...u, role: 'quarantined' } : u))
      }
    })
  }

  function handleRestore(tenantId: string) {
    startTransition(async () => {
      const res = await restoreAccountAction(tenantId)
      if ('error' in res) {
        setFeedback((p) => ({ ...p, [tenantId]: res.error }))
      } else {
        setQueue((prev) => prev.filter((u) => u.tenantId !== tenantId))
        setFeedback((p) => ({ ...p, [tenantId]: 'Restored' }))
        setResults((prev) =>
          prev.map((u) => u.tenantId === tenantId ? { ...u, role: 'free' } : u)
        )
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* Search */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <h2 className="mb-3 font-medium text-white">Search by Twitch username</h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="twitchlogin…"
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600 disabled:opacity-50"
          >
            Search
          </button>
        </form>

        {results.length > 0 && (
          <div className="mt-4 space-y-2">
            {results.map((u) => (
              <div
                key={u.tenantId}
                className="rounded-lg border border-gray-700 bg-gray-800 p-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium text-white">{u.displayName}</div>
                    <div className="text-xs text-gray-400">
                      @{u.twitchLogin} · <span className="capitalize">{u.role}</span> · {u.subscriptionStatus}
                    </div>
                    {feedback[u.tenantId] && (
                      <div className={`mt-1 text-xs ${feedback[u.tenantId] === 'Quarantined' || feedback[u.tenantId] === 'Restored' ? 'text-green-400' : 'text-red-400'}`}>
                        {feedback[u.tenantId]}
                      </div>
                    )}
                  </div>

                  {u.role !== 'quarantined' ? (
                    <div className="flex shrink-0 flex-col gap-2">
                      <input
                        value={reasonMap[u.tenantId] ?? ''}
                        onChange={(e) => setReasonMap((p) => ({ ...p, [u.tenantId]: e.target.value }))}
                        placeholder="Reason…"
                        className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                      />
                      <button
                        onClick={() => handleQuarantine(u.tenantId)}
                        disabled={isPending}
                        className="rounded px-3 py-1 text-xs font-medium text-orange-300 ring-1 ring-orange-700 hover:bg-orange-900/40 disabled:opacity-50"
                      >
                        Quarantine
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleRestore(u.tenantId)}
                      disabled={isPending}
                      className="shrink-0 rounded px-3 py-1 text-xs font-medium text-green-400 ring-1 ring-green-800 hover:bg-green-900/30 disabled:opacity-50"
                    >
                      Restore access
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quarantine queue */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <h2 className="mb-3 font-medium text-white">
          Quarantine Queue{' '}
          {queue.length > 0 && (
            <span className="ml-1 rounded-full bg-orange-900 px-2 py-0.5 text-xs text-orange-300">
              {queue.length}
            </span>
          )}
        </h2>

        {queue.length === 0 ? (
          <p className="text-sm text-gray-500">No quarantined accounts</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="pb-2 font-medium text-gray-400">Account</th>
                <th className="pb-2 font-medium text-gray-400">Reason</th>
                <th className="pb-2 font-medium text-gray-400">Date</th>
                <th className="pb-2 font-medium text-gray-400">Admin</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {queue.map((u) => (
                <tr key={u.tenantId} className="border-b border-gray-800 last:border-0">
                  <td className="py-2">
                    <div className="font-medium text-white">{u.displayName}</div>
                    <div className="text-xs text-gray-500">@{u.twitchLogin}</div>
                  </td>
                  <td className="py-2 text-gray-300">{u.reason}</td>
                  <td className="py-2 text-gray-400">
                    {u.quarantinedAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="py-2 font-mono text-xs text-gray-500">
                    {u.actorId.slice(0, 8)}…
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => handleRestore(u.tenantId)}
                      disabled={isPending}
                      className="rounded px-3 py-1 text-xs font-medium text-green-400 ring-1 ring-green-800 hover:bg-green-900/30 disabled:opacity-50"
                    >
                      Restore access
                    </button>
                    {feedback[u.tenantId] && (
                      <div className="mt-0.5 text-xs text-green-400">{feedback[u.tenantId]}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
