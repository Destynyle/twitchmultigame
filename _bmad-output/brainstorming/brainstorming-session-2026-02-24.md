---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: ['/home/desty/42/Playground/blindtest']
session_topic: 'Refonte architecture application blindtest musical interactif Twitch'
session_goals: 'Concevoir une architecture scalable, maintenable et extensible vers d''autres mini-jeux'
selected_approach: 'ai-recommended'
techniques_used: ['Assumption Reversal', 'Cross-Pollination', 'Morphological Analysis']
session_active: false
workflow_completed: true
---

# Brainstorming Session — Synthèse Finale

**Facilitateur :** Desty Le Boss
**Date :** 2026-02-24
**Sujet :** Refonte complète de l'architecture d'une application web de blindtests musicaux interactifs sur Twitch → Plateforme SaaS de mini-jeux interactifs Twitch

---

## Contexte du Projet Existant

**Stack actuelle analysée :**
- Node.js/Express + Vanilla JS + jQuery + TMI.js (Twitch bot côté client)
- Logique de jeu dans le browser, état en mémoire volatile (perdu au rechargement)
- Pas de vraie isolation multi-streamer, credentials Firebase hardcodés, aucun test
- Couplage fort entre UI, logique de jeu et persistance

**Problèmes fondamentaux identifiés :**
- Bot Twitch dans le browser = fragile et non sécurisé
- Scoring côté client = trichable
- Pas de persistance réelle
- Multi-streamer = illusion (même URL partagée)
- Architecture inextensible à d'autres jeux

---

## Vision Produit Finale

**Ce qu'on construit :** Une **plateforme SaaS freemium** de mini-jeux interactifs pour Twitch, où le streamer orchestre l'expérience et sa communauté joue via le chat.

**Principe directeur :** La plateforme est un **outil**, le streamer est l'**hôte**. On libère le streamer des tâches mécaniques sans remplacer les interactions humaines qui font vivre le stream.

---

## Idées Organisées par Thème

---

### THÈME 1 — Architecture & Infrastructure

| Idée | Description | Priorité |
|---|---|---|
| Modular Monolith → Microservices | Un seul service modulaire pour commencer, extraction progressive si besoin | MVP |
| Bot backend session-scoped | Le bot démarre quand le streamer se connecte, s'arrête à déconnexion | MVP |
| Redis + PostgreSQL | Redis pour l'état live de session, PostgreSQL pour les données persistantes | MVP |
| S3 + CDN pour médias | Hébergement vidéo/audio géré par la plateforme | V2 |
| WebSocket (dashboard) + SSE (overlay) | Chaque surface a son protocole optimal | MVP |
| Multi-tenant via tenant_id | Isolation logique par streamer en base de données | MVP |
| Onboarding OAuth Twitch zero-config | Connexion en 1 clic, zéro JSON, zéro token manuel | MVP |

---

### THÈME 2 — Game Engine & Mini-Jeux

**Abstraction commune :** Chaque jeu implémente une interface `GamePlugin` :
```
onStart(config) → overlayContent
onMessage(user, text) → GameEvent
onStreamerAction(action) → GameEvent
onReveal() → overlayContent
onEnd() → FinalScores
```

Chaque jeu = une combinaison de 5 blocs réutilisables :
`PRÉSENTATION → INTERACTION → VALIDATION → SCORING → RÉVÉLATION`

| Jeu | Présentation | Interaction | Validation | Statut |
|---|---|---|---|---|
| **Blind Test** | Audio (chanson) | Texte libre chat | Fuzzy matching auto | Existant → refonte |
| **Akinator / 20Q** | Contexte (thème secret saisi par streamer) | Texte libre chat | Exact matching | V2 |
| **Guess the Lyrics** | Texte (paroles à trous) | Texte libre chat | Strict matching | V2 |
| **Quiz Culture** | Texte/Image (question) | Lettre A/B/C/D ou texte | Exact/fuzzy | V2 |
| **Quiz Personnalisé** | Questions créées par streamer | Texte libre chat | Base réponses custom | V2 |
| **Guess the Movie** | Image/Vidéo (extrait scène) | Texte libre chat | Fuzzy matching | V2 |
| **Guess the Clip** | Vidéo (extrait clip musical) | Texte libre chat | Fuzzy matching | V2 |

