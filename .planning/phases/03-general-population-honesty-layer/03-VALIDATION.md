---
phase: 3
slug: general-population-honesty-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-27
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `03-RESEARCH.md` §Validation Architecture. Per-task IDs are assigned by the planner; the executor/nyquist-auditor fills the per-task map.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | repo `vitest` config (runner quirk: `npm test` / `npx vitest` print fake PASS(0)/FAIL(0)) |
| **Quick run command** | `node ./node_modules/vitest/vitest.mjs run src/lib/audience/__tests__/<file>.test.ts` |
| **Full suite command** | `node ./node_modules/vitest/vitest.mjs run` |
| **Component tests** | opt into `happy-dom` via the top-of-file `vitest-environment happy-dom` pragma + `@testing-library/react` (see `src/components/audience/__tests__/persona-edit.test.tsx`) |
| **Typecheck gate** | the repo `tsc --noEmit` baseline is NON-ZERO (pre-existing errors in `src/components/app/brand-deals/earnings-chart.tsx` + `src/lib/tools/runners/__tests__/hooks-runner.test.ts`). Gate on **no NEW errors on the touched paths** — `! npx tsc --noEmit 2>&1 \| grep -E '<changed-path-regex>'` exits 0 — NOT a clean full-repo run. Vitest is the primary behavioral gate. |
| **Estimated runtime** | ~10–30 seconds (unit + component); D-01 live re-bake is a separate paid manual gate |

---

## Sampling Rate

- **After every task commit:** Run the touched module's test via the quick command (`resolve-tier.test.ts` / repo test / `honesty-render.test.tsx`).
- **After every plan wave:** Run `node ./node_modules/vitest/vitest.mjs run src/lib/audience` (+ `src/components/audience` for the UI wave).
- **Before `/gsd-verify-work`:** Full suite green **AND** the manual D-01 live double-bake evidence (`signatureEqual:true`) recorded.
- **Max feedback latency:** ~30 seconds (unit/component); D-01 gate is human-approved, out of the latency budget.

---

## Per-Task Verification Map

> Requirement-indexed seed (task IDs TBD — planner assigns; nyquist-auditor maps to `{N}-PP-TT`).

| Req / Decision | Behavior | Test Type | Automated Command | File Exists | Status |
|---------|----------|-----------|-------------------|-------------|--------|
| D-01 (Wave 0) | live double-bake → `signatureEqual:true` + no synth-quality regression vs socials control | manual / live (paid) | re-bake harness under `scripts/` | ❌ W0 | ⬜ pending |
| POP-01 | Socials audience round-trips byte-stable post-migration (`mode='socials'`, weights + gated CHECK satisfied); `rowToAudience`/`audienceToRow` carry `mode` losslessly | unit | `… resolve-tier.test.ts` + `audience-repo-mode.test.ts` (03-04) | ❌ W0 | ⬜ pending |
| POP-01 | existing assembly/normalization determinism still green | unit | `… signature-determinism.test.ts` | ✅ (kept, free) | ⬜ pending |
| POP-02 | `resolveTier(audience)` truth table (socials→Validated; general/undefined/`{}`/`{baselineRef:""}`→Directional, never Validated) | unit | `… resolve-tier.test.ts` (03-02) | ❌ W0 | ⬜ pending |
| POP-03 | General audience saves / lists / reuses (create+update `mode='general'` round-trip = the existing manager CRUD; rename = updateAudience) | unit | `audience-repo-mode.test.ts` create/update/list with `mode='general'` (03-04) | ❌ W0 | ⬜ pending |
| POP-04 | analyst + hiring constants present, prepended, `signature:null`, tier Directional, skipped on write | unit | `audience-repo-mode.test.ts`: `GENERAL_TEMPLATES` in `listAudiences` + `deleteAudience` throws on their ids (03-04) | ❌ W0 | ⬜ pending |
| POP-05 | success-criterion authored + edited persists | unit/integration | route test on PATCH with `success_criterion` (03-06) | ❌ W0 | ⬜ pending |
| TRUST-01 | badge derives correct tier for each audience + each run | unit (resolver) + component (render) | `resolve-tier.test.ts` (03-02) + `honesty-render.test.tsx` (03-05, in-phase) | ❌ W0 | ⬜ pending |
| TRUST-02 | grounded persona shows evidence; empty-evidence persona reads ungrounded | unit (`isPersonaGrounded`) + component (render) | `audience-display.test.ts` helper + `honesty-render.test.tsx` (03-05, in-phase) | ❌ W0 | ⬜ pending |
| TRUST-02 | `custom_context` persists + renders distinctly | unit | repo test on `custom_context` round-trip (03-04) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/<re-bake-harness>.ts` — D-01 live double-bake (re-create the torn-down spike probe; reuse the frozen `socials-bundle.fixture.json`)
- [ ] `src/lib/audience/__tests__/resolve-tier.test.ts` — tier truth table (POP-02 / TRUST-01) — 03-02
- [ ] `src/lib/audience/__tests__/audience-repo-mode.test.ts` (or extend an existing repo test) — `mode` / `success_criterion` / `custom_context` round-trip + template constants + sentinel-skip + `mode='general'` save/name (create+update) (POP-01/03/04/05, TRUST-02) — 03-04
- [ ] `src/components/audience/__tests__/honesty-render.test.tsx` — in-phase component render test for the headline honesty deliverable: TrustBadge tier (socials→Validated / general→Directional) + grounded-vs-ungrounded persona affordance (TRUST-01/02). **Lands in 03-05 THIS phase** — UI-SPEC was `--skip-ui`'d, so there is NO downstream `/gsd-ui-phase` to catch a honesty-render regression.

*Existing `signature-determinism.test.ts` already covers assembly/normalization determinism + 10-persona evidence presence — free, keep green.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live double-bake determinism after dropping thinking-mode | D-01 (Wave-0 gate) | Requires a real paid Qwen `qwen3.7-plus` call; the existing replay test is byte-deterministic by construction and cannot exercise the live LLM | Set `DASHSCOPE_API_KEY`; run the re-created re-bake harness twice on the frozen `khaby.lame` fixture; assert `signatureEqual(a,b)===true`; A/B synth output vs socials control for quality. Budget ~10 Qwen calls / <$0.50. |

*Fine visual polish (exact spacing, hover, motion) remains a non-blocking human-glance concern; the behavioral badge-tier + grounded/ungrounded RENDER is now automated in-phase via `honesty-render.test.tsx` (no `/gsd-ui-phase` deferral).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (unit/component); D-01 manual gate recorded separately
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
</content>
