import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { applyTheme, getTheme } from '../lib/settings'
import { getWeeklyLeaderboard, type WeeklyLeaderboard } from '../lib/weekly-api'
import Footer from '../components/Footer'

// Public page: current week's theme + cross-channel results. The engagement
// loop — viewers come back to check where their channel (and they) landed.

export default function Weekly() {
  const [board, setBoard] = useState<WeeklyLeaderboard | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    applyTheme(getTheme())
    getWeeklyLeaderboard()
      .then(setBoard)
      .catch((e) => setError((e as Error).message))
  }, [])

  return (
    <div className="mx-auto max-w-3xl p-4 pb-16">
      <header className="mb-6 text-center">
        <Link to="/" className="text-sm text-white/40 hover:text-white">← Accueil</Link>
        <h1 className="mt-2 text-3xl font-bold">📅 Blindtest de la semaine</h1>
        {board?.theme && <div className="mt-1 text-xl text-indigo-300">{board.theme}</div>}
        {board && (
          <div className="mt-1 text-sm text-white/40">
            {board.trackCount} pistes · publié le {new Date(board.publishedAt).toLocaleDateString('fr-FR')}
          </div>
        )}
      </header>

      {error && (
        <p className="rounded-xl bg-white/5 p-6 text-center text-white/50">{error}</p>
      )}

      {board && (
        <>
          <div className="mb-6 text-center">
            <Link
              to="/weekly/host"
              className="inline-block rounded-xl bg-indigo-500 px-6 py-3 font-semibold hover:bg-indigo-400"
            >
              🎙️ Animer sur ma chaîne
            </Link>
            <p className="mt-2 text-xs text-white/40">
              Le blindtest s'enchaîne tout seul — ta commu joue dans le chat, toi tu animes.
            </p>
          </div>

          {board.global.length > 0 ? (
            <section className="mb-6 rounded-xl bg-white/5 p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">
                🌍 Top joueurs (toutes chaînes)
              </h2>
              <ol className="flex flex-col gap-1">
                {board.global.map((s, i) => (
                  <li key={s.username} className="flex items-baseline gap-3 rounded-lg bg-white/5 px-3 py-1.5">
                    <span className={`w-7 text-right font-mono ${i < 3 ? 'text-amber-300' : 'text-white/30'}`}>
                      {i + 1}.
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{s.displayName}</span>
                    <span className="text-xs text-white/30">via {s.channel}</span>
                    <span className="font-mono text-indigo-300">{s.points}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : (
            <p className="mb-6 rounded-xl bg-white/5 p-6 text-center text-white/40">
              Aucune chaîne n'a encore joué cette semaine — sois la première !
            </p>
          )}

          {board.channels.length > 0 && (
            <section className="rounded-xl bg-white/5 p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">
                📺 Par chaîne ({board.channels.length})
              </h2>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {board.channels.map((c) => (
                  <li key={c.channel} className="rounded-lg bg-white/5 p-3">
                    <div className="mb-1 flex items-baseline justify-between">
                      <span className="font-semibold text-white/80">{c.channel}</span>
                      <span className="text-xs text-white/30">{c.players} joueur(s)</span>
                    </div>
                    <ol className="text-sm text-white/60">
                      {c.top.map((s, i) => (
                        <li key={s.username} className="flex justify-between">
                          <span className="truncate">{['🥇', '🥈', '🥉'][i]} {s.displayName}</span>
                          <span className="font-mono">{s.points}</span>
                        </li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      <Footer />
    </div>
  )
}
