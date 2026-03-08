import { auth } from '~/server/auth'

export default async function DashboardPage() {
  // Session is guaranteed non-null by the dashboard layout (which redirects if missing).
  // We still call auth() here only to get the user name for the welcome message.
  const session = await auth()

  return (
    <div>
      <h1 className="text-3xl font-bold text-white">
        Welcome, {session?.user.name ?? 'Streamer'}!
      </h1>
      <p className="mt-2 text-gray-400">
        Your dashboard is ready. Select a section from the sidebar to get started.
      </p>
    </div>
  )
}
