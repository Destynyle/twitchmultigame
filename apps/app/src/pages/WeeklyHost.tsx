import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { GameController } from '../game/controller'
import { TwitchChatReader } from '../lib/twitch-chat'
import { createPublisher } from '../lib/sync'
import { loadChannel, saveChannel } from '../lib/storage'
import { applyTheme, getTheme } from '../lib/settings'
import { getWeekly, pushWeeklyResults, type WeeklyWeek } from '../lib/weekly-api'
import { getTwitchToken } from '../lib/twitch-auth'
import type { GameSnapshot, Track } from '../lib/types'
import Player from '../components/Player'
import Leaderboard from '../components/Leaderboard'
import Feed from '../components/Feed'
import Footer from '../components/Footer'

// Host mode for the weekly blindtest: rounds chain automatically, the host UI
// never shows the current answer (trust model — the streamer animates, the
// community plays), and the final leaderboard is pushed to the global board.

const REVEAL_SEC = 8

export default function WeeklyHost() {
  const [week, setWeek] = useState<WeeklyWeek | null>(null)
  const [error, setError] = useState('')
  const [channel, setChannel] = useState(loadChannel)

  useEffect(() => {
    applyTheme(getTheme())
    getWeekly()
      .then(setWeek)
      .catch((e) => setError((e as Error).message))
  }, [])

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center text-white/50">
        <div>
          <p>{error}</p>
          <Link to="/weekly" className="mt-3 inline-block text-indigo-300 hover:underline">← Retour</Link>
        </div>
      </div>
    )
  }
  if (!week) return <div className="grid min-h-screen place-items-center text-white/40">Chargement…</div>
  if (!channel.trim()) {
    return <ChannelPrompt onSet={(c) => { saveChannel(c); setChannel(c) }} />
  }
  return <Host week={week} channel={channel.trim().toLowerCase()} />
}

function ChannelPrompt({ onSet }: { onSet: (c: string) => void }) {
  const [v, setV] = useState('')
  return (
    <div className="mx-auto grid min-h-screen max-w-sm place-items-center p-6">
      <div className="w-full">
        <h1 className="mb-1 text-2xl font-bold">📅 Blindtest de la semaine</h1>
        <p className="mb-4 text-sm text-white/50">Ta chaîne Twitch (le chat joue).</p>
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && v.trim() && onSet(v)}
          placeholder="ex: destynyle"
          autoFocus
          className="w-full rounded-lg bg-white/5 px-3 py-2 outline-none focus:bg-white/10"
        />
        <button
          onClick={() => v.trim() && onSet(v)}
          className="mt-3 w-full rounded-lg bg-indigo-500 py-2 font-medium hover:bg-indigo-400"
        >
          Continuer
        </button>
      </div>
    </div>
  )
}

type Phase = 'ready' | 'running' | 'done'

