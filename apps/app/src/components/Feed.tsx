import type { FeedEvent } from '../lib/types'

const COLOR: Record<FeedEvent['kind'], string> = {
  found: 'text-green-400',
  malus: 'text-red-400',
  featuring: 'text-cyan-400',
  streak: 'text-orange-400',
  system: 'text-white/40',
}

export default function Feed({ events }: { events: FeedEvent[] }) {
  return (
    <div className="flex flex-col gap-1">
      {events.map((e) => (
        <div key={e.id} className={`animate-pop text-sm ${COLOR[e.kind]}`}>
          {e.text}
        </div>
      ))}
    </div>
  )
}
