import { auth } from '../../../../server/auth'
import { redirect } from 'next/navigation'
import { getOrCreateOverlayTokenAction, getThemesAction } from './actions'
import OverlaySetupClient from './OverlaySetupClient'

export default async function OverlaySetupPage() {
  const session = await auth()
  if (!session?.user?.tenantId) redirect('/signin')

  const [result, themesResult] = await Promise.all([
    getOrCreateOverlayTokenAction(),
    getThemesAction(),
  ])
  const token = result.success ? result.token : null
  const selectedThemeId = result.success ? result.selectedThemeId : null
  const themes = 'themes' in themesResult ? themesResult.themes : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Overlay Setup</h1>
        <p className="mt-1 text-gray-400">
          Paste your overlay URL into OBS as a Browser Source — no configuration required.
        </p>
      </div>
      {token ? (
        <OverlaySetupClient token={token} themes={themes} selectedThemeId={selectedThemeId} />
      ) : (
        <p className="text-red-400">Failed to generate overlay token. Please refresh.</p>
      )}
    </div>
  )
}
