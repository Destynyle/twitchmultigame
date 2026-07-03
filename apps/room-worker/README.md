# room-worker — backend des rooms Battle

Cloudflare Worker + Durable Objects (1 DO = 1 room éphémère). Les viewers
rejoignent via `https://<pages>/room/<CODE>`, cherchent un titre (recherche
Spotify proxifiée, token app-only — jamais celui du streamer) et soumettent le
track exact. L'onglet admin (`/battle`) reçoit les soumissions en live par
WebSocket. Les rooms s'auto-détruisent après 12 h.

## Déploiement (une fois)

```bash
pnpm install
cd apps/room-worker
npx wrangler login                       # ouvre le navigateur (compte Cloudflare)
npx wrangler secret put ROOM_PASSWORD    # mdp exigé à la création de room
npx wrangler secret put SPOTIFY_CLIENT_ID
npx wrangler secret put SPOTIFY_CLIENT_SECRET
npx wrangler deploy                      # → https://battle-rooms.<compte>.workers.dev
# (pas `pnpm deploy` — mot réservé pnpm)
```

`SPOTIFY_CLIENT_ID`/`SECRET` : dans le [dashboard Spotify](https://developer.spotify.com/dashboard),
app existante → Settings → Client ID + « View client secret ». Le flow Client
Credentials n'accède à aucune donnée utilisateur — juste `/search`.

Ensuite : coller l'URL `workers.dev` dans le panneau « Room web » de `/battle`
(stockée en localStorage), et la mettre en dur dans `VITE_ROOM_WORKER_URL`
(ou `DEFAULT_WORKER_URL` de `apps/app/src/lib/room-api.ts`) pour que les
**viewers** l'aient sans rien configurer.

## Dev local

```bash
# apps/room-worker/.dev.vars (gitignoré) :
# ROOM_PASSWORD=desty
# SPOTIFY_CLIENT_ID=…
# SPOTIFY_CLIENT_SECRET=…
pnpm --filter @playground/room-worker dev   # http://127.0.0.1:8787
```

## API

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/rooms` | créer (body `{password, config}`) → `{code, adminKey}` |
| GET | `/rooms/:code?clientId=` | état viewer (+ ses soumissions) |
| GET | `/rooms/:code/search?q=&clientId=` | recherche Spotify (10/min/client) |
| POST | `/rooms/:code/submit` | soumettre (cap/user, dédup, 5/min/client) |
| POST | `/rooms/:code/admin` | `{key, action: close\|reopen\|remove, id?}` |
| GET | `/rooms/:code/ws?key=` | WebSocket admin (state initial + events live) |
