---
phase: 03-general-population-honesty-layer
verified: 2026-06-27T17:21:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open the audience manager. Inspect an Analyst/Hiring General template card."
    expected: "The card reads honestly: a 'Directional' TrustBadge + 'Authored template — Directional' provenance subline. NO confident 'Calibrated' status chip should sit beside the Directional badge."
    why_human: "WR-01 — getCalibrationStatus() has no mode==='general' branch, so general templates fall through to return 'calibrated' and AudienceStatusChip renders a confident 'Calibrated' chip ALONGSIDE the honest 'Directional' TrustBadge — a visual contradiction the in-phase render test does not cover (it asserts the badge tier + evidence affordance, not the co-rendered status chip). This is the review's WR-01 and is the one honesty inconsistency in a phase whose purpose is honesty. Non-blocking per operator guidance, but a human should eyeball whether the contradictory chip is acceptable to ship or worth a 1-line fix."
  - test: "Select a General template (analyst or hiring) and run a Read with zero setup; confirm the run/result card shows a 'Directional' badge."
    expected: "The template runs through the existing Read path with no calibration step, and the result card wears a Directional TrustBadge."
    why_human: "SC3 'a built-in default template panel runs with zero setup' + the run-badge half of TRUST-01 are end-to-end UI/run behaviors that grep + unit tests cannot exercise; the General scorer is deferred (D-02) so the run uses the existing Socials pipeline — a human should confirm the zero-setup run completes and reads Directional."
  - test: "Confirm the live virtuna-v1.1 Supabase DB carries the migration: `select mode, count(*) from public.audiences group by mode;` and that mode/success_criterion/custom_context columns + the gated audiences_weights_sum_check exist."
    expected: "All existing rows mode='socials' (0 general), three new columns present, gated CHECK active."
    why_human: "POP-01 SC1 'existing Socials audiences migrate cleanly' depends on the LIVE DB state, which the verifier cannot re-query from this toolset. 03-03-SUMMARY records an MCP read-back (socials:2, 0 general, gated CHECK + 3 columns present) and the operator context attests it — a human with DB access can confirm in seconds."
---

# Phase 3: General Population + Honesty Layer Verification Report

