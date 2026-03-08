import { eq } from 'drizzle-orm'
import { db } from '@playground/db'
import { tenants } from '@playground/db/schema'
import { notFound } from 'next/navigation'
import OverlayClient from './OverlayClient'

interface Props {
  params: Promise<{ token: string }>
}

export default async function OverlayPage({ params }: Props) {
  const { token } = await params

  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.overlayToken, token))

  if (!tenant) notFound()

  return (
    <OverlayClient
      token={token}
      sseUrl={`/api/overlay/${token}`}
    />
  )
}
