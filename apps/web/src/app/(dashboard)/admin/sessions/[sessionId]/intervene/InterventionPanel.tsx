'use client'

import { useState, useTransition } from 'react'
import {
  forceSSEReconnectAction,
  forceTokenRefreshAction,
  forceBotReconnectAction,
  adminEndSessionAction,
} from '~/server/actions/admin/interventions'

type ActionResult = { success: true } | { error: string } | null

interface Action {
  key: string
  label: string
  description: string
  variant: 'default' | 'danger'
  fn: (sessionId: string) => Promise<{ success: true } | { error: string }>
}

const ACTIONS: Action[] = [
  {
    key: 'sse',
    label: 'Force SSE Reconnect',
    description: 'Publishes a reconnect event to the overlay channel. OBS browser source reconnects within 5s.',
    variant: 'default',
    fn: forceSSEReconnectAction,
  },
  {
    key: 'token',
    label: 'Force Token Refresh',
    description: 'Refreshes the Twitch OAuth token for this tenant using the stored refresh token.',
    variant: 'default',
    fn: forceTokenRefreshAction,
  },
  {
    key: 'bot',
    label: 'Force Bot Reconnect',
    description: 'Sends a reconnect command to the bot. It will disconnect from Twitch chat then reconnect.',
    variant: 'default',
    fn: forceBotReconnectAction,
  },
  {
    key: 'end',
    label: 'End Session',
    description: 'Immediately ends the session. Bot disconnects, streamer is notified.',
    variant: 'danger',
    fn: adminEndSessionAction,
  },
]

export function InterventionPanel({ sessionId }: { sessionId: string }) {
  const [results, setResults] = useState<Record<string, ActionResult>>({})
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleClick(action: Action) {
    if (action.variant === 'danger' && confirming !== action.key) {
      setConfirming(action.key)
      return
    }
    setConfirming(null)
    setPendingKey(action.key)
    startTransition(async () => {
      const result = await action.fn(sessionId)
      setResults((prev) => ({ ...prev, [action.key]: result }))
      setPendingKey(null)
    })
  }

  return (
    <div className="space-y-3">
      {ACTIONS.map((action) => {
        const result = results[action.key]
        const isPending = pendingKey === action.key
        const isConfirming = confirming === action.key

        return (
          <div
            key={action.key}
            className="rounded-lg border border-gray-800 bg-gray-900 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="font-medium text-white">{action.label}</div>
                <div className="mt-0.5 text-sm text-gray-400">{action.description}</div>
                {result && (
                  <div className={`mt-2 text-sm ${
                    'error' in result ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {'error' in result ? `✗ ${result.error}` : '✓ Done'}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                {isConfirming ? (
                  <>
                    <span className="text-xs text-orange-400">Confirm?</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirming(null)}
                        className="rounded px-3 py-1 text-sm text-gray-400 hover:bg-gray-800"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleClick(action)}
                        disabled={isPending}
                        className="rounded bg-red-700 px-3 py-1 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
                      >
                        {isPending ? 'Running…' : 'Confirm'}
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => handleClick(action)}
                    disabled={isPending || !!pendingKey}
                    className={`rounded px-4 py-1.5 text-sm font-medium disabled:opacity-50 ${
                      action.variant === 'danger'
                        ? 'bg-red-900 text-red-200 hover:bg-red-800 ring-1 ring-red-700'
                        : 'bg-gray-700 text-white hover:bg-gray-600'
                    }`}
                  >
                    {isPending ? 'Running…' : action.label}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
