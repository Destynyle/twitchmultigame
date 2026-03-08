import { redirect } from 'next/navigation'
import { auth } from '~/server/auth'
import { withTenantContext } from '@playground/db'
import { sessions, playlists } from '@playground/db/schema'
import { desc } from 'drizzle-orm'
import SessionsClient from './components/SessionsClient'

export default async function SessionsPage() {
  const session = await auth()
  if (!session?.user?.tenantId) {
    redirect('/signin')
  }

  const tenantId = session.user.tenantId

  const [sessionList, playlistList] = await Promise.all([
    withTenantContext(tenantId, async (tx) => {
      return tx.select().from(sessions).orderBy(desc(sessions.createdAt))
    }),
    withTenantContext(tenantId, async (tx) => {
      return tx.select().from(playlists).orderBy(desc(playlists.createdAt))
    }),
  ])

  return (
    <div>
      <SessionsClient
        initialSessions={sessionList}
        playlists={playlistList}
      />
    </div>
  )
}
