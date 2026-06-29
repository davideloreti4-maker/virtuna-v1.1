---
phase: 5
slug: profile-simulate-wow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-28
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `05-RESEARCH.md` §Validation Architecture (code-grounded, HIGH confidence).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (vendored) |
| **Config file** | `vitest.config.ts` (repo root) |
| **Quick run command** | `node ./node_modules/vitest/vitest.mjs run <path>` |
| **Full suite command** | `node ./node_modules/vitest/vitest.mjs run` |
| **Estimated runtime** | TBD — measure during Wave 0 |

> ⚠️ **Runner gotcha (LOCKED):** `npm test` / `npx vitest` print fake `PASS(0)/FAIL(0)`. ALWAYS use `node ./node_modules/vitest/vitest.mjs run`.
> ⚠️ **Live-smoke gotcha (LOCKED):** vitest does NOT load `.env.local` into `process.env`. Gated DashScope/qwen smokes silently 401 via the dummy-key fallback (and a 1×1 PNG → 400). Gate live smokes on a **REAL key + a real fixture**, never the dummy-key path.
> ⚠️ **Bundle-leak gotcha (GSI P3 BUILD-01):** vitest-in-node cannot catch Next client/server bundle leaks. A real browser pass (or `next build`) is required before the phase is marked done.

---

## Sampling Rate

- **After every task commit:** Run the touched module's quick run (e.g. `node ./node_modules/vitest/vitest.mjs run src/lib/tools/runners/__tests__/simulate-runner.test.ts`).
- **After every plan wave:** Run the engine + tools + audience + threads suites.
- **Before `/gsd-verify-work`:** Full suite must be green; one gated live smoke per LLM path (real key) + a manual one-thread browser UAT.
- **Max feedback latency:** TBD — measure during Wave 0.

---

## Requirement → Test Map

> Task IDs are assigned by the planner (next `/gsd-plan-phase 5` invocation). The planner MUST map each task to a row below so the per-task verification map can be completed during execution.

| Requirement | Behavior | Test Type | Automated Command (quick run via vendored vitest) | File |
|-------------|----------|-----------|----------------------------------------------------|------|
| PROF-01 | person/panel detection from evidence (pure logic) | unit | `… run src/lib/audience/__tests__/profile-bake.test.ts` | ❌ Wave 0 |
| PROF-01 | bake produces frozen `AudienceSignature` (synth mocked) | unit (mock synth dep) | same file | ❌ Wave 0 |
| PROF-01 | bake LLM synthesis end-to-end | gated live smoke (real key + fixture) | `RUN_PROFILE_LIVE_SMOKE=1 … run profile-bake.live` | ❌ Wave 0 |
| PROF-02 | `ProfileReadBlockSchema` validates / rejects 0-100 (`.strict()`) | unit | `… run src/lib/tools/__tests__/blocks.test.ts` | ⚠️ extend |
| PROF-02 | tells carry evidence quotes; forensic null on flash, present on max | unit (canned READ) | `… run src/lib/tools/runners/__tests__/profile-runner.test.ts` | ❌ Wave 0 |
| PROF-02 | behavioral system prompt includes D-04 never-coach + caveat lines | unit (string assertion) | `… run src/lib/engine/__tests__/behavioral-core.test.ts` | ❌ Wave 0 |
| PROF-02 | (optional) `scanForExcludedCoaching` backstop trips coaching / passes audit | unit (harvest 58 branch tests) | same | ❌ Wave 0 |
| PROF-02 | READ content quality | gated live smoke | opt-in env | ❌ Wave 0 |
| PROF-03 | `createAudience(mode:"general")` persists + appears in `listAudiences` | unit (mock supabase) | `… run src/lib/audience/__tests__/audience-repo.test.ts` | ⚠️ extend |
| PROF-04 | `handoffsFor("profile")` returns the simulate CTA | unit | `… run src/lib/tools/__tests__/chain-handoff.test.ts` | ⚠️ extend |
| SIMU-01 | runner reuses flash + aggregate (mocked flash) → reactions | unit (mock `runFlashTextMode`) | `… run src/lib/tools/runners/__tests__/simulate-runner.test.ts` | ❌ Wave 0 |
| SIMU-01 | simulate end-to-end | gated live smoke | opt-in env | ❌ Wave 0 |
| SIMU-02 | `ReactionDistributionBlockSchema` person→single read / panel→band+themes; rejects score | unit | `… run src/lib/tools/__tests__/blocks.test.ts` | ⚠️ extend |
| SIMU-02 | theme clustering (pure) + person/panel presentation branch | unit | simulate-runner test | ❌ Wave 0 |
| SIMU-03 | both blocks register in `BLOCK_REGISTRY` + round-trip `insertMessage`/`loadMessages` | unit (mock supabase) | `… run src/lib/threads/__tests__/messages.test.ts` + block-registry test | ⚠️ extend |
| SIMU-03 | full Profile→Simulate one-thread flow | manual UAT / gated e2e | browser pass (auth via `e2e/create-test-user.ts`) | ❌ Wave 0 |
| D-08 (sec) | evidence / `success_criterion` / `custom_context` isolated (system prompt carries no user bytes) | unit (assert assembled messages) | profile-runner / simulate-runner tests | ❌ Wave 0 |
| P4 carry AR-04-01 | `storagePath` regex rejects `..` / absolute | unit | stimulus/types or route test | ❌ Wave 0 |
| P4 carry AR-04-02 | `text` content cap enforced | unit | route test | ❌ Wave 0 |

*Status legend: ❌ Wave 0 (must be created) · ⚠️ extend (add cases to existing suite).*

---

## Wave 0 Requirements

- [ ] `src/lib/engine/__tests__/behavioral-core.test.ts` — prompt-block content assertions (D-04 lines, tier-gated directives) → PROF-02
- [ ] `src/lib/audience/__tests__/profile-bake.test.ts` — person/panel detection + synth-mocked bake → PROF-01
- [ ] `src/lib/tools/runners/__tests__/profile-runner.test.ts` — READ assembly + isolation + forensic-by-tier → PROF-02 / D-08
- [ ] `src/lib/tools/runners/__tests__/simulate-runner.test.ts` — flash-mocked reactions + person/panel branch + theme clustering → SIMU-01/02
- [ ] Extend `blocks.test.ts` / `block-registry` / `messages` / `chain-handoff` / `audience-repo` suites for the new types + CTA + persistence → PROF-03/04, SIMU-02/03
- [ ] Gated live smokes (READ, omni video read, bake synth, simulate) — opt-in env, real key + real fixture
- [ ] (optional) harvest the branch's 58 `ethics-gate.test.ts` cases if the regex backstop is adopted

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full Profile-a-chat → Simulate-a-reply in one continuous thread | SIMU-03 | E2E thread flow + Next client/server bundle integrity (vitest-in-node misses bundle leaks — GSI P3 BUILD-01 precedent) | Auth via `e2e/create-test-user.ts`; drop a chat fixture → READ card renders w/ evidence quotes → "Simulate a message to [them]" CTA → draft reply → reaction-distribution card; verify Directional badge + bands-only (no 0-100) on both cards |
| Behavioral READ content quality + forensic-by-tier | PROF-02 | LLM output quality + Max/video-only forensic layer need real model + real fixtures | Gated live smoke (real key); confirm flash tier omits the deep forensic layer, Max/video tier includes it |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency measured (set during Wave 0)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
