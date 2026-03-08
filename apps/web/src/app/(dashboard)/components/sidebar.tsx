'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOutAction } from './sign-out-action'
import type { Session } from 'next-auth'

const NAV_LINKS = [
  { href: '/dashboard/sessions', label: 'Sessions' },
  { href: '/dashboard/playlists', label: 'Playlists' },
  { href: '/dashboard/overlay', label: 'Overlay Setup' },
  { href: '/dashboard/settings', label: 'Settings' },
] as const

const ADMIN_NAV_LINKS = [
  { href: '/dashboard/admin/audit-log', label: 'Audit Log' },
] as const

interface SidebarProps {
  session: Session
}

export function Sidebar({ session }: SidebarProps) {
  const { name, image, role } = session.user
  const pathname = usePathname()
  const isAdmin = role === 'admin'

  return (
    <nav
      aria-label="Dashboard navigation"
      className="flex h-full w-64 flex-col border-r border-gray-800 bg-gray-900 px-4 py-6"
    >
      {/* Brand */}
      <Link
        href="/dashboard"
        className="mb-8 text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-gray-900"
      >
        Playground
      </Link>

      {/* Navigation links */}
      <ul className="flex flex-1 flex-col gap-1">
        {NAV_LINKS.map(({ href, label }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`block rounded-lg px-3 py-2 transition focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-1 focus:ring-offset-gray-900 ${isActive
                  ? 'bg-gray-800 text-white font-medium'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                {label}
              </Link>
            </li>
          )
        })}

        {isAdmin && (
          <>
            <li className="mt-4 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-gray-600">
              Admin
            </li>
            {ADMIN_NAV_LINKS.map(({ href, label }) => {
              const isActive = pathname === href || pathname.startsWith(`${href}/`)
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`block rounded-lg px-3 py-2 transition focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-1 focus:ring-offset-gray-900 ${isActive
                      ? 'bg-gray-800 text-white font-medium'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }`}
                  >
                    {label}
                  </Link>
                </li>
              )
            })}
          </>
        )}
      </ul>

      {/* User info + sign out */}
      <div className="mt-6 border-t border-gray-800 pt-4">
        <div className="mb-3 flex items-center gap-3">
          {image && (
            <Image
              src={image}
              alt={`${name ?? 'User'} avatar`}
              width={32}
              height={32}
              className="rounded-full"
            />
          )}
          <span className="truncate text-sm font-medium text-white">
            {name ?? 'Streamer'}
          </span>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-400 transition hover:bg-gray-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-1 focus:ring-offset-gray-900"
          >
            Sign out
          </button>
        </form>
      </div>
    </nav>
  )
}
