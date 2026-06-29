import {
  buildBracket,
  applyWinner,
  nextOpenMatch,
  champion,
  parseVote,
  type Bracket,
  type BattleItem,
} from '@playground/game-engine'
import { fisherYatesShuffle } from '@playground/game-engine'
import type { IncomingChat } from '../lib/twitch-chat'
import type { MusicSource } from '../lib/types'
import type {
  BattleConfig,
  BattleEntry,
  BattlePhase,
  BattleSideView,
  BattleSnapshot,
  BattleVoteFeed,
} from '../lib/battle-types'
import { saveBattle, loadBattle } from '../lib/battle-storage'

const FEED_MAX = 30
const DEFAULT_CONFIG: BattleConfig = { theme: '', maxTotal: 16, maxPerUser: 2, voteSec: 30 }

let feedSeq = 0

/** Resolves a chat `!add <query>` to a tournament entry (e.g. via Spotify search).
 *  Returns null when nothing usable is found. */
export type SubmissionResolver = (
  query: string,
  submittedBy: string,
) => Promise<BattleEntry | null>

const ADD_RE = /^!add\s+(.+)/i

function sourceKey(s: MusicSource): string {
  return s.kind === 'youtube' ? `yt:${s.videoId}` : `sp:${s.trackId}`
}

/**
 * Authoritative client-side controller for Battle mode. Lives for the whole
 * room lifecycle (lobby → bracket → done) on the admin tab, consuming chat for
 * both song submissions (lobby) and votes (during a match), and broadcasting a
 * read-only snapshot to the overlay. Pure bracket/vote logic lives in the engine.
 */
export class BattleController {
  private channel: string
  private resolve: SubmissionResolver
  private onChange: (snap: BattleSnapshot) => void

  private config: BattleConfig = { ...DEFAULT_CONFIG }
  private entries: BattleEntry[] = []
  private phase: BattlePhase = 'lobby'
  private bracket: Bracket | null = null

  // Transient (not persisted) per-match vote state.
  private votes = new Map<string, 'a' | 'b'>()
  private voteOpen = false
  private voteStartedAt = 0
  private lastWinner: 'a' | 'b' | null = null
  private voteTimer: ReturnType<typeof setTimeout> | null = null
  private feed: BattleVoteFeed[] = []

  constructor(
    channel: string,
    resolve: SubmissionResolver,
    onChange: (snap: BattleSnapshot) => void,
  ) {
    this.channel = channel
    this.resolve = resolve
    this.onChange = onChange
  }

  // ─── Config (lobby) ───────────────────────────────────────────────────────
  setConfig(patch: Partial<BattleConfig>): void {
    this.config = { ...this.config, ...patch }
    this.emit()
  }

  getConfig(): BattleConfig {
    return this.config
  }

  // ─── Pool management ──────────────────────────────────────────────────────
  getEntries(): BattleEntry[] {
    return this.entries
  }

  getPhase(): BattlePhase {
    return this.phase
  }

  private countByUser(user: string): number {
    return this.entries.filter((e) => e.submittedBy.toLowerCase() === user.toLowerCase()).length
  }

  /** Add an entry (manual admin add or a resolved chat submission). Returns a
   *  short error string if rejected, else null. */
  addEntry(entry: BattleEntry, enforcePerUser = false): string | null {
    if (this.phase !== 'lobby') return 'Le tournoi a déjà commencé'
    if (this.entries.some((e) => sourceKey(e.source) === sourceKey(entry.source))) {
      return 'Doublon : ce son est déjà dans le pool'
    }
    if (enforcePerUser && this.countByUser(entry.submittedBy) >= this.config.maxPerUser) {
      return `Limite atteinte (${this.config.maxPerUser}/personne)`
    }
    this.entries.push(entry)
    this.emit()
    return null
  }

  removeEntry(id: string): void {
    this.entries = this.entries.filter((e) => e.id !== id)
    this.emit()
  }

