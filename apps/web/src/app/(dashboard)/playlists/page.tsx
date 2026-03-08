import { redirect } from 'next/navigation'
import { auth } from '~/server/auth'
import { withTenantContext } from '@playground/db'
import { playlists } from '@playground/db/schema'
import { sql } from 'drizzle-orm'
import PlaylistsClient from './components/PlaylistsClient'

export default async function PlaylistsPage() {
  const session = await auth()
  if (!session?.user?.tenantId) {
    redirect('/auth/signin')
  }

  const tenantId = session.user.tenantId
  const role = session.user.role

  const playlistList = await withTenantContext(tenantId, async (tx) => {
    return tx
      .select()
      .from(playlists)
      .orderBy(sql`${playlists.createdAt} DESC`)
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Playlists</h1>
          <p className="mt-1 text-gray-400">
            {role === 'free'
              ? `${playlistList.length} / 3 playlists (Free tier)`
              : `${playlistList.length} playlist${playlistList.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      <PlaylistsClient
        initialPlaylists={playlistList}
        role={role}
      />
    </div>
  )
}
