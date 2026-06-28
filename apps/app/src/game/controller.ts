import { BlindtestPlugin } from '@playground/game-engine'
import type { SessionContext, ChatMessage, ScoringEvent } from '@playground/game-types'
import type { Track, ViewerScore, FeedEvent, GameSnapshot, RoundStatus } from '../lib/types'
import type { IncomingChat } from '../lib/twitch-chat'
import { coverUrl } from '../lib/sources'
import { getWindowMs } from '../lib/settings'
import { saveSession, loadSession, clearSession } from '../lib/session'

// Streak multiplier growth per consecutive found round. Tunable.
const STREAK_STEP = 0.2
const FEED_MAX = 40

const CTX: SessionContext = { sessionId: 'local', tenantId: 'local', gameType: 'blindtest' }

let feedSeq = 0

/**
 * Authoritative client-side game loop. Wraps the pure BlindtestPlugin (window
 * scoring, malus, double-shot, featuring) and adds streak tracking, a running
 * scoreboard, and an animated event feed. Replaces the old Redis RoundStateManager.
 */
export class GameController {
  private plugin = new BlindtestPlugin()
  private tracks: Track[]
  private channel: string
  private playlistId: string
  private onChange: (snap: GameSnapshot) => void

  private scores = new Map<string, ViewerScore>()
  private streakIn = new Map<string, number>() // streak coming into the current round
  private roundFound = new Set<string>()        // scored a positive main guess this round
  private roundMalus = new Set<string>()        // took a malus this round

  private index = 0
  private status: RoundStatus = 'idle'
  private found = false
  private bonus = false               // current round awards double points
  private roundStartedAt = 0          // for the overlay countdown bar
  private feed: FeedEvent[] = []

