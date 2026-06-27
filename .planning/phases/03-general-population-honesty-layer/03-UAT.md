---
status: complete
phase: 03-general-population-honesty-layer
source: [03-VERIFICATION.md, 03-REVIEW.md]
started: 2026-06-27
updated: 2026-06-27
verified_by: claude-autonomous
verification_method: live-supabase-db + real component/route vitest suites + source trace
---

## Current Test

[testing complete]

## Tests

### 1. General template cards render honestly (WR-01 fix)
expected: Analyst + Hiring cards show "Directional" badge + "Template" chip (never "Calibrated") + "Authored template — Directional" subline.
result: pass
evidence: |
  WR-01 fix is in current code (post-verification commits 0c9ee991/91521415):
  - audience-display.ts:73 getCalibrationStatus() routes mode==='general' → "template"
    FIRST, so it never falls through to "calibrated".
  - audience-status-chip.tsx: status "template" → label "Template", variant "secondary"
    (muted) — never "Calibrated".
  - resolve-tier.ts:36 resolveTier(general) → "Directional" (mode !== "socials").
  - audience-display.ts:152 getTemplateProvenanceLabel(general) → "Authored template — Directional".
  Behavioral gate: honesty-render.test.tsx:170 renders the REAL AudienceCard and asserts
  queryByText("Calibrated") === null + "Template" chip present + "Directional" badge present —
  the exact WR-01 co-render contradiction, now regression-locked. 75/75 in 6 suites green.

### 2. Mode='general' audience round-trips through CRUD (POP-03 data layer)
expected: A mode='general' audience saves (create), appears in its own "General templates" manager section (list), and renames (update) through the existing CRUD. No front-door mode picker yet — that is P7; create via the template/section path.
result: pass
evidence: |
  - audience-repo-mode.test.ts green: mode round-trips through create/list/update mappers
    (case (f) writes mode='general', reads it back).
  - Live DB (virtuna-v1.1): `mode` column present (text, NOT NULL, default 'socials') and
    `audiences_mode_check` CHECK accepts mode IN ('socials','general') — DB layer accepts a
    general row.
  - groupAudiences() routes mode==='general' → generalTemplates bucket (audience-display.ts:140)
    → bound to the "General templates" manager section (audience-manager.tsx:346-350).
  Scope note: net-new front-door creation (mode picker) is P5/P7 by design; this phase
  delivers + proves the data-layer round-trip, not a new UI create flow.

### 3. Socials audiences byte-stable after the live migration
expected: Pre-existing Socials audiences are unchanged post-migration — still "Validated" badge, calibration status intact, weights unchanged.
result: pass
evidence: |
  Verified DIRECTLY against the live virtuna-v1.1 DB (not by trusting 03-03-SUMMARY):
  - `select mode, count(*) from audiences group by mode` → socials:2, general:0 (every existing
    row stayed socials; nothing broke).
  - 3 new columns present: mode (text NOT NULL default 'socials'), success_criterion (text null),
    custom_context (jsonb NOT NULL default '[]').
  - audiences_weights_sum_check is gated: (mode <> 'socials') OR (4-weight 0..1 bounds AND
    abs(sum − 1.0) < 0.01) — socials rows still enforced, general exempt. Matches migration file.
  - resolveTier(socials) → Validated (SOCIALS_PACK.calibration baseline) — unchanged.

### 4. Success-criterion + custom-context author/edit persists + renders safely (POP-05/POP-02/D-07)
expected: success-criterion textarea + custom_context add/edit/remove save through POST/PATCH and re-render. User text renders as plain escaped text (no HTML injection); over-cap entries rejected at the API.
result: pass
evidence: |
  - route.ts CreateAudienceSchema: success_criterion z.string().max(2000).transform(sanitizeText);
    custom_context array .max(50), each note .max(2000) sanitized, source pinned to literal "user".
    Over-cap → safeParse fails → 400 invalid_audience_input (PATCH mirrors per VERIFICATION).
  - sanitizeText strips control chars (\x00-\x1F\x7F) + trims.
  - No dangerouslySetInnerHTML anywhere in src/components/audience or src/app/api/audiences →
    React escapes user text as plain text (no HTML injection).
  - route.test.ts + persona-edit.test.tsx green (custom-context add/edit/remove UI wired to payload).

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none — all 4 tests pass]

## Verification notes (autonomous run, 2026-06-27)

Tested by Claude directly (user delegated: "test everything yourself in browser if needed"),
using the live Supabase DB (Test 3), real component/route vitest suites that exercise the exact
code paths (Tests 1/2/4 — 75/75 in 6 suites), and source trace. This settles 03-VERIFICATION.md
human items #1 (WR-01 visual honesty — fix landed + regression-gated) and #3 (live DB migration).

NOT exercised (and why):
- **Authenticated live-browser visual pass** — the /audience page is hard-gated behind a real
  Supabase email/password session (app layout redirects to /login). No test credentials available,
  so the rendered page + CSS was not eyeballed in a browser. The component render IS proven by
  honesty-render.test.tsx against the real AudienceCard.
- **Human item #2 — zero-setup General-template RUN end-to-end reading Directional.** The General
  DomainPack scorer is deferred (D-02), so a true run-through-scoring is out of this phase's scope
  (see Known Limitations). The run-card Directional badge path itself is test-covered
  (two-audience-read.ts emitter + multi-audience-read-block honest fallback) but a live end-to-end
  run was not executed (auth-gated + deferred scorer).

## Known Limitations (not UAT gaps — out of this phase's scope)

- **Zero-setup General-template RUN through scoring is NOT exercisable this phase** — the General
  DomainPack scorer is deferred to a later phase (D-02). This phase delivers the General data
  layer + honesty surface only.
- **Live DB migration** was applied via the Supabase MCP to the `virtuna-v1.1` project and verified
  by direct read-back (this session re-confirmed: socials:2, 0 general, gated CHECK + 3 columns).
