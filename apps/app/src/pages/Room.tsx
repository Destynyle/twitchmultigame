import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { applyTheme, getTheme } from '../lib/settings'
import {
  fetchRoom,
  getViewerName,
  searchRoom,
  setViewerName,
  submitToRoom,
  type RoomPick,
  type RoomView,
} from '../lib/room-api'
import { fetchMeta, parseSource } from '../lib/sources'

// Public viewer page — no password gate: the room code IS the invitation
// (shared on stream). Viewers pick a pseudo, search Spotify (proxied by the
// worker) and submit the exact track they mean.

export default function Room() {
  const { code = '' } = useParams()
  const roomCode = code.toUpperCase()
  const [view, setView] = useState<RoomView | null>(null)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      setView(await fetchRoom(roomCode))
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }, [roomCode])

  useEffect(() => {
    applyTheme(getTheme())
    void refresh()
    const t = setInterval(() => void refresh(), 8000)
    return () => clearInterval(t)
  }, [refresh])

  if (error && !view) {
    return (
      <div className="mx-auto grid min-h-screen max-w-md place-items-center p-6 text-center">
        <div>
          <div className="mb-2 text-4xl">😕</div>
          <p className="text-white/70">{error}</p>
          <p className="mt-2 text-sm text-white/40">Vérifie le code de la room avec le streamer.</p>
        </div>
      </div>
    )
  }
  if (!view) {
    return <div className="grid min-h-screen place-items-center text-white/40">Chargement…</div>
  }

  return (
    <div className="mx-auto max-w-md p-4 pb-16">
      <header className="mb-4 text-center">
        <div className="text-xs uppercase tracking-widest text-white/40">Battle musicale · room {view.code}</div>
        {view.theme && <h1 className="mt-1 text-2xl font-bold">{view.theme}</h1>}
        <div className="mt-1 text-sm text-white/50">
          {view.count}/{view.maxTotal} sons · {view.maxPerUser} max par personne
        </div>
      </header>

      {!view.open && (
        <p className="mb-4 rounded-lg bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-300">
          Les soumissions sont fermées — le tournoi va commencer !
        </p>
      )}

      {view.mine.length > 0 && (
        <section className="mb-4 rounded-xl bg-white/5 p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase text-white/40">Tes sons</h2>
          <ul className="flex flex-col gap-1.5">
            {view.mine.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-lg bg-white/5 p-2">
                <Cover url={s.cover} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{s.title}</div>
                  <div className="truncate text-xs text-white/40">{s.artist ?? '—'}</div>
                </div>
                <span className="ml-auto text-emerald-400">✓</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.open && view.mine.length < view.maxPerUser && (
        <SubmitPanel code={roomCode} onSubmitted={refresh} />
      )}
      {view.open && view.mine.length >= view.maxPerUser && (
        <p className="rounded-lg bg-white/5 px-3 py-2 text-center text-sm text-white/50">
          Limite atteinte ({view.maxPerUser} max) — que le meilleur gagne 🎶
        </p>
      )}
    </div>
  )
}

function SubmitPanel({ code, onSubmitted }: { code: string; onSubmitted: () => Promise<void> }) {
  const [name, setName] = useState(getViewerName)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<RoomPick[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const search = async () => {
    if (!q.trim() || busy) return
    setBusy(true)
    setMsg('')
    try {
      // Pasted YouTube/Spotify link → resolve it directly (title via oEmbed,
      // no key needed); anything else → Spotify text search via the worker.
      const source = parseSource(q.trim())
      if (source) {
        const meta = await fetchMeta(source)
        if (!meta.title) throw new Error('Lien reconnu mais vidéo/track introuvable')
        setHits([
          {
            source,
            title: meta.title,
            artist: meta.artist ?? null,
            ...(meta.cover ? { cover: meta.cover } : {}),
          },
        ])
      } else {
        setHits(
          (await searchRoom(code, q.trim())).hits.map((h) => ({
            source: { kind: 'spotify', trackId: h.trackId },
            title: h.title,
            artist: h.artist,
            ...(h.cover ? { cover: h.cover } : {}),
          })),
        )
      }
    } catch (e) {
      setMsg((e as Error).message)
      setHits([])
    } finally {
      setBusy(false)
    }
  }

  const submit = async (hit: RoomPick) => {
    const pseudo = name.trim()
    if (!pseudo) {
      setMsg('Choisis un pseudo d’abord')
      return
    }
    setViewerName(pseudo)
    setBusy(true)
    try {
      await submitToRoom(code, hit, pseudo)
      setHits([])
      setQ('')
      setMsg('')
      await onSubmitted()
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl bg-white/5 p-3">
      <label className="mb-1 block text-xs text-white/40">Ton pseudo</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="ex: destyviewer"
        maxLength={25}
        className="mb-3 w-full rounded-lg bg-black/30 px-3 py-2 text-sm outline-none focus:bg-black/50"
      />
      <label className="mb-1 block text-xs text-white/40">Propose un son</label>
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void search()}
          placeholder="Titre + artiste… ou lien YouTube/Spotify"
          className="flex-1 rounded-lg bg-black/30 px-3 py-2 text-sm outline-none focus:bg-black/50"
        />
        <button
          onClick={() => void search()}
          disabled={busy || !q.trim()}
          className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium hover:enabled:bg-indigo-400 disabled:opacity-30"
        >
          {busy ? '…' : 'Chercher'}
        </button>
      </div>
      {msg && <p className="mt-2 text-sm text-amber-300">{msg}</p>}
      {hits.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {hits.map((h) => (
            <li key={h.source.kind === 'spotify' ? h.source.trackId : h.source.videoId}>
              <button
                onClick={() => void submit(h)}
                disabled={busy}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-white/10 disabled:opacity-50"
              >
                <Cover url={h.cover} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    {h.source.kind === 'youtube' && <span className="mr-1 text-xs">▶️</span>}
                    {h.title}
                  </span>
                  <span className="block truncate text-xs text-white/40">{h.artist ?? '—'}</span>
                </span>
                <span className="shrink-0 text-xs text-indigo-300">+ proposer</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Cover({ url }: { url?: string }) {
  return url ? (
    <img src={url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
  ) : (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded bg-white/10 text-sm">🎵</div>
  )
}