**Scoring progressif universel par jeu :**
- 1er à trouver = points maximum
- Décroissance sur X secondes après le 1er
- Règles configurables par le streamer (seuils, multiplicateurs, combos, malus)

**Détails Akinator :** Le streamer saisit la bonne réponse dans son dashboard. Les viewers devinent en chat. La bonne réponse est révélée par le streamer quand il le souhaite — la plateforme ne gère pas les oui/non (le streamer les fait oralement à l'antenne).

**Détails Guess the Lyrics :** Matching strict (pas de fuzzy). Les indices sont donnés manuellement par le streamer.

**Détails Guess the Movie / Clip :**
- Progressive reveal : frame très zoomée → dézoom progressif si personne ne trouve
- Score inversement proportionnel au nombre de révélations nécessaires
- Deux jeux distincts (film ≠ clip musical)

---

### THÈME 3 — Score & Persistance

**Principe fondamental :** Chaque jeu a son propre tableau de scores indépendant par communauté. Pas de score cross-game. Deux jeux joués le même soir = deux tableaux distincts = deux prompts d'export séparés.

```
SESSION NORMALE                      JEUX HEBDOMADAIRES OFFICIELS
─────────────────────                ────────────────────────────────
Score vit dans Redis (TTL session)   Score persisté en PostgreSQL auto
         ↓ fin de partie                      ↓
  Prompt : "Exporter ?"              Alimente le leaderboard inter-commu
  [Exporter CSV/JSON] [Ignorer]      Pas d'action requise du streamer
         ↓
  Téléchargement fichier
         ↑
  Import possible en début
  de nouvelle session
```

**Flow début de session :**
> "Voulez-vous reprendre des scores existants ?"
> [Nouvelle partie] [Importer un fichier CSV/JSON]

**Flow fin de session (jeu normal) :**
> Résumé → Podium top 3 → Stats → "Exporter les scores ?" → [Oui / Non]

**Jeux hebdomadaires :** Persistance automatique, pas de prompt, contribue au leaderboard.

---

### THÈME 4 — Communauté & Compétition Intercommunautaire

| Idée | Description | Priorité |
|---|---|---|
| Playlist de la semaine | Curatée, révélée chaque lundi minuit, jouable 1 fois par streamer, archivée après 7 jours | V2 |
| Leaderboard inter-commu | Score normalisé (% bonnes réponses), opt-in par le streamer | V2 |
| Compétition interne | Classement au sein de la commu d'un seul streamer | MVP |
| Profil viewer | Historique scores, badges, streams favoris | V2 |
| Badges streamer | "Champion Blindtest Jan 2026", "Top 3 commu musicale" | V2 |
| Hall of Fame mensuel | Page publique partageable des meilleures commus | V2 |
| Saisons compétitives | Reset trimestriel, skin d'overlay de saison, urgence + fenêtres de monétisation | V3 |
| Duos inter-streamers | Deux streamers co-hostent simultanément, commus s'affrontent en temps réel | V3 |
| Streak de participation | "Tu as joué 7 semaines consécutives" → récompense cosmétique | V2 |

**Curation de la playlist hebdomadaire :** Thèmes rotatifs (Années 90, Rap FR, OST Gaming, Anime…) définis par l'équipe éditoriale + validation humaine sur proposition algo.

---

### THÈME 5 — Produit SaaS & Modèle Freemium

| Fonctionnalité | Free | Premium |
|---|---|---|
| Playlists custom | Limitées (nb + taille) | Illimitées |
| Thèmes d'overlay | Basiques | Shop complet + CSS custom |
| Mini-jeux | Blind Test uniquement | Tous les mini-jeux |
| Export de scores | ✅ | ✅ |
| Analytics | Basiques | Avancées |
| Leaderboard inter-commu | Opt-in | Opt-in + mis en avant |
| Support | Communauté | Prioritaire |
| Quiz IA généré | ❌ | ✅ ("Génère 10 questions sur le hip-hop français") |

**Shop de thèmes CSS :**
- Thèmes par univers : Pixel Art, Néon Cyberpunk, Vaporwave, Minimaliste, Anime...
- Thèmes saisonniers / événementiels (Noël, Halloween, Été...)
- Thème "Signature" généré à partir des couleurs/logo du streamer (ultra-premium)
- Aperçu live avant achat (overlay en temps réel avec le thème)
- Marketplace communautaire : les créateurs de thèmes peuvent les publier et partager les revenus

**Rebindable hotkeys :**
- `Space` = révéler la réponse (défaut)
- `Enter` = chanson/question suivante (défaut)
- `Escape` = pause (défaut)
- Entièrement reconfigurables par le streamer

---

### THÈME 6 — UX & Surfaces Frontend

**3 surfaces distinctes avec des outils adaptés :**

| Surface | Stack | Usage |
|---|---|---|
| **Dashboard Streamer** | React SPA (desktop-first) | Gestion sessions, playlists, scores |
| **Overlay OBS** | HTML/CSS pur + SSE | Affichage temps réel, CSS injecté, zéro logique |
| **Site Public** | Next.js SSR | Leaderboards, marketplace, landing, profils |

**Dashboard Streamer — Mode Régie :**
- Vue simplifiée une fois la session lancée : chanson en cours, chat filtré, top scores
- Hotkeys rebindables (pas de souris nécessaire pendant le jeu)
- Chat intégré : affiche uniquement les tentatives de réponse, filtre le flood
- Indicateur "Tension" : barre visuelle qui monte si personne ne répond → signal pour aider ou skipper
- Split view : liste chansons | chat filtré | scoreboard live
- "Clone ma dernière session" en 1 clic
- Templates prêts à l'emploi (Années 80, K-pop, OST Gaming...)

**Overlay OBS — Ultra-léger :**
- URL unique par streamer avec token : `overlay.app.com/{streamerId}?token=xxx`
- Widgets modulaires composables : scoreboard seul / chanson seule / combo indicator seul
- Animations de victoire selon le streak (simple pour 1, explosion pour combo x5)
- Nom du 1er à trouver = animation spéciale (son moment de gloire)
- Compte à rebours animé créant de la pression visuelle
- CSS injecté dynamiquement = thème premium sans republier l'overlay
- Badge discret "Playlist officielle de la semaine" quand applicable

---

### THÈME 7 — Audio, Vidéo & Sources Multiples

**Abstraction AudioProvider :**
```
AudioProvider interface
├── SpotifyAdapter     (preview 30s, API Spotify)
├── YouTubeAdapter     (embed, large catalogue)
└── S3Adapter          (upload custom, contrôle total)
```
Ajouter une source = ajouter un adaptateur. Le Game Engine ne sait pas d'où vient l'audio.

**Hébergement vidéo (Guess the Movie / Clip) :**
- Upload par le streamer → stockage S3 + transcoding FFmpeg
- Delivery via CDN (performance globale)
- Extraction de frames pour thumbnails et progressive reveal
- Support YouTube embed en alternative (premium)

---

### THÈME 8 — Croissance & Viralité

| Mécanisme | Description | Priorité |
|---|---|---|
| Clip de victoire auto | Résumé vidéo/image généré quand une commu gagne la semaine → partageable Twitter/TikTok | V2 |
| Badge Twitch Panel | Le streamer affiche "Rejoindre mon blindtest" sur son panel → lien direct session | MVP |
| Spectateur → Streamer | CTA dans l'overlay : "Tu veux organiser ton propre blindtest ?" | V2 |
| Widget leaderboard embeddable | Iframe du classement pour sites/blogs/Discord | V2 |
| Wrapped annuel | "Votre année blindtest" : meilleure chanson, meilleur joueur, stats virales | V3 |
| Marketplace playlists | Les streamers partagent et notent leurs playlists, les meilleures remontent | V2 |

---

### THÈME 9 — Sécurité & Modération

| Fonctionnalité | Description |
|---|---|
| Rate limiting | Un viewer ne peut pas envoyer plus de X réponses/seconde |
| Délai de validation | Réponse < 200ms = suspecte, flag automatique |
| Shadow scoring | Réponses suspectes comptées visuellement mais en quarantaine |
| Ban list par streamer | Blacklist de joueurs par session/permanente |
| Mode silencieux | Le streamer peut couper les annonces du bot dans le chat |
| Timeout auto | Réponse correcte avant le début du jeu = timeout 5 min |
| Rôles modérateurs | Délégation de la gestion du jeu à un modérateur de confiance |
| Anti-cheat renforcé | Pour les jeux hebdomadaires officiels uniquement (scores qui comptent vraiment) |

---

## Architecture Recommandée — Vue Synthétique

```
┌──────────────────────────────────────────────────────────────────┐
│  FRONTEND (3 surfaces)                                           │
│  Dashboard React (desktop) │ Site Next.js │ Overlay HTML pur     │
└─────────────────────┬────────────────────────────────────────────┘
                      │ WS / SSE / HTTPS
┌─────────────────────▼────────────────────────────────────────────┐
│  BACKEND — Modular Monolith TypeScript                           │
│  ┌──────────┐ ┌────────────────────┐ ┌──────────┐ ┌──────────┐  │
│  │Auth      │ │Game Engine         │ │Bot Mgr   │ │Media     │  │
│  │Twitch    │ │  BlindTest Plugin  │ │Session-  │ │AudioProv │  │
│  │OAuth+JWT │ │  Akinator Plugin   │ │scoped    │ │S3+CDN    │  │
│  │Roles     │ │  Quiz Plugin       │ │1 bot /   │ │Transcoder│  │
│  │Multi-    │ │  GuestLyrics Plugin│ │session   │ │          │  │
│  │tenant    │ │  GuestMovie Plugin │ │          │ │          │  │
│  └──────────┘ │  GuestClip Plugin  │ └──────────┘ └──────────┘  │
│               │  Scoring Engine    │                             │
│               │  (progressif/jeu)  │ ┌──────────┐ ┌──────────┐  │
│               └────────────────────┘ │Community │ │Theme     │  │
│                                      │Weekly PL │ │Engine    │  │
│                                      │Leaderbd  │ │CSS inject│  │
│                                      │Inter-cmu │ │Shop      │  │
│                                      └──────────┘ └──────────┘  │
└─────────────────────┬────────────────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────────────────┐
│  DATA LAYER                                                      │
│  PostgreSQL (données persistantes)  │  Redis (état session live) │
│  S3 + CDN (médias vidéo/audio)                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Prioritisation — Roadmap en 3 Phases

### Phase MVP — "Le Blindtest Réinventé"

**Objectif :** Remplacer l'app actuelle par une version robuste, multi-streamer réelle, prête à être SaaS.

- [ ] Architecture de base (Monolith modulaire, PostgreSQL, Redis)
- [ ] Auth Twitch OAuth + JWT + isolation multi-tenant
- [ ] Bot backend session-scoped (remplace TMI.js browser)
- [ ] Blind Test refonte complète (scoring serveur, fuzzy matching backend)
- [ ] Dashboard streamer (Mode Régie, hotkeys rebindables)
- [ ] Overlay OBS modulaire (SSE, HTML pur, CSS de base)
- [ ] Score par jeu + export CSV/JSON à la demande
- [ ] Import de scores pour reprendre une session
- [ ] Prompt export en fin de partie
- [ ] Freemium basique (limite de playlists)
- [ ] Onboarding OAuth zero-config (zéro JSON)

### Phase V2 — "La Plateforme de Mini-Jeux"

**Objectif :** Étendre le catalogue, lancer la compétition inter-communautaire, monétiser.

- [ ] Mini-jeux : Akinator, Guess the Lyrics, Quiz Culture, Quiz Personnalisé
- [ ] AudioProvider abstraction (Spotify + YouTube)
- [ ] Hébergement vidéo + Guess the Movie + Guess the Clip
- [ ] Shop de thèmes CSS + aperçu live
- [ ] Playlist de la semaine officielle (curation éditoriale)
- [ ] Leaderboard inter-communautaire opt-in
- [ ] Analytics streamer basiques (heatmap participation, difficulté playlist)
- [ ] Profils viewers + badges
- [ ] Marketplace de playlists (partage + notation)
- [ ] Widget leaderboard embeddable + Badge Twitch Panel
- [ ] Clip de victoire partageable (image/résumé)

### Phase V3 — "L'Écosystème Compétitif"

**Objectif :** Viralité, monétisation avancée, économie de créateurs.

- [ ] Saisons compétitives (reset trimestriel, skins de saison)
- [ ] Duos inter-streamers (co-hosting compétitif)
- [ ] Wrapped annuel viral
- [ ] Quiz IA généré (fonctionnalité premium)
- [ ] Marketplace créateurs de thèmes (revenue sharing)
- [ ] Channel Points Twitch integration (power-ups)
- [ ] Reverse monetization (quiz payants Bits)
- [ ] Analytics avancées + rétention viewers

---

## Concepts Breakthrough de la Session

**[Breakthrough #1] : GamePlugin Interface**
_Concept :_ Le blindtest n'est plus une application, c'est un plugin parmi d'autres dans un framework générique. Ajouter un nouveau jeu = implémenter une interface de 5 méthodes.
_Nouveauté :_ Extensibilité sans réécriture. La plateforme grandit sans dette technique.

**[Breakthrough #2] : Bot Session-Scoped**
_Concept :_ Le bot ne tourne que quand le streamer est connecté. Session ouverte = bot actif. Session fermée = bot éteint. Pas de coût inutile, pas de zombie process.
_Nouveauté :_ Supprime la fragilité du bot browser tout en restant économique.

**[Breakthrough #3] : Score Éphémère + Export On-Demand**
_Concept :_ Les scores n'ont pas besoin d'exister au-delà d'une session. Ils vivent dans Redis, meurent proprement, et peuvent être exportés si le streamer le souhaite. Seuls les jeux hebdomadaires officiels persistent automatiquement.
_Nouveauté :_ Simplicité radicale. Pas de "base de données de scores" à gérer pour 99% des sessions.

**[Breakthrough #4] : 3 Surfaces Frontend Distinctes**
_Concept :_ Dashboard (React), Overlay OBS (HTML pur), Site Public (Next.js). Chaque surface a sa stack optimale. L'overlay OBS est délibérément stupide — il reçoit et affiche, c'est tout.
_Nouveauté :_ Performance maximale pour l'overlay, richesse maximale pour le dashboard, SEO pour le site public.

**[Breakthrough #5] : Playlist Hebdomadaire comme Moteur de Croissance**
_Concept :_ Une playlist identique pour tous les streamers, révélée chaque lundi, jouable une seule fois. Crée un événement collectif hebdomadaire et une compétition inter-communautaire naturelle.
_Nouveauté :_ Mécanisme de Wordle appliqué au streaming musical. Viralité intégrée au produit.

---

## Insights Clés de la Session

1. **Le pivot produit est majeur :** On est passé d'un "outil de blindtest" à une "plateforme de mini-jeux interactifs Twitch". L'architecture doit refléter cette ambition dès le MVP.

2. **La plateforme augmente le streamer, elle ne le remplace pas :** Les interactions humaines (répondre aux questions dans Akinator, donner des indices dans Guess the Lyrics) restent la responsabilité du streamer. Le stream doit rester vivant.

3. **La compétition intercommunautaire est le différenciateur fort :** C'est ce qui transforme un outil en réseau. La playlist hebdomadaire est le mécanisme central de rétention et de viralité.

4. **Le modèle freemium s'appuie sur deux piliers :** Les limites fonctionnelles (nombre de playlists) et les cosmétiques premium (thèmes CSS). Les deux ont une valeur claire et perçue différemment.

5. **L'architecture est extensible by design :** Chaque décision technique (GamePlugin, AudioProvider, ThemeEngine) anticipe la croissance sans surarchitecturer le MVP.

---

*Session générée le 2026-02-24 — Facilitateur BMAD Brainstorming*