  // ─── Chat handling ────────────────────────────────────────────────────────
  handleChat(msg: IncomingChat): void {
    if (this.phase === 'lobby') {
      const m = ADD_RE.exec(msg.text.trim())
      if (!m) return
      if (this.countByUser(msg.displayName) >= this.config.maxPerUser) return
      void this.resolveAndAdd(m[1]!.trim(), msg.displayName)
      return
    }
    if (this.phase === 'bracket' && this.voteOpen) {
      const pair = this.currentItems()
      if (!pair) return
      const side = parseVote(msg.text, pair.a, pair.b)
      if (side) this.recordVote(msg.username, msg.displayName, side)
    }
  }

  private async resolveAndAdd(query: string, submittedBy: string): Promise<void> {
    let entry: BattleEntry | null = null
    try {
      entry = await this.resolve(query, submittedBy)
    } catch {
      return
    }
    if (!entry || this.phase !== 'lobby') return
    // Re-check the per-user cap after the async gap (anti-spam).
    if (this.countByUser(submittedBy) >= this.config.maxPerUser) return
    this.addEntry(entry, true)
  }

  private recordVote(username: string, displayName: string, side: 'a' | 'b'): void {
    const prev = this.votes.get(username)
    if (prev === side) return // no-op re-vote
    this.votes.set(username, side)
    this.pushFeed(displayName, side, prev !== undefined)
    this.emit()
  }

  private pushFeed(user: string, side: 'a' | 'b', changed: boolean): void {
    this.feed.unshift({ id: `b${feedSeq++}`, user, side, changed })
    if (this.feed.length > FEED_MAX) this.feed.length = FEED_MAX
  }

  // ─── Bracket lifecycle ────────────────────────────────────────────────────
  /** Lock the lobby and generate the bracket. */
  seed(shuffle: boolean): string | null {
    if (this.entries.length < 2) return 'Il faut au moins 2 sons'
    let pool = this.entries.slice()
    if (shuffle) pool = fisherYatesShuffle(pool.length).map((i) => pool[i]!)
    pool = pool.slice(0, Math.max(2, this.config.maxTotal))
    const items: BattleItem[] = pool.map((e) => ({ id: e.id, title: e.title, artist: e.artist }))
    this.bracket = buildBracket(items)
    this.phase = 'bracket'
    this.resetVoteState()
    this.emit()
    return null
  }

  startVote(): void {
    if (this.phase !== 'bracket' || !this.currentItems()) return
    this.votes.clear()
    this.voteOpen = true
    this.voteStartedAt = Date.now()
    this.lastWinner = null
    this.clearTimer()
    this.voteTimer = setTimeout(() => this.endVote(), this.config.voteSec * 1000)
    this.emit()
  }

  /** Close voting and lock in the leading side (tie → admin decides). */
  endVote(): void {
    if (!this.voteOpen) return
    this.voteOpen = false
    this.clearTimer()
    const { a, b } = this.tally()
    this.lastWinner = a > b ? 'a' : b > a ? 'b' : null
    this.emit()
  }

  restartVote(): void {
    if (this.phase !== 'bracket') return
    this.startVote()
  }

  /** Admin override of the winning side (e.g. to break a tie). */
  pickWinner(side: 'a' | 'b'): void {
    if (this.phase !== 'bracket') return
    this.voteOpen = false
    this.clearTimer()
    this.lastWinner = side
    this.emit()
  }

  /** Advance the decided winner and move to the next match (or crown a champion). */
  advance(): void {
    if (this.phase !== 'bracket' || !this.bracket || !this.lastWinner) return
    const cur = nextOpenMatch(this.bracket)
    if (!cur) return
    this.bracket = applyWinner(this.bracket, cur.round, cur.match, this.lastWinner)
    this.resetVoteState()
    if (!nextOpenMatch(this.bracket)) this.phase = 'done'
    this.emit()
  }

  resetRoom(): void {
    this.config = { ...DEFAULT_CONFIG }
    this.entries = []
    this.phase = 'lobby'
    this.bracket = null
    this.feed = []
    this.resetVoteState()
    this.emit()
  }

