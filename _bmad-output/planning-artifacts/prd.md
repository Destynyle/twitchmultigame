---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish']
inputDocuments:
  - '_bmad-output/brainstorming/brainstorming-session-2026-02-24.md'
workflowType: 'prd'
briefCount: 0
researchCount: 0
brainstormingCount: 1
projectDocsCount: 0
classification:
  projectType: 'saas_web_app'
  domain: 'Entertainment Tech / Streaming Tools'
  complexity: 'high'
  projectContext: 'brownfield-to-greenfield-rewrite'
  targetSegment: 'Mid-tier streamers (500-5000 viewers)'
resilience:
  - 'Bot reconnexion automatique silencieuse (backoff exponentiel)'
  - 'Chat sampling sous haute charge (50k viewers)'
  - 'Fallback overlay pour médias indisponibles'
  - 'Soft delete avec période de grâce 30 jours'
  - 'Architecture bots stateless pour scaling horizontal'
architecture_constraints:
  - 'StreamingProvider abstrait (Twitch, Kick, YouTube Live en adaptateurs)'
  - 'VideoProvider multi-sources (YouTube, Twitch Clips, Vimeo)'
  - 'Score leaderboard normalisé (%, jamais points absolus)'
  - 'Ligues par taille de communauté (éviter domination grosses commus)'
critical_decisions:
  - 'Onboarding : premier jeu < 2 minutes (métrique north star)'
  - 'Profil viewer public dès le MVP'
  - 'MVP = Blindtest refonte + 1 mini-jeu additionnel + leaderboard basique'
  - 'Beta privée (20 streamers minimum) avant lancement public'
  - 'Marketplace créateurs CSS = moteur croissance organique (V2 haute priorité)'
  - 'ELO viewer cross-streams (rétention V2)'
  - 'Pipeline viewer→streamer (CTA dans overlay) = MVP, pas V2'
  - 'Kick support = milestone V2 stratégique explicite'
pricing:
  - 'Free : playlists limitées, thèmes de base, 1 mini-jeu'
  - 'Pro (~15€/mois) : playlists illimitées, tous les mini-jeux, analytics basiques'
  - 'Studio (~29€/mois) : CSS custom, shop de thèmes, analytics avancées, support prioritaire'
moat:
  - 'Effet réseau leaderboard inter-commu : valeur croît avec le nombre de streamers'
  - 'Marketplace créateurs de thèmes : écosystème propriétaire'
  - 'Viral loop : chaque session expose la plateforme aux viewers (overlay visible)'
growth:
  - 'Viral loop : overlay visible par les viewers → spectateurs deviennent streamers'
  - 'CTA overlay : "Tu veux organiser ton propre blindtest ?" → pipeline viewer→streamer'
  - 'Clip de victoire hebdo partageable (Twitter/TikTok)'
  - 'Leaderboard public embeddable (widget iframe)'
architecture_decisions:
  - 'ADR-01 : Modular Monolith TypeScript (MVP), extraction microservices si besoin'
  - 'ADR-02 : GamePlugin interface contrat strict typé (non négociable)'
  - 'ADR-03 : Redis état live + PostgreSQL flush fin de session (jeux hebdo uniquement)'
  - 'ADR-04 : Scoring 100% backend — jamais côté client (sécurité non négociable)'
  - 'ADR-05 : Tokens Twitch côté serveur uniquement — JWT applicatif pour le frontend'
  - 'ADR-06 : Row-Level Security PostgreSQL + tenant_id sur chaque table'
---

# Product Requirements Document - Playground

**Author:** Desty Le Boss
**Date:** 2026-02-24

## Executive Summary

A multi-tenant SaaS platform that transforms Twitch streamer communities into competitive teams through interactive chat-based mini-games. Streamers deploy game sessions — blindtest, quiz, guess the movie/clip, lyrics challenge, and more — directly to their Twitch chat in under 2 minutes, with zero manual configuration. The platform creates a cross-community competitive layer through weekly official playlists: all participating streamers play the same content, scores are normalized by participation rate, and a public inter-community leaderboard determines which community best mastered the week's challenge.

The target segment is mid-tier streamers (500–5,000 concurrent viewers) — large enough for mini-games to be engaging, underserved by tools that are either too generic (Jackbox) or too complex (custom bot setups). The platform monetizes via freemium: a functional free tier with playlist and game limits, a Pro tier (~15€/month) unlocking unlimited playlists and all mini-games, and a Studio tier (~29€/month) adding custom CSS overlays, a cosmetic theme shop, and advanced analytics.

The streamer is the host, not a bot operator. Human interactions — humor, hints, reactions — remain the streamer's domain. The platform handles mechanical tasks: answer validation, score calculation, overlay rendering, and leaderboard management.

### What Makes This Special

**Network-effect moat:** The inter-community leaderboard gains value as the streamer base grows. A platform with 100 streamers offers limited competition; at 10,000 streamers, it becomes a cultural event. This effect is self-reinforcing and defensible against feature-copying competitors.

**Normalized competition:** Communities are ranked by answer success rate (%), not absolute points. A 30-person community scoring 92% beats a 500-person community at 61%. Competition is equitable regardless of audience size — preventing large communities from dominating and discouraging smaller ones.

**Extensible game engine:** All mini-games implement a shared `GamePlugin` interface (`onSessionStart`, `onChatMessage`, `onStreamerAction`, `onReveal`, `onSessionEnd`). New game types are additive, not architectural rewrites. The blindtest is plugin #1; quiz, akinator, guess the movie, guess the clip, and guess the lyrics follow the same contract.

**Platform-agnostic architecture:** A `StreamingProvider` abstraction decouples the platform from Twitch. Twitch is adapter #1; Kick and YouTube Live are subsequent adapters. API policy changes by any single platform do not threaten the product.

**Viral loop by design:** Every game session is a live advertisement — the overlay is visible to all viewers. High-engagement viewers see a CTA to host their own sessions. The weekly leaderboard generates shareable results. Growth is product-led, not paid.

## Project Classification

