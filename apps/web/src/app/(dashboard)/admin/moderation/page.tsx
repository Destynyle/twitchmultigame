import { getModerationQueueAction } from '~/server/actions/admin/moderation'
import { ModerationClient } from './ModerationClient'

const REPORT_REASONS = ['inappropriate', 'copyright', 'spam', 'other'] as const

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams
  const filterReason = reason && REPORT_REASONS.includes(reason as typeof REPORT_REASONS[number])
    ? reason
    : undefined

  const result = await getModerationQueueAction(filterReason)
  const groups = 'groups' in result ? result.groups : []

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Content Moderation</h1>
        <p className="mt-1 text-sm text-gray-400">Review and action reported content</p>
      </div>

      {/* Reason filter */}
      <div className="mb-4 flex gap-2">
        <a
          href="/dashboard/admin/moderation"
          className={`rounded-full px-3 py-1 text-sm ${!filterReason ? 'bg-purple-700 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
        >
          All
        </a>
        {REPORT_REASONS.map((r) => (
          <a
            key={r}
            href={`/dashboard/admin/moderation?reason=${r}`}
            className={`rounded-full px-3 py-1 text-sm capitalize ${filterReason === r ? 'bg-purple-700 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
          >
            {r}
          </a>
        ))}
      </div>

      <ModerationClient initialGroups={groups} />
    </div>
  )
}
