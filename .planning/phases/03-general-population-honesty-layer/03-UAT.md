---
status: complete
phase: 03-general-population-honesty-layer
source: [03-VERIFICATION.md, 03-REVIEW.md]
started: 2026-06-27
updated: 2026-06-27
verified_by: claude-autonomous
verification_method: live-supabase-db + real component/route vitest suites + source trace + live browser pass
build_fix: BUILD-01 (client-bundle dns break) found in browser pass, fixed, re-verified
---

## Current Test

[testing complete]

## Tests

### 1. General template cards render honestly (WR-01 fix)
expected: Analyst + Hiring cards show "Directional" badge + "Template" chip (never "Calibrated") + "Authored template — Directional" subline.
result: pass
evidence: |
  VERIFIED IN A REAL BROWSER (logged in as e2e-test@virtuna.local, /audience). DOM extract of the
  "General templates" section:
    - "Analyst Panel — Directional — Template — 4 personas · Custom · Target — … — Authored template — Directional"
    - "Hiring Panel  — Directional — Template — 4 personas · Custom · Target — … — Authored template — Directional"
  No "Calibrated" on either General template. (The only "Calibrated" chip on the page is on
  "Fitness Creators", a real user-owned calibrated socials audience in Yours — honest, not WR-01.)
  Presets read Validated/Template; baseline reads Validated/Baseline. Screenshot in scratchpad:
  audience-fixed-render.png.
  NOTE: this required fixing BUILD-01 first (see below) — the page did not render at all on the
  first browser pass. Underlying logic also gated by honesty-render.test.tsx:170 (real AudienceCard,
  asserts no "Calibrated" + "Template" + "Directional").

### 2. Mode='general' audience round-trips through CRUD (POP-03 data layer)
expected: A mode='general' audience saves (create), appears in its own "General templates" manager section (list), and renames (update) through the existing CRUD.
result: pass
evidence: |
  - audience-repo-mode.test.ts green: mode round-trips through create/list/update mappers.
  - Live DB: `mode` column + `audiences_mode_check` accept mode IN ('socials','general').
  - Browser: the "General templates" section renders with Analyst + Hiring (groupAudiences routes
    mode==='general' → generalTemplates bucket), confirmed live at /audience.

### 3. Socials audiences byte-stable after the live migration
expected: Pre-existing Socials audiences unchanged post-migration — Validated tier, calibration intact, weights unchanged.
result: pass
evidence: |
  Verified DIRECTLY against the live virtuna-v1.1 DB:
  - socials:2, general:0 (every existing row stayed socials).
  - 3 cols present (mode text NOT NULL default 'socials'; success_criterion text null; custom_context
    jsonb NOT NULL default '[]').
  - audiences_weights_sum_check gated (mode<>'socials') OR (4-weight bounds AND abs(sum−1.0)<0.01).
  Browser cross-check: socials presets + baseline render "Validated"; the calibrated socials audience
  "Fitness Creators" renders "Calibrated" — all honest.

### 4. Success-criterion + custom-context author/edit persists + renders safely (POP-05/POP-02/D-07)
expected: success-criterion + custom_context save through POST/PATCH and re-render; user text escaped; over-cap rejected.
result: pass
evidence: |
  - route.ts: success_criterion .max(2000).transform(sanitizeText); custom_context array .max(50),
    note .max(2000) sanitized, source pinned "user"; over-cap → 400. No dangerouslySetInnerHTML.
  - route.test.ts + persona-edit.test.tsx green.
  - audience-form.tsx does not import the resolve-tier/pack chain (so it was never part of BUILD-01).

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[all resolved — BUILD-01 fixed in this session, see below]

## BUILD-01 — client-bundle break on /audience (found in browser pass, FIXED + re-verified)

- **Symptom:** /audience returned a Next.js Build Error "Module not found: Can't resolve 'dns'" and
  rendered nothing — the headline honesty surface was fully down. Vitest (node env) could not catch it.
- **Root cause:** audience-card.tsx ("use client") → resolve-tier.ts imported the whole SOCIALS_PACK
  → socials.ts imports runPredictionPipeline → pipeline.ts → apify-provider → apify-client →
  pac-resolver → Node 'dns'. The server-only engine pipeline was dragged into the client bundle.
  Introduced in P3 (resolve-tier created d16046f2, mounted on card 33d30681). No next.config dns
  fallback → `next build` would fail too.
- **Fix (surgical, ENGINE_VERSION-safe):**
  - NEW src/lib/engine/packs/socials-calibration.ts — leaf module exporting SOCIALS_CALIBRATION
    ({kind:'socials', baselineRef}), no pipeline import.
  - socials.ts: `calibration: SOCIALS_CALIBRATION` (byte-identical value → ENGINE_VERSION 3.20.0
    unchanged, prediction cache valid).
  - resolve-tier.ts: imports SOCIALS_CALIBRATION (leaf) instead of SOCIALS_PACK → client-safe.
- **Re-verified:** /audience renders in the browser (cards honest, see Test 1); 80/80 across 7 targeted
  suites incl. the engine audience-regression gate; dev (turbopack) recompiles clean. Prod build fixed
  by construction (resolve-tier no longer pulls the pipeline barrel into the client graph).

## Known Limitations (not UAT gaps — out of this phase's scope)

- **Zero-setup General-template RUN through scoring is NOT exercisable this phase** — General DomainPack
  scorer deferred (D-02). This phase delivers the General data layer + honesty surface only.
- **Live DB migration** applied via Supabase MCP to virtuna-v1.1; re-confirmed this session
  (socials:2, 0 general, gated CHECK + 3 columns).
