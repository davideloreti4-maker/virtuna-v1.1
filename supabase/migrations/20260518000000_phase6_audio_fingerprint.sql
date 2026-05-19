-- Phase 6: Audio Analysis + Fingerprint Matching — pgvector setup + trending_sounds embedding columns + match RPC + analysis_results.audio_description.
--
-- All statements use IF NOT EXISTS for idempotent re-runs.
-- pgvector ownership: Phase 6 installs the extension; Phase 8 (competitor_videos.embedding) reuses it.
-- Research deviations from CONTEXT.md (per .planning/phases/06-audio-analysis-fingerprint-matching/06-RESEARCH.md):
--   1. HNSW index instead of ivfflat (CONTEXT D-F2 specified ivfflat; HNSW recommended for incremental-write workloads)
--   2. Vector dimension 768 (for gemini-embedding-001 truncated; CONTEXT D-F1 did not specify dimension)
--   3. analysis_results.audio_description column added (RESEARCH Q4 RESOLVED — persists predict-time description so M2 can surface it
--      later and Phase 10 ML audit may train on it. Cheap, additive widening; no FK or index required.)

-- Step 1: Install pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Step 2: Add embedding + description columns to trending_sounds (idempotent)
ALTER TABLE trending_sounds
  ADD COLUMN IF NOT EXISTS audio_embedding vector(768),
  ADD COLUMN IF NOT EXISTS audio_description text;

-- Step 3: HNSW index for cosine similarity search
-- HNSW (chosen over ivfflat per research):
--   - Builds on empty tables and adapts to incremental writes (cron path adds ~50 sounds/day)
--   - ivfflat requires data to learn cluster centers, degrading on incremental write workloads
--   - pgvector defaults m=16, ef_construction=64; tunable later via WITH clause if recall drops
-- vector_cosine_ops matches the 1 - (a <=> b) cosine formula used in the RPC function below.
CREATE INDEX IF NOT EXISTS trending_sounds_audio_embedding_idx
  ON trending_sounds USING hnsw (audio_embedding vector_cosine_ops);

-- Step 4: Match RPC function (canonical Supabase pgvector pattern)
-- PostgREST does not currently support pgvector similarity operators (<=>) in raw
-- filter queries; wrap in an SQL function and invoke via supabase.rpc().
-- [Source: supabase.com/docs/guides/ai/semantic-search]
-- RLS note: trending_sounds is public-read (see 20260213000000_content_intelligence.sql);
-- the function inherits that grant. No additional policies needed.
CREATE OR REPLACE FUNCTION match_trending_sound_by_audio(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  sound_name text,
  sound_url text,
  trend_phase text,
  velocity_score numeric,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ts.id,
    ts.sound_name,
    ts.sound_url,
    ts.trend_phase,
    ts.velocity_score,
    1 - (ts.audio_embedding <=> query_embedding) AS similarity
  FROM trending_sounds ts
  WHERE ts.audio_embedding IS NOT NULL
    AND 1 - (ts.audio_embedding <=> query_embedding) >= match_threshold
  ORDER BY ts.audio_embedding <=> query_embedding ASC
  LIMIT LEAST(match_count, 10);
$$;

-- Step 5: Persist predict-time audio_description on analysis_results (RESEARCH Q4 RESOLVED).
-- Per Note 7 from the checker pass: aggregator extension in Plan 06-06 will write
-- geminiResult.analysis.audio_signals?.audio_description into this column. M2 UI may surface
-- it later; Phase 10 ML audit may train on description-quality features.
-- Nullable on purpose: existing rows + future rows where audio is absent persist NULL.
ALTER TABLE analysis_results
  ADD COLUMN IF NOT EXISTS audio_description text;
