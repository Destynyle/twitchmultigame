import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { completeTwitchAuth } from '../lib/twitch-auth'
import { saveChannel } from '../lib/storage'
import { setRoomTwitch, TW_STATE_KEY } from '../lib/room-api'

// A viewer logging in from a room page lands here too — their state is
// `room:<CODE>:<rand>` and their token must NOT touch the streamer's storage.
async function completeRoomAuth(fragment: string): Promise<string> {
  const params = new URLSearchParams(fragment.replace(/^#/, ''))
  const expected = localStorage.getItem(TW_STATE_KEY)
  localStorage.removeItem(TW_STATE_KEY)
  const state = params.get('state')
  if (!expected || state !== expected) throw new Error('État OAuth invalide — retente depuis la room')
  const token = params.get('access_token')
  if (!token) throw new Error('Token Twitch absent')
  // No Client-Id needed: the validate endpoint identifies the token's owner.
  const res = await fetch('https://id.twitch.tv/oauth2/validate', {
    headers: { Authorization: `OAuth ${token}` },
  })
  if (!res.ok) throw new Error('Token Twitch invalide')
  const j = (await res.json()) as { login?: string }
  setRoomTwitch(token, j.login ?? '')
  return state!.split(':')[1] ?? ''
}

export default function AuthTwitch() {
  const nav = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    // Implicit grant returns the token in the URL fragment.
    if (!window.location.hash) {
      nav('/', { replace: true })
      return
    }
    const isRoom = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      .get('state')
      ?.startsWith('room:')
    if (isRoom) {
      completeRoomAuth(window.location.hash)
        .then((code) => nav(`/room/${code}`, { replace: true }))
        .catch((e) => setError((e as Error).message))
      return
    }
    completeTwitchAuth(window.location.hash)
      .then((login) => {
        saveChannel(login)
        // replace:true so the token-bearing fragment leaves no history entry.
        nav('/?twitch=connected', { replace: true })
      })
      .catch((e) => setError((e as Error).message))
  }, [nav])

  return (
    <div className="grid h-screen place-items-center text-sm text-white/60">
      {error ? <span className="text-red-400">Erreur Twitch : {error}</span> : 'Connexion Twitch…'}
    </div>
  )
}
