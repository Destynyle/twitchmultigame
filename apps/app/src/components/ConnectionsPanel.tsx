import { useState } from 'react'
import { Link } from 'react-router-dom'
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
  importSpotifyPlaylistByLink,
  getDevices,
  type SpotifyPlaylistRef,
} from '../lib/spotify'
import { beginTwitchAuth, isTwitchConnected } from '../lib/twitch-auth'
import {
  getPlaybackMode,
  setPlaybackMode,
  getSpotifyDevice,
  setSpotifyDevice,
  type PlaybackMode,
} from '../lib/playback'

export default function ConnectionsPanel({
  onImport,
}: {
  onImport: (name: string, tracks: Track[]) => void
}) {
  // Open settings by default when no Spotify client_id yet — a fresh visitor
  // (shared link) needs to paste their own before anything works.
  const [open, setOpen] = useState(() => !getSpotifyClientId())
  const [spotifyId, setSpotifyId] = useState(getSpotifyClientId())
  const [twitchId, setTwitchId] = useState(getTwitchClientId())
  const [playlists, setPlaylists] = useState<SpotifyPlaylistRef[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const [mode, setMode] = useState<PlaybackMode>(getPlaybackMode())
  const [devices, setDevices] = useState<{ id: string; name: string }[] | null>(null)
  const [deviceId, setDeviceId] = useState(getSpotifyDevice()?.id ?? '')
  const [linkInput, setLinkInput] = useState('')

  function changeMode(m: PlaybackMode) {
    setMode(m)
    setPlaybackMode(m)
  }

  async function loadDevices() {
    setError('')
    setBusy(true)
    try {
      const list = await getDevices()
      setDevices(list.map((d) => ({ id: d.id, name: `${d.name} (${d.type})` })))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function pickDevice(id: string) {
    setDeviceId(id)
    const d = devices?.find((x) => x.id === id)
    setSpotifyDevice(id && d ? { id, name: d.name } : null)
  }

  function copy(text: string) {
    void navigator.clipboard?.writeText(text)
    setCopied(text)
    setTimeout(() => setCopied(''), 1500)
  }

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

  async function importLink() {
    setError('')
    setBusy(true)
    try {
      const { name, tracks } = await importSpotifyPlaylistByLink(linkInput)
      onImport(name, tracks)
      setLinkInput('')
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
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/70 transition-all duration-150 hover:scale-105 hover:border-white/30 hover:bg-white/20 hover:text-white active:scale-95"
        >
          <span className={`inline-block transition-transform duration-300 ${open ? 'rotate-90' : ''}`}>
            ⚙️
          </span>
          {open ? 'Masquer' : 'Réglages'}
        </button>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => safe(beginTwitchAuth)}
            className="rounded-lg bg-[#9146FF]/80 px-3 py-1.5 text-sm transition-all duration-150 hover:scale-105 hover:bg-[#9146FF] active:scale-95"
          >
            {twitchOn ? 'Twitch ✓' : 'Connecter Twitch'}
          </button>
          {spotifyOn ? (
            <button
              onClick={loadPlaylists}
              disabled={busy}
              className="rounded-lg bg-[#1DB954]/80 px-3 py-1.5 text-sm text-black transition-all duration-150 hover:scale-105 hover:bg-[#1DB954] active:scale-95 disabled:opacity-50"
            >
              Importer playlist Spotify
            </button>
          ) : (
            <button
              onClick={() => safe(() => void beginSpotifyAuth())}
              className="rounded-lg bg-[#1DB954]/80 px-3 py-1.5 text-sm text-black transition-all duration-150 hover:scale-105 hover:bg-[#1DB954] active:scale-95"
            >
              Connecter Spotify
            </button>
          )}
        </div>
      </div>

      {spotifyOn && (
        <div className="mt-3 flex gap-2">
          <input
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && linkInput.trim() && importLink()}
            placeholder="Colle un lien de playlist Spotify (publique ou perso)…"
            className="flex-1 rounded-lg bg-black/30 px-3 py-2 text-sm outline-none focus:bg-black/50"
          />
          <button
            onClick={importLink}
            disabled={busy || !linkInput.trim()}
            className="rounded-lg bg-[#1DB954]/80 px-4 py-2 text-sm text-black transition-all duration-150 hover:scale-105 hover:bg-[#1DB954] active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
          >
            Importer
          </button>
        </div>
      )}

      {open && (
        <div className="mt-3 border-t border-white/10 pt-3">
          {!spotifyId.trim() && (
            <p className="mb-3 rounded-lg bg-[#1DB954]/10 px-3 py-2 text-xs text-[#1DB954]">
              Pour importer <b>tes</b> playlists Spotify : crée une app gratuite sur{' '}
              <a
                href="https://developer.spotify.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                developer.spotify.com/dashboard
              </a>
              , colle le <b>Redirect URI</b> ci-dessous dedans, puis recopie son <b>Client ID</b> ici.{' '}
              <Link to="/guide" className="underline">
                Guide détaillé ↗
              </Link>
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs">
              <span className="text-white/40">Spotify client_id</span>
              <input
                value={spotifyId}
                onChange={(e) => {
                  setSpotifyId(e.target.value)
                  setSpotifyClientId(e.target.value)
                }}
                placeholder="colle ton Client ID Spotify"
                className="mt-0.5 w-full rounded bg-black/30 px-2 py-1 text-sm"
              />
              <RedirectRow uri={spotifyRedirectUri()} copied={copied} onCopy={copy} />
            </label>
            <label className="text-xs">
              <span className="text-white/40">Twitch client_id</span>
              <input
                value={twitchId}
                onChange={(e) => {
                  setTwitchId(e.target.value)
                  setTwitchClientId(e.target.value)
                }}
                placeholder="optionnel (auto-remplit la chaîne)"
                className="mt-0.5 w-full rounded bg-black/30 px-2 py-1 text-sm"
              />
              <RedirectRow uri={twitchRedirectUri()} copied={copied} onCopy={copy} />
            </label>
          </div>
          <div className="mt-3 border-t border-white/10 pt-3">
            <p className="mb-1 text-xs font-medium text-white/60">Lecture des pistes Spotify</p>
            <div className="flex flex-col gap-1.5 text-xs text-white/80">
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="pbmode"
                  checked={mode === 'embed'}
                  onChange={() => changeMode('embed')}
                  className="mt-0.5"
                />
                <span>
                  <b>Lecteur navigateur</b> — extrait 30s, aucun Premium. ⚠️ Son mélangé à l'onglet,
                  dur à exclure de la VOD.
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="pbmode"
                  checked={mode === 'connect'}
                  onChange={() => changeMode('connect')}
                  className="mt-0.5"
                />
                <span>
                  <b>App Spotify</b> — son complet via ton app desktop. <b>Premium requis.</b> Appli
                  séparée → routable vers une piste OBS hors-VOD (anti-strike).
                </span>
              </label>
            </div>

            {mode === 'connect' && (
              <div className="mt-2 rounded-lg bg-white/5 p-2">
                <div className="flex items-center gap-2">
                  <select
                    value={deviceId}
                    onChange={(e) => pickDevice(e.target.value)}
                    className="flex-1 rounded bg-black/30 px-2 py-1 text-xs"
                  >
                    <option value="">Appareil actif (auto)</option>
                    {devices?.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={loadDevices}
                    disabled={busy}
                    className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20 disabled:opacity-50"
                  >
                    Rafraîchir appareils
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-white/30">
                  Ouvre l'app Spotify desktop et lance une lecture une fois pour qu'elle apparaisse.
                  Si tu as connecté Spotify avant cette fonctionnalité, reconnecte-toi pour autoriser
                  le pilotage.
                </p>
              </div>
            )}
          </div>

          {spotifyOn && (
            <button onClick={disconnectSpotify} className="mt-2 text-left text-xs text-white/30 hover:text-red-400">
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

/** Shows the exact redirect URI to register in the provider dashboard, with copy. */
function RedirectRow({
  uri,
  copied,
  onCopy,
}: {
  uri: string
  copied: string
  onCopy: (text: string) => void
}) {
  return (
    <span className="mt-1 flex items-center gap-1 text-[10px] text-white/30">
      <span className="truncate" title={uri}>
        Redirect : {uri}
      </span>
      <button
        type="button"
        onClick={() => onCopy(uri)}
        className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-white/60 hover:bg-white/20"
      >
        {copied === uri ? 'copié ✓' : 'copier'}
      </button>
    </span>
  )
}
