import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig(({ command }) => ({
  // GitHub Pages serves a project site under /<repo>/, so production assets and
  // routes need that base path. Dev stays at root.
  base: command === 'build' ? '/twitchmultigame/' : '/',
  // HTTPS on 127.0.0.1 so BOTH OAuth providers accept the redirect URI:
  // Spotify rejects the hostname `localhost` entirely (needs the loopback IP
  // literal 127.0.0.1) and forbids http except loopback; Twitch requires https
  // (except localhost-http). https://127.0.0.1:5173 satisfies both.
  plugins: [react(), tailwindcss(), basicSsl()],
  server: {
    port: 5173,
    // Fail loudly if 5173 is taken — drifting to 5174 would break the OAuth
    // redirect URIs (registered for :5173).
    strictPort: true,
    host: true,
    // Allow importing raw .ts from workspace packages (game-engine/game-types)
    fs: { allow: ['..', '../..'] },
  },
  // Workspace packages ship raw TS via their exports map; let Vite transpile them
  // instead of trying to pre-bundle them as opaque deps.
  optimizeDeps: {
    exclude: ['@playground/game-engine', '@playground/game-types'],
  },
}))
