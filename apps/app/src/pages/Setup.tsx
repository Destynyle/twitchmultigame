import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Playlist, Track } from '../lib/types'
import {
  loadPlaylists,
  savePlaylists,
  loadChannel,
  saveChannel,
  exportPlaylist,
  parsePlaylistFile,
} from '../lib/storage'
import { parseSource, fetchMeta } from '../lib/sources'
import {
  getWindowMs,
  setWindowMs,
  THEMES,
  getTheme,
  setTheme,
  applyTheme,
} from '../lib/settings'
import ConnectionsPanel from '../components/ConnectionsPanel'
import Footer from '../components/Footer'

const ACTIVE_KEY = 'blindtest:activePlaylist'

export default function Setup() {
  const nav = useNavigate()
  const [channel, setChannel] = useState(loadChannel())
  const [playlists, setPlaylists] = useState<Playlist[]>(loadPlaylists)
  const [activeId, setActiveId] = useState<string>(() => localStorage.getItem(ACTIVE_KEY) || '')
  const [urlInput, setUrlInput] = useState('')
  const [error, setError] = useState('')
  const [windowSec, setWindowSec] = useState(() => Math.round(getWindowMs() / 1000))
  const [theme, setThemeState] = useState(getTheme)
  const fileRef = useRef<HTMLInputElement>(null)

  const active = playlists.find((p) => p.id === activeId) ?? playlists[0]

  useEffect(() => {
    savePlaylists(playlists)
  }, [playlists])
  useEffect(() => {
    if (active) localStorage.setItem(ACTIVE_KEY, active.id)
  }, [active])
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  function shuffleTracks() {
    mutateActive((p) => {
      const ts = [...p.tracks]
      for (let i = ts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[ts[i], ts[j]] = [ts[j]!, ts[i]!]
      }
      return { ...p, tracks: ts }
    })
  }

  function moveTrack(id: string, dir: -1 | 1) {
    mutateActive((p) => {
      const i = p.tracks.findIndex((t) => t.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= p.tracks.length) return p
      const ts = [...p.tracks]
      ;[ts[i], ts[j]] = [ts[j]!, ts[i]!]
      return { ...p, tracks: ts }
    })
  }

  function mutateActive(fn: (p: Playlist) => Playlist) {
    if (!active) return
    setPlaylists((ps) => ps.map((p) => (p.id === active.id ? fn(p) : p)))
  }

  function newPlaylist() {
    const p: Playlist = { id: crypto.randomUUID(), name: 'Nouvelle playlist', tracks: [] }
    setPlaylists((ps) => [...ps, p])
    setActiveId(p.id)
  }

  function importFromSpotify(name: string, tracks: Track[]) {
    const p: Playlist = { id: crypto.randomUUID(), name, tracks }
    setPlaylists((ps) => [...ps, p])
    setActiveId(p.id)
  }

  async function addTrack() {
    setError('')
    const source = parseSource(urlInput)
    if (!source) {
      setError('URL YouTube ou Spotify non reconnue')
      return
    }
    const meta = await fetchMeta(source)
    const track: Track = {
      id: crypto.randomUUID(),
      title: meta.title ?? '',
      artist: meta.artist ?? null,
      featurings: [],
      malusTerms: [],
      source,
      ...(meta.cover ? { coverUrl: meta.cover } : {}),
    }
    mutateActive((p) => ({ ...p, tracks: [...p.tracks, track] }))
    setUrlInput('')
  }

  function updateTrack(id: string, patch: Partial<Track>) {
    mutateActive((p) => ({
      ...p,
      tracks: p.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }))
  }

  function deleteTrack(id: string) {
    mutateActive((p) => ({ ...p, tracks: p.tracks.filter((t) => t.id !== id) }))
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const pl = parsePlaylistFile(await file.text())
      setPlaylists((ps) => [...ps, pl])
      setActiveId(pl.id)
    } catch (err) {
      setError((err as Error).message)
    }
    e.target.value = ''
  }

  function start() {
    setError('')
    if (!channel.trim()) return setError('Entre un nom de chaîne Twitch')
    if (!active || active.tracks.length === 0) return setError('Ajoute au moins une piste')
    saveChannel(channel)
    nav('/control')
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Blindtest — Configuration</h1>
        <Link to="/guide" className="text-sm text-indigo-400 hover:text-indigo-300">
          Guide ↗
        </Link>
      </div>
      <p className="mb-6 text-sm text-white/50">
        100% navigateur. Aucun compte, aucun token. Lecture du chat en anonyme.
      </p>

      <ConnectionsPanel onImport={importFromSpotify} />

      <section className="mb-6">
        <label className="mb-1 block text-sm font-medium">Chaîne Twitch</label>
        <input
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          placeholder="ex: zerator"
          className="w-full rounded-lg bg-white/5 px-3 py-2 outline-none focus:bg-white/10"
        />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">
            Fenêtre de réponse : {windowSec}s
          </label>
          <input
            type="range"
            min={2}
            max={20}
            value={windowSec}
            onChange={(e) => {
              const v = Number(e.target.value)
              setWindowSec(v)
              setWindowMs(v * 1000)
            }}
            className="w-full accent-indigo-400"
          />
          <p className="mt-1 text-xs text-white/40">
            Durée où les points sont les plus élevés (3 → 1).
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Thème de l'overlay</label>
          <select
            value={theme}
            onChange={(e) => {
              setTheme(e.target.value)
              setThemeState(e.target.value)
            }}
            className="w-full rounded-lg bg-white/5 px-3 py-2"
          >
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.emoji} {t.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-white/40">Appliqué sur la page overlay (OBS).</p>
        </div>
      </section>

      <section className="mb-4 flex items-center gap-2">
        <select
          value={active?.id ?? ''}
          onChange={(e) => setActiveId(e.target.value)}
          className="rounded-lg bg-white/5 px-3 py-2"
        >
          {playlists.length === 0 && <option>—</option>}
          {playlists.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.tracks.length})
            </option>
          ))}
        </select>
        <button onClick={newPlaylist} className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20">
          + Playlist
        </button>
        {active && (
          <>
            <button
              onClick={() => exportPlaylist(active)}
              className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
            >
              Export
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
            >
              Import
            </button>
            <button
              onClick={shuffleTracks}
              disabled={active.tracks.length < 2}
              className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20 disabled:opacity-30"
            >
              🔀 Mélanger
            </button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={onImport} />
          </>
        )}
      </section>

      {active && (
        <>
          <input
            value={active.name}
            onChange={(e) => mutateActive((p) => ({ ...p, name: e.target.value }))}
            className="mb-4 w-full rounded-lg bg-white/5 px-3 py-2 text-sm"
          />

          <div className="mb-3 flex gap-2">
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTrack()}
              placeholder="Colle une URL YouTube ou Spotify…"
              className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-sm outline-none focus:bg-white/10"
            />
            <button onClick={addTrack} className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium hover:bg-indigo-400">
              Ajouter
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {active.tracks.map((t, i) => (
              <div key={t.id} className="rounded-xl bg-white/5 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs text-white/40">
                  <span>#{i + 1}</span>
                  <span className="rounded bg-white/10 px-1.5 py-0.5">{t.source.kind}</span>
                  <button
                    onClick={() => moveTrack(t.id, -1)}
                    disabled={i === 0}
                    className="rounded px-1 hover:text-white disabled:opacity-20"
                    title="Monter"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveTrack(t.id, 1)}
                    disabled={i === active.tracks.length - 1}
                    className="rounded px-1 hover:text-white disabled:opacity-20"
                    title="Descendre"
                  >
                    ▼
                  </button>
                  <button onClick={() => deleteTrack(t.id)} className="ml-auto hover:text-red-400">
                    supprimer
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Titre" value={t.title} onChange={(v) => updateTrack(t.id, { title: v })} />
                  <Field
                    label="Artiste (vide = titre seul)"
                    value={t.artist ?? ''}
                    onChange={(v) => updateTrack(t.id, { artist: v.trim() ? v : null })}
                  />
                  <Field
                    label="Featurings (séparés par ,)"
                    value={t.featurings.join(', ')}
                    onChange={(v) => updateTrack(t.id, { featurings: splitList(v) })}
                  />
                  <Field
                    label="Pièges malus (séparés par ,)"
                    value={t.malusTerms.join(', ')}
                    onChange={(v) => updateTrack(t.id, { malusTerms: splitList(v) })}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <button
        onClick={start}
        className="mt-6 w-full rounded-xl bg-green-500 py-3 font-semibold text-black transition-all duration-150 hover:scale-[1.02] hover:bg-green-400 active:scale-100"
      >
        Lancer le panneau de contrôle →
      </button>

      <Footer />
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-xs">
      <span className="text-white/40">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded bg-black/30 px-2 py-1 text-sm outline-none focus:bg-black/50"
      />
    </label>
  )
}

function splitList(v: string): string[] {
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}
