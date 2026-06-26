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
        {revealed && snap.reveal && (
          <div className="absolute bottom-6 rounded-xl bg-black/70 px-6 py-3 text-center backdrop-blur">
            <div className="text-2xl font-bold">{snap.reveal.title}</div>
            {snap.reveal.artist && <div className="text-white/70">{snap.reveal.artist}</div>}
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