| Dimension | Value |
|---|---|
| **Project Type** | SaaS Web App — multi-tenant, freemium |
| **Domain** | Entertainment Tech / Streaming Tools |
| **Complexity** | High — real-time systems, third-party API dependencies, plugin architecture, multi-tenant isolation |
| **Project Context** | Brownfield-to-greenfield rewrite — existing single-tenant client-side app replaced by production-grade SaaS platform |
| **Primary Segment** | Mid-tier Twitch streamers, 500–5,000 concurrent viewers |
| **Secondary Segment** | Viewer communities seeking cross-platform competitive identity |
| **Monetization** | Freemium — Free / Pro (~15€/mo) / Studio (~29€/mo) |
| **Go-to-Market** | Private beta (20 streamers) → organic word-of-mouth → product-led growth |

## Success Criteria

### User Success

**Streamer (Primary User)**
- Launches first game session in under 2 minutes from account creation (zero-config Twitch OAuth onboarding — non-negotiable north star metric)
- Runs a full game session without using a mouse (hotkey-driven dashboard)
- Bot reconnects automatically and silently after a connection drop (no visible interruption to the stream)
- Platform handles all answer validation, scoring, and overlay updates without streamer intervention
- Exports session scores in one click at session end
- Resumes a previous session by importing a score file in under 30 seconds

**Streamer (Audio)**
- Connects Spotify or YouTube account via OAuth in one click
- Imports existing playlists directly from connected platform (no manual song entry required)
- Spotify: audio plays in-app via Web Playback SDK (requires Premium); fallback notice displayed if no Premium
- YouTube: audio plays in-app via iframe embed (free, no Premium required)
- Both providers available at MVP — streamer chooses based on their setup

**Viewer (Secondary User)**
- Sees their name and score on the overlay within 500ms of a correct answer
- Has a public profile showing their participation history across streams
- Understands competition rules without reading documentation (self-explanatory overlay and chat feedback)
- Receives clear feedback when an answer is wrong, arrives too late, or earns partial points

### Business Success

**3-Month Targets (Private Beta)**
- 20 streamers complete at least 3 game sessions each
- Zero critical bot failures during live sessions
- Net Promoter Score > 7/10 from beta streamers
- Onboarding time < 2 minutes validated with real users

**12-Month Targets (Post-Launch)**
- 500+ active streamers (minimum 1 session/week)
- 5%+ free-to-Pro conversion rate
- ~7,500€ MRR (500 Pro × 15€)
- 20%+ of Pro streamers opt into the inter-community leaderboard
- J30 streamer retention > 40%
- Organic growth (viewer→streamer pipeline) accounts for >30% of new signups

**Moat Indicators**
- Inter-community leaderboard participation grows week-over-week (network effect activation)
- CSS theme shop generates its first community creator submission within 6 months

### Technical Success

- Bot reconnection < 5 seconds after connection drop, invisible to viewers
- Overlay update latency < 300ms p95 from answer validation to display
- Chat message processing sustains 10,000 messages/minute without score calculation degradation
- Platform availability 99.5% during peak stream hours (18h–24h CET)
- Zero score data loss on server crash (Redis persistence + flush-on-end)
- Multi-tenant isolation: one tenant's session failure has zero impact on others
- All OAuth tokens stored server-side only — never exposed to frontend

### Measurable Outcomes

| Metric | Target | Timeline |
|---|---|---|
| First game launch time | < 2 minutes | At onboarding |
| Bot reconnection time | < 5 seconds | At all times |
| Overlay latency | < 300ms p95 | At all times |
| Active streamers | 500+ | Month 12 |
| Free→Pro conversion | > 5% | Month 12 |
| MRR | ~7,500€ | Month 12 |
| J30 streamer retention | > 40% | Month 3+ |
| Leaderboard opt-in rate | > 20% of Pro | Month 12 |
| Organic signup share | > 30% | Month 12 |

## Product Scope

### MVP — Minimum Viable Product

**Core Platform**
- Twitch OAuth onboarding (zero manual config)
- Multi-tenant architecture with full session isolation
- Session-scoped bot (starts/stops with dashboard session)
- Scoring engine 100% server-side (no client-side calculation)

**Audio / Media**
- Dual authentication: Twitch OAuth (bot/chat) + Audio Platform OAuth (playlist import + playback)
- AudioProvider abstraction: each provider owns authenticate(), importPlaylists(), and play()
- Spotify Provider: OAuth → playlist import → in-app playback via Web Playback SDK (Premium required); graceful fallback notice if no Premium
- YouTube Provider: OAuth → playlist import → in-app playback via iframe embed (free)
- Video embed support for Guess the Movie / Guess the Clip: YouTube iframe + Twitch Clips embed (link-based, no file hosting)
- No audio or video file hosting by the platform

**Games (MVP: 2)**
- Blindtest (full rewrite — server-side matching, progressive scoring)
- Quiz (custom questions by streamer — multiple choice or open answer)

**Dashboard (Streamer)**
- Session management (create, launch, pause, end)
- Régie mode (hotkey-driven, mouse-free operation)
- Rebindable hotkeys
- Score export (CSV/JSON) with end-of-session prompt
- Score import (resume previous session)
- Separate score table per game type per session

**Overlay (OBS)**
- Modular widgets via unique URL per streamer
- SSE-based updates (no polling)
- Basic theme (2 variants)
- Viewer→streamer CTA embedded in overlay

**Community**
- Intra-community leaderboard (per session, per game type)
- Basic viewer profile (participation history, badges placeholder)

**Freemium Gates**
- Free: 3 custom playlists max, Blindtest only, basic overlay theme, Spotify or YouTube connection
- Pro (~15€/mo): Unlimited playlists, all MVP games, score export/import, both audio providers

### Growth Features (Post-MVP — V2)

