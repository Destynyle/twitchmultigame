export default function AuthErrorPage() {
  return (
    <div className="flex flex-col items-center gap-6 rounded-xl border border-red-800 bg-gray-900 p-10 shadow-xl">
      <h1 className="text-2xl font-bold text-white">Authentication Error</h1>
      <p className="text-gray-400">Something went wrong during sign in.</p>
      <a
        href="/auth/signin"
        className="rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-400"
      >
        Try again
      </a>
    </div>
  )
}
