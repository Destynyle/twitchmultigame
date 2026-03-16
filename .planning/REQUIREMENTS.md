# Requirements: Playground — Twitch Blindtest Platform

**Defined:** 2026-03-17
**Milestone:** v2.0 — Funnier and Prettier Blindtest
**Core Value:** The streamer can run an engaging live blindtest on their Twitch stream with zero friction — chat guesses, bot reacts, overlay updates in real time.

## v2 Requirements

### Gameplay Engine

- [ ] **GAME-01**: Viewer answers are scored within a 3-second window after the first correct guess (first finder gets max points, others in window get fewer)
- [ ] **GAME-02**: Streak multiplier accumulates when a viewer finds at least one answer per consecutive round; breaks on a miss or wrong answer (including malus)
- [ ] **GAME-03**: Streamer can configure malus trap terms per playlist; a viewer who types a trap word loses points multiplicatively on that round
- [ ] **GAME-04**: Viewer can submit title + artist in one message (double-shot): both correct = bonus points; only one correct = zero points for both
- [ ] **GAME-05**: Featuring guesses are scored instantly (no 3-second window) — each featuring is guessable independently
- [ ] **GAME-06**: Scoring state (per-round scores, streaks, active window) is preserved in memory with atomic DB writes to prevent lost increments on concurrent guesses
- [ ] **GAME-07**: Streamer can play the playlist in shuffle order (Fisher-Yates, non-repetitive — each track plays once before any repeats)
- [ ] **GAME-08**: Streamer can configure the scoring window duration per session (default 3s)

### Spotify Import Cleanup

- [ ] **SPOT-01**: On Spotify import, track titles are automatically cleaned — strips `(Radio Edit)`, `(Remastered)`, `(Live)`, `(Single Version)`, and similar annotations
- [ ] **SPOT-02**: `(feat. X)`, `(ft. X)`, `(with X)` are extracted from titles and stored as featurings; cleaned title stored separately from raw Spotify title
- [ ] **SPOT-03**: Streamer can manually edit cleaned title, artist, and featurings from the track list before starting a session

### Bot & Chat Commands

- [ ] **BOT-01**: Bot sends a message in chat when a new round starts (announcing that guessing is open)
- [ ] **BOT-02**: Bot announces in chat when a viewer correctly guesses the title or artist
- [ ] **BOT-03**: Bot announces in chat when a viewer correctly guesses a featuring (instantly, no window)
- [ ] **BOT-04**: Bot sends a summary in chat when the scoring window closes (listing all viewers who scored on that round)
- [ ] **BOT-05**: Bot announces in chat when a viewer triggers a malus trap
- [ ] **BOT-06**: Bot announces streak milestones in chat (e.g. streak x5)
- [ ] **BOT-07**: Bot respects Twitch rate limits (max 20 messages / 30 seconds) via a token-bucket queue — excess messages are dropped, not delayed
- [ ] **BOT-08**: Viewer can type `!score` in chat to receive their current score from the bot
- [ ] **BOT-09**: Viewer can type `!rank` in chat to receive their current position in the leaderboard
- [ ] **BOT-10**: Viewer can type `!streak` in chat to receive their current streak multiplier
- [ ] **BOT-11**: Viewer can type `!rules` in chat to receive a brief explanation of how the game works
- [ ] **BOT-12**: Viewer can type `!pointexplain` in chat to receive a breakdown of how points are calculated

### Overlay Redesign

- [ ] **OVRL-01**: Overlay exposes three independent zone URLs — `/overlay/[token]/player`, `/overlay/[token]/feed`, `/overlay/[token]/leaderboard` — each usable as a separate OBS browser source
- [ ] **OVRL-02**: Player zone displays cover art (blurred until found), and title/artist/featurings that are progressively revealed as viewers guess them correctly
- [ ] **OVRL-03**: Feed zone displays a live round event stream — who scored what, malus hits, streak milestones — updating in real time
- [ ] **OVRL-04**: Leaderboard zone displays the global session leaderboard, updating in real time
- [ ] **OVRL-05**: Full overlay page (`/overlay/[token]`) displays all three zones in a combined layout for streamers who prefer a single source
- [ ] **OVRL-06**: SSE payload versioning — existing overlay event shapes are not broken; new event types are additive