- Mini-games: Akinator/20Q, Guess the Lyrics, Guess the Movie, Guess the Clip
- Weekly official playlist (curated, play-once, auto-persisted scores)
- Inter-community leaderboard (opt-in, normalized % scoring, leagues by size)
- CSS theme shop (purchase + live preview before buy)
- Custom CSS overlays (Studio tier)
- Streamer analytics (participation heatmap, playlist difficulty, viewer retention)
- Playlist marketplace (share, rate, discover community playlists)
- Shareable victory clip (weekly leaderboard result)
- Kick streaming platform support (StreamingProvider adapter #2)
- Additional AudioProviders: Deezer, SoundCloud
- Automatic playlist metadata enrichment (genre, difficulty tags) from provider API
- Studio tier (~29€/mo): CSS custom + shop + advanced analytics + priority support

### Vision — Future

- Seasonal competitive rankings (quarterly reset, season-exclusive cosmetics)
- Cross-stream viewer ELO (persistent viewer rating across all streams)
- Inter-streamer duo mode (two communities compete in real-time across two streams)
- AI-generated quiz questions (topic input → 10 questions in seconds, Studio tier)
- CSS theme creator marketplace (revenue sharing with theme creators)
- Twitch Channel Points integration (power-ups: hint, double points, timer freeze)
- YouTube Live and Discord Stage as StreamingProvider adapters
- Apple Music, SoundCloud AudioProvider adapters

## User Journeys

### Journey 1 — Thomas, Streamer Mid-Tier (Success Path)

**Persona:** Thomas, 28 ans, 1,200 viewers en moyenne. Il stream les soirs de semaine sur Twitch — gaming et IRL. Sa commu est fidèle mais il sent que les streams "classiques" s'essoufflent. Il cherche un format différent qui crée de vrais moments collectifs, sans passer 3 heures à configurer un bot.

**Opening Scene — Le Problème**
Thomas a essayé plusieurs bots Twitch pour des mini-jeux. À chaque fois, le même scénario : fichier de config JSON à remplir manuellement, token OAuth introuvable, bot qui plante en direct devant 1000 viewers. Il a abandonné. Ce soir, un autre streamer qu'il suit mentionne la plateforme dans son chat — sa commu vient de gagner le leaderboard de la semaine.

**Rising Action — La Découverte**
Thomas clique sur le lien dans le panel Twitch. La landing page affiche une seule action : "Connecte-toi avec Twitch". Il clique. Il autorise. Il est dans le dashboard en 45 secondes. Un wizard lui demande : "Connecte ta plateforme musicale" — il choisit Spotify, autorise en un clic, et ses playlists apparaissent instantanément. Il sélectionne sa playlist "Années 90 FR", choisit le mode Blindtest, et voit un aperçu de l'overlay OBS s'afficher à droite. Il copie l'URL overlay, l'ajoute dans OBS en 30 secondes. Temps écoulé depuis son arrivée sur le site : 1 minute 47 secondes.

**Climax — Le Premier Live**
Thomas lance son stream. Il dit à sa commu : "Ce soir on fait un blindtest, ça va faire mal." Il appuie sur Space. La première chanson commence à jouer dans Spotify. L'overlay OBS affiche un compte à rebours animé. Son chat explose. La première personne à trouver voit son pseudo s'afficher en grand dans l'overlay avec une animation. Thomas appuie sur Space à nouveau — chanson suivante. Il ne touche pas sa souris une seule fois pendant les 40 minutes de session.

**Resolution — La Nouvelle Réalité**
En fin de session, le dashboard lui propose : "Voulez-vous exporter les scores ?" Il télécharge le CSV. Sa commu lui demande déjà quand est le prochain blindtest. Il remarque dans la barre latérale : "Playlist officielle de la semaine — jouez avec votre commu et entrez dans le classement." Il active l'opt-in. Il est accroché.

---

### Journey 2 — Thomas, Streamer (Edge Case — Bot Disconnect en Direct)

**Opening Scene — L'Urgence**
Thomas est en direct, 800 viewers, 25 minutes dans un blindtest. Chanson 12 sur 20. Sa connexion internet fait un micro-drop de 3 secondes. Il ne s'en rend pas compte.

**Rising Action — La Crise Silencieuse**
Le bot Twitch a perdu sa connexion IRC. En coulisses, le backend détecte la déconnexion en moins d'une seconde et lance une reconnexion automatique avec backoff exponentiel. L'overlay affiche discrètement une icône "⟳" pendant 4 secondes. Dans le chat, les messages continuent d'affluer normalement côté Twitch — le bot n'est pas encore reconnecté, les réponses de cette fenêtre seront traitées en file d'attente à la reconnexion.

**Climax — La Résolution Invisible**
4,2 secondes après la déconnexion, le bot est reconnecté. Il traite la file d'attente des réponses du chat. Le premier à avoir répondu pendant la coupure reçoit ses points normalement. L'icône "⟳" disparaît de l'overlay. Thomas n'a rien vu. Sa commu n'a rien vu. Le stream continue. Dans son dashboard, une notification discrète : "Reconnexion bot — 4,2s — aucune donnée perdue."

**Resolution — La Confiance Installée**
Thomas finit sa session. Il exporte ses scores. Plus tard, il raconte en stream : "Le bot a replanché une seconde, mais ça n'a rien cassé." Sa confiance dans la stabilité de la plateforme est établie. Il la recommande à d'autres streamers.

---

### Journey 3 — Léa, Viewer Compétitive (Secondary User)

**Persona:** Léa, 22 ans, étudiante. Regarde 4-5 streams par semaine, dont 2 qui utilisent la plateforme. Elle adore les jeux et elle est compétitive — elle finit souvent dans le top 3 des blindtests de sa commu préférée.

**Opening Scene — L'Engagement**
Léa répond "Daft Punk" dans le chat. L'overlay affiche son pseudo avec une animation "1ère — 100 pts". Elle est première. Elle ressent quelque chose qu'elle ne ressent pas dans les autres streams : elle existe dans ce stream, son nom est visible pour tout le monde.

**Rising Action — La Découverte de Son Profil**
Dans l'overlay, elle voit un petit CTA discret : "Voir mon profil". Elle clique. Une page publique affiche son historique : 12 sessions jouées, score moyen, badge "Top 3 commu — 5 fois de suite". Elle partage le lien dans son Discord.

**Climax — La Compétition Intercommunautaire**
Le streamer annonce qu'il participe à la playlist officielle de la semaine. L'overlay affiche un badge "Playlist Officielle". Léa sait que ses points comptent maintenant dans le classement global. Elle joue différemment — plus concentrée. Sa commu finit 4ème cette semaine sur 127 streamers participants. Elle screenshot le classement et le poste sur Twitter.

**Resolution — La Fidélité**
Léa revient chaque semaine pour la playlist officielle. Elle a commencé à regarder d'autres streamers qui utilisent la plateforme pour comparer les niveaux. La plateforme est devenue son lien entre différentes commus Twitch.

---

### Journey 4 — Alex, Platform Admin (Operations)

**Persona:** Alex est dans l'équipe fondatrice. Il gère la curation de la playlist officielle hebdomadaire, monitore la santé des sessions en production, et traite les signalements d'abus.

**Opening Scene — Le Lundi Matin**
Chaque lundi à 10h, Alex ouvre l'interface admin. Cette semaine : thème "Rap FR 2000–2015". Il a 30 chansons candidates dans une liste préparée. Il en sélectionne 20, ajuste l'ordre de difficulté (des évidentes aux pointues), et programme la révélation pour lundi minuit.

**Rising Action — Le Monitoring**
Pendant la semaine, Alex surveille le dashboard de monitoring : sessions actives, bots connectés, erreurs de reconnexion, charge Redis. Un streamer signale que son overlay ne s'actualise plus — Alex identifie en 2 minutes que c'est un problème de token SSE expiré, il force un refresh depuis l'interface admin. Résolu sans que le streamer ait besoin de faire quoi que ce soit.

**Climax — Le Dimanche Soir**
52 streamers ont joué la playlist cette semaine. Alex vérifie les scores suspects (réponses à 180ms — potentiellement automatisées). Il voit 3 comptes avec des patterns anormaux et les met en quarantaine manuelle. À minuit, il publie le classement officiel.

**Resolution — La Mécanique qui Tourne**
Alex prépare la playlist de la semaine suivante. Il note que les chansons de 1995–2000 ont généré le plus de réponses — il en met davantage la semaine suivante.

---

### Journey 5 — Léa, Viewer → Streamer (Viral Loop)

**Opening Scene — La Tentation**
Léa a joué dans 20 sessions sur 3 streams différents. Elle a 200 followers sur Twitch et streame occasionnellement. Ce soir, pendant un blindtest, elle voit dans l'overlay un badge discret : "Tu veux organiser ton propre blindtest ? →"

**Rising Action — La Conversion**
Elle clique. Une landing page s'ouvre : "Ton premier blindtest en 2 minutes." Elle est déjà connue de la plateforme via son profil viewer — elle clique "Créer un compte streamer" et ses infos Twitch sont pré-remplies. Elle connecte Spotify. Elle crée une playlist de 10 chansons depuis ses favoris. Elle lance un test privé, sans stream.

**Climax — Le Premier Stream**
3 jours plus tard, Léa annonce à ses 200 followers : "Ce soir, blindtest chez moi." Elle a 45 viewers. Petit mais vivant. Ses viewers jouent. Elle voit leurs noms dans l'overlay. Elle ressent exactement ce que Thomas ressentait le soir de sa découverte.

**Resolution — Le Réseau Grandit**
Léa est maintenant streamer sur la plateforme. Elle a apporté 45 nouveaux viewers potentiels. L'un d'eux deviendra peut-être le prochain streamer. La boucle virale est bouclée.

---

### Journey Requirements Summary

| Capability Area | Revealed By |
|---|---|
| Two-step OAuth onboarding (Twitch + Audio platform) | Journey 1 |
| Playlist import from Spotify / YouTube | Journey 1 |
| Hotkey-driven dashboard, mouse-free session control | Journey 1 |
| OBS overlay URL with instant preview | Journey 1 |
| End-of-session score export prompt | Journey 1 |
| Weekly playlist opt-in from dashboard | Journey 1 |
| Auto bot reconnection (< 5s, silent, queue recovery) | Journey 2 |
| Session state persistence through disconnection | Journey 2 |
| Post-event dashboard notification log | Journey 2 |
| Viewer public profile (from overlay CTA) | Journey 3 |
| Participation history, badges, streaks | Journey 3 |
| Official playlist badge on overlay | Journey 3 |
| Public inter-community leaderboard (shareable) | Journey 3 |
| Admin: playlist curation and scheduling | Journey 4 |
| Admin: real-time monitoring (sessions, bots, errors) | Journey 4 |
| Admin: remote session intervention | Journey 4 |
| Admin: anti-cheat quarantine tooling | Journey 4 |
| Viewer→streamer CTA in overlay | Journey 5 |
| Pre-populated streamer onboarding from viewer profile | Journey 5 |
| Private session test mode (no live required) | Journey 5 |

## Domain-Specific Requirements

### Compliance & Regulatory

**GDPR (EU)**
- Viewer profiles constitute personal data linked to Twitch accounts → explicit consent required at profile creation
- Participation history stored → right to erasure implemented (30-day soft delete)
- Score export (CSV/JSON) satisfies data portability requirements by design
- Data hosted in EU region for primarily European audience
- Platform not directed at users under 13 (aligned with Twitch ToS); stated in Terms of Service

**Digital Services Act (DSA)**
- Below 45M active users threshold → lightweight obligations apply
- Documented content moderation policy required at MVP
- Report/flag mechanism for abusive playlists and quiz content required at MVP

**Third-Party Platform Terms of Service**
- Twitch API ToS: bots must not simulate human interaction, respect rate limits (800 msg/30s per IRC connection), OAuth tokens must be user-revocable → architecture compliant (server-side tokens, session-scoped bot)
- Spotify ToS: Web Playback SDK permitted for web apps; requires Premium account → disclosed clearly in onboarding flow
- YouTube API ToS: iframe embed permitted; ContentID-blocked videos may fail to load → fallback UI required with clear user message

**Intellectual Property**
- Platform does not play audio directly — playback fully delegated to provider (Spotify, YouTube) which manages its own licenses
- No direct music licensing liability for the platform
- Song metadata (title, artist) stored in DB for answer validation only — no audio content hosted

### Payments & Subscriptions

- Payment processing fully delegated to Stripe or Paddle — zero PCI-DSS scope for the platform
- No card data ever touches platform servers
- Subscription lifecycle managed via webhooks (`subscription.activated`, `subscription.cancelled`, `subscription.updated`) → triggers role update in DB
- Invoicing and tax compliance handled by payment provider

### Data Ownership & Portability

- Playlists belong to the streamer, not the platform — exportable at any time (CSV/JSON)
- Account deletion: streamer playlists in marketplace anonymized (not deleted) after 30-day grace period
- Session scores (normal games): ephemeral by design, deleted after session unless exported
- Weekly official game scores: retained anonymized for historical leaderboard integrity
- Viewer profiles: deleted on request within 30 days

### Security Requirements

- All OAuth tokens (Twitch, Spotify, YouTube) encrypted at rest (AES-256), never logged
- HTTPS enforced on all routes (automatic TLS)
- Automatic rotation of expiring OAuth tokens
- Admin action audit log (actor, action, timestamp) — immutable
- Rate limiting on public API endpoints (leaderboard scraping protection)
- No email or PII from payment provider stored on platform servers

### Availability & Operations

- SLA target: 99.5% uptime during peak streaming window (18h–24h CET)
- Scheduled maintenance: 03h–07h CET only
- Public status page (statuspage.io or equivalent) — mandatory at MVP launch
- Automated incident notification (Discord webhook / email) for incidents > 5 minutes

### Accessibility

- MVP: sufficient contrast on overlays (readable during stream), keyboard navigation on dashboard
- V2: WCAG 2.1 AA compliance on public-facing site (leaderboards, profiles, marketplace)

## Innovation & Novel Patterns

### Detected Innovation Areas

**Innovation #1 — Inter-Community Competitive Layer on Streaming**
No existing streaming tool creates cross-community competitive ranking. Twitch has raids, host mode, and gifted subs — but no mechanism for communities to compete against each other on a shared objective. The weekly official playlist creates a first-ever structured competition between Twitch communities, measured objectively (% success rate) and ranked publicly. This is analogous to what Wordle did for word games — a shared daily object creating a collective cultural moment — applied to streaming communities at scale.

Novel combination: Streaming tool infrastructure × Esports competitive mechanics × Cultural event scheduling.

**Innovation #2 — Normalized Community Scoring (% Rate Equalization)**
Existing leaderboard products rank by absolute score, inherently favoring larger communities. Ranking communities by answer success rate (%) rather than total points makes competition equitable across community sizes — a 30-viewer community can legitimately beat a 5,000-viewer community. This design decision is the mechanism that makes the inter-community layer viable rather than demotivating for mid-tier streamers.

**Innovation #3 — GamePlugin Architecture for Streaming**
Treating streaming mini-games as interchangeable plugins on a shared engine (chat integration, scoring, overlay rendering) has not been done at the product level. Existing tools (Streamlabs, StreamElements) provide isolated features, not a composable game framework. The `GamePlugin` interface (`onSessionStart`, `onChatMessage`, `onStreamerAction`, `onReveal`, `onSessionEnd`) creates an extensible primitive that no competitor currently offers.

**Innovation #4 — Viral Loop Baked Into the Product Surface**
The viewer-to-streamer conversion CTA embedded directly in the OBS overlay is a novel distribution mechanic. The product's primary advertising surface IS the product itself — every stream session simultaneously delivers value to the current streamer and recruits future streamers from the live audience.

**Innovation #5 — Audio Source Abstraction for Game Logic**
Decoupling audio playback (delegated to Spotify/YouTube) from game logic (answer matching, scoring) solves a licensing problem no competitor has cleanly addressed. The AudioProvider abstraction enables legal, seamless audio in a game context without platform liability.

### Market Context & Competitive Landscape

**Direct Competitors:**
- Jackbox Games: standalone party games, not Twitch-native, no persistent community identity, no cross-community competition, requires purchase per game
- StreamElements/Streamlabs Overlays: static overlays, no interactive game logic, no scoring engine, no community competition layer
- Custom Twitch bots (Fossabot, Nightbot): general-purpose bots, no game framework, no scoring, high technical barrier to setup

**Adjacent Inspirations (not competitors):**
- Wordle: shared daily challenge → collective cultural moment (our weekly playlist)
- Duolingo: streak mechanics, leagues, normalized competition (our community leagues by size)
- Chess.com: club vs club competition, ELO, shareable results (our inter-community leaderboard)

**Market Gap:** No product currently combines (1) zero-config Twitch integration, (2) extensible game engine with multiple game types, and (3) cross-community competitive ranking.

### Innovation Validation Signals

| Innovation | Validation Signal | Target |
|---|---|---|
| Inter-community competition | % of beta streamers opting into weekly leaderboard within 2 weeks | > 50% |
| Normalized scoring | Small-community survey: perceived fairness score | > 7/10 |
| GamePlugin architecture | Engineering hours for game #2 vs. game #1 | < 40% |
| Viral loop CTA | % viewers clicking CTA who complete onboarding within 7 days | > 15% |
| Audio abstraction | % streamers completing onboarding with Spotify OR YouTube connected | > 80% |

## SaaS B2B Specific Requirements

### Multi-Tenant Architecture

**Isolation Model:** Shared database with Row-Level Security (PostgreSQL RLS) enforced at the database layer. Every table containing tenant data includes a `tenant_id` column. RLS policies ensure queries from one tenant context never return another tenant's data — even in the event of application-layer bugs.

**Tenant Lifecycle:**
- Created on first Twitch OAuth login (auto-provisioned)
- Suspended on subscription cancellation (data retained, features locked)
- Deleted on explicit account deletion (30-day grace period, then permanent)
- Viewer accounts: lightweight, created on explicit opt-in only

**Session Isolation:**
- Each active game session lives in a Redis namespace keyed by `{tenantId}:{sessionId}`
- Bot process assigned per session, not per tenant — no shared bot state
- One tenant's session failure has zero impact on other tenants

### Permission Model (RBAC)

| Role | Access Scope | Provisioned By |
|---|---|---|
| **Platform Admin** | Full platform access, curation tools, monitoring, moderation queue | Manual (founding team) |
| **Studio Streamer** | Full streamer features + CSS custom + theme shop + advanced analytics | Stripe/Paddle Studio subscription |
| **Pro Streamer** | All games, unlimited playlists, export/import, basic analytics | Stripe/Paddle Pro subscription |
| **Free Streamer** | Blindtest only, 3 playlists max, basic overlay themes | Auto on Twitch OAuth |
| **Viewer** | Public profile, participation history, leaderboard view | Auto on first profile opt-in |
| **Anonymous Viewer** | Overlay view only (read-only, no account required) | No provisioning needed |

**Permission Enforcement:**
- JWT payload includes `{ tenantId, role, subscriptionStatus }`
- Backend middleware validates role on every protected route
- Feature flags in DB allow granular overrides (beta features, trial periods)
- Subscription status checked on JWT refresh — cached 5 minutes

### Subscription Tiers

| Feature | Free | Pro (~15€/mo) | Studio (~29€/mo) |
|---|---|---|---|
| Custom playlists | 3 max (20 songs each) | Unlimited | Unlimited |
| Games available | Blindtest only | All MVP games | All games incl. V2 |
| Audio providers | Spotify OR YouTube | Spotify + YouTube | All providers |
| Score export / import | ✗ | ✅ | ✅ |
| Overlay themes | 2 basic | 5 themes | Full shop access |
| Custom CSS overlay | ✗ | ✗ | ✅ |
| Analytics | Session summary only | Basic (heatmap, difficulty) | Advanced + retention |
| Inter-community leaderboard | ✗ | Opt-in | Opt-in + highlighted |
| Support | Community forum | Email (48h) | Priority (24h) |
| Weekly official playlist | Opt-in (view only) | Opt-in + participate | Opt-in + participate |

**Subscription Management:**
- Stripe or Paddle handles billing, invoicing, and tax
- Webhooks: `subscription.created`, `subscription.updated`, `subscription.cancelled`, `payment.failed`
- Role updated in DB within 60 seconds of webhook receipt
- 7-day grace period on `payment.failed` before downgrade to Free

### Integration List

| Integration | Purpose | Auth | MVP/V2 |
|---|---|---|---|
| Twitch IRC / Chat | Bot reads chat, sends announcements | OAuth 2.0 server-side | MVP |
| Twitch API | User identity, channel info | OAuth 2.0 server-side | MVP |
| Spotify Web API | Playlist import, track metadata | OAuth 2.0 server-side | MVP |
| Spotify Web Playback SDK | In-app audio (Premium required) | SDK client-side | MVP |
| YouTube Data API v3 | Playlist import, video metadata | OAuth 2.0 server-side | MVP |
| YouTube iframe API | In-app video/audio playback | iframe embed | MVP |
| Stripe / Paddle | Subscription billing | API key + Webhooks | MVP |
| OBS Browser Source | Overlay delivery via SSE | Token in URL | MVP |
| Twitch Clips API | Video embed for Guess the Clip | Public embed | V2 |
| Kick API | Alternative streaming platform | OAuth 2.0 | V2 |
| Discord Webhooks | Leaderboard notifications | Webhook URL | V2 |

### Implementation Considerations

**Database Schema Principles:**
- `tenant_id` UUID on every tenant-scoped table (indexed)
- RLS policies enabled at schema creation
- Soft delete pattern (`deleted_at`) across all entities
- Event log table for audit trail (admin actions, subscription changes)

**Stateless Bot Design:**
- Bot processes are stateless between sessions
- All game state lives in Redis (not in bot process memory)
- Bot crash → Redis state survives → new process picks up on reconnect
- Enables horizontal scaling: multiple bot workers, load-balanced

**Deployment Strategy:**
- Modular monolith containerized (Docker)
- Railway, Render, or Fly.io for initial hosting
- Redis: managed (Upstash or Railway Redis)
- PostgreSQL: managed (Supabase, Neon, or Railway Postgres)
- CDN: Cloudflare for static assets

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Platform MVP + Revenue MVP hybrid — the product must exist as a complete platform (multi-tenant, stable bot, overlay, scoring engine) even for the first user. No smoke-test version is viable for a real-time interactive product. Monetization is activated at MVP to validate willingness to pay.

**Validation Gate:** 20 streamers × minimum 3 live sessions → NPS > 7/10 + onboarding < 2 minutes validated in real conditions before public launch.

**Resource Requirements:** Minimum viable team: 1 full-stack engineer + 1 PM/designer. Ideal: 2 full-stack engineers + 1 designer. Hosted services (Railway/Supabase/Upstash) eliminate ops burden at MVP scale.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- Journey 1 (Thomas success path): full blindtest session in < 2 min from account creation
- Journey 2 (Thomas edge case): silent bot reconnection < 5s, zero data loss
- Journey 3 (Léa viewer): public profile + intra-community leaderboard
- Journey 4 (Alex admin): platform monitoring + weekly playlist curation
- Journey 5 (Léa → streamer viral loop): overlay CTA → pre-populated onboarding

**Must-Have Capabilities:**

| Capability | Justification |
|---|---|
| Twitch OAuth zero-config onboarding | North star: < 2 min. Drop-off guaranteed without this |
| Spotify OAuth + Web Playback SDK (Premium) | Core audio path #1 — validated at MVP |
| YouTube OAuth + iframe embed playback (free) | Core audio path #2 — free alternative to Spotify Premium |
| Blindtest (full server-side rewrite) | Core value proposition — founding game |
| Quiz (custom streamer questions) | Game #2 — validates GamePlugin extensibility at MVP |
| Hotkey-driven dashboard + rebindable shortcuts | Mouse-free session control — Thomas journey requirement |
| OBS Overlay via SSE + unique URL per streamer | Live viewer experience — no overlay = no product |
| Session management (create, launch, pause, end) | Basic streamer control |
| Automatic bot reconnection (< 5s, silent, queue recovery) | Platform credibility — bot reliability non-negotiable |
| Score export (CSV/JSON) with end-of-session prompt | GDPR portability + user decision |
| Score import (resume previous session) | User decision |
| Separate score table per game type per session | User decision — no universal score |
| Multi-tenant isolation (PostgreSQL RLS + Redis namespaced) | Security non-negotiable |
| Scoring engine 100% server-side | ADR-04 — security non-negotiable |
| Viewer public profile (from overlay CTA) | Viral loop requires public identity |
| Viewer→Streamer CTA in overlay | Viral loop at MVP — not V2 |
| Intra-community leaderboard (per session, per game type) | Basic competition layer |
| Freemium gates (Free / Pro ~15€/mo) | Revenue from day one |
| Stripe or Paddle subscription billing + webhooks | No monetization without this |
| Admin: session monitoring + bot health dashboard | Journey 4 — required for beta operations |
| Admin: weekly playlist curation + scheduling tools | Journey 4 — core admin workflow |
| Public status page | Minimum viable operations transparency |

**Can be manual at MVP (temporary):**

| Capability | Manual Approach |
|---|---|
| Advanced analytics | Manual DB queries by founding team |
| CSS custom overlays (Studio tier) | Manually delivered by team for early Studio customers |
| Discord webhook notifications | Manual DM by admin during beta |

### Post-MVP Features

**Phase 2 — Growth (Months 4–10):**
- Mini-games: Akinator/20Q, Guess the Lyrics, Guess the Movie, Guess the Clip
- Weekly official playlist (curated, play-once, auto-persisted scores)
- Inter-community leaderboard (opt-in, normalized % scoring, size-based leagues)
- CSS theme shop (purchase + live preview)
- Custom CSS overlays (Studio tier — automated delivery)
- Streamer analytics dashboard (participation heatmap, playlist difficulty, viewer retention)
- Playlist marketplace (share, rate, discover community playlists)
- Shareable weekly victory clip (Twitter/TikTok format)
- Embeddable leaderboard widget (iframe)
- Kick streaming platform support (StreamingProvider adapter #2)
- Additional audio providers: Deezer, SoundCloud
- Studio tier (~29€/mo) formalized

**Phase 3 — Expansion (Months 10–18+):**
- Seasonal competitive rankings (quarterly reset, season-exclusive cosmetics)
- Cross-stream viewer ELO (persistent rating across all streams)
- Inter-streamer duo mode (two communities compete in real-time)
- AI-generated quiz questions (topic input → 10 questions in seconds, Studio tier)
- CSS theme creator marketplace with revenue sharing
- Twitch Channel Points integration (power-ups: hint, double points, timer freeze)
- YouTube Live and Discord Stage as StreamingProvider adapters
- Apple Music, SoundCloud AudioProvider adapters

### Risk Mitigation Strategy

**Technical Risks:**

| Risk | Impact | Mitigation |
|---|---|---|
| Spotify Premium requirement excludes streamers | Medium | YouTube free alternative at MVP; clear Premium notice in Spotify onboarding flow |
| Twitch/Spotify/YouTube API breaking changes | High | StreamingProvider + AudioProvider abstractions (ADR-01/02) — API change = adapter change only |
| Redis bottleneck at very high load (50k+ viewers) | Medium | Stateless bot design (ADR-03); Redis clustering architecture prepared but not activated at MVP |
| GamePlugin complexity underestimated for game #2 | Medium | 2 games shipped at MVP validates interface before committing to V2 game slate |

**Market Risks:**

| Risk | Impact | Mitigation |
|---|---|---|
| Beta adoption below 20 streamers | High | Direct outreach to 50+ mid-tier streamers before launch; free Pro tier during beta |
| Inter-community leaderboard empty at launch | High | Size-based leagues (viable at 5+ streamers); seed with 20 beta streamers |
| Competitor copies feature set | Medium | Network effect moat — copying features does not copy streamer base |
| Streamers expect more games at MVP | Medium | Clear V2 roadmap communicated to beta users; Quiz proves plugin extensibility on day one |

**Resource Risks:**

| Risk | Impact | Mitigation |
|---|---|---|
| Small team (solo or duo developer) | High | Modular Monolith (ADR-01) = maintainable mono-repo; Railway/Supabase/Upstash = zero ops overhead |
| Bot stability under live load | High | Stateless bot design (ADR-03) — bot crash loses no data; Redis state survives independently |
| Scope creep before beta | Medium | North star gate: a streamer can run a blindtest in < 2 min. If true → ship beta. No exceptions. |

## Functional Requirements

### Account & Tenant Management

- **FR1:** Streamer can authenticate to the platform using their Twitch account without manual configuration
- **FR2:** Streamer can connect a Spotify account to import playlists and enable in-app audio playback
- **FR3:** Streamer can connect a YouTube account to import playlists and enable in-app video/audio playback
- **FR4:** Streamer can disconnect and reconnect audio platform accounts independently from their Twitch session
- **FR5:** Viewer can create a profile (no password required — Twitch identity only) by opting in directly from a stream overlay
- **FR6:** Platform automatically provisions an isolated tenant namespace for each new streamer on first login
- **FR7:** Streamer can permanently delete their account with a 30-day grace period before data removal
- **FR8:** Viewer can request erasure of their profile and participation history

### Content & Playlist Management

- **FR9:** Streamer can create custom playlists by manually entering song or question metadata
- **FR10:** Streamer can import playlists directly from their connected Spotify or YouTube account
- **FR11:** Streamer can organize, edit, rename, and delete their custom playlists
- **FR12:** Streamer can export their playlists at any time in a portable format
- **FR13:** Any user can report playlist or quiz content for platform moderation review

### Game Session Management

- **FR14:** Streamer can create a game session by selecting a game type and an associated playlist or question set
- **FR15:** Streamer can launch, pause, resume, and end a game session from the dashboard
- **FR16:** Streamer can control session flow entirely using rebindable keyboard shortcuts without a mouse
- **FR17:** Streamer can run a private test session without streaming live on Twitch
- **FR18:** Streamer can import a previously exported score file to resume cumulative scoring from a prior session
- **FR19:** Streamer can export session scores at any time, with an automatic prompt presented at session end
- **FR20:** System maintains a separate, independent score table per game type within a single session
- **FR21:** Streamer can view a real-time event log of bot status, reconnection events, and session alerts in the dashboard

### Game Engine & Chat Integration

- **FR22:** System validates viewer answers submitted via Twitch chat against the active challenge in real-time
- **FR23:** System awards progressive points to the first correct respondent and to subsequent correct respondents within a configurable time window
- **FR24:** System supports the Blindtest game type: streamer controls audio revelation; viewers answer the song title or artist in chat
- **FR25:** System supports the Quiz game type: streamer presents questions; viewers submit text answers in chat
- **FR26:** Bot automatically reconnects to Twitch IRC following a connection drop, without session data loss
- **FR27:** System queues chat messages received during a reconnection window and processes them in order upon recovery
- **FR28:** System supports adding new game types through a defined plugin contract without modifying core game engine logic

### Audio & Media Playback

- **FR29:** Streamer can play audio tracks in-app from connected Spotify playlists during a session (Spotify Premium account required)
- **FR30:** Streamer can play audio and video content in-app from connected YouTube playlists during a session
- **FR31:** Streamer can embed external video content by link (YouTube, Twitch Clips) for use in movie or clip guessing games
- **FR32:** System displays a clear notice and alternative path when Spotify Premium is required but not detected
- **FR33:** System displays a clear fallback message when a linked video is unavailable or access-restricted

### Overlay & Real-Time Display

- **FR34:** Streamer can access a unique, persistent overlay URL for use as an OBS browser source
- **FR35:** Overlay displays real-time game state updates to stream viewers within 300ms p95 of a server scoring event
- **FR36:** Overlay displays the answering viewer's identity and score with visual feedback upon a correct answer
- **FR37:** Overlay displays the current session leaderboard state during and after an active game round
- **FR38:** Streamer can preview the overlay appearance from within the dashboard before going live
- **FR39:** Overlay includes a visible call-to-action for viewers to create their own streamer account
- **FR40:** Streamer can select an overlay theme from a set of available visual options

### Score & Leaderboard Management

- **FR41:** System maintains a real-time intra-community leaderboard per game type per session
- **FR42:** Viewer can see their current rank and accumulated score during an active session via the overlay
- **FR43:** Streamer can view the full score table for all game types in the current session from the dashboard
- **FR44:** System prompts the streamer to export session scores at session end (CSV and JSON formats)

### Viewer Identity & Community

- **FR45:** Viewer can access a public profile page displaying their participation history, scores, and earned badges
- **FR46:** Viewer profile is accessible via a shareable direct URL usable outside the platform
- **FR47:** Viewer can access cross-session statistics on their own profile
- **FR48:** Platform automatically pre-populates the streamer onboarding flow with data from the viewer's existing profile upon conversion

### Subscription & Billing

- **FR49:** Streamer can subscribe to a paid tier through an in-platform payment flow
- **FR50:** Platform enforces feature access limits based on the streamer's active subscription tier
- **FR51:** Streamer can upgrade, downgrade, or cancel their subscription at any time
- **FR52:** Platform automatically updates access permissions within 60 seconds following a subscription status change event
- **FR53:** Streamer retains access to paid features during a grace period following a payment failure before downgrade

### Platform Administration

- **FR54:** Platform admin can curate, edit, and schedule the weekly official playlist
- **FR55:** Platform admin can monitor active sessions, bot connection states, and platform health indicators in real-time
- **FR56:** Platform admin can perform remote session interventions (e.g. force token refresh, resolve overlay delivery issues)
- **FR57:** Platform admin can place streamer or viewer accounts in quarantine pending investigation
- **FR58:** Platform admin can review flagged content submissions and apply moderation actions
- **FR59:** Platform admin can access an immutable audit log of all administrative actions

## Non-Functional Requirements

### Performance

- **NFR-P1:** Overlay receives game state updates within 300ms p95 of a scoring event on the server
- **NFR-P2:** Bot processes incoming chat messages within 100ms of receipt under normal load (up to 10,000 messages/minute per session)
- **NFR-P3:** Bot reconnects to the active streaming platform chat connection within 5 seconds of a connection drop, with zero manual intervention required
- **NFR-P4:** Streamer dashboard reflects session state changes within 500ms of a server event
- **NFR-P5:** Score export for sessions with up to 500 participants generates and downloads within 3 seconds
- **NFR-P6:** Playlist import from Spotify or YouTube (up to 200 tracks) completes within 10 seconds

### Security

- **NFR-S1:** All OAuth tokens (Twitch, Spotify, YouTube) are encrypted at rest and never exposed to frontend clients or included in logs
- **NFR-S2:** All score calculation and answer validation occurs exclusively server-side; no scoring data is accepted from client inputs
- **NFR-S3:** Multi-tenant data isolation is enforced at the database layer independently of application-layer logic
- **NFR-S4:** All platform communications are transmitted over encrypted transport; no unencrypted channel is accepted for any API surface
- **NFR-S5:** OAuth tokens are automatically rotated before expiry; no user session is interrupted by token expiry
- **NFR-S6:** Payment processing is fully delegated to the payment provider; no card data transits or is stored on platform servers
- **NFR-S7:** All platform admin actions are recorded in an immutable audit log (actor, action, timestamp, affected resource)

### Scalability

- **NFR-SC1:** Platform supports at least 50,000 concurrent viewers distributed across all active sessions without overlay latency exceeding 300ms p95 (ref: NFR-P1)
- **NFR-SC2:** Chat message processing sustains 10,000 messages per minute per active session without message processing latency exceeding 100ms p95 (ref: NFR-P2)
- **NFR-SC3:** Bot worker processes are horizontally scalable; a single high-load session has zero measurable impact on other sessions' overlay latency or message processing time
- **NFR-SC4:** Platform sustains peak traffic windows (18h–24h CET) at 3× baseline load without breaching SLA targets
- **NFR-SC5:** One tenant's session failure or resource spike has zero measurable impact on other tenants' active sessions

### Reliability

- **NFR-R1:** Platform maintains 99.5% availability during peak streaming windows (18h–24h CET)
- **NFR-R2:** No session score data is lost on bot process crash; session state in the persistence layer survives independently of any individual process
- **NFR-R3:** Chat messages received during a bot reconnection window are queued and processed in arrival order upon recovery
- **NFR-R4:** Scheduled maintenance windows are restricted to 03h–07h CET to minimize streamer impact
- **NFR-R5:** Incidents exceeding 5 minutes trigger automated notifications (Discord webhook or email) to affected streamers; a public status page is maintained at all times

### Accessibility

- **NFR-A1:** Overlay UI maintains WCAG 2.1 AA minimum color contrast ratios to ensure readability during live streams under varied screen conditions
- **NFR-A2:** Streamer dashboard supports complete keyboard navigation without a mouse (prerequisite for hotkey-driven operation)
- **NFR-A3:** *(V2 target)* All public-facing surfaces (leaderboards, viewer profiles, marketing site) achieve WCAG 2.1 AA compliance

### Integration

- **NFR-I1:** StreamingProvider abstraction ensures all Twitch-specific logic is isolated to a single adapter; adding or replacing a streaming platform requires no changes to core game engine logic
- **NFR-I2:** AudioProvider abstraction ensures all Spotify- and YouTube-specific logic is isolated to individual adapters; adding a new audio source requires only a new adapter implementation
- **NFR-I3:** Platform handles streaming platform chat rate limits (800 messages per 30 seconds per connection for the current adapter) transparently without session interruption
- **NFR-I4:** Platform handles YouTube ContentID-blocked video failures gracefully with a user-facing fallback message and no session crash
- **NFR-I5:** Subscription status changes from payment provider webhooks are reflected in platform feature access within 60 seconds of webhook receipt
- **NFR-I6:** OBS overlay browser source functions correctly with zero configuration beyond pasting the provided overlay URL
