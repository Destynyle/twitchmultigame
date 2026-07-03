import { DurableObject } from 'cloudflare:workers'
import { validateTwitchToken } from './twitch'
import type { ChannelResult, Env, WeeklyScore, WeeklyTrack, WeeklyWeek } from './types'

// Singleton DO holding the "blindtest de la semaine": the current curated
// playlist (published by the site admin, password-checked in the router) and
// the per-channel results streamers push at the end of their run.
//
// Trust model (deliberate): answers ARE served to the host client — the game
// engine matches guesses locally, and streamers are expected to host without
// playing. This is a community feature, not an anti-cheat one.

const MAX_TRACKS = 60
const MAX_TOP = 20
const MAX_CHANNELS = 200

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const err = (message: string, status: number) => json({ error: message }, status)

function sanitizeTrack(raw: unknown): WeeklyTrack | null {
  if (typeof raw !== 'object' || raw === null) return null
  const t = raw as Record<string, unknown>
  const title = String(t.title ?? '').trim().slice(0, 120)
  if (!title) return null
  const src = t.source as Record<string, unknown> | undefined
  let source: WeeklyTrack['source']
  if (src?.kind === 'spotify' && /^[A-Za-z0-9]{22}$/.test(String(src.trackId ?? ''))) {
    source = { kind: 'spotify', trackId: String(src.trackId) }
  } else if (src?.kind === 'youtube' && /^[A-Za-z0-9_-]{11}$/.test(String(src.videoId ?? ''))) {
    source = { kind: 'youtube', videoId: String(src.videoId) }
  } else {
    return null
  }
  const strList = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x).slice(0, 80)).filter(Boolean).slice(0, 10) : []
  const artist = t.artist == null ? null : String(t.artist).trim().slice(0, 120) || null
  const coverUrl = String(t.coverUrl ?? '')
  const windowMs = Number(t.windowMs)
  return {
    title,
    artist,
    featurings: strList(t.featurings),
    malusTerms: strList(t.malusTerms),
    source,
    ...(coverUrl.startsWith('https://') ? { coverUrl: coverUrl.slice(0, 300) } : {}),
    ...(Number.isFinite(windowMs) && windowMs >= 1000 && windowMs <= 60000 ? { windowMs } : {}),
  }
}

export class WeeklyHub extends DurableObject<Env> {
  private async week(): Promise<WeeklyWeek | null> {
    return (await this.ctx.storage.get<WeeklyWeek>('week')) ?? null
  }

  private async results(): Promise<Record<string, ChannelResult>> {
    return (await this.ctx.storage.get<Record<string, ChannelResult>>('results')) ?? {}
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    switch (url.pathname) {
      case '/set':
        return this.set(request)
      case '/get':
        return this.get()
      case '/results':
        return this.submitResults(request)
      case '/leaderboard':
        return this.leaderboard()
      default:
        return err('not found', 404)
    }
  }

  /** Publish a new week (password already checked by the router). Clears results. */
  private async set(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return err('requête invalide', 400)
    const tracks = (Array.isArray(body.tracks) ? body.tracks : [])
      .map(sanitizeTrack)
      .filter((t): t is WeeklyTrack => t !== null)
      .slice(0, MAX_TRACKS)
    if (tracks.length < 2) return err('il faut au moins 2 pistes valides', 400)
    const week: WeeklyWeek = {
      id: `w${Date.now().toString(36)}`,
      theme: String(body.theme ?? '').trim().slice(0, 80),
      tracks,
      publishedAt: Date.now(),
    }
    await this.ctx.storage.put('week', week)
    await this.ctx.storage.put('results', {})
    return json({ ok: true, id: week.id, trackCount: tracks.length })
  }

  private async get(): Promise<Response> {
    const week = await this.week()
    if (!week) return err('pas de blindtest de la semaine pour le moment', 404)
    return json(week)
  }

  /** A streamer pushes their run's final leaderboard. Channel = verified Twitch
   *  login of the pushing streamer (one result per channel, overwrite = re-run). */
  private async submitResults(request: Request): Promise<Response> {
    const week = await this.week()
    if (!week) return err('pas de semaine active', 404)
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return err('requête invalide', 400)
    if (body.id !== week.id) return err('cette édition est terminée — recharge la page', 409)
    const identity = await validateTwitchToken(String(body.twitchToken ?? ''))
    if (!identity) return err('connexion Twitch requise (streamer)', 401)
    const raw = Array.isArray(body.leaderboard) ? body.leaderboard : []
    const top: WeeklyScore[] = raw
      .map((s: any): WeeklyScore | null => {
        const username = String(s?.username ?? '').trim().slice(0, 40)
        const points = Number(s?.points)
        if (!username || !Number.isFinite(points)) return null
        return {
          username,
          displayName: String(s?.displayName ?? username).trim().slice(0, 40) || username,
          points: Math.round(points * 10) / 10,
        }
      })
      .filter((s): s is WeeklyScore => s !== null)
      .sort((a, b) => b.points - a.points)
      .slice(0, MAX_TOP)
    if (top.length === 0) return err('classement vide', 400)

    const results = await this.results()
    if (!results[identity.login] && Object.keys(results).length >= MAX_CHANNELS) {
      return err('trop de chaînes cette semaine', 409)
    }
    results[identity.login] = {
      channel: identity.login,
      top,
      players: Math.max(top.length, Math.min(10000, Number(body.players) || top.length)),
      at: Date.now(),
    }
    await this.ctx.storage.put('results', results)
    return json({ ok: true })
  }

  private async leaderboard(): Promise<Response> {
    const week = await this.week()
    if (!week) return err('pas de semaine active', 404)
    const results = await this.results()
    // Global board: a viewer may play on several channels — keep their best run.
    const best = new Map<string, WeeklyScore & { channel: string }>()
    for (const r of Object.values(results)) {
      for (const s of r.top) {
        const key = s.username.toLowerCase()
        const prev = best.get(key)
        if (!prev || s.points > prev.points) best.set(key, { ...s, channel: r.channel })
      }
    }
    const global = [...best.values()].sort((a, b) => b.points - a.points).slice(0, 25)
    const channels = Object.values(results)
      .sort((a, b) => b.players - a.players)
      .map((r) => ({ channel: r.channel, top: r.top.slice(0, 3), players: r.players, at: r.at }))
    return json({
      id: week.id,
      theme: week.theme,
      trackCount: week.tracks.length,
      publishedAt: week.publishedAt,
      channels,
      global,
    })
  }
}
