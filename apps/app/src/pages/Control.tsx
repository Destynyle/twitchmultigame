import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GameController } from '../game/controller'
import { TwitchChatReader } from '../lib/twitch-chat'
import { createPublisher } from '../lib/sync'
import { loadPlaylists, loadChannel, updateTrack, addTracksToPlaylist } from '../lib/storage'
import { parseSource, fetchMeta } from '../lib/sources'
import { applyTheme, getTheme } from '../lib/settings'
import type { GameSnapshot, Playlist, Track } from '../lib/types'
import { exportScoresJson, exportScoresCsv, exportPodiumPng } from '../lib/export'
import Player from '../components/Player'
import Leaderboard from '../components/Leaderboard'
import Feed from '../components/Feed'
import Footer from '../components/Footer'

const ACTIVE_KEY = 'blindtest:activePlaylist'

export default function Control() {
  const nav = useNavigate()
  const ctrlRef = useRef<GameController | null>(null)
  const pubRef = useRef<ReturnType<typeof createPublisher> | null>(null)
  const readerRef = useRef<TwitchChatReader | null>(null)
  const activeIdRef = useRef<string | null>(null)
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
    activeIdRef.current = active.id
    applyTheme(getTheme())

    const pub = createPublisher()
    pubRef.current = pub
    const ctrl = new GameController(active.tracks, channel, active.id, (s) => {
      setSnap(s)
      pub.publish(s)
    })
    // Restore an interrupted game (accidental reload) if it matches this channel+playlist.
    ctrl.hydrate()
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
      ctrl.dispose()
    }
  }, [nav])

  const ctrl = ctrlRef.current
  const track = ctrl?.currentTrack ?? null
  if (!snap || !ctrl) return null

  const podium = snap.status === 'revealed' ? ctrl.roundPodium() : []

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
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
          {track ? (
            <CurrentTrackEditor
              key={track.id}
              track={track}
              onSave={(patch) => {
                ctrl.editCurrentTrack(patch)
                updateTrack(track.id, patch)
              }}
            />
          ) : (
            <div className="mb-3 text-sm text-white/40">Aucune piste</div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => void ctrl.startRound()}
              disabled={snap.status === 'playing' || !track}
              className="flex-1 rounded-lg bg-green-500 py-2 font-medium text-black transition-all duration-150 hover:enabled:scale-105 hover:enabled:bg-green-400 active:enabled:scale-95 disabled:opacity-30"
            >
              ▶ Démarrer
            </button>
            <button
              onClick={() => void ctrl.reveal()}
              disabled={snap.status !== 'playing'}
              className="flex-1 rounded-lg bg-amber-500 py-2 font-medium text-black transition-all duration-150 hover:enabled:scale-105 hover:enabled:bg-amber-400 active:enabled:scale-95 disabled:opacity-30"
            >
              👁 Révéler
            </button>
            <button
              onClick={() => ctrl.next()}
              disabled={snap.trackIndex >= snap.trackTotal - 1 && snap.status === 'idle'}
              className="flex-1 rounded-lg bg-white/10 py-2 font-medium transition-all duration-150 hover:enabled:scale-105 hover:enabled:bg-white/20 active:enabled:scale-95 disabled:opacity-30"
            >
              ⏭ Suivant
            </button>
          </div>
          <button
            onClick={() => ctrl.toggleBonus()}
            className={`mt-2 w-full rounded-lg py-2 text-sm font-semibold transition-all duration-150 hover:scale-[1.02] active:scale-100 ${
              snap.bonus
                ? 'bg-amber-400 text-black ring-2 ring-amber-200'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            {snap.bonus ? '✦ Manche bonus ×2 ACTIVE' : '✦ Activer manche bonus ×2'}
          </button>
        </div>

        <AddSong
          onAdd={async (input) => {
            const source = parseSource(input)
            if (!source) return 'URL YouTube/Spotify invalide'
            const meta = await fetchMeta(source)
            const newTrack: Track = {
              id: crypto.randomUUID(),
              title: meta.title ?? 'Sans titre',
              artist: meta.artist ?? null,
              featurings: [],
              malusTerms: [],
              source,
              ...(meta.cover ? { coverUrl: meta.cover } : {}),
            }
            ctrl.addTracks([newTrack])
            if (activeIdRef.current) addTracksToPlaylist(activeIdRef.current, [newTrack])
            return null
          }}
        />

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
          <button
            onClick={() => {
              if (confirm('Remettre tous les scores à zéro ?')) ctrl.resetGame()
            }}
            className="ml-auto rounded-lg bg-red-500/20 px-3 py-2 text-red-300 hover:bg-red-500/30"
          >
            Reset scores
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
      <Footer />
    </div>
  )
}

/** Editable answer for the current track — fix title/artist mid-game. */
function CurrentTrackEditor({
  track,
  onSave,
}: {
  track: Track
  onSave: (patch: {
    title?: string
    artist?: string | null
    featurings?: string[]
    malusTerms?: string[]
  }) => void
}) {
  const [title, setTitle] = useState(track.title)
  const [artist, setArtist] = useState(track.artist ?? '')
  const [feats, setFeats] = useState(track.featurings.join(', '))
  const [malus, setMalus] = useState(track.malusTerms.join(', '))
  const field =
    'w-full rounded bg-black/30 px-2 py-1 text-sm outline-none transition-colors focus:bg-black/50'
  return (
    <div className="mb-3">
      <div className="mb-1 text-xs text-white/40">Réponse — modifiable en direct</div>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== track.title && onSave({ title })}
          placeholder="Titre"
          className={field}
        />
        <input
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          onBlur={() => {
            const a = artist.trim() ? artist : null
            if (a !== track.artist) onSave({ artist: a })
          }}
          placeholder="Artiste (vide = titre seul)"
          className={field}
        />
        <input
          value={feats}
          onChange={(e) => setFeats(e.target.value)}
          onBlur={() => {
            const list = splitList(feats)
            if (list.join(' ') !== track.featurings.join(' ')) onSave({ featurings: list })
          }}
          placeholder="Featurings (séparés par ,)"
          className={field}
        />
        <input
          value={malus}
          onChange={(e) => setMalus(e.target.value)}
          onBlur={() => {
            const list = splitList(malus)
            if (list.join(' ') !== track.malusTerms.join(' ')) onSave({ malusTerms: list })
          }}
          placeholder="Pièges malus (séparés par ,)"
          className={field}
        />
      </div>
    </div>
  )
}

/** Paste a YouTube/Spotify URL to append a track mid-game (scores preserved). */
function AddSong({ onAdd }: { onAdd: (input: string) => Promise<string | null> }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!url.trim() || busy) return
    setBusy(true)
    setError('')
    const err = await onAdd(url.trim())
    setBusy(false)
    if (err) setError(err)
    else setUrl('')
  }

  return (
    <div className="rounded-xl bg-white/5 p-4">
      <h3 className="mb-2 text-sm font-semibold text-white/60">Ajouter un son (en direct)</h3>
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          placeholder="Lien YouTube ou Spotify"
          className="flex-1 rounded-lg bg-black/30 px-3 py-2 text-sm outline-none transition-colors focus:bg-black/50"
        />
        <button
          onClick={() => void submit()}
          disabled={busy || !url.trim()}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium transition-all duration-150 hover:enabled:scale-105 hover:enabled:bg-white/20 active:enabled:scale-95 disabled:opacity-30"
        >
          {busy ? '…' : '+ Ajouter'}
        </button>
      </div>
      {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
    </div>
  )
}

function splitList(v: string): string[] {
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
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
