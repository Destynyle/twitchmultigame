import { db } from '@playground/db'
import { adminAuditLog } from '@playground/db/schema'
import { desc } from 'drizzle-orm'
import { auth } from '~/server/auth'

const PAGE_SIZE = 50

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  const session = await auth()
  if (!session || session.user.role !== 'admin') return null

  const rows = await db
    .select()
    .from(adminAuditLog)
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <p className="mt-1 text-sm text-gray-400">
          Immutable record of all administrative actions
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="px-4 py-3 font-medium text-gray-400">Action</th>
              <th className="px-4 py-3 font-medium text-gray-400">Target</th>
              <th className="px-4 py-3 font-medium text-gray-400">Actor</th>
              <th className="px-4 py-3 font-medium text-gray-400">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  No audit log entries yet
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50"
                >
                  <td className="px-4 py-3 font-mono text-purple-400">
                    {row.action}
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {row.targetType && row.targetId ? (
                      <span>
                        <span className="text-gray-500">{row.targetType}/</span>
                        <span className="font-mono">{row.targetId.slice(0, 8)}…</span>
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-400">
                    {row.actorId.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {row.createdAt.toISOString().replace('T', ' ').slice(0, 19)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {(rows.length === PAGE_SIZE || page > 1) && (
        <div className="mt-4 flex justify-between text-sm">
          {page > 1 ? (
            <a
              href={`?page=${page - 1}`}
              className="rounded px-3 py-1 text-gray-400 hover:bg-gray-800 hover:text-white"
            >
              ← Previous
            </a>
          ) : (
            <span />
          )}
          {rows.length === PAGE_SIZE && (
            <a
              href={`?page=${page + 1}`}
              className="rounded px-3 py-1 text-gray-400 hover:bg-gray-800 hover:text-white"
            >
              Next →
            </a>
          )}
        </div>
      )}
    </div>
  )
}
