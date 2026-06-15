import { useState } from 'react'
import type { Track } from '../lib/types'
import {
  getSpotifyClientId,
  setSpotifyClientId,
  getTwitchClientId,
  setTwitchClientId,
  spotifyRedirectUri,
  twitchRedirectUri,
} from '../lib/connections'
import {
  beginSpotifyAuth,
  isSpotifyConnected,
  disconnectSpotify,
  fetchMyPlaylists,
  importSpotifyPlaylist,
  type SpotifyPlaylistRef,
} from '../lib/spotify'
import { beginTwitchAuth, isTwitchConnected } from '../lib/twitch-auth'

export default function ConnectionsPanel({
  onImport,
}: {
  onImport: (name: string, tracks: Track[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [spotifyId, setSpotifyId] = useState(getSpotifyClientId())
  const [twitchId, setTwitchId] = useState(getTwitchClientId())
  const [playlists, setPlaylists] = useState<SpotifyPlaylistRef[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const spotifyOn = isSpotifyConnected()
  const twitchOn = isTwitchConnected()

  async function loadPlaylists() {
    setError('')
    setBusy(true)
    try {
      setPlaylists(await fetchMyPlaylists())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function pick(p: SpotifyPlaylistRef) {
    setBusy(true)
    setError('')
    try {
      const tracks = await importSpotifyPlaylist(p.id)
      onImport(p.name, tracks)
      setPlaylists(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function safe(fn: () => void) {
    try {
      fn()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="mb-6 rounded-xl bg-white/5 p-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">Connexions</h2>
        <button onClick={() => setOpen((o) => !o)} className="text-xs text-white/40 hover:text-white">
          {open ? 'masquer réglages' : 'réglages'}
        </button>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => safe(beginTwitchAuth)}
            className="rounded-lg bg-[#9146FF]/80 px-3 py-1.5 text-sm hover:bg-[#9146FF]"
          >
            {twitchOn ? 'Twitch ✓' : 'Connecter Twitch'}
          </button>
          {spotifyOn ? (
            <button
              onClick={loadPlaylists}
              disabled={busy}
              className="rounded-lg bg-[#1DB954]/80 px-3 py-1.5 text-sm text-black hover:bg-[#1DB954] disabled:opacity-50"
            >
              Importer playlist Spotify
            </button>
          ) : (
            <button
              onClick={() => safe(() => void beginSpotifyAuth())}
              className="rounded-lg bg-[#1DB954]/80 px-3 py-1.5 text-sm text-black hover:bg-[#1DB954]"
            >
              Connecter Spotify
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
          <label className="text-xs">
            <span className="text-white/40">Spotify client_id</span>
            <input
              value={spotifyId}
              onChange={(e) => {
                setSpotifyId(e.target.value)
                setSpotifyClientId(e.target.value)
              }}
              className="mt-0.5 w-full rounded bg-black/30 px-2 py-1 text-sm"
            />
            <span className="text-[10px] text-white/30">Redirect : {spotifyRedirectUri()}</span>
          </label>
          <label className="text-xs">
            <span className="text-white/40">Twitch client_id</span>
            <input
              value={twitchId}
              onChange={(e) => {
                setTwitchId(e.target.value)
                setTwitchClientId(e.target.value)
              }}
              className="mt-0.5 w-full rounded bg-black/30 px-2 py-1 text-sm"
            />
            <span className="text-[10px] text-white/30">Redirect : {twitchRedirectUri()}</span>
          </label>
          {spotifyOn && (
            <button onClick={disconnectSpotify} className="col-span-2 text-left text-xs text-white/30 hover:text-red-400">
              Déconnecter Spotify
            </button>
          )}
        </div>
      )}

      {playlists && (
        <div className="mt-3 max-h-60 overflow-auto border-t border-white/10 pt-3">
          {playlists.length === 0 && <p className="text-sm text-white/40">Aucune playlist</p>}
          {playlists.map((p) => (
            <button
              key={p.id}
              onClick={() => pick(p)}
              disabled={busy}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-white/10 disabled:opacity-50"
            >
              <span className="flex-1 truncate">{p.name}</span>
              <span className="text-xs text-white/40">{p.total}</span>
            </button>
          ))}
        </div>
      )}

      {busy && <p className="mt-2 text-xs text-white/40">Chargement…</p>}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </section>
  )
}
