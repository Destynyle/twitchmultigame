# Roadmap: Playground — Twitch Blindtest Platform

## Milestones

- ✅ **v1.0 Foundation** - Phases 1-5 (shipped 2026-03)
- 🚧 **v2.0 Funnier and Prettier Blindtest** - Phases 6-12 (in progress)

## Phases

<details>
<summary>✅ v1.0 Foundation (Phases 1-5) - SHIPPED 2026-03</summary>

### Phase 1: Twitch OAuth + Tenant Creation
**Goal**: Users can securely log in with Twitch and get a tenant account on first login.
**Plans**: Complete

### Phase 2: Session Management
**Goal**: Streamers can create, manage, and delete blindtest sessions with bot lifecycle.
**Plans**: Complete

### Phase 3: Spotify Integration
**Goal**: Streamers can import Spotify playlists as track lists and manage tracks.
**Plans**: Complete

### Phase 4: Overlay SSE
**Goal**: The OBS overlay displays live scores, leaderboard, and themes via SSE.
**Plans**: Complete

### Phase 5: Admin and Moderation
**Goal**: Admins can monitor sessions, quarantine users, and moderate content.
**Plans**: Complete

</details>

### 🚧 v2.0 Funnier and Prettier Blindtest (In Progress)

**Milestone Goal:** Redesign the gameplay loop to be more engaging and competitive — fuzzy answer matching, streak/malus/double-shot scoring, active bot feedback, improved overlay, and live dashboard controls.

## Phase Details

### Phase 6: Game Engine Foundation
**Goal**: The game engine delivers all v2 scoring mechanics with correct DB schema and atomic writes — every other phase depends on this.
**Depends on**: Phase 5 (v1 complete)
**Requirements**: GAME-01, GAME-02, GAME-03, GAME-04, GAME-05, GAME-06, GAME-07, GAME-08
**Success Criteria** (what must be TRUE):
  1. A viewer who guesses correctly within 3 seconds of the first finder receives proportionally fewer points than the first finder.
  2. A viewer's streak multiplier increases across consecutive found rounds and resets when they miss or trigger a malus.
  3. A viewer who types a malus trap term loses points; the trap terms are configured per playlist by the streamer.
  4. A viewer who submits title and artist in one message receives bonus points if both are correct, and zero points for both if only one is correct.
  5. Concurrent correct guesses from multiple viewers never produce lost score increments (atomic DB upsert in place).
**Plans**: TBD

### Phase 7: Spotify Import Cleanup
**Goal**: Spotify track data is automatically cleaned on import, and streamers can manually correct titles, artists, and featurings before a session.
**Depends on**: Phase 6 (DB schema for featurings column)
**Requirements**: SPOT-01, SPOT-02, SPOT-03
**Success Criteria** (what must be TRUE):
  1. A freshly imported Spotify track with "(Radio Edit)" or "(Remastered)" in the title shows the cleaned title automatically.
  2. A track imported with "(feat. X)" in the title stores the featuring separately and shows a clean title without the annotation.
  3. Streamer can edit the cleaned title, artist, and featurings of any track in the playlist list before starting a session.
**Plans**: TBD

### Phase 8: Bot Auto-Messages and Chat Commands
**Goal**: The bot actively participates in chat — confirming finds, announcing milestones, and responding to viewer commands — without ever tripping Twitch rate limits.
**Depends on**: Phase 6 (game engine events), Phase 7 (featurings data)
**Requirements**: BOT-01, BOT-02, BOT-03, BOT-04, BOT-05, BOT-06, BOT-07, BOT-08, BOT-09, BOT-10, BOT-11, BOT-12
**Success Criteria** (what must be TRUE):
  1. When a new round starts, the bot sends a chat message announcing that guessing is open.
  2. When a viewer correctly guesses the title or artist, the bot confirms it in chat within the same second.
  3. A viewer typing `!score`, `!rank`, `!streak`, `!rules`, or `!pointexplain` in chat receives an accurate response from the bot.
  4. During a high-activity round with many simultaneous correct guesses, the bot never sends more than 15 messages in any 30-second window, and excess messages are silently dropped rather than delayed.
**Plans**: TBD