**Phase Goal:** `audiences` generalizes into a domain-agnostic population on the signature substrate — saveable, named, browseable, with an authorable success-criterion — and every audience and run wears an honest trust badge with surfaced provenance, while Socials stays byte-stable.
**Verified:** 2026-06-27T17:21:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A General audience exists on the signature substrate with socials enums / fixed 4-weight model now optional/pack-supplied; existing Socials audiences migrate cleanly and still run unchanged | ✓ VERIFIED | `audience-types.ts:218` `mode: "socials"\|"general"` required; `:260` `success_criterion?`; `:268` `custom_context?` additive-optional. Migration `20260627000000_audience_general.sql` adds `mode NOT NULL DEFAULT 'socials'` + re-gates `audiences_weights_sum_check` via `mode <> 'socials' OR (<verbatim 4-weight predicate, same <0.01 epsilon>)` → socials byte-stable. Live apply attested (03-03-SUMMARY MCP read-back: socials:2, 0 general, gated CHECK + 3 cols) — see human item 3. Determinism (POP-01) resolved via accepted Fallback Option 2 (bake-once-freeze); replay gate green |
| 2 | A General audience carries Mode, a trust tier, and an editable success-criterion; user can author/edit it | ✓ VERIFIED | `resolve-tier.ts` `resolveTier`/`tierFromCalibration` (socials→Validated via SOCIALS_PACK.calibration, general→Directional by rule); `audience-form.tsx:57` `successCriterion` state → `:264` Textarea → `:85` payload; routes accept `success_criterion`+`mode` (`route.ts:53/55`, `[id]/route.ts:56/58`) sanitized+capped. resolve-tier truth-table test green |
| 3 | User can save, name, browse, reuse General audiences in a General library; built-in default template panel (analyst/hiring) runs with zero setup | ✓ VERIFIED | `GENERAL_TEMPLATES` (`audience-repo.ts:117`) = analyst (`template-analyst`) + hiring (`template-hiring`), `mode:'general'`, `signature:null`, evidence-free virtual constants prepended in `listAudiences` (`:407`), refused on delete (SENTINEL_IDS `:226`). Save/name via existing CRUD (createAudience/updateAudience, repo-mode test case (f) green). Browse: "General templates" section in `audience-manager.tsx:346-350`. Zero-setup run end-to-end → human item 2 (General scorer deferred D-02; runs via existing Read path). Net-new front-door creation is explicitly P5/P7 |
| 4 | Each audience AND each run shows a Validated vs Directional badge in the UI | ✓ VERIFIED | Audience: `audience-card.tsx:54` `resolveTier(audience)` → `:118` `<TrustBadge tier={tier}/>`. Run: `blocks.ts:369` additive `props.tier` enum; emitter `two-audience-read.ts:218/250` `tier: resolveTier(pair[0]!)` on both return paths; renderer `multi-audience-read-block.tsx:239` `<TrustBadge tier={block.props.tier ?? 'Directional'}/>` (honest fallback). honesty-render + read-route + emitter tests green |
| 5 | A persona's provenance is surfaced — evidence visible, ungrounded personas read as visibly ungrounded | ✓ VERIFIED | `audience-display.ts:39` `isPersonaGrounded` (non-empty trimmed evidence). Card: grounded → inline evidence quote (`audience-card.tsx:143-152`); template → "Authored template — Directional" subline (`:154-157`); else muted "no evidence — Directional" (`:159-161`). honesty-render test asserts all three branches |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/audience/enrich-signature.ts` | thinking-mode dropped on synth bake | ✓ VERIFIED | `:355` `enable_thinking: false`; `thinking_budget` count = 0; `temperature:0`+`seed` retained |
| `scripts/rebake-determinism.ts` | paid double-bake harness | ✓ VERIFIED | Present, committed `6d5854a2` (repurposed as v2/CAL-01 drift tool per Option 2) |
| `src/lib/audience/resolve-tier.ts` | resolveTier/tierFromCalibration/TrustTier | ✓ VERIFIED | Keys off `SOCIALS_PACK.calibration`; general→Directional directly, never Validated |
| `src/lib/audience/audience-types.ts` | mode/success_criterion/custom_context/CustomContext | ✓ VERIFIED | All four present; custom_context top-level (not in SignatureProvenance) |
| `supabase/migrations/20260627000000_audience_general.sql` | additive mode-gated migration | ✓ VERIFIED | Correct DDL; committed `6d8b6073`; live apply attested |
| `src/lib/audience/audience-repo.ts` | mappers + zod + GENERAL_TEMPLATES + mode='socials' on constants | ✓ VERIFIED | 3 fields round-trip; presets mode='socials'; templates mode='general' signature-null evidence-free |
| `src/components/audience/trust-badge.tsx` | TrustBadge over Badge primitive | ✓ VERIFIED | Wraps `@/components/ui/badge`; Validated→default, Directional→secondary; no coral/glass |
| `src/components/audience/audience-display.ts` | isPersonaGrounded + generalTemplates bucket | ✓ VERIFIED | Predicate + bucket route mode==='general' before is_preset check |
| `src/components/audience/audience-card.tsx` | badge + inline evidence/ungrounded render | ✓ VERIFIED | resolveTier→TrustBadge in header; provenance block with 3 branches |
| `src/components/audience/audience-manager.tsx` | General templates section | ✓ VERIFIED | `:346-350` section bound to generalTemplates bucket |
| `src/app/api/audiences/route.ts` + `[id]/route.ts` | CreateAudienceSchema/PatchAudienceSchema new fields | ✓ VERIFIED | mode/success_criterion/custom_context sanitized + capped on both |
| `src/components/audience/audience-form.tsx` | success-criterion + custom-context author/edit | ✓ VERIFIED | successCriterion Textarea + customContext add/edit/remove list wired to payload |
| `src/lib/tools/blocks.ts` | additive props.tier enum | ✓ VERIFIED | `:369` top-level optional enum; per-audience `.strict()` retained |
| `src/components/thread/multi-audience-read-block.tsx` | TrustBadge mount on run card | ✓ VERIFIED | Import + mount with honest Directional fallback |
| `src/lib/engine/flash/two-audience-read.ts` | emitter resolveTier wiring | ✓ VERIFIED | tier set from lead audience on both return paths (not in plan files_modified but plan-authorized) |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| audience-card.tsx | resolve-tier.ts | `TrustBadge tier={resolveTier(audience)}` | ✓ WIRED |
| resolve-tier.ts | packs/socials.ts | `SOCIALS_PACK.calibration` | ✓ WIRED |
| audience-form.tsx | audiences/[id]/route.ts | PATCH `{ success_criterion, custom_context }` | ✓ WIRED |
| listAudiences | GENERAL_TEMPLATES | prepend `[GENERAL, ...PRESETS, ...GENERAL_TEMPLATES, ...userRows]` | ✓ WIRED |
| multi-audience-read-block.tsx | trust-badge.tsx | `TrustBadge tier={block.props.tier}` | ✓ WIRED |
| two-audience-read.ts (emitter) | resolve-tier.ts | `tier: resolveTier(pair[0]!)` | ✓ WIRED (data flows: emitter sets tier → block → badge, not a constant) |

