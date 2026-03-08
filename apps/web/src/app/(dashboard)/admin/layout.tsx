import { redirect } from 'next/navigation'
import { auth } from '~/server/auth'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  // Middleware handles the redirect, this is a server-side safety net
  if (!session || session.user.role !== 'admin') {
    redirect('/sessions')
  }

  return <>{children}</>
}
