-- =========================================================================
-- Library rework phase 1 — saved_items integrity: one save per block, + remix
--
-- Two additive changes that close the "save is write-only" defect:
--
-- 1. `remix` becomes a real item_type. remix-card-block.tsx saved its output as
--    item_type 'hook' because no remix type existed, so the shelf labelled a
--    remix "Hook" and offered it the hook forward action. Widening the CHECK is
--    backward compatible — every existing row keeps its type.
--
-- 2. A PARTIAL unique index on (user_id, item_type, ref_id). Without it a second
--    click on an already-saved card writes a SECOND row, which is exactly what
--    shipped: saved state was derived from the mutation's own isSuccess flag, so
--    it reset on remount and the card offered "Save" again.
--
--    Partial (WHERE ref_id IS NOT NULL) because the 10 rows that predate
--    provenance all have ref_id NULL. They are GRANDFATHERED, not backfilled:
--    their origin is genuinely unknown and inventing a ref_id would be a
--    fabricated provenance. A full unique index would also collapse all of them
--    into one row per (user, type), silently deleting saves.
--
-- Verified before applying: 0 duplicate (user_id, item_type, ref_id) groups
-- among rows with a non-null ref_id, so the index builds without conflict.
-- =========================================================================

-- ── 1. remix ────────────────────────────────────────────────────────────────
ALTER TABLE public.saved_items DROP CONSTRAINT IF EXISTS saved_items_item_type_check;

ALTER TABLE public.saved_items ADD CONSTRAINT saved_items_item_type_check
  CHECK (item_type IN ('read','idea','hook','script','outlier','format','remix'));

-- `format` stays in the CHECK deliberately. No renderer emits it and 0 rows carry
-- it, so it is dropped from the TypeScript union, the zod enum and the filter bar
-- — but narrowing a CHECK buys nothing and would reject any legacy write.

-- ── 2. one save per block ───────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS saved_items_user_type_ref_uniq
  ON public.saved_items (user_id, item_type, ref_id)
  WHERE ref_id IS NOT NULL;

COMMENT ON INDEX public.saved_items_user_type_ref_uniq IS
  'One save per (user, type, originating block). Partial: pre-provenance rows have ref_id NULL and are grandfathered rather than backfilled.';
