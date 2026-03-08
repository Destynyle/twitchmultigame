'use client'

import { useQuery } from '@tanstack/react-query'

interface ActiveSession {
  id: string
  tenantId: string
  gameType: 'blindtest' | 'quiz'
  status: 'active' | 'paused'
  startedAt: string | null
  twitchLogin: string
  displayName: string
  viewerCount: number
  botStatus: 'connected' | 'reconnecting' | 'disconnected'
  botStatusSince: string | null
}

interface PlatformHealth {
  activeSessions: number
  connectedBots: number
  redisMemoryUsage: string
  deployedAt: string | null
}

function durationSince(iso: string | null): string {
  if (!iso) return '—'
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

function BotStatusBadge({ session }: { session: ActiveSession }) {
  const { botStatus, botStatusSince } = session

  if (botStatus === 'connected') {
    return (
      <span className="inline-flex items-center gap-1.5 text-green-400">
        <span className="h-2 w-2 rounded-full bg-green-400" />
        Connected
      </span>
    )
  }

  if (botStatus === 'reconnecting') {
    const elapsed = botStatusSince
      ? Math.floor((Date.now() - new Date(botStatusSince).getTime()) / 1000)
      : 0
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-400">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
        Reconnecting {elapsed > 0 ? `(${elapsed}s)` : ''}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-red-400">
      <span className="h-2 w-2 rounded-full bg-red-400" />
      Disconnected
    </span>
  )
}

export default function AdminMonitoringPage() {
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery<{ sessions: ActiveSession[] }>({
    queryKey: ['admin-sessions'],
    queryFn: () => fetch('/api/admin/sessions').then((r) => r.json()),
    refetchInterval: 5000,
  })

  const { data: health } = useQuery<PlatformHealth>({
    queryKey: ['admin-platform-health'],
    queryFn: () => fetch('/api/admin/platform-health').then((r) => r.json()),
    refetchInterval: 5000,
  })

  const activeSessions = sessionsData?.sessions ?? []

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Platform Monitoring</h1>
        <p className="mt-1 text-sm text-gray-400">Real-time session and bot health — refreshes every 5s</p>
      </div>

      {/* Platform metrics */}
      {health && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MetricCard label="Active Sessions" value={String(health.activeSessions)} />
          <MetricCard label="Connected Bots" value={String(health.connectedBots)} />
          <MetricCard label="Redis Memory" value={health.redisMemoryUsage} />
          <MetricCard
            label="Last Deploy"
            value={health.deployedAt ? new Date(health.deployedAt).toLocaleDateString() : 'N/A'}
          />
        </div>
      )}

      {/* Sessions table */}
      <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
          <h2 className="font-medium text-white">Active Sessions</h2>
          {sessionsLoading && (
            <span className="text-xs text-gray-500">Loading…</span>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="px-4 py-3 font-medium text-gray-400">Streamer</th>
              <th className="px-4 py-3 font-medium text-gray-400">Game</th>
              <th className="px-4 py-3 font-medium text-gray-400">Duration</th>
              <th className="px-4 py-3 font-medium text-gray-400">Viewers</th>
              <th className="px-4 py-3 font-medium text-gray-400">Bot Status</th>
              <th className="px-4 py-3 font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {activeSessions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  {sessionsLoading ? 'Loading…' : 'No active sessions'}
                </td>
              </tr>
            ) : (
              activeSessions.map((s) => {
                const isDisconnected =
                  s.botStatus === 'disconnected' ||
                  (s.botStatus === 'reconnecting' &&
                    s.botStatusSince !== null &&
                    Date.now() - new Date(s.botStatusSince).getTime() > 10_000)

                return (
                  <tr
                    key={s.id}
                    className={`border-b border-gray-800 last:border-0 ${
                      s.botStatus === 'reconnecting' ? 'bg-amber-900/10' :
                      isDisconnected ? 'bg-red-900/10' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{s.displayName}</div>
                      <div className="text-xs text-gray-500">@{s.twitchLogin}</div>
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-300">{s.gameType}</td>
                    <td className="px-4 py-3 text-gray-400">{durationSince(s.startedAt)}</td>
                    <td className="px-4 py-3 text-gray-300">{s.viewerCount}</td>
                    <td className="px-4 py-3">
                      <BotStatusBadge session={s} />
                    </td>
                    <td className="px-4 py-3">
                      {isDisconnected && (
                        <a
                          href={`/admin/sessions/${s.id}/intervene`}
                          className="rounded px-2 py-1 text-xs font-medium text-red-400 ring-1 ring-red-800 hover:bg-red-900/30"
                        >
                          Intervene
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-white">{value}</div>
    </div>
  )
}
