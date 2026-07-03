import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BattleController, type SubmissionResolver } from '../battle/controller'
import { TwitchChatReader, TwitchChatSender, type SenderStatus } from '../lib/twitch-chat'
import { getChatCredentials, needsChatReconnect } from '../lib/twitch-auth'
import { createBattlePublisher } from '../lib/battle-sync'
import { loadChannel, saveChannel } from '../lib/storage'
import { isSpotifyConnected, searchSpotifyTracks, type SpotifyTrackHit } from '../lib/spotify'
import { applyTheme, getTheme } from '../lib/settings'
import type { BattleEntry, BattleSnapshot } from '../lib/battle-types'
import Player from '../components/Player'
import Footer from '../components/Footer'

export default function BattleAdmin() {
  const [channel, setChannel] = useState(loadChannel)
  if (!channel.trim()) {
    return <ChannelPrompt onSet={(c) => { saveChannel(c); setChannel(c) }} />
  }
  return <BattleRoom channel={channel.trim().toLowerCase()} />
}

function ChannelPrompt({ onSet }: { onSet: (c: string) => void }) {
  const [v, setV] = useState('')
  return (
    <div className="mx-auto grid min-h-screen max-w-sm place-items-center p-6">
      <div className="w-full">
        <h1 className="mb-1 text-2xl font-bold">⚔️ Mode Battle</h1>
        <p className="mb-4 text-sm text-white/50">Chaîne Twitch dont on lit le chat.</p>
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && v.trim() && onSet(v)}
          placeholder="ex: zerator"
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

function BattleRoom({ channel }: { channel: string }) {
  const ctrlRef = useRef<BattleController | null>(null)
  const [snap, setSnap] = useState<BattleSnapshot | null>(null)
  const [chatStatus, setChatStatus] = useState('connecting')
  const [senderStatus, setSenderStatus] = useState<SenderStatus | null>(null)
  const spotifyOn = isSpotifyConnected()

  useEffect(() => {
    applyTheme(getTheme())
    const pub = createBattlePublisher()
    const resolver: SubmissionResolver = async (query, submittedBy) => {
      const hit = (await searchSpotifyTracks(query, 1))[0]
      return hit ? hitToEntry(hit, submittedBy) : null
    }
    const ctrl = new BattleController(channel, resolver, (s) => {
      setSnap(s)
      pub.publish(s)
    })
    ctrl.hydrate()
    ctrlRef.current = ctrl
    setSnap(ctrl.snapshot())
    pub.publish(ctrl.snapshot())

    const reader = new TwitchChatReader(channel, {
      onMessage: (m) => ctrl.handleChat(m),
      onStatus: setChatStatus,
    })
    reader.connect()

    // Chat feedback (✅ ajouté / vote ouvert / champion) via the streamer's
    // token — optional, everything works silently without it.
    const creds = getChatCredentials()
    let sender: TwitchChatSender | null = null
    if (creds) {
      sender = new TwitchChatSender(channel, creds, setSenderStatus)
      sender.connect()
      ctrl.setAnnouncer((text) => sender?.say(text))
    }

    return () => {
      sender?.disconnect()
      reader.disconnect()
      pub.close()
      ctrl.dispose()
    }
  }, [channel])

  const ctrl = ctrlRef.current
  if (!snap || !ctrl) return null

  return (
    <div className="mx-auto max-w-5xl p-4">
      <header className="mb-4 flex items-center gap-3 text-sm">
        <Link to="/" className="text-white/40 hover:text-white">← Accueil</Link>
        <span className="font-medium">⚔️ Battle · #{snap.channel}</span>
        <StatusDot status={chatStatus} />
        {senderStatus === 'connected' && (
          <span className="text-white/40" title="Confirmations envoyées dans le chat">📣</span>
        )}
        <a
          href={`${import.meta.env.BASE_URL}battle/overlay`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20"
        >
          Ouvrir l'overlay ↗
        </a>
      </header>

      {!spotifyOn && (
        <p className="mb-4 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          ⚠️ Spotify non connecté — la résolution des soumissions chat (<code>!add</code>) et la
          recherche manuelle ne marcheront pas. Connecte Spotify depuis la page Config.
        </p>
      )}
      {needsChatReconnect() && (
        <p className="mb-4 rounded-lg bg-sky-500/10 px-3 py-2 text-xs text-sky-300">
          💬 Reconnecte Twitch (page Config) pour que le bot confirme les ajouts dans le chat
          (nouvelles permissions <code>chat:edit</code>). Optionnel — tout marche sans.
        </p>
      )}
      {senderStatus === 'auth-failed' && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
          ⚠️ Session Twitch expirée — les confirmations chat sont coupées. Reconnecte Twitch
          depuis la page Config.
        </p>
      )}

      {snap.phase === 'lobby' && <Lobby ctrl={ctrl} spotifyOn={spotifyOn} />}
      {snap.phase === 'bracket' && <Match ctrl={ctrl} snap={snap} />}
      {snap.phase === 'done' && <Done ctrl={ctrl} snap={snap} />}

      <Footer />
    </div>
  )
}

// ─── Lobby: config + submissions ───────────────────────────────────────────────
function Lobby({ ctrl, spotifyOn }: { ctrl: BattleController; spotifyOn: boolean }) {
  const cfg = ctrl.getConfig()
  const entries = ctrl.getEntries()

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      <div className="flex flex-col gap-4">
        <section className="rounded-xl bg-white/5 p-4">
          <h2 className="mb-3 text-sm font-semibold text-white/60">Réglages du tournoi</h2>
          <label className="mb-2 block text-xs text-white/40">Thème (annoncé au chat)</label>
          <input
            defaultValue={cfg.theme}
            onChange={(e) => ctrl.setConfig({ theme: e.target.value })}
            placeholder="ex: Génériques d'anime"
            className="mb-3 w-full rounded-lg bg-black/30 px-3 py-2 text-sm outline-none focus:bg-black/50"
          />
          <NumField label="Sons max dans le tournoi" value={cfg.maxTotal} min={2} max={64}
            onChange={(n) => ctrl.setConfig({ maxTotal: n })} />
          <NumField label="Max par personne" value={cfg.maxPerUser} min={1} max={20}
            onChange={(n) => ctrl.setConfig({ maxPerUser: n })} />
          <NumField label="Durée de vote (s)" value={cfg.voteSec} min={5} max={300}
            onChange={(n) => ctrl.setConfig({ voteSec: n })} />
        </section>

        <section className="rounded-xl bg-white/5 p-4 text-xs text-white/50">
          <p className="mb-1 font-semibold text-white/70">Le chat soumet avec :</p>
          <code className="text-indigo-300">!add nom du son</code>
          <p className="mt-2">Résolu via la recherche Spotify, sans lien (anti-censure Twitch).</p>
        </section>

        <div className="flex gap-2">
          <button
            onClick={() => { const e = ctrl.seed(false); if (e) alert(e) }}
            disabled={entries.length < 2}
            className="flex-1 rounded-lg bg-white/10 py-2 text-sm font-medium hover:enabled:bg-white/20 disabled:opacity-30"
          >
            Lancer (ordre)
          </button>
          <button
            onClick={() => { const e = ctrl.seed(true); if (e) alert(e) }}
            disabled={entries.length < 2}
            className="flex-1 rounded-lg bg-green-500 py-2 text-sm font-semibold text-black hover:enabled:bg-green-400 disabled:opacity-30"
          >
            🔀 Mélanger & lancer
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {spotifyOn && <ManualAdd ctrl={ctrl} />}
        <section className="rounded-xl bg-white/5 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/60">
            Sons soumis
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{entries.length}</span>
          </h2>
          {entries.length === 0 ? (
            <p className="text-sm text-white/40">Aucun son. Le chat tape <code>!add …</code> ou ajoute à la main ci-dessus.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-lg bg-white/5 p-2">
                  <Cover url={e.coverUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{e.title}</div>
                    <div className="truncate text-xs text-white/40">
                      {e.artist ?? '—'} · par {e.submittedBy}
                    </div>
                  </div>
                  <button
                    onClick={() => ctrl.removeEntry(e.id)}
                    className="shrink-0 rounded px-2 py-1 text-xs text-white/40 hover:text-red-400"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function ManualAdd({ ctrl }: { ctrl: BattleController }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SpotifyTrackHit[]>([])
  const [busy, setBusy] = useState(false)

  const search = async () => {
    if (!q.trim() || busy) return
    setBusy(true)
    try {
      setHits(await searchSpotifyTracks(q.trim(), 6))
    } catch {
      setHits([])
    } finally {
      setBusy(false)
    }
  }

  const add = (h: SpotifyTrackHit) => {
    const err = ctrl.addEntry(hitToEntry(h, 'admin'))
    if (err) alert(err)
    setHits([])
    setQ('')
  }

  return (
    <section className="rounded-xl bg-white/5 p-4">
      <h2 className="mb-2 text-sm font-semibold text-white/60">Ajouter un son (admin)</h2>
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void search()}
          placeholder="Rechercher sur Spotify…"
          className="flex-1 rounded-lg bg-black/30 px-3 py-2 text-sm outline-none focus:bg-black/50"
        />
        <button
          onClick={() => void search()}
          disabled={busy || !q.trim()}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:enabled:bg-white/20 disabled:opacity-30"
        >
          {busy ? '…' : 'Chercher'}
        </button>
      </div>
      {hits.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {hits.map((h) => (
            <li key={h.trackId}>
              <button
                onClick={() => add(h)}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-white/10"
              >
                <Cover url={h.cover} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{h.title}</span>
                  <span className="block truncate text-xs text-white/40">{h.artist ?? '—'}</span>
                </span>
                <span className="text-xs text-indigo-300">+ ajouter</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ─── Match: the active head-to-head ─────────────────────────────────────────────
function Match({ ctrl, snap }: { ctrl: BattleController; snap: BattleSnapshot }) {
  const m = snap.match
  const sources = ctrl.currentSources()
  if (!m) return <p className="text-white/40">Préparation du match…</p>
  const voteOpen = snap.vote?.open ?? false
  const a = snap.vote?.a ?? 0
  const b = snap.vote?.b ?? 0
  const win = snap.lastWinner

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center text-sm text-white/50">
        {m.roundLabel} · match {m.matchInRound}/{m.matchesInRound}
        {snap.theme && <> · thème : <span className="text-white/70">{snap.theme}</span></>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SideCard view={m.a} source={sources.a} votes={a} winner={win === 'a'} />
        <SideCard view={m.b} source={sources.b} votes={b} winner={win === 'b'} />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {!voteOpen ? (
          <button
            onClick={() => ctrl.startVote()}
            className="rounded-lg bg-green-500 px-5 py-2 text-sm font-semibold text-black hover:bg-green-400"
          >
            ▶ Lancer le vote
          </button>
        ) : (
          <button
            onClick={() => ctrl.endVote()}
            className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400"
          >
            ⏹ Clore le vote
          </button>
        )}
        <button
          onClick={() => ctrl.restartVote()}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
        >
          ↻ Relancer
        </button>
        <span className="mx-1 text-xs text-white/30">Gagnant :</span>
        <button onClick={() => ctrl.pickWinner('a')}
          className={`rounded-lg px-3 py-2 text-sm ${win === 'a' ? 'bg-indigo-500' : 'bg-white/10 hover:bg-white/20'}`}>
          ◀ {m.a.title.slice(0, 16)}
        </button>
        <button onClick={() => ctrl.pickWinner('b')}
          className={`rounded-lg px-3 py-2 text-sm ${win === 'b' ? 'bg-indigo-500' : 'bg-white/10 hover:bg-white/20'}`}>
          {m.b.title.slice(0, 16)} ▶
        </button>
        <button
          onClick={() => ctrl.advance()}
          disabled={!win}
          className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold hover:enabled:bg-green-500 disabled:opacity-30"
        >
          Valider & suite →
        </button>
      </div>
      <p className="text-center text-xs text-white/30">
        Le chat vote : <code>1</code>/<code>2</code>, <code>gauche</code>/<code>droite</code>, ou le nom du son. Re-voter change le vote.
      </p>
    </div>
  )
}

function SideCard({
  view,
  source,
  votes,
  winner,
}: {
  view: { title: string; artist: string | null; coverUrl: string | null; submittedBy: string | null }
  source: import('../lib/types').MusicSource | null
  votes: number
  winner: boolean
}) {
  return (
    <div className={`rounded-xl p-3 ${winner ? 'bg-indigo-500/20 ring-2 ring-indigo-400' : 'bg-white/5'}`}>
      <Player source={source} active={false} />
      <div className="mt-2 truncate text-sm font-semibold">{view.title}</div>
      <div className="truncate text-xs text-white/40">{view.artist ?? '—'}</div>
      {view.submittedBy && <div className="text-[10px] text-white/30">soumis par {view.submittedBy}</div>}
      <div className="mt-1 font-mono text-lg">{votes} <span className="text-xs text-white/40">votes</span></div>
    </div>
  )
}

// ─── Done: champion ─────────────────────────────────────────────────────────────
function Done({ ctrl, snap }: { ctrl: BattleController; snap: BattleSnapshot }) {
  const c = snap.champion
  return (
    <div className="grid place-items-center gap-4 py-10 text-center">
      <div className="text-5xl">🏆</div>
      <div className="text-2xl font-bold">{c?.title ?? '—'}</div>
      <div className="text-white/50">{c?.artist ?? ''}</div>
      {c?.submittedBy && <div className="text-sm text-white/30">son de {c.submittedBy}</div>}
      <button
        onClick={() => { if (confirm('Nouveau tournoi ? (efface le pool actuel)')) ctrl.resetRoom() }}
        className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
      >
        Nouveau tournoi
      </button>
    </div>
  )
}

// ─── Small bits ─────────────────────────────────────────────────────────────────
function hitToEntry(h: SpotifyTrackHit, submittedBy: string): BattleEntry {
  return {
    id: crypto.randomUUID(),
    title: h.title,
    artist: h.artist,
    source: { kind: 'spotify', trackId: h.trackId },
    ...(h.cover ? { coverUrl: h.cover } : {}),
    submittedBy,
  }
}

function Cover({ url }: { url?: string | null }) {
  return url ? (
    <img src={url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
  ) : (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded bg-white/10 text-sm">🎵</div>
  )
}

function NumField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (n: number) => void
}) {
  return (
    <label className="mb-2 block">
      <span className="mb-1 block text-xs text-white/40">{label}</span>
      <input
        type="number"
        defaultValue={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
        }}
        className="w-full rounded-lg bg-black/30 px-3 py-2 text-sm outline-none focus:bg-black/50"
      />
    </label>
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
