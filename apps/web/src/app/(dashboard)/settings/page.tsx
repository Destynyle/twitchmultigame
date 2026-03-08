import { auth } from '~/server/auth'
import { redirect } from 'next/navigation'
import { isSpotifyConnected } from '~/server/spotify'
import { disconnectSpotifyAction } from './actions'
import { DeleteAccountForm } from './components/DeleteAccountForm'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ spotify?: string }>
}) {
  const session = await auth()
  if (!session?.user?.tenantId) redirect('/signin')

  const params = await searchParams
  const spotifyConnected = await isSpotifyConnected(session.user.tenantId)

  return (
    <div>
      <h1 className="text-3xl font-bold text-white">Settings</h1>

      {/* Spotify connection */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold text-white">Connected Accounts</h2>
        {params.spotify === 'connected' && (
          <p className="mt-2 text-sm text-green-400">Spotify connected successfully!</p>
        )}
        {params.spotify === 'error' && (
          <p className="mt-2 text-sm text-red-400">Spotify connection failed. Please try again.</p>
        )}
        <div className="mt-4 flex items-center gap-4">
          <span className="text-gray-300">Spotify</span>
          {spotifyConnected ? (
            <form action={disconnectSpotifyAction}>
              <button
                type="submit"
                className="rounded bg-gray-700 px-3 py-1 text-sm text-white hover:bg-gray-600"
              >
                Disconnect
              </button>
            </form>
          ) : (
            <a
              href="/api/spotify/connect"
              className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
            >
              Connect Spotify
            </a>
          )}
        </div>
      </section>

      {/* Danger Zone */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-red-400">Danger Zone</h2>
        <p className="mt-1 text-sm text-gray-400">
          Deleting your account starts a 30-day grace period. You can reactivate anytime during
          this window by signing in again.
        </p>
        <DeleteAccountForm />
      </section>
    </div>
  )
}
