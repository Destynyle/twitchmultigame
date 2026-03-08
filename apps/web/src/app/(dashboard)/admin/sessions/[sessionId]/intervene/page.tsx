import { redirect } from 'next/navigation'
import { auth } from '~/server/auth'
import { db } from '@playground/db'
import { sessions, tenants } from '@playground/db/schema'
import { eq } from 'drizzle-orm'
import { InterventionPanel } from './InterventionPanel'

export default async function IntervenePage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') redirect('/sessions')

  const { sessionId } = await params

  const [row] = await db
    .select({
      id: sessions.id,
      status: sessions.status,
      gameType: sessions.gameType,
      startedAt: sessions.startedAt,
      tenantId: sessions.tenantId,
      twitchLogin: tenants.twitchLogin,
      displayName: tenants.displayName,
    })
    .from(sessions)
    .innerJoin(tenants, eq(sessions.tenantId, tenants.id))
    .where(eq(sessions.id, sessionId))

  if (!row) redirect('/admin')

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <a href="/admin" className="text-sm text-gray-500 hover:text-gray-300">
          ← Back to monitoring
        </a>
        <h1 className="mt-2 text-2xl font-bold text-white">Remote Intervention</h1>
        <p className="mt-1 text-sm text-gray-400">
          Session <span className="font-mono text-gray-300">{sessionId.slice(0, 8)}…</span>
          {' · '}{row.displayName} (@{row.twitchLogin})
          {' · '}<span className="capitalize">{row.gameType}</span>
          {' · '}<span className="capitalize text-yellow-400">{row.status}</span>
        </p>
      </div>

      <InterventionPanel sessionId={sessionId} />
    </div>
  )
}
