-- =========================================================================
-- Phase 3 — General Population + Honesty Layer
-- audiences: generalize along the new `mode` axis (D-04) + add the
--   success_criterion (D-03) and custom_context (D-07) storage.
--
-- Design guarantees:
--   - ADDITIVE only. ADD COLUMN IF NOT EXISTS; DEFAULTs backfill every
--     historical row in-place (no separate UPDATE). Mirrors
--     the 20260624000000 (audience_signature) + 20260601000000 (add-mode) idioms.
--   - `mode` is a FIRST-CLASS axis (NOT derived from is_general). DEFAULT
--     'socials' backfills all existing rows → Socials byte-stable.
--   - SOCIALS BYTE-STABILITY: the unconditional audiences_weights_sum_check is
--     dropped and recreated GATED to mode='socials' via logical implication
--     (mode <> 'socials' OR <predicate>). The 4-weight predicate is copied
--     VERBATIM from 20260619000000_audiences.sql:47-52 (same `< 0.01` epsilon),
--     so previously-valid Socials rows pass IDENTICALLY (Pitfall 4).
--   - NEVER alter the weight column DEFINITIONS (keep the 4 cols NOT-NULL with
--     their existing defaults). General-specific population/weights belong in a
--     future jsonb col, never overloading the 4 socials slots.
--   - Scope-locked to public.audiences ONLY: no other table, no scoring config,
--     no engine version, no RLS change. The existing row-level policies
--     (audiences_select_own / audiences_all_own) cover the new columns by inheritance.
-- =========================================================================

-- (1) mode — first-class domain axis. DEFAULT backfills every existing row to
--     'socials' in the same ADD COLUMN statement (no separate UPDATE, D-04).
ALTER TABLE public.audiences
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'socials' CHECK (mode IN ('socials','general'));

-- (2) success_criterion (D-03) + custom_context (D-07).
--     custom_context is top-level (NOT nested in signature) so General/template
--     audiences with signature:null still have somewhere to store it (Pitfall 2).
ALTER TABLE public.audiences
  ADD COLUMN IF NOT EXISTS success_criterion text,
  ADD COLUMN IF NOT EXISTS custom_context    jsonb NOT NULL DEFAULT '[]';

-- (3) Drop the unconditional weight-sum CHECK so it can be re-gated.
ALTER TABLE public.audiences DROP CONSTRAINT IF EXISTS audiences_weights_sum_check;

-- (4) Recreate it GATED to mode='socials' via logical implication. The OR-branch
--     predicate is byte-identical to 20260619000000_audiences.sql:47-52 — same
--     [0,1] bounds, same `ABS(... - 1.0) < 0.01` epsilon — so Socials rows pass
--     IDENTICALLY (byte-stable). General rows (mode='general') skip it by design;
--     their population/weight model is pack-supplied, never the 4 socials slots.
ALTER TABLE public.audiences
  ADD CONSTRAINT audiences_weights_sum_check
  CHECK (
    mode <> 'socials'
    OR (
      fyp >= 0 AND fyp <= 1 AND
      niche >= 0 AND niche <= 1 AND
      loyalist >= 0 AND loyalist <= 1 AND
      cross_niche >= 0 AND cross_niche <= 1 AND
      ABS((fyp + niche + loyalist + cross_niche) - 1.0) < 0.01
    )
  );

COMMENT ON COLUMN public.audiences.mode IS
  'First-class domain axis (D-04): ''socials'' (default, runs the Socials pack — byte-stable) or ''general'' (domain-agnostic SIM). NOT derived from is_general. DEFAULT ''socials'' backfills all historical rows in the same ADD COLUMN. The audiences_weights_sum_check is gated to mode=''socials'' so the 4-weight model is only enforced for Socials rows; General population/weights are pack-supplied, never overloading the 4 socials slots.';

COMMENT ON COLUMN public.audiences.success_criterion IS
  'Free-text "what good means" for this audience (D-03): the metric the pack scorer optimizes. Authorable/editable in the audience form. NULL for legacy/unset rows. Flows into DomainPack.scoring for General modes (P5/P6).';

COMMENT ON COLUMN public.audiences.custom_context IS
  'User-added grounding (D-07): CustomContext[] = [{ source:"user", note, persona_evidence_link? }]. TOP-LEVEL (not nested in signature/provenance) so General/template audiences with signature:null can still carry it (Pitfall 2). DEFAULT ''[]'' backfills all rows. Rendered as plain text (React-escaped), never dangerouslySetInnerHTML.';
