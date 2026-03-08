'use client'

import { useState } from 'react'

export default function OverlaySetupClient({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)

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
