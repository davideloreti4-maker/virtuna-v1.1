-- Phase 15 (CALIB-01): Platt parameters engine_version discriminator.
--
-- Adds engine_version TEXT NOT NULL column to platt_parameters so multiple
-- engine versions can coexist. The two existing rows (id=1 sample_count=79,
-- id=2 sample_count=224) are text-mode-trained on the Gemini+DeepSeek engine
-- and are backfilled to '2.1.0' as historical reference (preservation rule
-- per MILESTONE.md "Stack decisions" — never DELETE).
--
-- Sequence is atomic: ADD nullable → UPDATE backfill → SET NOT NULL.
-- Partial-apply states cannot exist (single migration file, implicit txn).
--
-- Decisions: D-01 (column add, not JSONB), D-02 (backfill to '2.1.0'),
-- D-03 (single composite index), D-05 (filename stamp).

-- Step 1: Add column as nullable (existing rows tolerated)
ALTER TABLE platt_parameters ADD COLUMN engine_version TEXT;

-- Step 2: Backfill text-mode rows
UPDATE platt_parameters SET engine_version = '2.1.0' WHERE engine_version IS NULL;

-- Step 3: Enforce NOT NULL post-backfill
ALTER TABLE platt_parameters ALTER COLUMN engine_version SET NOT NULL;

-- Step 4: Composite index for getPlattParameters ordering
-- (engine_version equality filter + created_at DESC limit 1)
CREATE INDEX idx_platt_parameters_engine_created
  ON platt_parameters(engine_version, created_at DESC);
