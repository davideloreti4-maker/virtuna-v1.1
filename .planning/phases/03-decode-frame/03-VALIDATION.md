---
phase: 03
slug: decode-frame
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-02
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `03-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + @testing-library + vitest-axe |
| **Config file** | `vitest.config.*` (project root — confirm exact name at plan time) |
| **Quick run command** | `npx vitest run <path>` |
| **Full suite command** | `npm test` (`vitest run`) |
| **Estimated runtime** | ~30s quick / full suite per existing baseline |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test file>` (< 30s)
- **After every plan wave:** Run `npm test` (full Vitest suite)
- **Before `/gsd:verify-work`:** Full suite green + one live remix-URL manual decode (~70–100s path) producing non-empty beats + non-empty luck lane
- **Max feedback latency:** ~30 seconds (quick), full suite per wave

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | DECODE-01 | — | N/A | unit | `npx vitest run src/lib/engine/remix/__tests__/decode.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | — | DECODE-01 | — | decode path skips pipeline + usage_tracking (C2) | unit (route, mocked) | `npx vitest run src/app/api/analyze/__tests__/decode-route.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | — | DECODE-01 | — | persists `variants.remix.decode`, preserves sibling `variants.craft` (read-merge-write) | unit | `npx vitest run src/app/api/analyze/__tests__/decode-route.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | — | DECODE-01 | — | decode row `overall_score: null`, `mode: 'remix'`; completion marker `variants.remix != null` (m3) | unit | `npx vitest run src/app/api/analyze/__tests__/decode-route.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | — | DECODE-02 | — | `luck` array length ≥ 1 always (backstop on empty model output) | unit | `npx vitest run src/lib/engine/remix/__tests__/decode.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | — | DECODE-02 | — | luck categories restricted to fixed D-05 taxonomy (Zod enum) | unit | `npx vitest run src/lib/engine/remix/__tests__/decode.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | — | DECODE-02 | — | beat with no signal returns `verdict:'absent'` + honest body, not fabricated content | unit | `npx vitest run src/lib/engine/remix/__tests__/decode.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | — | DECODE-02/SC#4 | — | rendered beats+lanes contain NO advice verbs / second-person (you/fix/improve/should/try/consider) | component | `npx vitest run src/components/board/decode/__tests__/DecodeShellNode.test.tsx` | ⚠️ add | ⬜ pending |
| TBD | TBD | — | DECODE-01 | — | DecodeShellNode renders all 4 beats + both lanes from fixture (live + permalink) | component | `npx vitest run src/components/board/decode/__tests__/DecodeShellNode.test.tsx` | ⚠️ add | ⬜ pending |
| TBD | TBD | — | DECODE-01/C4 | — | decode path deletes re-hosted temp mp4 (derive-and-drop) | unit | extend `src/app/api/analyze/__tests__/derive-and-drop.test.ts` | ⚠️ extend | ⬜ pending |
| TBD | TBD | — | SC#5 | — | score-mode board + existing analyze flow unchanged (regression) | unit | existing route/board suites stay green | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/engine/remix/__tests__/decode.test.ts` — DECODE-01/02 (beats×4 fixed order, luck≥1, fixed taxonomy, honest-absence verdicts, voice). Needs Omni-fixture built from spike §6 real values
- [ ] `src/app/api/analyze/__tests__/decode-route.test.ts` — C2 (no pipeline, no usage_tracking), `variants.remix.decode` persistence + read-merge-write, `overall_score` null
- [ ] `src/components/board/decode/__tests__/DecodeShellNode.test.tsx` — 4-beat + 2-lane render from fixture, no-advice-verb assertion, in-flight "Decoding…" state, mobile parity
- [ ] Extend `src/app/api/analyze/__tests__/derive-and-drop.test.ts` — decode path deletes temp mp4
- [ ] Omni structural fixture (real-shaped from spike §6) — shared by decode + component tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live remix decode renders non-empty beats + non-empty luck on a real viral URL | DECODE-01/02, SC#1/#3 | Requires live Omni+Qwen calls (~70–100s); cannot mock end-to-end fidelity | Paste a known viral non-owned URL in remix mode, confirm 4 beats render with content/honest-absence + luck lane non-empty |
| Latency well under full pipeline (SC#2) | DECODE-01 | Wall-clock timing of live path | Time remix submit → decode rendered; confirm ≪ ~332s |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
