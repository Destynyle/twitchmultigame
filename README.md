# Blindtest

A zero-backend blind test game for Twitch streamers. Build a playlist, read your
chat **anonymously** (no token, no login), and let viewers guess songs live —
scoring, an OBS overlay, and animations all run **100% in the browser**.

🎮 Live: https://destynyle.github.io/twitchmultigame/
Made by [destynyle_s](https://twitch.tv/destynyle_s).

## How it works

- **No server, no database.** Everything runs client-side and persists to
  `localStorage`. Hosting is a static bundle on GitHub Pages.
- **Anonymous chat reading.** Connects to Twitch IRC over WebSocket as a
  `justinfan` guest — no account or token needed to read a channel's chat.
- **Music.** Paste YouTube/Spotify URLs, or import a Spotify playlist (your own
  Spotify app, client-side PKCE). YouTube plays in full; Spotify plays a 30s
  embed preview, or full songs via the **Spotify desktop app** (Connect mode).
- **Overlay ↔ control sync** over `BroadcastChannel` (same browser, same PC) —
  no server in between. Add the overlay as an OBS Browser Source.

## Scoring

- **Title** and **Artist** are independent targets, each with its own 5s decay
  window (first finder gets the most, 3 → 1 over the window).
- **Combo**: naming title **and** artist in the same message → `(title + artist) × 1.5`.
- **Featuring**: +1 each, revealed on the overlay as soon as found.
- **Malus**: forbidden terms cost points (−1, −2, −3…).
- **Streak**: consecutive rounds with a find grow a multiplier.

## Stack

Turborepo monorepo:

- `apps/app` — Vite + React 18 + Tailwind CSS v4 SPA (the whole game)
- `packages/game-engine` — pure scoring engine (`BlindtestPlugin`), framework-agnostic, tested with Vitest
- `packages/game-types` — shared TypeScript interfaces

## Local development

```bash
pnpm install
pnpm dev
```

The dev server runs on **https://127.0.0.1:5173** (HTTPS on the loopback IP).
This is required for OAuth: Spotify rejects the `localhost` hostname and Twitch
requires HTTPS — only `https://127.0.0.1` satisfies both. Accept the self-signed
certificate on first load.

```bash
pnpm build        # production build (apps/app → dist/, with SPA 404 fallback)
pnpm test         # run the game-engine test suite
pnpm type-check   # TypeScript check
pnpm lint         # lint
```

## OAuth setup (optional)

Reading chat needs **nothing**. Only importing a Spotify playlist (and the
optional Twitch login that auto-fills your channel name) needs a one-time setup,
done with **your own** OAuth apps — there are no shared secrets in this repo.

The exact **Redirect URI** to register is shown (with a copy button) in the app
under **Connexions → Réglages**; it adapts automatically to dev
(`https://127.0.0.1:5173/…`) and prod (`…github.io/…`). See the in-app **Guide**
for the step-by-step. Spotify dev mode whitelists up to 25 accounts per app, so
each player uses their own Spotify app.

## Deployment (GitHub Pages)

Pushing to `master` triggers `.github/workflows/deploy.yml` (build + deploy via
GitHub Actions). One-time setup: repo **Settings → Pages → Source = GitHub
Actions**.

The Vite `base` is set to the repository name (`/twitchmultigame/` in
`apps/app/vite.config.ts`) so assets and routes resolve under the project-site
path. **If you fork/rename the repo, update `base` to match.**

## Security notes

Zero-backend keeps the attack surface small (no server, no DB, no stored PII;
React escapes all chat/user text — no XSS sinks). The main residual considerations:

- OAuth tokens live in `localStorage`. On GitHub Pages, all of a user's project
  sites share the `*.github.io` origin (and thus `localStorage`) — a custom
  domain isolates them.
- OAuth uses PKCE (Spotify) / implicit with empty scope (Twitch login) — no
  client secret is ever exposed.
