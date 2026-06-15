import type { ViewerScore } from '../lib/types'

export default function Leaderboard({
  rows,
  onAdjust,
}: {
  rows: ViewerScore[]
  onAdjust?: (username: string, delta: number) => void
}) {
  if (rows.length === 0) {
    return <div className="text-sm text-white/40">Pas encore de score</div>
  }
  return (
    <ol className="flex flex-col gap-1">
      {rows.map((r, i) => (
        <li
          key={r.username}
          className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-sm"
        >
          <span className="w-6 text-center font-mono text-white/40">{i + 1}</span>
          <span className="flex-1 truncate font-medium">{r.displayName}</span>
          {r.streak > 1 && <span className="text-xs text-orange-400">🔥{r.streak}</span>}
          <span className="font-mono tabular-nums">{r.points}</span>
          {onAdjust && (
            <span className="ml-1 flex gap-1">
              <button
                onClick={() => onAdjust(r.username, -1)}
                className="rounded bg-white/10 px-1.5 leading-5 hover:bg-red-500/40"
              >
                −
              </button>
              <button
                onClick={() => onAdjust(r.username, 1)}
                className="rounded bg-white/10 px-1.5 leading-5 hover:bg-green-500/40"
              >
                +
              </button>
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}
