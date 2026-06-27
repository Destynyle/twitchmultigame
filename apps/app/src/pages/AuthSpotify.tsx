import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { completeSpotifyAuth } from '../lib/spotify'

export default function AuthSpotify() {
  const nav = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const err = params.get('error')
    if (err) {
      setError(err)
      return
    }
    if (!code) {
      nav('/', { replace: true })
      return
    }
    completeSpotifyAuth(code, state)
      // replace:true so the URL holding the auth code leaves no history entry.
      .then(() => nav('/?spotify=connected', { replace: true }))
      .catch((e) => setError((e as Error).message))
  }, [nav])

  return (
    <div className="grid h-screen place-items-center text-sm text-white/60">
      {error ? <span className="text-red-400">Erreur Spotify : {error}</span> : 'Connexion Spotify…'}
    </div>
  )
}