### Behavioral Spot-Checks (project runner: `node ./node_modules/vitest/vitest.mjs run`)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Audience lib + components + routes | `… src/lib/audience src/components/audience src/app/api/audiences` | 22 files / 249 passed | ✓ PASS |
| Determinism replay + resolver + honesty render + read route + emitter + reskin guard | targeted 6-file run | 6 files / 35 passed | ✓ PASS |
| Thread + tools block registry/renderers | `… src/components/thread src/lib/tools` | 20 files / 206 passed | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| POP-01 | 03-01/02/03/04 | Generalize audiences on signature substrate; socials migrate cleanly | ✓ SATISFIED | mode axis + additive migration + repo mappers; determinism via accepted Option 2 (bake-once-freeze), replay gate green, thinking-off in place |
| POP-02 | 03-02/06 | General audience carries Mode + success-criterion + trust tier | ✓ SATISFIED | mode field + resolveTier + success_criterion form/route |
| POP-03 | 03-04/05 | Save/name/browse/reuse in a General library | ✓ SATISFIED | data-layer CRUD + manager General-templates surface (net-new front-door = P5/P7 by design) |
| POP-04 | 03-04 | Built-in analyst/hiring template panel, zero setup | ✓ SATISFIED | GENERAL_TEMPLATES virtual constants |
| POP-05 | 03-06 | Author + edit success-criterion | ✓ SATISFIED | Textarea + POST/PATCH zod (scorer untouched D-02 — surfaced, not consumed) |
| TRUST-01 | 03-05/07 | Validated/Directional badge on each audience AND each run | ✓ SATISFIED | card badge + run-card badge via emitter resolveTier |
| TRUST-02 | 03-05/06 | Provenance surfaced; ungrounded reads ungrounded | ✓ SATISFIED | isPersonaGrounded inline evidence / muted ungrounded affordance + user-added grounding |

All 7 phase requirement IDs accounted for. (TRUST-03 belongs to Phase 2 — Complete — and underpins POP-01's determinism mitigation.)

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (modified file set) | — | TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER | ℹ️ none | Clean — no debt markers in any phase-modified file |
| audience-display.ts | 68-76 | `getCalibrationStatus` falls through to `"calibrated"` for general templates | ⚠️ WARNING | WR-01: confident "Calibrated" chip co-renders with honest "Directional" badge — honesty contradiction (see human item 1) |
| audiences/route.ts, [id]/route.ts | 69-71 | `personas`/`profile`/`calibration` are `z.unknown()` uncapped | ⚠️ WARNING | WR-02: storage/DoS + self-scoped prompt-injection surface; non-blocking, own-tenant blast radius |
| audience-repo.ts | 425-534 | getAudience/update/deleteAudience lack `.eq("user_id")` | ⚠️ WARNING | WR-03: ownership relies solely on RLS; docstring overclaims app-layer scoping |
| audience-form.tsx | 118-123 | tautological `else` (AudienceType only personal\|target) | ⚠️ WARNING | WR-04: dead branch hides intent |
| audiences/[id]/route.ts | 168-182 | DELETE guard only covers GENERAL_AUDIENCE.id | ⚠️ WARNING | WR-05: preset/template DELETE returns generic 500 not clean 400 (still refused) |

All warnings are advisory (0 blockers in 03-REVIEW.md) and per operator guidance do not by themselves fail the phase.

### Human Verification Required

See frontmatter `human_verification` — 3 items:
1. **WR-01 visual honesty** — confirm the General template card does not present a contradictory "Calibrated" chip beside the "Directional" badge (the one item the automated render test does not cover).
2. **Zero-setup General template run** — confirm an analyst/hiring template runs end-to-end with no calibration and the result card reads Directional (SC3 + run-badge half of TRUST-01).
3. **Live DB migration state** — confirm on virtuna-v1.1 that all rows are mode='socials', the 3 columns + gated CHECK exist (verifier cannot re-query the live DB; attested by 03-03 MCP read-back).

### Gaps Summary

No blocking gaps. All 5 ROADMAP success criteria and all 7 requirement IDs are satisfied in the codebase, with the determinism leg (POP-01) closed by the operator-accepted Fallback Option 2 (bake-once-freeze) rather than a live `signatureEqual:true` — the replay gate is green (35 targeted + 249 audience-surface tests pass) and the thinking-off change is in place, matching the D-01 resolution recorded in 03-01-SUMMARY. Status is **human_needed** (not passed) because this is a UI honesty phase whose SC4/SC5 are about rendered UI, the live-DB migration state cannot be re-queried from the verifier toolset, and the WR-01 honesty contradiction on template cards is a visual judgment the automated tests do not catch. The five review warnings are advisory and non-blocking.

---

_Verified: 2026-06-27T17:21:00Z_
_Verifier: Claude (gsd-verifier)_
