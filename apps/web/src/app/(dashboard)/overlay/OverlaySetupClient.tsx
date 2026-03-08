'use client'

import { useState, useTransition } from 'react'
import type { OverlayTheme } from '@playground/db/schema'
import { selectThemeAction } from './actions'

interface OverlaySetupClientProps {
  token: string
  themes: OverlayTheme[]
  selectedThemeId: string | null
}

export default function OverlaySetupClient({
  token,
  themes,
  selectedThemeId: initialSelectedThemeId,
}: OverlaySetupClientProps) {
  const [copied, setCopied] = useState(false)
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(initialSelectedThemeId)
  const [isPending, startTransition] = useTransition()

  const overlayUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/overlay/${token}`
      : `/overlay/${token}`

  function handleCopy() {
    void navigator.clipboard.writeText(
      `${window.location.origin}/overlay/${token}`
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleThemeSelect(themeId: string) {
    if (isPending) return
    setSelectedThemeId(themeId)
    startTransition(async () => {
      await selectThemeAction(themeId)
    })
  }

  return (
    <div className="space-y-8">
      {/* URL display + copy */}
      <div className="rounded-lg border border-gray-700 bg-gray-900 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">Your Overlay URL</h2>
        <p className="text-sm text-gray-400">
          Add this URL as a <strong>Browser Source</strong> in OBS (recommended size: 1920×1080).
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <code className="flex-1 rounded-md border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-purple-300 break-all">
            {overlayUrl}
          </code>
          <button
            onClick={handleCopy}
            className="shrink-0 rounded-md bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-500 transition-colors"
          >
            {copied ? '✓ Copied!' : 'Copy URL'}
          </button>
        </div>
      </div>

      {/* Theme Selector */}
      {themes.length > 0 && (
        <div className="rounded-lg border border-gray-700 bg-gray-900 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Overlay Theme</h2>
            <p className="text-sm text-gray-400 mt-1">
              Choose the visual style for your overlay. Pro themes are available to all users during beta.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {themes.map((theme) => {
              const isSelected = theme.id === selectedThemeId
              const isPro = theme.tier !== 'free'
              return (
                <button
                  key={theme.id}
                  onClick={() => handleThemeSelect(theme.id)}
                  disabled={isPending}
                  className={`relative flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all cursor-pointer disabled:opacity-60 ${
                    isSelected
                      ? 'border-purple-500 bg-purple-950/40'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                  }`}
                >
                  {/* Color swatch */}
                  <div
                    className="w-full rounded-md"
                    style={{
                      backgroundColor: theme.previewColor,
                      height: '48px',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  />
                  {/* Theme name */}
                  <span className="text-sm font-medium text-white">{theme.name}</span>
                  {/* Tier badge */}
                  {isPro && (
                    <span className="absolute top-2 right-2 rounded-full bg-amber-600/70 px-1.5 py-0.5 text-[10px] font-semibold text-amber-100 leading-none">
                      Pro
                    </span>
                  )}
                  {/* Selected indicator */}
                  {isSelected && (
                    <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-purple-400 text-xs font-medium">
                      ✓ Active
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Live preview iframe */}
      <div className="rounded-lg border border-gray-700 bg-gray-900 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">Preview</h2>
        <p className="text-sm text-gray-400">
          This is how your overlay will appear in OBS (transparent background renders as dark here).
        </p>
        <div
          className="relative overflow-hidden rounded-lg border border-gray-700"
          style={{ paddingBottom: '56.25%' /* 16:9 */ }}
        >
          <iframe
            src={overlayUrl}
            className="absolute inset-0 h-full w-full"
            style={{ background: '#111' }}
            title="Overlay preview"
          />
        </div>
      </div>
    </div>
  )
}
