'use client'

import { useState, useTransition } from 'react'
import { removeContentAction, dismissReportAction } from '~/server/actions/admin/moderation'
import type { ReportGroup } from '~/server/actions/admin/moderation'

export function ModerationClient({ initialGroups }: { initialGroups: ReportGroup[] }) {
  const [groups, setGroups] = useState(initialGroups)
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  function key(g: ReportGroup) {
    return `${g.contentType}:${g.contentId}`
  }

  function handleRemove(g: ReportGroup) {
    startTransition(async () => {
      const res = await removeContentAction(g.contentType, g.contentId, g.reportIds)
      if ('error' in res) {
        setFeedback((p) => ({ ...p, [key(g)]: res.error }))
      } else {
        setGroups((prev) => prev.filter((x) => key(x) !== key(g)))
        setFeedback((p) => ({ ...p, [key(g)]: 'Content removed' }))
      }
    })
  }

  function handleDismiss(g: ReportGroup) {
    startTransition(async () => {
      const res = await dismissReportAction(g.contentType, g.contentId, g.reportIds)
      if ('error' in res) {
        setFeedback((p) => ({ ...p, [key(g)]: res.error }))
      } else {
        setGroups((prev) => prev.filter((x) => key(x) !== key(g)))
      }
    })
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-8 text-center text-gray-500">
        No pending reports
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div
          key={key(g)}
          className="rounded-lg border border-gray-800 bg-gray-900 p-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded bg-gray-800 px-2 py-0.5 text-xs font-medium capitalize text-gray-300">
                  {g.contentType}
                </span>
                <span className="font-medium text-white">{g.contentPreview}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
                <span className="text-gray-400">
                  {g.reporterCount} report{g.reporterCount !== 1 ? 's' : ''}
                </span>
                <span className="text-gray-600">·</span>
                {g.reasons.map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-red-900/40 px-2 py-0.5 capitalize text-red-300"
                  >
                    {r}
                  </span>
                ))}
                <span className="text-gray-600">·</span>
                <span className="text-gray-400">
                  First reported {g.firstReportedAt.toISOString().slice(0, 10)}
                </span>
              </div>
              {feedback[key(g)] && (
                <div className="mt-1.5 text-xs text-green-400">{feedback[key(g)]}</div>
              )}
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => handleDismiss(g)}
                disabled={isPending}
                className="rounded px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-50"
              >
                Dismiss
              </button>
              <button
                onClick={() => handleRemove(g)}
                disabled={isPending}
                className="rounded bg-red-900 px-3 py-1.5 text-sm font-medium text-red-200 ring-1 ring-red-700 hover:bg-red-800 disabled:opacity-50"
              >
                Remove content
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
