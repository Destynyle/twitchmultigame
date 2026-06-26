import { useEffect, useRef, useState } from 'react'
import { createSubscriber } from '../lib/sync'
import type { FeedKind, GameSnapshot } from '../lib/types'
import Leaderboard from '../components/Leaderboard'
import Feed from '../components/Feed'

interface Pop {
  key: string
  author?: string
  detail: string
  kind: FeedKind
  x: number
  dur: number
  emphasis: boolean
}

// Feed kinds that spawn a falling popup (score-related only).
const POPUP_KINDS = new Set<FeedKind>(['found', 'malus', 'featuring'])

export default function Overlay() {
  const [snap, setSnap] = useState<GameSnapshot | null>(null)
  const [pops, setPops] = useState<Pop[]>([])
  const seenIds = useRef<Set<string>>(new Set())
  const initialized = useRef(false)

  useEffect(() => {
    document.body.classList.add('overlay')
    const sub = createSubscriber(setSnap)
    return () => {
      document.body.classList.remove('overlay')
      sub.close()
    }
  }, [])

  // Spawn a falling popup for each NEW score event. The first snapshot only seeds
  // the seen-set (the feed may already hold up to 40 events) to avoid an avalanche.
  useEffect(() => {
    if (!snap) return
    if (!initialized.current) {
      for (const e of snap.feed) seenIds.current.add(e.id)
      initialized.current = true
      return
    }
    const fresh = snap.feed.filter((e) => !seenIds.current.has(e.id) && POPUP_KINDS.has(e.kind))
    if (fresh.length === 0) return
    // feed is newest-first; reverse so popups appear in chronological order.
    const newPops = fresh.reverse().map((e): Pop => {
      seenIds.current.add(e.id)
      const detail = e.author && e.text.startsWith(e.author) ? e.text.slice(e.author.length).trim() : e.text
      return {
        key: e.id,
        ...(e.author ? { author: e.author } : {}),
        detail,
        kind: e.kind,
        x: 5 + Math.random() * 80,
        dur: 3.2 + Math.random() * 0.8,
        emphasis: e.kind === 'found' && /[🎯🔥]/u.test(e.text),
      }
    })
    setPops((prev) => [...prev, ...newPops].slice(-10))
  }, [snap])

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

      {/* Falling event popups (full-screen, non-interactive) */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {pops.map((p) => (
          <EventPopup
            key={p.key}
            pop={p}
            onDone={() => setPops((prev) => prev.filter((x) => x.key !== p.key))}
          />
        ))}
      </div>
    </div>
  )
}

const POP_STYLE: Record<FeedKind, string> = {
  found: 'bg-emerald-500/90 text-white',
  malus: 'bg-red-500/90 text-white',
  featuring: 'bg-cyan-500/90 text-white',
  streak: 'bg-amber-400/90 text-black',
  system: 'bg-white/20 text-white',
}

/** A single popup that drops from the top and removes itself when done. */
function EventPopup({ pop, onDone }: { pop: Pop; onDone: () => void }) {
  // Fallback removal in case the CSS animationend never fires (e.g. background tab).
  useEffect(() => {
    const t = setTimeout(onDone, pop.dur * 1000 + 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tone = pop.emphasis ? 'bg-amber-400/95 text-black ring-2 ring-amber-200' : POP_STYLE[pop.kind]
  return (
    <div
      className="animate-fall absolute top-0"
      style={{ left: `${pop.x}%`, ['--fall-dur' as string]: `${pop.dur}s` }}
      onAnimationEnd={onDone}
    >
      <div
        className={`flex flex-col items-center rounded-xl px-4 py-2 text-center shadow-2xl backdrop-blur ${tone} ${
          pop.emphasis ? 'scale-110' : ''
        }`}
      >
        {pop.author && (
          <span className={`font-extrabold leading-tight ${pop.emphasis ? 'text-xl' : 'text-base'}`}>
            {pop.author}
          </span>
        )}
        <span className={`font-semibold leading-tight ${pop.author ? 'text-sm opacity-90' : 'text-base'}`}>
          {pop.detail}
        </span>
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