  // Progressive overlay reveal: title/artist appear when their 5s window closes,
  // featurings as soon as they are found.
  private revealTitle = false
  private revealArtist = false
  private revealedFeats: string[] = []
  private titleTimer: ReturnType<typeof setTimeout> | null = null
  private artistTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    tracks: Track[],
    channel: string,
    playlistId: string,
    onChange: (snap: GameSnapshot) => void,
  ) {
    this.tracks = tracks
    this.channel = channel
    this.playlistId = playlistId
    this.onChange = onChange
    void this.plugin.onSessionStart(CTX)
  }

  /** Restore scores/feed/index from a saved session if it matches this game. */
  hydrate(): boolean {
    const s = loadSession()
    if (!s || s.channel !== this.channel || s.playlistId !== this.playlistId) return false
    this.scores = new Map(s.scores.map((v) => [v.username, v]))
    this.streakIn = new Map(s.streakIn)
    this.index = Math.min(s.index, Math.max(0, this.tracks.length - 1))
    this.feed = s.feed
    this.bonus = s.bonus
    // Round-local state is intentionally dropped; the streamer re-opens the round.
    this.status = 'idle'
    this.found = false
    // Keep the module feed counter ahead of restored ids to avoid key collisions.
    const maxId = s.feed.reduce((m, e) => Math.max(m, Number(e.id.slice(1)) || 0), 0)
    if (maxId >= feedSeq) feedSeq = maxId + 1
    return true
  }

  /** Wipe scores and the persisted session (start a fresh game). */
  resetGame(): void {
    this.scores.clear()
    this.streakIn.clear()
    this.roundFound.clear()
    this.roundMalus.clear()
    this.feed = []
    this.index = 0
    this.status = 'idle'
    this.found = false
    this.bonus = false
    this.clearTimers()
    this.revealTitle = false
    this.revealArtist = false
    this.revealedFeats = []
    clearSession()
    this.emit()
  }

  get currentTrack(): Track | null {
    return this.tracks[this.index] ?? null
  }

  private get windowMs(): number {
    return this.currentTrack?.windowMs ?? getWindowMs()
  }

  /** Reveal a target on the overlay once its scoring window closes. */
  private scheduleReveal(target: 'title' | 'artist'): void {
    if (target === 'title') {
      if (this.titleTimer || this.revealTitle) return
      this.titleTimer = setTimeout(() => {
        this.titleTimer = null
        this.revealTitle = true
        this.emit()
      }, this.windowMs)
    } else {
      if (this.artistTimer || this.revealArtist) return
      this.artistTimer = setTimeout(() => {
        this.artistTimer = null
        this.revealArtist = true
        this.emit()
      }, this.windowMs)
    }
  }

  private clearTimers(): void {
    if (this.titleTimer) clearTimeout(this.titleTimer)
    if (this.artistTimer) clearTimeout(this.artistTimer)
    this.titleTimer = null
    this.artistTimer = null
  }

  async startRound(): Promise<void> {
    const track = this.currentTrack
    if (!track) return
    this.status = 'playing'
    this.found = false
    this.roundStartedAt = Date.now()
    this.roundFound.clear()
    this.roundMalus.clear()
    this.clearTimers()
    this.revealTitle = false
    this.revealArtist = false
    this.revealedFeats = []
    this.plugin.setCurrentTrack(track.title, track.artist, {
      featurings: track.featurings,
      malusTerms: track.malusTerms,
      windowDurationMs: this.windowMs,
    })
    const bonusTag = this.bonus ? ' ✦ MANCHE BONUS ×2' : ''
    this.pushFeed('system', `Manche ${this.index + 1} ouverte — à vous de deviner !${bonusTag}`)
    this.emit()
  }

  async handleChat(msg: IncomingChat): Promise<void> {
    if (this.status !== 'playing') return
    const chat: ChatMessage = {
      viewerUsername: msg.username,
      viewerDisplayName: msg.displayName,
      text: msg.text,
      timestamp: msg.timestamp,
    }
    const ev = await this.plugin.onChatMessage(CTX, chat)
    if (ev) this.applyEvent(ev)
  }

  private applyEvent(ev: ScoringEvent): void {
    const score = this.ensureScore(ev.viewerUsername, ev.viewerDisplayName)

    if (ev.reason === 'malus') {
      score.points += ev.points // negative
      this.roundMalus.add(ev.viewerUsername)
      this.pushFeed('malus', `${score.displayName} ${ev.points} (malus 💀)`, score.displayName)
      this.emit()
      return
    }

    const bonusMult = this.bonus ? 2 : 1

    if (ev.reason === 'featuring') {
      const fpts = ev.points * bonusMult
      score.points += fpts
      if (ev.label && !this.revealedFeats.includes(ev.label)) this.revealedFeats.push(ev.label)
      this.pushFeed('featuring', `${score.displayName} +${fpts} (feat 🎤)`, score.displayName)
      this.emit()
      return
    }

    // correct_title | correct_artist | combo — all positive main-guess points.
    const streak = this.streakIn.get(ev.viewerUsername) ?? 0
    const mult = 1 + STREAK_STEP * streak
    const final = Math.round(ev.points * mult * bonusMult * 10) / 10
    score.points += final
    this.found = true
    this.roundFound.add(ev.viewerUsername)
    const tag =
      ev.reason === 'combo'
        ? ' (combo 🎯)'
        : ev.reason === 'correct_artist'
          ? ' (artiste 🎸)'
          : ''
    const streakTag = streak > 0 ? ` 🔥x${mult.toFixed(2)}` : ''
    const bonusTag = this.bonus ? ' ✦x2' : ''
    this.pushFeed('found', `${score.displayName} +${final}${tag}${streakTag}${bonusTag}`, score.displayName)
    // Open the reveal countdown for each target the first finder just claimed.
    if (ev.reason === 'correct_title' || ev.reason === 'combo') this.scheduleReveal('title')
    if (ev.reason === 'correct_artist' || ev.reason === 'combo') this.scheduleReveal('artist')
    this.emit()
  }

  async reveal(): Promise<void> {
    if (this.status === 'idle' && !this.currentTrack) return
    this.status = 'revealed'
    // Manual reveal exposes everything immediately.
    this.clearTimers()
    this.revealTitle = true
    this.revealArtist = true
    const cur = this.currentTrack
    if (cur) {
      for (const f of cur.featurings) {
        if (!this.revealedFeats.includes(f)) this.revealedFeats.push(f)
      }
    }
    // Round-end streak resolution.
    for (const u of this.roundFound) {
      this.streakIn.set(u, (this.streakIn.get(u) ?? 0) + 1)
      const s = this.scores.get(u)
      if (s) s.streak = this.streakIn.get(u) ?? 0
    }
    for (const u of this.roundMalus) {
      this.streakIn.set(u, 0)
      const s = this.scores.get(u)
      if (s) s.streak = 0
    }
    const t = this.currentTrack
    if (t) {
      const artist = t.artist ? ` — ${t.artist}` : ''
      this.pushFeed('system', `Réponse : ${t.title}${artist}`)
    }
    this.emit()
  }

  /** Toggle double-points for the current/next round. */
  toggleBonus(): void {
    this.bonus = !this.bonus
    this.emit()
  }

  next(): void {
    this.clearTimers()
    this.bonus = false
    this.revealTitle = false
    this.revealArtist = false
    this.revealedFeats = []
    if (this.index < this.tracks.length - 1) {
      this.index += 1
      this.status = 'idle'
      this.found = false
    } else {
      this.status = 'idle'
      this.pushFeed('system', 'Fin de la playlist 🏁')
    }
    this.emit()
  }

  /** Stop pending reveal timers (call when the control page unmounts). */
  dispose(): void {
    this.clearTimers()
  }

  /** Fix the current track's answer on the fly (title/artist/feat/malus). */
  editCurrentTrack(patch: {
    title?: string
    artist?: string | null
    featurings?: string[]
    malusTerms?: string[]
  }): void {
    const t = this.currentTrack
    if (!t) return
    if (patch.title !== undefined) t.title = patch.title
    if (patch.artist !== undefined) t.artist = patch.artist
    if (patch.featurings !== undefined) t.featurings = patch.featurings
    if (patch.malusTerms !== undefined) t.malusTerms = patch.malusTerms
    if (this.status === 'playing') this.plugin.updateAnswer(patch)
    this.emit()
  }

  /** Append tracks to the live playlist mid-game without touching scores. */
  addTracks(tracks: Track[]): void {
    if (tracks.length === 0) return
    this.tracks.push(...tracks)
    const label = tracks.length === 1 ? `« ${tracks[0]!.title} »` : `${tracks.length} pistes`
    this.pushFeed('system', `Ajout à la playlist : ${label}`)
    this.emit()
  }

  adjustScore(username: string, delta: number): void {
    const s = this.scores.get(username)
    if (!s) return
    s.points = Math.round((s.points + delta) * 10) / 10
    this.emit()
  }

  private ensureScore(username: string, displayName: string): ViewerScore {
    let s = this.scores.get(username)
    if (!s) {
      s = { username, displayName, points: 0, streak: this.streakIn.get(username) ?? 0 }
      this.scores.set(username, s)
    } else {
      s.displayName = displayName
    }
    return s
  }

  private pushFeed(kind: FeedEvent['kind'], text: string, author?: string): void {
    this.feed.unshift({ id: `f${feedSeq++}`, kind, text, at: Date.now(), ...(author ? { author } : {}) })
    if (this.feed.length > FEED_MAX) this.feed.length = FEED_MAX
  }

  private leaderboard(): ViewerScore[] {
    return [...this.scores.values()].sort((a, b) => b.points - a.points)
  }

  /** Top 3 by points earned in the just-completed round (for the mini podium). */
  roundPodium(): ViewerScore[] {
    return [...this.roundFound]
      .map((u) => this.scores.get(u))
      .filter((s): s is ViewerScore => !!s)
      .sort((a, b) => b.points - a.points)
      .slice(0, 3)
  }

  snapshot(): GameSnapshot {
    const t = this.currentTrack
    return {
      channel: this.channel,
      status: this.status,
      trackIndex: this.index,
      trackTotal: this.tracks.length,
      reveal:
        this.status === 'revealed' && t
          ? { title: t.title, artist: t.artist, featurings: t.featurings }
          : null,
      partial: {
        title: this.revealTitle && t ? t.title : null,
        artist: this.revealArtist && t ? t.artist : null,
        hasArtist: !!t?.artist,
        featurings: this.revealedFeats,
        featuringTotal: t?.featurings.length ?? 0,
      },
      coverUrl: t ? (t.coverUrl ?? coverUrl(t.source)) : null,
      found: this.found,
      round:
        this.status === 'playing'
          ? { startedAt: this.roundStartedAt, windowMs: this.windowMs }
          : null,
      bonus: this.bonus,
      leaderboard: this.leaderboard(),
      feed: this.feed,
    }
  }

  private persist(): void {
    saveSession({
      v: 1,
      channel: this.channel,
      playlistId: this.playlistId,
      scores: [...this.scores.values()],
      streakIn: [...this.streakIn.entries()],
      index: this.index,
      feed: this.feed,
      bonus: this.bonus,
    })
  }

  private emit(): void {
    this.persist()
    this.onChange(this.snapshot())
  }
}
