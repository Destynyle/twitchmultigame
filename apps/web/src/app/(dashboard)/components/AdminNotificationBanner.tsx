'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

interface Notification {
  message: string
  sessionId: string
}

export function AdminNotificationBanner() {
  const [visible, setVisible] = useState<Notification | null>(null)

  const { data } = useQuery<{ notification: Notification | null }>({
    queryKey: ['admin-notifications'],
    queryFn: () => fetch('/api/notifications').then((r) => r.json()),
    refetchInterval: 3000,
  })

  useEffect(() => {
    if (data?.notification) {
      setVisible(data.notification)
      const timer = setTimeout(() => setVisible(null), 8000)
      return () => clearTimeout(timer)
    }
  }, [data?.notification])

  if (!visible) return null

  return (
    <div
      role="alert"
      className="fixed right-4 top-4 z-50 flex max-w-sm items-start gap-3 rounded-lg border border-orange-700 bg-orange-950 px-4 py-3 text-sm shadow-xl"
    >
      <span className="mt-0.5 shrink-0 text-orange-400">⚠</span>
      <div>
        <p className="font-medium text-orange-200">{visible.message}</p>
        <p className="mt-0.5 text-xs text-orange-400">Session ID: {visible.sessionId.slice(0, 8)}…</p>
      </div>
      <button
        onClick={() => setVisible(null)}
        className="ml-auto shrink-0 text-orange-500 hover:text-orange-300"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