### Dashboard Live Controls

- [ ] **DASH-01**: Streamer can edit the title, artist, featurings, and malus terms of the currently playing track from the session dashboard (changes take effect on the active round)
- [ ] **DASH-02**: Streamer can manually adjust any viewer's score (+1 / -1) from the session dashboard
- [ ] **DASH-03**: Streamer can click a "Reveal" button to reveal all un-guessed answers and lock the current round
- [ ] **DASH-04**: A mini podium (top 3 viewers by points earned on that round) is displayed between rounds before the next track starts

### Score Management

- [ ] **SCORE-01**: Streamer can export session scores as JSON
- [ ] **SCORE-02**: Streamer can export session scores as CSV
- [ ] **SCORE-03**: Streamer can import a previously exported score file to resume a session from a saved state
- [ ] **SCORE-04**: Streamer can export the final podium as a PNG image (top 3 with names and scores)

### Streamer Guide

- [ ] **GUIDE-01**: A dedicated guide page in the dashboard explains the full setup flow — connect bot, create playlist, configure session, go live, and control from the dashboard
- [ ] **GUIDE-02**: The guide page explains how the scoring system works (window, streak, malus, double-shot) so the streamer can explain the rules to their chat
- [ ] **GUIDE-03**: The guide page explains how to set up OBS overlay sources (zone URLs, recommended layout)

## v3 Requirements (Deferred)

### Advanced Customization

- **CONF-01**: ~~Moved to v2 as GAME-08~~
- **CONF-02**: Streamer can configure streak multiplier step values
- **CONF-03**: Streamer can customize bot message templates

### Score Export Polish

- **SCORE-05**: Animated podium at end of session with confetti

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time viewer chat DMs | Not a Twitch bot capability |
| Mobile native app | Web-first; mobile deferred |
| Video overlay | Storage/bandwidth cost, not core |
| OAuth providers other than Twitch | Target audience is Twitch-only |
| Mid-round streak/malus config changes | Consistency risk; edit-at-round-boundary only |
| Bot message template customization | Deferred to v3 to keep v2 scope manageable |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| GAME-01 | — | Pending |
| GAME-02 | — | Pending |
| GAME-03 | — | Pending |
| GAME-04 | — | Pending |
| GAME-05 | — | Pending |
| GAME-06 | — | Pending |
| GAME-07 | — | Pending |
| GAME-08 | — | Pending |
| SPOT-01 | — | Pending |
| SPOT-02 | — | Pending |
| SPOT-03 | — | Pending |
| BOT-01 | — | Pending |
| BOT-02 | — | Pending |
| BOT-03 | — | Pending |
| BOT-04 | — | Pending |
| BOT-05 | — | Pending |
| BOT-06 | — | Pending |
| BOT-07 | — | Pending |
| BOT-08 | — | Pending |
| BOT-09 | — | Pending |
| BOT-10 | — | Pending |
| BOT-11 | — | Pending |
| BOT-12 | — | Pending |
| OVRL-01 | — | Pending |
| OVRL-02 | — | Pending |
| OVRL-03 | — | Pending |
| OVRL-04 | — | Pending |
| OVRL-05 | — | Pending |
| OVRL-06 | — | Pending |
| DASH-01 | — | Pending |
| DASH-02 | — | Pending |
| DASH-03 | — | Pending |
| DASH-04 | — | Pending |
| SCORE-01 | — | Pending |
| SCORE-02 | — | Pending |
| SCORE-03 | — | Pending |
| SCORE-04 | — | Pending |
| GUIDE-01 | — | Pending |
| GUIDE-02 | — | Pending |
| GUIDE-03 | — | Pending |

**Coverage:**
- v2 requirements: 39 total
- Mapped to phases: 0
- Unmapped: 39 ⚠️ (roadmap pending)

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-03-17 after initial definition*
