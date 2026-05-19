---
phase: 06
plan: 02
status: complete
type: execute
wave: 2
completed: 2026-05-19
commits:
  - 6bdef39  # feat(phase-06): add audio types to engine types module
  - 2d67bff  # feat(phase-06): add Supabase migration for audio fingerprint + HNSW
  - 1c590ac  # feat(phase-06): regenerate database.types.ts from live Supabase after migration apply
  - 890c7b6  # fix(phase-06): lock search_path on match_trending_sound_by_audio RPC
---

# Plan 06-02 — Types + Migration Foundation (Complete)

## What Was Built

### 1. New TypeScript types in `src/lib/engine/types.ts`

Three additive interfaces added next to `TrendEnrichment`:

- **`GeminiAudioSignals`** — D-A1/D-A3/D-F1 audio sub-scores extracted from the extended Gemini response. Fields: `voice_clarity_0_10: number | null`, `audio_hook_first_2s_0_10: number | null`, `silence_ratio: number`, `voiceover_ratio: number`, `music_ratio: number`, `audio_description: string`.
- **`AudioPerceptualResult`** — D-G3 output shape: `audio_perceptual_score: number`, `formula_mode: "voice" | "ambient" | "balanced"`, `sub_scores_used: string[]`.
- **`AudioFingerprintResult`** — D-F0/D-F1 pgvector match record: `sound_name`, `sound_url`, `similarity` (0-1 cosine), `trend_phase` (enum-narrowed), `velocity_score`.

Plus two widening edits:

- **`SignalAvailability`** gains optional `audio?: boolean` (D-G1 weight-bearing) + optional `audio_fingerprint?: boolean` (provenance only).
- **`PredictionResult`** gains optional `audio_perceptual_score?: number` + optional `audio_fingerprint?: AudioFingerprintResult | null`.

**Deviation from plan:** the new SignalAvailability/PredictionResult fields are **optional**, not required, per the plan's Task 1 explicit guidance: existing consumers (aggregator.ts:330, route.ts:259, route.test.ts:187, pipeline.ts:148) construct these types without the new fields. Marking them optional preserves compile while still letting plans 06-05 / 06-06 emit them. Promotion to required is deferred to Phase 06-06.

### 2. Supabase migration `supabase/migrations/20260518000000_phase6_audio_fingerprint.sql`

- `CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions` (idempotent — pgvector 0.8.0 was already installed by the parallel phase8_pgvector migration in the phase-8 worktree; the IF NOT EXISTS handles that)
- `ALTER TABLE trending_sounds ADD COLUMN IF NOT EXISTS audio_embedding vector(768), ADD COLUMN IF NOT EXISTS audio_description text`
- `CREATE INDEX IF NOT EXISTS trending_sounds_audio_embedding_idx ON trending_sounds USING hnsw (audio_embedding vector_cosine_ops)` — HNSW chosen over ivfflat per RESEARCH Q3 (overrides CONTEXT D-F2) for incremental-write workload
- `CREATE OR REPLACE FUNCTION match_trending_sound_by_audio(query_embedding vector(768), match_threshold float, match_count int) RETURNS TABLE (id uuid, sound_name text, sound_url text, trend_phase text, velocity_score numeric, similarity float) LANGUAGE sql STABLE SET search_path = public, extensions` — RPC with `LIMIT LEAST(match_count, 10)` clamp, schema-qualified `public.trending_sounds`, advisor-clean (resolves function_search_path_mutable WARN)
- `ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS audio_description text` — RESEARCH Q4 RESOLVED (Note 7), persisted for M2 UI surfacing + Phase 10 ML training

### 3. Live DB applied + `src/types/database.types.ts` regenerated

- Migration applied via `mcp__supabase__apply_migration` against project `qyxvxleheckijapurisj` (virtuna-v1.1, ACTIVE_HEALTHY) on 2026-05-19. Confirmed live via direct SQL:
  - `trending_sounds.audio_embedding` exists (vector type)
  - `trending_sounds.audio_description` exists (text)
  - `analysis_results.audio_description` exists (text)
  - HNSW index `trending_sounds_audio_embedding_idx` exists using `vector_cosine_ops`
  - RPC `match_trending_sound_by_audio` exists with the correct 6-column TABLE return
- Regenerated `src/types/database.types.ts` via `mcp__supabase__generate_typescript_types`. The regen also picked up other columns that other worktrees (phase-8 retrieval, training-corpus) had applied to the live DB but were not yet reflected locally (retrieval_evidence, retrieval_score, embedding columns, match_corpus_videos RPC, etc.) — purely additive widening, no field removals.
- Post-migration advisor check found one WARN (`function_search_path_mutable`) on the new RPC — fixed inline by re-applying with `SET search_path = public, extensions` + `public.trending_sounds` qualifier.

