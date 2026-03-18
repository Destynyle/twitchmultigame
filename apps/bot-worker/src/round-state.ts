import Redis from 'ioredis'

export interface RoundState {
  windowOpenAt: number | null
  windowMs: number
  malusCounters: Record<string, number>  // viewerUsername -> count
  foundThisRound: string[]               // viewers who scored this round
  featuringsFound: Record<string, string> // featuring -> viewerUsername
}

export class RoundStateManager {
  constructor(
    private readonly redis: Redis,
    private readonly sessionId: string
  ) {}

  private roundKey(): string {
    return `game:round:${this.sessionId}`
  }

  private streakKey(viewer: string): string {
    return `game:streak:${this.sessionId}:${viewer}`
  }

  private shuffleKey(): string {
    return `game:shuffle:${this.sessionId}`
  }

  async initRound(windowMs: number): Promise<void> {
    const state: RoundState = {
      windowOpenAt: null,
      windowMs,
      malusCounters: {},
      foundThisRound: [],
      featuringsFound: {},
    }
    await this.redis.set(this.roundKey(), JSON.stringify(state))
  }

  async getRoundState(): Promise<RoundState | null> {
    const raw = await this.redis.get(this.roundKey())
    return raw ? JSON.parse(raw) as RoundState : null
  }

  async updateRoundState(state: RoundState): Promise<void> {
    await this.redis.set(this.roundKey(), JSON.stringify(state))
  }

  async getStreak(viewer: string): Promise<number> {
    const val = await this.redis.get(this.streakKey(viewer))
    return val ? parseInt(val, 10) : 0
  }

  async setStreak(viewer: string, count: number): Promise<void> {
    // 24h TTL — sessions don't run longer than a few hours
    await this.redis.setex(this.streakKey(viewer), 86400, String(count))
  }

  async resetStreak(viewer: string): Promise<void> {
    await this.redis.del(this.streakKey(viewer))
  }

  // Called at round end: increment streak for viewers who scored, reset for those who didn't
  async processStreaksAtRoundEnd(
    foundThisRound: string[],
    allParticipants: string[]
  ): Promise<void> {
    const foundSet = new Set(foundThisRound)
    for (const viewer of allParticipants) {
      if (foundSet.has(viewer)) {
        const current = await this.getStreak(viewer)
        await this.setStreak(viewer, current + 1)
      } else {
        await this.resetStreak(viewer)
      }
    }
  }

  async setShuffleOrder(order: number[]): Promise<void> {
    await this.redis.set(this.shuffleKey(), JSON.stringify(order))
  }

  async getShuffleOrder(): Promise<number[] | null> {
    const raw = await this.redis.get(this.shuffleKey())
    return raw ? JSON.parse(raw) as number[] : null
  }

  async cleanup(): Promise<void> {
    await this.redis.del(this.roundKey())
    await this.redis.del(this.shuffleKey())
    // Note: streak keys have 24h TTL and will auto-expire
  }
}