  // ─── Derived state ────────────────────────────────────────────────────────
  private currentItems(): { a: BattleItem; b: BattleItem } | null {
    if (!this.bracket) return null
    const cur = nextOpenMatch(this.bracket)
    if (!cur) return null
    const m = this.bracket[cur.round]![cur.match]!
    if (!m.a || !m.b) return null
    return { a: m.a, b: m.b }
  }

  /** Sources for the two current contestants, for the admin's preview players. */
  currentSources(): { a: MusicSource | null; b: MusicSource | null } {
    const pair = this.currentItems()
    return { a: this.entryById(pair?.a.id)?.source ?? null, b: this.entryById(pair?.b.id)?.source ?? null }
  }

  private entryById(id?: string): BattleEntry | undefined {
    return id ? this.entries.find((e) => e.id === id) : undefined
  }

  private tally(): { a: number; b: number } {
    let a = 0
    let b = 0
    for (const v of this.votes.values()) v === 'a' ? a++ : b++
    return { a, b }
  }

  private sideView(item: BattleItem | null): BattleSideView {
    const e = this.entryById(item?.id)
    return {
      title: item?.title ?? '',
      artist: item?.artist ?? null,
      coverUrl: e?.coverUrl ?? null,
      submittedBy: e?.submittedBy ?? null,
    }
  }

  private roundLabel(round: number, total: number): string {
    const fromFinal = total - 1 - round
    return (
      ['Finale', 'Demi-finale', 'Quart de finale', 'Huitième de finale'][fromFinal] ??
      `Tour ${round + 1}`
    )
  }

  snapshot(): BattleSnapshot {
    const pair = this.currentItems()
    let match: BattleSnapshot['match'] = null
    if (this.bracket && pair && this.phase === 'bracket') {
      const cur = nextOpenMatch(this.bracket)!
      match = {
        a: this.sideView(pair.a),
        b: this.sideView(pair.b),
        roundLabel: this.roundLabel(cur.round, this.bracket.length),
        matchInRound: cur.match + 1,
        matchesInRound: this.bracket[cur.round]!.length,
      }
    }
    const tally = this.tally()
    const champ = this.bracket ? champion(this.bracket) : null
    return {
      channel: this.channel,
      phase: this.phase,
      theme: this.config.theme,
      pool: { count: this.entries.length, max: this.config.maxTotal },
      match,
      vote:
        this.phase === 'bracket' && (this.voteOpen || this.lastWinner !== null)
          ? {
              open: this.voteOpen,
              startedAt: this.voteStartedAt,
              durationMs: this.config.voteSec * 1000,
              a: tally.a,
              b: tally.b,
            }
          : null,
      lastWinner: this.lastWinner,
      champion: this.phase === 'done' ? this.sideView(champ) : null,
      feed: this.feed,
    }
  }

  // ─── Plumbing ─────────────────────────────────────────────────────────────
  private resetVoteState(): void {
    this.votes.clear()
    this.voteOpen = false
    this.voteStartedAt = 0
    this.lastWinner = null
    this.clearTimer()
  }

  private clearTimer(): void {
    if (this.voteTimer) clearTimeout(this.voteTimer)
    this.voteTimer = null
  }

  private persist(): void {
    saveBattle({
      v: 1,
      channel: this.channel,
      config: this.config,
      entries: this.entries,
      phase: this.phase,
      bracket: this.bracket,
    })
  }

  /** Restore a saved room if it matches this channel. Voting is left closed. */
  hydrate(): boolean {
    const s = loadBattle()
    if (!s || s.channel !== this.channel) return false
    this.config = s.config
    this.entries = s.entries
    this.phase = s.phase
    this.bracket = s.bracket
    this.resetVoteState()
    return true
  }

  private emit(): void {
    this.persist()
    this.onChange(this.snapshot())
  }

  dispose(): void {
    this.clearTimer()
  }
}
