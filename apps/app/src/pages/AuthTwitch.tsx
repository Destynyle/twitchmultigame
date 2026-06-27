import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { completeTwitchAuth } from '../lib/twitch-auth'
import { saveChannel } from '../lib/storage'

export default function AuthTwitch() {
  const nav = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    // Implicit grant returns the token in the URL fragment.
    if (!window.location.hash) {
      nav('/', { replace: true })
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
