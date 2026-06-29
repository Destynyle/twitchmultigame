import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { isBattleUnlocked, tryUnlock } from '../lib/battle-gate'

/** Password gate for the WIP Battle mode. Obscurity only — see lib/battle-gate. */
export default function BattleGate({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState(isBattleUnlocked)
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)

  if (ok) return <>{children}</>

  const submit = () => {
    if (tryUnlock(pw)) setOk(true)
    else {
      setErr(true)
      setPw('')
    }
  }

  return (
    <div className="mx-auto grid min-h-screen max-w-sm place-items-center p-6">
      <div className="w-full">
        <h1 className="mb-1 text-2xl font-bold">⚔️ Mode Battle</h1>
        <p className="mb-4 text-sm text-white/50">En chantier — accès protégé.</p>
        <input
          type="password"
          value={pw}
          onChange={(e) => {
            setPw(e.target.value)
            setErr(false)
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Mot de passe"
          autoFocus
          className="w-full rounded-lg bg-white/5 px-3 py-2 outline-none focus:bg-white/10"
        />
        {err && <p className="mt-2 text-sm text-red-400">Mot de passe incorrect.</p>}
        <button
          onClick={submit}
          className="mt-3 w-full rounded-lg bg-indigo-500 py-2 font-medium hover:bg-indigo-400"
        >
          Entrer
        </button>
        <Link to="/" className="mt-4 block text-center text-sm text-white/40 hover:text-white">
          ← Retour
        </Link>
      </div>
    </div>
  )
}
