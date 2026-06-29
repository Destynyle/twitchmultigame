import type { BattleSnapshot } from './battle-types'

// Zero-server sync between the Battle admin tab and the overlay tab(s) on the
// same machine/browser via BroadcastChannel. Mirror of lib/sync.ts but on its
// own channel and carrying a BattleSnapshot.

const CHANNEL = 'battle:sync'

type Msg = { type: 'snapshot'; snapshot: BattleSnapshot } | { type: 'request' }

export function createBattlePublisher() {
  const bc = new BroadcastChannel(CHANNEL)
  let last: BattleSnapshot | null = null

  bc.onmessage = (ev) => {
    const msg = ev.data as Msg
    if (msg.type === 'request' && last) {
      bc.postMessage({ type: 'snapshot', snapshot: last })
    }
  }

  return {
    publish(snapshot: BattleSnapshot) {
      last = snapshot
      bc.postMessage({ type: 'snapshot', snapshot })
    },
    close() {
      bc.close()
    },
  }
}

export function createBattleSubscriber(onSnapshot: (s: BattleSnapshot) => void) {
  const bc = new BroadcastChannel(CHANNEL)
  bc.onmessage = (ev) => {
    const msg = ev.data as Msg
    if (msg.type === 'snapshot') onSnapshot(msg.snapshot)
  }
  bc.postMessage({ type: 'request' })
  return {
    close() {
      bc.close()
    },
  }
}
