import { getQuarantineQueueAction } from '~/server/actions/admin/quarantine'
import { UsersClient } from './UsersClient'

export default async function AdminUsersPage() {
  const queueResult = await getQuarantineQueueAction()
  const queue = 'queue' in queueResult ? queueResult.queue : []

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <p className="mt-1 text-sm text-gray-400">Search accounts and manage quarantine</p>
      </div>

      <UsersClient initialQueue={queue} />
    </div>
  )
}
