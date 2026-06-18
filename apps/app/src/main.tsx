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

const router = createBrowserRouter([
  { path: '/', element: <Setup /> },
  { path: '/control', element: <Control /> },
  { path: '/overlay', element: <Overlay /> },
  { path: '/guide', element: <Guide /> },
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
