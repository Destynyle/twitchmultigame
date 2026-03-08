import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gray-950 p-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-white">Playground</h1>
        <p className="mt-4 text-xl text-gray-400">
          Twitch chat mini-games for streamers
        </p>
      </div>
      <Link
        href="/signin"
        className="rounded-lg bg-purple-600 px-8 py-4 text-lg font-semibold text-white transition hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-gray-950"
      >
        Sign in with Twitch
      </Link>
    </main>
  )
}
