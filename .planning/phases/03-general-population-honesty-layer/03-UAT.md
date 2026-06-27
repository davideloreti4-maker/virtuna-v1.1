---
status: testing
phase: 03-general-population-honesty-layer
source: [03-VERIFICATION.md, 03-REVIEW.md]
started: 2026-06-27
updated: 2026-06-27
---

## Current Test

number: 1
name: General template cards render honestly (WR-01 fix)
expected: |
  In the audience manager, the General-template cards (Analyst, Hiring) show a
  "Directional" trust badge + a "Template" status chip (NOT "Calibrated") + the
  "Authored template — Directional" provenance subline. No confident/calibrated
  signal anywhere on a Directional template.
awaiting: user response

## Tests

### 1. General template cards render honestly (WR-01 fix)
expected: Analyst + Hiring cards show "Directional" badge + "Template" chip (never "Calibrated") + "Authored template — Directional" subline.
result: [pending]

### 2. Mode='general' audience round-trips through CRUD (POP-03 data layer)
expected: A mode='general' audience saves (create), appears in its own "General templates" manager section (list), and renames (update) through the existing CRUD. No front-door mode picker yet — that is P7; create via the template/section path.
result: [pending]

### 3. Socials audiences byte-stable after the live migration
expected: Pre-existing Socials audiences are unchanged post-migration — still "Validated" badge, calibration status intact, weights unchanged. (Live DB read-back already attested 2 rows backfilled mode='socials', gated CHECK live, 3 new columns present — this is the visual confirm.)
result: [pending]

### 4. Success-criterion + custom-context author/edit persists + renders safely (POP-05/POP-02/D-07)
expected: In the audience form, the success-criterion textarea + the "User-added grounding" (custom_context) add/edit/remove list save through POST/PATCH and re-render. User text renders as plain escaped text (no HTML injection); over-cap entries are rejected at the API.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

## Known Limitations (not UAT gaps — out of this phase's scope)

- **Zero-setup General-template RUN through scoring is NOT exercisable this phase** — the General DomainPack scorer is deferred to a later phase (D-02). This phase delivers the General data layer + honesty surface only; running a general audience through a Read end-to-end lands when the General scorer ships.
- **Live DB migration** was applied via the Supabase MCP to the `virtuna-v1.1` project (not CLI `db push`) and verified by read-back; remote migration-history version reconciled to `20260627000000` to match the committed file.
