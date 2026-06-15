import type { GameSnapshot } from './types'

// Zero-server sync between the Control tab and the Overlay tab(s) on the same
// machine/browser via BroadcastChannel. Control publishes snapshots; Overlay
// subscribes. Overlay also requests a snapshot on mount (Control replies).

const CHANNEL = 'blindtest:sync'

type Msg =
  | { type: 'snapshot'; snapshot: GameSnapshot }
  | { type: 'request' }

export function createPublisher() {
  const bc = new BroadcastChannel(CHANNEL)
  let last: GameSnapshot | null = null

  bc.onmessage = (ev) => {
    const msg = ev.data as Msg
    // A freshly opened overlay asks for the current state.
    if (msg.type === 'request' && last) {
      bc.postMessage({ type: 'snapshot', snapshot: last })
    }
  }

  return {
    publish(snapshot: GameSnapshot) {
      last = snapshot
      bc.postMessage({ type: 'snapshot', snapshot })
    },
    close() {
      bc.close()
    },
  }
}

export function createSubscriber(onSnapshot: (s: GameSnapshot) => void) {
  const bc = new BroadcastChannel(CHANNEL)
  bc.onmessage = (ev) => {
    const msg = ev.data as Msg
    if (msg.type === 'snapshot') onSnapshot(msg.snapshot)
  }
  // Ask Control for the current state right away.
  bc.postMessage({ type: 'request' })
  return {
    close() {
      bc.close()
    },
  }
}
