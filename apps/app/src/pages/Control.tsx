import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GameController } from '../game/controller'
import { TwitchChatReader } from '../lib/twitch-chat'
import { createPublisher } from '../lib/sync'
import { loadPlaylists, loadChannel } from '../lib/storage'
import type { GameSnapshot, Playlist } from '../lib/types'
import { exportScoresJson, exportScoresCsv, exportPodiumPng } from '../lib/export'
import Player from '../components/Player'
import Leaderboard from '../components/Leaderboard'
import Feed from '../components/Feed'

const ACTIVE_KEY = 'blindtest:activePlaylist'

export default function Control() {
  const nav = useNavigate()
  const ctrlRef = useRef<GameController | null>(null)
  const pubRef = useRef<ReturnType<typeof createPublisher> | null>(null)
  const readerRef = useRef<TwitchChatReader | null>(null)
  const [snap, setSnap] = useState<GameSnapshot | null>(null)
  const [chatStatus, setChatStatus] = useState('connecting')

  useEffect(() => {
    const channel = loadChannel()
    const playlists = loadPlaylists()
    const active: Playlist | undefined =
      playlists.find((p) => p.id === localStorage.getItem(ACTIVE_KEY)) ?? playlists[0]
    if (!channel || !active || active.tracks.length === 0) {
      nav('/')
      return
    }

    const pub = createPublisher()
    pubRef.current = pub
    const ctrl = new GameController(active.tracks, channel, (s) => {
      setSnap(s)
      pub.publish(s)
    })
    ctrlRef.current = ctrl
    setSnap(ctrl.snapshot())
    pub.publish(ctrl.snapshot())

    const reader = new TwitchChatReader(channel, {
      onMessage: (m) => void ctrl.handleChat(m),
      onStatus: setChatStatus,
    })
    reader.connect()
    readerRef.current = reader

    return () => {
      reader.disconnect()
      pub.close()
    }
  }, [nav])

  const ctrl = ctrlRef.current
  const track = ctrl?.currentTrack ?? null
  if (!snap || !ctrl) return null

  const podium = snap.status === 'revealed' ? ctrl.roundPodium() : []

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_360px]">
      {/* Left: player + controls */}
      <div className="flex flex-col gap-4">
        <header className="flex items-center gap-3 text-sm">
          <Link to="/" className="text-white/40 hover:text-white">
            ← Config
          </Link>
          <span className="font-medium">#{snap.channel}</span>
          <StatusDot status={chatStatus} />
          <span className="text-white/40">
            Manche {snap.trackIndex + 1}/{snap.trackTotal}
          </span>
          <a
            href={`${import.meta.env.BASE_URL}overlay`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20"
          >
            Ouvrir l'overlay ↗
          </a>
        </header>

        <Player source={track?.source ?? null} active={snap.status === 'playing'} />

        <div className="rounded-xl bg-white/5 p-4">
          <div className="mb-3 text-sm">
            {track ? (
              <>
                <span className="text-white/40">Réponse : </span>
                <span className="font-medium">{track.title}</span>
                {track.artist && <span className="text-white/60"> — {track.artist}</span>}
              </>
            ) : (
              <span className="text-white/40">Aucune piste</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void ctrl.startRound()}
              disabled={snap.status === 'playing' || !track}
              className="flex-1 rounded-lg bg-green-500 py-2 font-medium text-black disabled:opacity-30"
            >
              ▶ Démarrer
            </button>
            <button
              onClick={() => void ctrl.reveal()}
              disabled={snap.status !== 'playing'}
              className="flex-1 rounded-lg bg-amber-500 py-2 font-medium text-black disabled:opacity-30"
            >
              👁 Révéler
            </button>
            <button
              onClick={() => ctrl.next()}
              disabled={snap.trackIndex >= snap.trackTotal - 1 && snap.status === 'idle'}
              className="flex-1 rounded-lg bg-white/10 py-2 font-medium disabled:opacity-30"
            >
              ⏭ Suivant
            </button>
          </div>
        </div>

        {podium.length > 0 && (
          <div className="rounded-xl bg-white/5 p-4">
            <h3 className="mb-2 text-sm font-semibold text-white/60">Podium de la manche</h3>
            <ol className="flex gap-3">
              {podium.map((p, i) => (
                <li key={p.username} className="flex-1 rounded-lg bg-white/5 p-2 text-center">
                  <div className="text-lg">{['🥇', '🥈', '🥉'][i]}</div>
                  <div className="truncate text-sm font-medium">{p.displayName}</div>
                  <div className="font-mono text-xs text-white/50">{p.points}</div>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="flex gap-2 text-sm">
          <button
            onClick={() => exportScoresJson(snap.leaderboard)}
            className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/20"
          >
            Export JSON
          </button>
          <button
            onClick={() => exportScoresCsv(snap.leaderboard)}
            className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/20"
          >
            Export CSV
          </button>
          <button
            onClick={() => exportPodiumPng(snap.leaderboard)}
            className="rounded-lg bg-white/10 px-3 py-2 hover:bg-white/20"
          >
            Podium PNG
          </button>
        </div>
      </div>

      {/* Right: leaderboard + feed */}
      <div className="flex flex-col gap-4">
        <div className="rounded-xl bg-white/5 p-4">
          <h3 className="mb-2 text-sm font-semibold text-white/60">Classement</h3>
          <Leaderboard rows={snap.leaderboard} onAdjust={(u, d) => ctrl.adjustScore(u, d)} />
        </div>
        <div className="rounded-xl bg-white/5 p-4">
          <h3 className="mb-2 text-sm font-semibold text-white/60">Flux</h3>
          <Feed events={snap.feed} />
        </div>
      </div>
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
