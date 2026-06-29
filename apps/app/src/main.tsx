import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import './index.css'
import Setup from './pages/Setup'
import Control from './pages/Control'
import Overlay from './pages/Overlay'
import Guide from './pages/Guide'
import AuthSpotify from './pages/AuthSpotify'
import AuthTwitch from './pages/AuthTwitch'
import BattleAdmin from './pages/BattleAdmin'
import BattleOverlay from './pages/BattleOverlay'
import BattleGate from './components/BattleGate'

const router = createBrowserRouter([
  { path: '/', element: <Setup /> },
  { path: '/control', element: <Control /> },
  { path: '/overlay', element: <Overlay /> },
  { path: '/guide', element: <Guide /> },
  // Battle mode (WIP) — gated behind a password. The overlay is also gated so a
  // shared overlay link doesn't expose the mode before it's ready.
  { path: '/battle', element: <BattleGate><BattleAdmin /></BattleGate> },
  { path: '/battle/overlay', element: <BattleGate><BattleOverlay /></BattleGate> },
  { path: '/auth/spotify', element: <AuthSpotify /> },
  { path: '/auth/twitch', element: <AuthTwitch /> },
  { path: '*', element: <Navigate to="/" replace /> },
], {
  // GitHub Pages serves the app under /<repo>/ in prod; '/' in dev.
  basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/',
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
