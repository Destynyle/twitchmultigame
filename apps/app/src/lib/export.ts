import type { ViewerScore } from './types'

function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportScoresJson(rows: ViewerScore[]): void {
  download('scores.json', JSON.stringify(rows, null, 2), 'application/json')
}

export function exportScoresCsv(rows: ViewerScore[]): void {
  const head = 'rank,displayName,username,points,streak'
  const lines = rows.map(
    (r, i) => `${i + 1},${csv(r.displayName)},${csv(r.username)},${r.points},${r.streak}`,
  )
  // BOM so Excel reads UTF-8 correctly.
  download('scores.csv', '﻿' + [head, ...lines].join('\r\n'), 'text/csv')
}

function csv(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

// Renders the final top-3 podium to a PNG and downloads it.
export function exportPodiumPng(rows: ViewerScore[]): void {
  const W = 900
  const H = 520
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#13131f')
  grad.addColorStop(1, '#0a0a0f')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#f5f5f7'
  ctx.textAlign = 'center'
  ctx.font = 'bold 40px system-ui, sans-serif'
  ctx.fillText('🏆 Podium', W / 2, 70)

  const top = rows.slice(0, 3)
  // Display order: 2nd, 1st, 3rd (classic podium). Heights differ.
  const layout = [
    { row: top[1], x: W / 2 - 250, h: 180, medal: '🥈', color: '#9ca3af' },
    { row: top[0], x: W / 2, h: 250, medal: '🥇', color: '#fbbf24' },
    { row: top[2], x: W / 2 + 250, h: 130, medal: '🥉', color: '#d97706' },
  ]
  const baseY = 470
  const barW = 180
  for (const slot of layout) {
    if (!slot.row) continue
    const topY = baseY - slot.h
    ctx.fillStyle = slot.color
    ctx.fillRect(slot.x - barW / 2, topY, barW, slot.h)
    ctx.fillStyle = '#0a0a0f'
    ctx.font = '48px system-ui, sans-serif'
    ctx.fillText(slot.medal, slot.x, topY + 56)
    ctx.fillStyle = '#f5f5f7'
    ctx.font = 'bold 26px system-ui, sans-serif'
    ctx.fillText(truncate(slot.row.displayName, 14), slot.x, topY - 16)
    ctx.font = '22px system-ui, sans-serif'
    ctx.fillStyle = '#0a0a0f'
    ctx.fillText(`${slot.row.points} pts`, slot.x, topY + slot.h / 2 + 40)
  }

  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'podium.png'
    a.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
