-- ─────────────────────────────────────────────────────────────────────────────
-- The curated receipts named the wrong baseline.
--
-- 20260714120000_normalize_curated_teardowns.sql set `baseline_label = 'vs followers'` on the
-- Sandcastles import, recording it as "owner-confirmed" and claiming it had been "corroborated
-- against the data rather than taken on faith". Both were wrong:
--
--   * The corroboration was hollow. There IS no follower data to corroborate against — 0 of the
--     532 rows carry a `follower_count`, and the raw Sandcastles record has no follower field at
--     all. Its only metric is `outlier_score`. Nothing in the data could have confirmed a follower
--     ratio, because nothing in the data mentions followers.
--   * The basis is not followers. Owner, 2026-07-14: **`outlier_score` is measured against the
--     creator's PAST VIDEO VIEWS** — views ÷ what that creator's videos normally do.
--
-- The number was always real. Only its NAME was invented. The cost of the wrong name was a card
-- that told users:
--
--     proven by @colinandsamir · 1226.3× vs followers · 60M views
--
-- for an account with well over a million followers, where a follower ratio would be nearer 60×.
-- Read correctly — 1226× the views that creator's videos usually get — it is both true and a far
-- stronger claim. This is the standard creator definition of an outlier, and it is the one metric
-- that survives a creator's follower count being stale, private, or unknowable.
--
-- Renaming it also repairs the >=3x proof gate, which had been quietly measuring nothing: a bar of
-- "3x its follower count" applied to a score that was never about followers.
--
-- Scraped rows are NOT touched. The orchestrator computes their multiplier from a follower count it
-- actually captured (outlier-gate.ts), so for them 'vs followers' is a claim we can stand behind.
-- The two pools now carry two honest, DIFFERENT bases, and the label is what tells them apart.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.outlier_teardowns
SET baseline_label = 'vs their usual views'
WHERE extraction_version = 'sandcastles-import-v1'
  AND baseline_label = 'vs followers';

-- Belt-and-braces: any curated row that still carries a multiplier but no basis at all cannot make
-- a claim. retrieve.ts refuses to print a number without a label, but a row whose label went
-- missing would degrade to a silent exemplar rather than a loud failure — so name it here.
UPDATE public.outlier_teardowns
SET baseline_label = 'vs their usual views'
WHERE source_pool = 'curated'
  AND outlier_multiplier IS NOT NULL
  AND (baseline_label IS NULL OR baseline_label = '');
