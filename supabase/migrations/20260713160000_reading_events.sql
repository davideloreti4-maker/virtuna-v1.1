-- THE READING LEDGER — usage becomes an event, not a row count.
--
-- Until now the meter counted rows in `analysis_results`. That conflates "a Reading" (the unit
-- the customer is charged for) with "a row" (an artefact of how the pipeline persists), and the
-- two come apart in three ways that all bill the customer wrongly:
--
--   1. FAILED RUNS BILL. The SSE branch inserts a placeholder row BEFORE the engine runs
--      (route.ts, "Pitfall #6") so the reconnect stream has something to read. A run that dies
--      mid-pipeline leaves that row behind — and the count charges for it. A customer pays for
--      an engine failure.
--   2. DELETES REFUND. Delete a Reading from the library and the count drops: the month's
--      allowance silently comes back. Usage must not be rewritable by the user.
--   3. Nothing is auditable. "Why does it say 34?" has no answer, and a refund/credit has
--      nowhere to live.
--
-- An append-only event log fixes all three: one row per Reading actually DELIVERED, written by
-- the service role at the moment of success, immutable thereafter. `billed=false` is the seat
-- for future credits/refunds and comped runs — it is written, it just doesn't count.
--
-- Safe on a live DB: a new table only. `lib/billing/quota.ts` falls back to counting
-- analysis_results if this table is absent, so the app behaves identically before this
-- migration is applied and switches to the ledger the moment it is.

CREATE TABLE IF NOT EXISTS reading_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- TEXT, not UUID: analysis_results.id became TEXT in 20260527105138 (the route mints
  -- nanoid(12)). ON DELETE SET NULL is the point of the ledger — deleting the Reading must
  -- NOT delete the fact that it was delivered, or a delete would refund the allowance.
  analysis_id TEXT REFERENCES analysis_results(id) ON DELETE SET NULL,

  -- Does this event consume allowance? FALSE = delivered but not charged (a comped run, a
  -- credited failure). The quota check counts only billed=true.
  billed BOOLEAN NOT NULL DEFAULT TRUE,

  -- 'score' (a full simulation) | 'remix' (a decode). Both are engine spend and both bill
  -- today; keeping the mode makes it possible to price them apart later without a backfill.
  mode TEXT,

  -- The tier at the moment of the Reading — so a usage history stays readable after an
  -- upgrade, and so a dispute can be settled without reconstructing the subscription timeline.
  tier TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The hot path: "how many billed Readings has this user had since <window start>", run on
-- every /api/analyze before any engine spend.
CREATE INDEX IF NOT EXISTS idx_reading_events_user_created
  ON reading_events (user_id, created_at DESC)
  WHERE billed;

ALTER TABLE reading_events ENABLE ROW LEVEL SECURITY;

-- Users may READ their own usage (the balance in /settings). Nothing else: no INSERT, no
-- UPDATE, no DELETE policy exists for the anon/authenticated roles, so a user cannot mint
-- themselves Readings or erase the ones they have spent. The service role (which bypasses RLS)
-- is the only writer — see lib/billing/record-reading.ts.
DROP POLICY IF EXISTS "Users can view own reading events" ON reading_events;
CREATE POLICY "Users can view own reading events"
  ON reading_events FOR SELECT
  USING (user_id = (SELECT auth.uid()));

COMMENT ON TABLE reading_events IS
  'Append-only ledger of Readings actually delivered. One row per successful Reading, written by the service role at the moment of success. THE meter: quota counts billed=true rows in the current billing period. Never counts a failed engine run, and a deleted analysis_results row does not refund the allowance (analysis_id goes NULL, the event stays).';

COMMENT ON COLUMN reading_events.billed IS
  'Whether this Reading consumes allowance. FALSE = delivered but not charged (comp, credit, refund). Write the event either way — an unbilled Reading that leaves no trace is unauditable.';
