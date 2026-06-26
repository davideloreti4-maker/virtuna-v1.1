---
phase: 2
slug: trustworthy-sim-spike
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-26
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> **Note:** this is a SPIKE. The KEPT artifact (replay determinism test) is fully automated; the make-or-break LLM-determinism evidence comes from a THROWAWAY live probe (manual run, needs `DASHSCOPE_API_KEY` + `APIFY_TOKEN`). The phase gate is `SPIKE-VERDICT.md` (GO/NO-GO), not green tests alone.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (installed; engine suite green — 95 files / 1170 passed per STATE.md) |
| **Config file** | repo Vitest config (existing) |
| **Quick run command** | `node ./node_modules/vitest/vitest.mjs run src/lib/audience/__tests__/signature-determinism.test.ts` |
| **Full suite command** | `node ./node_modules/vitest/vitest.mjs run` |
| **Estimated runtime** | ~15s (quick: <2s replay; full audience suite: a few s) |

> ⚠️ Test-runner quirk: `npm test` / `npx vitest` emit fake PASS(0)/FAIL(0). ALWAYS run via `node ./node_modules/vitest/vitest.mjs run`.

---

## Sampling Rate

- **After every task commit:** Run `node ./node_modules/vitest/vitest.mjs run src/lib/audience/__tests__/signature-determinism.test.ts`
- **After every plan wave:** Run `node ./node_modules/vitest/vitest.mjs run src/lib/audience`
- **Before `/gsd-verify-work`:** Full suite green + `SPIKE-VERDICT.md` written with an explicit GO/NO-GO.
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| determinism (assembly) | TBD | — | TRUST-03 | — | N/A | unit (replay) | `node ./node_modules/vitest/vitest.mjs run src/lib/audience/__tests__/signature-determinism.test.ts` | ❌ W0 | ⬜ pending |
| normalization (`scraped_at` only delta) | TBD | — | TRUST-03 | — | N/A | unit | same file | ❌ W0 | ⬜ pending |
| tiering (Directional by rule) | TBD | — | TRUST-03 | — | N/A | unit (pure predicate) | same file | ❌ W0 | ⬜ pending |
| LLM determinism (live ×2 double-bake) | TBD | — | TRUST-03 | — | N/A | manual (throwaway probe) | `node --import tsx scripts/spike/trustworthy-sim-probe.ts` | ❌ W0 | ⬜ pending |
| provenance (≥1 evidence/reactor; ungrounded distinguishable; scraped + `source=user`) | TBD | — | TRUST-03 | — | N/A | manual (probe assertions) + verdict | (in probe) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/audience/signature-equality.ts` — `normalizeSignature` + `signatureEqual` (KEPT — P3 regression foundation)
- [ ] `src/lib/audience/__tests__/signature-determinism.test.ts` — replay gate, zero network (KEPT)
- [ ] `src/lib/audience/__tests__/fixtures/bake-input.fixture.json` + `bake-llm-outputs.fixture.json` — recorded from the live bake
- [ ] `scripts/spike/trustworthy-sim-probe.ts` + chat-bundle adapter + `fixtures/socials-bundle.fixture.json` (THROWAWAY — D-05)
- Framework install: none — Vitest present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| LLM-bake determinism (the make-or-break unknown — thinking-mode seed honoring) | TRUST-03 | Needs live Qwen + 1 Apify call (real network, cost ~$0.50); cannot run in CI | Set `DASHSCOPE_API_KEY` + `APIFY_TOKEN`, run `node --import tsx scripts/spike/trustworthy-sim-probe.ts`; assert load-bearing fields identical across the 2 bakes |
| Provenance inspection (scraped + `source=user`) | TRUST-03 | Judgment over real baked output (grounded vs ungrounded distinguishability) | Probe prints per-reactor evidence counts + grounding flags; record in `SPIKE-VERDICT.md` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
