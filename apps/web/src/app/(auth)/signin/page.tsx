import { signIn } from '~/server/auth'

export default function SignInPage() {
  return (
    <div className="flex flex-col items-center gap-6 rounded-xl border border-gray-800 bg-gray-900 p-10 shadow-xl">
      <h1 className="text-2xl font-bold text-white">Playground</h1>
      <p className="text-gray-400">Sign in to access your streaming dashboard</p>
      <form
        action={async () => {
          'use server'
          await signIn('twitch', { redirectTo: '/sessions' })
        }}
      >
        <button
          type="submit"
          className="flex items-center gap-3 rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-gray-900"
        >
          Sign in with Twitch
        </button>
      </form>
    </div>
  )
}