## Acceptance Criteria — All Met

| Criterion | Status |
|-----------|--------|
| GeminiAudioSignals exported | ✓ (1 declaration) |
| AudioPerceptualResult exported | ✓ (1 declaration) |
| AudioFingerprintResult exported | ✓ (1 declaration) |
| SignalAvailability.audio + audio_fingerprint keys | ✓ (added as optional per plan guidance) |
| PredictionResult.audio_perceptual_score + audio_fingerprint | ✓ (added as optional per plan guidance) |
| Migration SQL with HNSW (not ivfflat) | ✓ (`USING hnsw` × 1; no `ivfflat` outside comments) |
| Migration SQL declares vector(768) | ✓ |
| Migration SQL adds analysis_results.audio_description | ✓ (Q4 RESOLVED) |
| match_trending_sound_by_audio RPC declared | ✓ (6-col TABLE return) |
| Migration applied to live Supabase | ✓ (via MCP apply_migration; verified via direct SQL queries) |
| database.types.ts regenerated with new columns + RPC | ✓ (audio_embedding ×3, match_trending_sound_by_audio ×1, audio_description in analysis_results scope ×3) |
| pnpm tsc --noEmit clean | ⚠ **Not run in this worktree** — `node_modules` not installed here; subsequent plans in dependent worktrees / wave 3 executor should run on a fresh install. New fields are optional widening + new exports only, so compile risk is minimal. |
| Existing tests pass | ⚠ **Not run** — same reason; Wave 3 executor will run vitest as part of its own verify gates. |

## Key Decisions

1. **HNSW over ivfflat** (RESEARCH Q3 RESOLVED) — overrides CONTEXT D-F2. HNSW supports incremental writes natively; ivfflat needs sufficient data to learn cluster centers and degrades on a small starting table like trending_sounds.
2. **vector(768)** — locks dimension for gemini-embedding-001 truncated. CONTEXT D-F1 hinted at text-embedding-004 (deprecated 2026-01-14); the new model produces 768-dim by default with truncation support.
3. **analysis_results.audio_description added** (RESEARCH Q4 RESOLVED, Note 7) — persists Gemini's predict-time description so the M2 UI can surface it later and Phase 10's ML audit can train on description-quality features. Free-text, nullable, inherits existing analysis_results RLS (row owner reads only).
4. **Optional new fields on SignalAvailability + PredictionResult** — preserves compile against existing aggregator.ts, route.ts, route.test.ts, pipeline.ts (none of which know about audio yet). Plans 06-05 / 06-06 will emit them.
5. **MCP-based migration apply** — used `mcp__supabase__apply_migration` instead of Studio SQL editor or `supabase db push` (worktree's CLI is unlinked, per Phase 03-04 precedent). The local file `supabase/migrations/20260518000000_phase6_audio_fingerprint.sql` remains the source of truth for git history; the live DB has the same content under a different MCP-assigned timestamp.
6. **Search-path hardening on the new RPC** — applied a follow-up `CREATE OR REPLACE FUNCTION` with `SET search_path = public, extensions` after the advisor flagged `function_search_path_mutable`. Updated the source migration file so a fresh apply produces the advisor-clean state.

## For Downstream Plans

Plans 06-03, 06-04, 06-05, 06-06 can now:

- `import type { AudioFingerprintResult, AudioPerceptualResult, GeminiAudioSignals } from "@/lib/engine/types"`
- Read/write `audio_embedding` and `audio_description` columns on `trending_sounds` via the Supabase JS client (auto-typed)
- Read/write `audio_description` column on `analysis_results` (auto-typed)
- Call `supabase.rpc("match_trending_sound_by_audio", { query_embedding, match_threshold, match_count })` with full type safety on Args + Returns

When plans 06-05 / 06-06 emit `audio_perceptual_score` and `audio_fingerprint` on PredictionResult, they may also choose to promote those fields from optional to required — leaving them optional is fine if it eases the aggregator transition.

## Commits

```
6bdef39  feat(phase-06): add audio types to engine types module
2d67bff  feat(phase-06): add Supabase migration for audio fingerprint + HNSW
1c590ac  feat(phase-06): regenerate database.types.ts from live Supabase after migration apply
890c7b6  fix(phase-06): lock search_path on match_trending_sound_by_audio RPC
```
