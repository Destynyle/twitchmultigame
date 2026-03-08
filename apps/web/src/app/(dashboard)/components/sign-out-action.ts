'use server'

import { signOut } from '~/server/auth'

/**
 * Server action for signing out.
 * Extracted into its own file so it can be imported by the 'use client' Sidebar component.
 */
export async function signOutAction() {
    await signOut({ redirectTo: '/' })
}