### Phase 9: Overlay Zone Redesign
**Goal**: The OBS overlay exposes three independent zone URLs (player, feed, leaderboard), each updatable in real time from the same SSE stream, with no breakage to existing overlays already configured by streamers.
**Depends on**: Phase 6 (typed overlay event contract), Phase 8 (bot events flowing into overlay feed)
**Requirements**: OVRL-01, OVRL-02, OVRL-03, OVRL-04, OVRL-05, OVRL-06
**Success Criteria** (what must be TRUE):
  1. A streamer can add `/overlay/[token]/player` as an OBS browser source and see cover art that is blurred until the track is found.
  2. A streamer can add `/overlay/[token]/feed` as a separate OBS source and see a live stream of who scored, malus hits, and streak milestones.
  3. A streamer can add `/overlay/[token]/leaderboard` and see a leaderboard that updates in real time as scores change.
  4. A streamer already using the full `/overlay/[token]` URL before v2 sees no visual breakage or missing events after the upgrade.
**Plans**: TBD

### Phase 10: Dashboard Live Controls
**Goal**: The streamer can correct track metadata and control round flow from the session dashboard while live, without race conditions on in-progress rounds.
**Depends on**: Phase 6 (malus_terms DB column), Phase 8 (BotSession command routing)
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. Streamer can edit the title, artist, featurings, and malus terms of the currently playing track from the dashboard, with changes taking effect at the next round boundary.
  2. Streamer can click +1 or -1 next to any viewer's score and the overlay leaderboard updates immediately.
  3. Streamer can click "Reveal" to expose all un-guessed answers and lock the current round for scoring.
  4. Between rounds, the dashboard displays a mini podium showing the top 3 viewers by points earned on the just-completed round.
**Plans**: TBD

### Phase 11: Score Management
**Goal**: Streamers can export session scores in multiple formats and import a previous session's scores to resume from a saved state.
**Depends on**: Phase 6 (DB schema for scores with streak column)
**Requirements**: SCORE-01, SCORE-02, SCORE-03, SCORE-04
**Success Criteria** (what must be TRUE):
  1. Streamer can download a JSON file of all session scores that includes viewer names, total points, and streak at end of session.
  2. Streamer can download a CSV file of scores that opens correctly in Excel or Google Sheets.
  3. Streamer can upload a previously exported score file to a new session and see the imported scores reflected in the leaderboard.
  4. Streamer can export a PNG image of the final podium showing the top 3 viewers with names and scores.
**Plans**: TBD

### Phase 12: Streamer Guide
**Goal**: A dedicated guide page in the dashboard gives streamers a complete reference for setup, scoring rules, and OBS overlay configuration.
**Depends on**: Phase 9 (overlay zone URLs finalized), Phase 10 (live controls finalized), Phase 11 (export finalized)
**Requirements**: GUIDE-01, GUIDE-02, GUIDE-03
**Success Criteria** (what must be TRUE):
  1. A new streamer landing on the guide page can follow the setup steps — connect bot, create playlist, configure session, go live — without needing external documentation.
  2. The guide page explains how points, streaks, malus, and double-shot work in plain language the streamer can read aloud to their chat.
  3. The guide page shows the three overlay zone URLs and explains how to add each as an OBS browser source.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 6 → 7 → 8 → 9 → 10 → 11 → 12

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Twitch OAuth + Tenant Creation | v1.0 | - | Complete | 2026-03 |
| 2. Session Management | v1.0 | - | Complete | 2026-03 |
| 3. Spotify Integration | v1.0 | - | Complete | 2026-03 |
| 4. Overlay SSE | v1.0 | - | Complete | 2026-03 |
| 5. Admin and Moderation | v1.0 | - | Complete | 2026-03 |
| 6. Game Engine Foundation | v2.0 | 0/? | Not started | - |
| 7. Spotify Import Cleanup | v2.0 | 0/? | Not started | - |
| 8. Bot Auto-Messages and Chat Commands | v2.0 | 0/? | Not started | - |
| 9. Overlay Zone Redesign | v2.0 | 0/? | Not started | - |
| 10. Dashboard Live Controls | v2.0 | 0/? | Not started | - |
| 11. Score Management | v2.0 | 0/? | Not started | - |
| 12. Streamer Guide | v2.0 | 0/? | Not started | - |
