-- 0013_v2_game_engine.sql
-- Phase 6: Game Engine Foundation — v2 scoring mechanics

-- 1. Add featurings array to tracks (per-track featuring artists for GAME-05)
ALTER TABLE "tracks" ADD COLUMN "featurings" TEXT[] DEFAULT '{}';--> statement-breakpoint

-- 2. Add malus_terms array to playlists (per-playlist trap terms for GAME-03)
ALTER TABLE "playlists" ADD COLUMN "malus_terms" TEXT[] DEFAULT '{}';--> statement-breakpoint

-- 3. Change score from INTEGER to NUMERIC(10,1) for decimal scoring (GAME-01/02)
-- This is a lossless cast — existing integer values become X.0
ALTER TABLE "session_scores" ALTER COLUMN "score" TYPE NUMERIC(10,1)
  USING score::NUMERIC(10,1);--> statement-breakpoint

-- 4. Change score default from 0 (integer) to '0' (numeric)
ALTER TABLE "session_scores" ALTER COLUMN "score" SET DEFAULT 0;--> statement-breakpoint

-- 5. Add streak column to session_scores (GAME-02)
ALTER TABLE "session_scores" ADD COLUMN "streak" INTEGER NOT NULL DEFAULT 0;--> statement-breakpoint

-- 6. Add unique constraint for atomic upsert ON CONFLICT (GAME-06)
ALTER TABLE "session_scores"
  ADD CONSTRAINT session_scores_session_viewer_unique
  UNIQUE (session_id, viewer_username);--> statement-breakpoint

-- 7. Add shuffle_order JSONB to sessions (GAME-07)
ALTER TABLE "sessions" ADD COLUMN "shuffle_order" JSONB;