function Host({ week, channel }: { week: WeeklyWeek; channel: string }) {
  const ctrlRef = useRef<GameController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const phaseRef = useRef<Phase>('ready')
  const [snap, setSnap] = useState<GameSnapshot | null>(null)
  const [chatStatus, setChatStatus] = useState('connecting')
  const [phase, setPhaseState] = useState<Phase>('ready')
  const [playing, setPlaying] = useState(false)
  const [roundSec, setRoundSec] = useState(40)
  const [pushMsg, setPushMsg] = useState('')

  const setPhase = (p: Phase) => {
    phaseRef.current = p
    setPhaseState(p)
  }

  useEffect(() => {
    const tracks: Track[] = week.tracks.map((t) => ({ ...t, id: crypto.randomUUID() }))
    const pub = createPublisher()
    const ctrl = new GameController(tracks, channel, `weekly:${week.id}`, (s) => {
      setSnap(s)
      pub.publish(s)
    })
    // Resume an interrupted run (reload) — scores and position survive.
    ctrl.hydrate()
    ctrlRef.current = ctrl
    setSnap(ctrl.snapshot())
    pub.publish(ctrl.snapshot())

    const reader = new TwitchChatReader(channel, {
      onMessage: (m) => void ctrl.handleChat(m),
      onStatus: setChatStatus,
    })
    reader.connect()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      reader.disconnect()
      pub.close()
      ctrl.dispose()
    }
  }, [week, channel])

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }

  /** One automated round: play → reveal → (next round | finish). */
  const runRound = async () => {
    const ctrl = ctrlRef.current
    if (!ctrl || phaseRef.current !== 'running') return
    await ctrl.startRound()
    setPlaying(true)
    timerRef.current = setTimeout(() => void revealNow(), roundSec * 1000)
  }

  const revealNow = async () => {
    const ctrl = ctrlRef.current
    if (!ctrl || phaseRef.current !== 'running') return
    clearTimer()
    setPlaying(false)
    await ctrl.reveal()
    const s = ctrl.snapshot()
    const isLast = s.trackIndex >= s.trackTotal - 1
    timerRef.current = setTimeout(() => {
      if (phaseRef.current !== 'running') return
      if (isLast) {
        void finish()
      } else {
        ctrlRef.current?.next()
        void runRound()
      }
    }, REVEAL_SEC * 1000)
  }

  const start = () => {
    setPushMsg('')
    setPhase('running')
    void runRound()
  }

  const stop = () => {
    clearTimer()
    setPlaying(false)
    setPhase('ready')
  }

  const finish = async () => {
    clearTimer()
    setPlaying(false)
    setPhase('done')
    await pushResults()
  }

  const pushResults = async () => {
    const ctrl = ctrlRef.current
    if (!ctrl) return
    const board = ctrl.snapshot().leaderboard
    if (board.length === 0) {
      setPushMsg('Aucun joueur — rien à publier.')
      return
    }
    const token = getTwitchToken()
    if (!token) {
      setPushMsg('⚠️ Connecte Twitch (page Config) puis clique « Publier les scores ».')
      return
    }
    try {
      await pushWeeklyResults(week.id, token, board)
      setPushMsg('✅ Scores publiés sur le classement global !')
    } catch (e) {
      setPushMsg(`⚠️ Publication échouée : ${(e as Error).message}`)
    }
  }

  const ctrl = ctrlRef.current
  if (!snap || !ctrl) return null
  const revealed = snap.status === 'revealed'

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <header className="flex flex-wrap items-center gap-3 text-sm">
            <Link to="/weekly" className="text-white/40 hover:text-white">← Classement</Link>
            <span className="font-medium">📅 {week.theme || 'Blindtest de la semaine'}</span>
            <span className="text-white/40">#{snap.channel}</span>
            <StatusDot status={chatStatus} />
            <span className="ml-auto text-white/50">
              Piste {snap.trackIndex + 1}/{snap.trackTotal}
            </span>
          </header>

          {/* Player, masked while guessing so the host never sees the answer. */}
          <div className="relative overflow-hidden rounded-xl">
            <Player source={ctrl.currentTrack?.source ?? null} active={playing} />
            {!revealed && (
              <div className="absolute inset-0 z-10 grid place-items-center bg-black/95">
                <div className="text-center">
                  <div className="text-4xl">{playing ? '🎵' : '🤫'}</div>
                  <div className="mt-1 text-sm text-white/50">
                    {playing ? 'Manche en cours — réponse cachée' : 'Prêt'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {revealed && snap.reveal && (
            <div className="rounded-xl bg-emerald-500/10 p-3 text-center">
              <span className="font-bold">{snap.reveal.title}</span>
              {snap.reveal.artist && <span className="text-white/60"> — {snap.reveal.artist}</span>}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {phase !== 'running' ? (
              <button
                onClick={start}
                className="rounded-lg bg-green-500 px-5 py-2 text-sm font-semibold text-black hover:bg-green-400"
              >
                ▶ {snap.trackIndex > 0 || phase === 'done' ? 'Reprendre' : 'Lancer'} l'autopilote
              </button>
            ) : (
              <>
                <button
                  onClick={() => void revealNow()}
                  disabled={snap.status !== 'playing'}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:enabled:bg-amber-400 disabled:opacity-30"
                >
                  ⏭ Révéler maintenant
                </button>
                <button onClick={stop} className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20">
                  ⏸ Pause
                </button>
              </>
            )}
            {phase !== 'running' && (
              <label className="flex items-center gap-2 text-xs text-white/50">
                Durée par manche
                <input
                  type="number"
                  min={10}
                  max={120}
                  value={roundSec}
                  onChange={(e) => setRoundSec(Math.min(120, Math.max(10, Number(e.target.value) || 40)))}
                  className="w-16 rounded-lg bg-black/30 px-2 py-1 outline-none"
                />
                s
              </label>
            )}
          </div>

          <p className="text-xs text-white/30">
            Autopilote : {roundSec}s de jeu puis {REVEAL_SEC}s de réponse, enchaîné jusqu'au bout.
            Mode « App Spotify » recommandé (lecture auto, page Config). Overlay OBS : /overlay, comme d'habitude.
          </p>

          {phase === 'done' && (
            <div className="rounded-xl bg-white/5 p-4 text-center">
              <div className="text-3xl">🏁</div>
              <div className="mt-1 font-semibold">C'est fini !</div>
              {pushMsg && <p className="mt-2 text-sm text-white/60">{pushMsg}</p>}
              {pushMsg.startsWith('⚠️') && (
                <button
                  onClick={() => void pushResults()}
                  className="mt-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm hover:bg-indigo-400"
                >
                  Publier les scores
                </button>
              )}
              <Link to="/weekly" className="mt-2 block text-sm text-indigo-300 hover:underline">
                Voir le classement global →
              </Link>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-white/5 p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">Classement</h3>
            <Leaderboard rows={snap.leaderboard.slice(0, 10)} />
          </div>
          <div className="max-h-80 overflow-hidden rounded-xl bg-white/5 p-4">
            <Feed events={snap.feed.slice(0, 12)} />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'connected' ? 'bg-green-400' : status === 'closed' ? 'bg-red-400' : 'bg-amber-400'
  return (
    <span className="flex items-center gap-1 text-white/40">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {status}
    </span>
  )
}
