import { useEffect, useState } from 'react'
import { createSubscriber } from '../lib/sync'
import type { GameSnapshot } from '../lib/types'
import Leaderboard from '../components/Leaderboard'
import Feed from '../components/Feed'

export default function Overlay() {
  const [snap, setSnap] = useState<GameSnapshot | null>(null)

  useEffect(() => {
    document.body.classList.add('overlay')
    const sub = createSubscriber(setSnap)
    return () => {
      document.body.classList.remove('overlay')
      sub.close()
    }
  }, [])

  if (!snap) {
    return <div className="grid h-screen place-items-center text-white/30">En attente du contrôle…</div>
  }

  const revealed = snap.status === 'revealed'

  return (
    <div className="grid h-screen grid-cols-[1fr_320px] gap-4 p-4">
      {/* Player zone — heavily blurred cover until found (must be unrecognizable) */}
      <div className="relative flex items-center justify-center overflow-hidden rounded-2xl">
        {snap.coverUrl ? (
          <img
            src={snap.coverUrl}
            alt=""
            className={`max-h-[70vh] rounded-2xl shadow-2xl transition-all duration-700 ${
              snap.found || revealed
                ? 'blur-0 scale-100 brightness-100'
                : 'blur-[90px] scale-125 brightness-75 saturate-150'
            }`}
          />
        ) : (
          <div className="grid h-64 w-64 place-items-center rounded-2xl bg-white/5 text-6xl">🎵</div>
        )}
        {snap.status !== 'idle' && (
          <div className="absolute inset-x-6 bottom-6 flex flex-col items-center gap-2">
            <AnswerSlot label="Titre" value={snap.partial.title} big />
            {snap.partial.hasArtist && <AnswerSlot label="Artiste" value={snap.partial.artist} />}
            {snap.partial.featuringTotal > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-[10px] uppercase tracking-wide text-white/40">feat.</span>
                {snap.partial.featurings.map((f) => (
                  <FeatChip key={f} name={f} />
                ))}
                {Array.from({
                  length: snap.partial.featuringTotal - snap.partial.featurings.length,
                }).map((_, i) => (
                  <FeatChip key={`masked-${i}`} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Side: leaderboard + feed */}
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-black/60 p-4 backdrop-blur">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
            Classement
          </h3>
          <Leaderboard rows={snap.leaderboard.slice(0, 10)} />
        </div>
        <div className="flex-1 overflow-hidden rounded-2xl bg-black/60 p-4 backdrop-blur">
          <Feed events={snap.feed.slice(0, 12)} />
        </div>
      </div>
    </div>
  )
}

/** One answer line: shows the value once revealed, masked dots until then. */
function AnswerSlot({ label, value, big }: { label: string; value: string | null; big?: boolean }) {
  const size = big ? 'text-2xl' : 'text-lg'
  return (
    <div className="flex items-center gap-3 rounded-xl bg-black/70 px-4 py-2 backdrop-blur">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">{label}</span>
      {value ? (
        <span className={`font-bold text-white ${size}`}>{value}</span>
      ) : (
        <span className={`select-none font-bold tracking-[0.3em] text-white/25 ${size}`}>••••••</span>
      )}
    </div>
  )
}

/** A featuring chip: green with the name once found, masked otherwise. */
function FeatChip({ name }: { name?: string }) {
  return name ? (
    <span className="rounded-full bg-emerald-500/80 px-3 py-1 text-sm font-medium text-white">
      {name}
    </span>
  ) : (
    <span className="select-none rounded-full bg-white/10 px-3 py-1 text-sm tracking-widest text-white/25">
      •••
    </span>
  )
}
