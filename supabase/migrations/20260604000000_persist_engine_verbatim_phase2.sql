-- Phase 2 (R1) — Persist Omni verbatim transcription so it survives permalink
-- reload (GET /api/analysis/[id]) and is available for P3 Apollo rewrites
-- (R2) and P4 Audience-Sim (R3) which need to know what viewers heard/saw.
--
-- Before this, buildInsertRow dropped verbatim on the floor:
--   hook_verbatim        → Omni hook transcription (first ~3s spoken_words + on_screen_text)
--   per-segment verbatim → per-segment spoken_text/on_screen_text on each segment
--
-- Shape stored in this column:
--   {
--     hook: { spoken_words: string | null, on_screen_text: string | null },
--     segments: [{ idx: number, spoken_text: string | null, on_screen_text: string | null }, ...]
--   }
--
-- Null contracts (D-02):
--   - spoken_words / spoken_text = null for silence (no speech); NOT "[inaudible]"
--   - "[inaudible]" marks present-but-unintelligible speech (D-04.2)
--   - Column is null only when neither a hook nor any text-bearing segment exists
--     (no speech AND no on-screen text anywhere). A hook-only object `{ hook: {...} }`
--     (no `segments` key) and a segments-only object `{ segments: [...] }` (no `hook`
--     key) are both valid NON-null shapes — consumers must treat a missing
--     `hook`/`segments` key as absent, not infer the whole column is null.
--   - Synthetic fallback segments (buildFixedBuckets) carry null verbatim legitimately
--
-- No backfill: historical rows keep NULL (engine output isn't re-derivable).
-- Newly inserted rows are populated by buildInsertRow (INSERT at route.ts ~594)
-- AND the SSE safety-net UPDATE (route.ts ~921) — both sites persist the full
-- { hook, segments } object so streaming runs are not penalised.
--
-- Mirrors migration 20260531000000_persist_engine_emitted_columns.sql exactly —
-- one ADD COLUMN IF NOT EXISTS, one COMMENT ON COLUMN, no DROP, no backfill.

ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS verbatim JSONB;

COMMENT ON COLUMN public.analysis_results.verbatim IS
  'Omni verbatim transcription (P2/R1). Shape: { hook: { spoken_words, on_screen_text }, segments: [{ idx, spoken_text, on_screen_text }] }. Null when video has no speech/on-screen text. spoken_text=null for silence (D-02); [inaudible] for present-but-unclear speech (D-04.2). No backfill — historical rows NULL. Consumed by P3 Apollo rewrites (R2) and P4 Audience-Sim (R3).';
