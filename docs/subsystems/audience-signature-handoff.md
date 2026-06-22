# AudienceSignature — Fresh-Session Handoff

> Track A (wire-live) + Track B step-7 (generation/SIM wiring) are **DONE, committed, and
> verified** on `rework/engine-core`. This is the only file the next session must read first;
> pull the rest on demand. Supersedes the prior "pick track A or B" version.

---

## Paste this as the opening prompt

```
Read docs/subsystems/audience-signature-handoff.md. The real AudienceSignature path is
live: migration applied, calibration persists signature+creator_persona, reveal works,
and step-7 generation+SIM wiring is done (creator voice fallback + reaction_frame SIM).
Pick up at "What's next" = Track B step 8 (composer intent). FIRST resolve the GAP-C2
vocab decision (composer grow|sell vs audience's 4 intents), THEN build. Do NOT touch
ENGINE_VERSION; keep signature gated behind non-general; keep the General-regression gate
green. Confirm the C2 decision before building.
```

---

## State of the world (2026-06-24, end of session)

- **Worktree:** `~/virtuna-engine-rework`, branch `rework/engine-core`. Clean tree, auto-wip
  committed (HEAD `b792a77b`).
- **DB:** migration `20260624000000_audience_signature.sql` **APPLIED** to project
  `qyxvxleheckijapurisj` (virtuna-v1.1, = `.env.local`). `audiences.creator_persona` +
  `audiences.signature` jsonb cols live. Generated types match the hand-added cols (no drift).
- **Design SSOT:** `docs/subsystems/audience.md` §P. Backlog: `docs/DISSECTION-BACKLOG.md`
  (A7 + S1 = FIXED; DONE section has the 2026-06-24 session log).
- **Guardrails HELD:** `ENGINE_VERSION` 3.19.0 untouched · signature gates behind non-general
  ONLY · General-regression gate green (prompt-level byte-identical proven).

---

## ✅ Done this session

| Item | What | Files |
|---|---|---|
| Track A.1 | Migration applied to DB; types no-drift | `supabase/migrations/20260624000000_audience_signature.sql` |
| Track A.2 | Full authed browser UAT (create→calibrate→reveal→persist→navigate, @doctormike, real Apify+DashScope) | — (live) |
| A7 fix | Orphan draft row — calibrate route accepts `audienceId` → `updateAudience` in place (no dupe). Live-verified row_count 1. +route test | `src/app/api/audiences/calibrate/route.ts`, `route.test.ts` |
| S1 fix | `script`/`remix` were niche-blind (raw `niche_primary`) → now route through shared `buildReactionPanel` (resolveNicheKey) | `script-runner.ts`, `remix-runner.ts` |
| Step-7 SIM | **FINDING: already live.** `personasFromSignature` maps `repaint = reaction_frame`; runners fold repaint into `buildNicheAwareSystemPrompt`. No work needed. | `calibration.ts:103` |
| Step-7 generation | **DONE.** New `applyCreatorPersona(profileRow, audience)`: voice FALLBACK (manual `writing_voice_sample` wins; auto-derived `writing_style_sample` backfills) + `content_description`/`context` steer into overrides. Wired into idea/hooks/script runners. +unit test (6 cases). | `src/lib/audience/apply-creator-persona.ts`, ideas/hooks/script runners |

**Hot-path traced:** routes (`hooks`/`ideas`/`script`/`remix`) load audience via `getAudience`
→ `rowToAudience` maps `creator_persona` (repo:199) → pass `audience: activeAudience` to runner
→ `applyCreatorPersona` → voice+steer reach the assembled prompt. Proven no-LLM (voice sample +
context + content_desc all present; General byte-identical).

**Verify (all green this session):** tsc clean (src) · eslint 0 errors · 104 runner+kc + 149
audience/gate tests pass. Pre-existing only: 3 DELETE-415 route quirks, 1 stale eslint-disable.

---

## ✅ Track B step 8 (composer intent C1/C2) — DONE 2026-06-24

**GAP-C2 DECIDED: "keep 2, derive down"** (confirmed with user). Composer keeps the 2-value
per-run lens (`grow|sell`); audience's 4-value `goal_intent` maps down for the default
(authority/nurture→grow — already baked into weights + repaint at calibration). C1 plumbed:
intent reaches all 5 skills. See `docs/subsystems/audience.md` §P.10 + `DISSECTION-BACKLOG.md`
DONE 2026-06-24. New module `src/lib/audience/intent-lens.ts`; SIM seam = sell directive in the
`buildFlashUserContent` user message (system-prompt cache prefix + ENGINE_VERSION untouched).
Gate-safe (General → undefined no-op). 413 tests green; tsc/eslint clean (no new issues).

## ▶ What's next — Track B step 9 (flywheel / drift re-bake)

1. **Step 9 flywheel/drift** — mostly built per the original handoff; re-bake the frozen signature
   on the weekly drift cron (the ONLY place it re-bakes — intentional, §P).

### Deferred / loose ends (lower priority)
- **Remix generation voice** — remix generates via the adapt path (not `assembleBundle`), so the
  step-7 creator voice is NOT wired there. Small consistency fix if desired.
- **Live E2E of step-7/8** — wiring is proven; the LLM-honors-voice (step 7) and LLM-honors-buying-frame
  (step 8 sell lens) behaviors are unobserved live (~$0.05 each to check). Optional.

> Start in a FRESH context.

---

## Gotchas / decisions to carry forward

- **Additive, not a rename.** `signature`/`creator_persona` are NEW nullable cols; legacy
  `profile`/`personas`/4-weight-cols stay (back-compat + regression gate). Calibration populates BOTH.
- **Weights are derived** (reality-first); `personasFromSignature` maps `repaint = reaction_frame`
  (this is why the SIM half was already live — don't re-build it).
- **Voice wiring is FALLBACK** (decided): manual profile voice wins; auto-derived backfills only
  when absent. General/no-audience → `applyCreatorPersona` returns inputs unchanged (gate-safe).
- **All enrichment/calibration I/O injectable** (`EnrichDeps`/`CalibrationDeps`) → unit tests zero-LLM.
- **Vitest:** use `node ./node_modules/vitest/vitest.mjs run …` ([[vitest-rtk-shim]]).

## Anchors

| Concern | File |
|---|---|
| Design SSOT | `docs/subsystems/audience.md` §P |
| Backlog (A7/S1 fixed, session log) | `docs/DISSECTION-BACKLOG.md` |
| Step-7 generation helper | `src/lib/audience/apply-creator-persona.ts` |
| Step-8 intent lens (C2) | `src/lib/audience/intent-lens.ts` · `flash-prompts.ts` `SELL_LENS_DIRECTIVE` |
| SIM seam | `src/lib/engine/flash/build-reaction-panel.ts`, `run-flash-text-mode.ts` |
| Calibration (signature→legacy map) | `src/lib/audience/calibration.ts` |
| Generation runners | `src/lib/tools/runners/{ideas,hooks,script,remix}-runner.ts` |
| Calibrate route (A7) | `src/app/api/audiences/calibrate/route.ts` |
| Commerce/intent context | memory [[commerce-marketing-intent-track]] |
