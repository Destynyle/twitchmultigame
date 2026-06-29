import { useEffect, useRef, useState } from 'react'
import { createBattleSubscriber } from '../lib/battle-sync'
import { applyTheme, getTheme } from '../lib/settings'
import type { BattleSideView, BattleSnapshot } from '../lib/battle-types'

interface Pop {
  key: string
  user: string
  side: 'a' | 'b'
  x: number
}

export default function BattleOverlay() {
  const [snap, setSnap] = useState<BattleSnapshot | null>(null)
  const [pops, setPops] = useState<Pop[]>([])
  const seen = useRef<Set<string>>(new Set())
  const init = useRef(false)

  useEffect(() => {
    document.body.classList.add('overlay')
    applyTheme(getTheme())
    const sub = createBattleSubscriber(setSnap)
    return () => {
      document.body.classList.remove('overlay')
      sub.close()
    }
  }, [])

  // Spawn a floating "+pseudo" for each new vote, toward the chosen side.
  useEffect(() => {
    if (!snap) return
    if (!init.current) {
      for (const f of snap.feed) seen.current.add(f.id)
      init.current = true
      return
    }
    const fresh = snap.feed.filter((f) => !seen.current.has(f.id))
    if (fresh.length === 0) return
    const add = fresh.reverse().map((f): Pop => {
      seen.current.add(f.id)
      return { key: f.id, user: f.user, side: f.side, x: 8 + Math.random() * 30 }
    })
    setPops((p) => [...p, ...add].slice(-14))
  }, [snap])

  if (!snap) {
    return <div className="grid h-screen place-items-center text-white/30">En attente…</div>
  }

  if (snap.phase === 'lobby') {
    return (
      <div className="ov-root grid h-screen place-items-center p-8 text-center">
        <div className="ov-panel rounded-3xl px-12 py-10 backdrop-blur">
          <div className="mb-2 text-sm uppercase tracking-widest text-white/40">Battle musicale</div>
          {snap.theme && <div className="ov-accent mb-4 text-3xl font-bold">{snap.theme}</div>}
          <div className="text-xl">
            Soumets ton son : <code className="rounded bg-white/10 px-2 py-1">!add nom du son</code>
          </div>
          <div className="mt-4 text-sm text-white/50">{snap.pool.count} son(s) en lice</div>
        </div>
      </div>
    )
  }

  if (snap.phase === 'done') {
    return (
      <div className="ov-root grid h-screen place-items-center p-8 text-center">
        <div className="ov-panel rounded-3xl px-12 py-10 backdrop-blur">
          <div className="text-6xl">🏆</div>
          <div className="ov-accent mt-3 text-4xl font-bold">{snap.champion?.title}</div>
          <div className="mt-1 text-xl text-white/60">{snap.champion?.artist}</div>
        </div>
      </div>
    )
  }

  // ─── Match (tug-of-war) ──────────────────────────────────────────────────────
  const m = snap.match!
  const a = snap.vote?.a ?? 0
  const b = snap.vote?.b ?? 0
  const total = a + b
  const shareA = total === 0 ? 0.5 : a / total
  const open = snap.vote?.open ?? false

  return (
    <div className="ov-root flex h-screen flex-col justify-center gap-6 p-8">
      <div className="text-center text-lg tracking-wide text-white/60">
        {m.roundLabel}
        {snap.theme && <span className="text-white/30"> · {snap.theme}</span>}
      </div>

      {/* Countdown bar */}
      {open && snap.vote && (
        <div className="mx-auto h-2 w-2/3 overflow-hidden rounded-full bg-black/40">
          <div
            key={snap.vote.startedAt}
            className="ov-countdown h-full rounded-full"
            style={{
              animationDuration: `${snap.vote.durationMs}ms`,
              animationDelay: `-${Math.max(0, Date.now() - snap.vote.startedAt)}ms`,
            }}
          />
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <Side view={m.a} votes={a} align="right" winner={snap.lastWinner === 'a'} />
        <div className="text-3xl font-black text-white/30">VS</div>
        <Side view={m.b} votes={b} align="left" winner={snap.lastWinner === 'b'} />
      </div>

      {/* Tug-of-war bar */}
      <div className="relative mx-auto h-12 w-11/12 overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10">
        <div
          className="absolute inset-y-0 left-0 flex items-center justify-start bg-gradient-to-r from-indigo-500 to-indigo-400 pl-4 font-bold text-white transition-[width] duration-500 ease-out"
          style={{ width: `${shareA * 100}%` }}
        >
          {total > 0 && `${Math.round(shareA * 100)}%`}
        </div>
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end bg-gradient-to-l from-rose-500 to-rose-400 pr-4 font-bold text-white transition-[width] duration-500 ease-out"
          style={{ width: `${(1 - shareA) * 100}%` }}
        >
          {total > 0 && `${Math.round((1 - shareA) * 100)}%`}
        </div>
        <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white/40" />
      </div>

      <div className="text-center text-sm text-white/40">
        {open ? 'Vote ouvert — tape 1 ou 2 dans le chat' : snap.lastWinner ? 'Vote clos' : 'En attente du vote'}
        {' · '}{total} vote(s)
      </div>

      {/* Floating +pseudo */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {pops.map((p) => (
          <VotePop
            key={p.key}
            pop={p}
            onDone={() => setPops((prev) => prev.filter((x) => x.key !== p.key))}
          />
        ))}
      </div>
    </div>
  )
}

function Side({
  view,
  votes,
  align,
  winner,
}: {
  view: BattleSideView
  votes: number
  align: 'left' | 'right'
  winner: boolean
}) {
  return (
    <div
      className={`flex items-center gap-4 ${align === 'right' ? 'flex-row-reverse text-right' : 'text-left'} ${
        winner ? 'opacity-100' : ''
      }`}
    >
      {view.coverUrl ? (
        <img
          src={view.coverUrl}
          alt=""
          className={`h-28 w-28 rounded-2xl object-cover shadow-2xl ${winner ? 'ring-4 ring-amber-300' : ''}`}
        />
      ) : (
        <div className="grid h-28 w-28 place-items-center rounded-2xl bg-white/10 text-4xl">🎵</div>
      )}
      <div className="min-w-0">
        <div className="truncate text-2xl font-bold">{view.title}</div>
        <div className="truncate text-lg text-white/50">{view.artist ?? '—'}</div>
        <div className="ov-accent mt-1 font-mono text-3xl font-black">{votes}</div>
        {view.submittedBy && <div className="text-xs text-white/30">par {view.submittedBy}</div>}
      </div>
    </div>
  )
}

function VotePop({ pop, onDone }: { pop: Pop; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200)
    return () => clearTimeout(t)
  }, [onDone])
  const sideStyle = pop.side === 'a' ? { left: `${pop.x}%` } : { right: `${pop.x}%` }
  const color = pop.side === 'a' ? 'bg-indigo-500/90' : 'bg-rose-500/90'
  return (
    <div
      className={`animate-pop absolute bottom-28 rounded-full px-3 py-1 text-sm font-bold text-white shadow-lg ${color}`}
      style={sideStyle}
    >
      +{pop.user}
    </div>
  )
}
