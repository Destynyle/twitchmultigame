import { redirect } from 'next/navigation'
import { auth } from '~/server/auth'
import { Sidebar } from './components/sidebar'
import { QueryProvider } from './components/QueryProvider'
import { AdminNotificationBanner } from './components/AdminNotificationBanner'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  // Middleware handles most cases; this is a server-side safety net
  if (!session) {
    redirect('/auth/signin')
  }

  return (
    <QueryProvider>
      <div className="flex h-screen overflow-hidden bg-gray-950">
        <Sidebar session={session} />
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
        <AdminNotificationBanner />
      </div>
    </QueryProvider>
  )
}
