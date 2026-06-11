---
phase: 2
slug: omni-verbatim
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-04
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `02-RESEARCH.md` §"Validation Architecture". The single critical
> regression risk is the **assembly hop** (the emotion_arc bug: field declared +
> prompted but dropped on the assembly literal → 26/26 null prod rows). Every
> verbatim field must be proven to survive all 4 hops on a real run (R1).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (already in repo) |
| **Config file** | existing repo `vitest` config |
| **Quick run command** | `npx vitest run src/lib/engine/__tests__/omni-analysis-verbatim.test.ts src/lib/engine/remix/__tests__/` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~quick <15s · full suite per repo baseline |

---

## Sampling Rate

- **After every task commit:** Run quick command (verbatim unit test + remix no-regression test)
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite green **AND** one real-run R1 proof
  (speech-bearing video → non-empty `verbatim`; silent video → `null`, specifically NOT `[inaudible]`)
- **Max feedback latency:** ~15s (quick) / full-suite baseline (wave)

---

## Per-Task Verification Map

> Task IDs are placeholders until the planner assigns plan/wave numbers. The
> behaviors below are the Nyquist checkpoints every plan must map a task onto.

| Behavior | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|----------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Schema ACCEPTS `hook_verbatim` + per-segment `spoken_text`/`on_screen_text` (happy path) | R1 | — | N/A | unit | `npx vitest run .../omni-analysis-verbatim.test.ts` | ❌ W0 | ⬜ pending |
| Schema validates WITHOUT verbatim (backward-compat, `.optional()`) | R1 | — | N/A | unit | same | ❌ W0 | ⬜ pending |
| System prompt contains literal `hook_verbatim`/`spoken_text` + fidelity rules (D-04) | R1 | — | N/A | unit | same | ❌ W0 | ⬜ pending |
| **Verbatim survives the assembly hop** (`geminiResult.analysis.hook_verbatim` populated) — THE regression | R1 | — | N/A | unit | same (mirror emotion_arc test :170–184) | ❌ W0 | ⬜ pending |
| Silent input → `null`, NOT `[inaudible]`, NOT a description | D-02 | T-2-01 | Zod `.nullable()`; prompt absence-contract | unit | same | ❌ W0 | ⬜ pending |
| Present-but-unclear speech → `[inaudible]` preserved through pipeline | D-04.2 | — | distinct-from-null marker held end-to-end | unit | same | ❌ W0 | ⬜ pending |
| Over-cap string rejected by Zod | D-04.4 | T-2-01 | `z.string().max(N)` ceiling → reject → MAX_RETRIES re-prompt | unit | same | ❌ W0 | ⬜ pending |
| `temperature: 0` + `seed: QWEN_SEED` unchanged at call site | R8 | — | sampling untouched | grep/unit | `grep 'temperature: 0' + 'seed: QWEN_SEED' src/lib/engine/qwen/omni-analysis.ts` | ✅ assert-unchanged | ⬜ pending |
| Remix `omniOutputToStructuralInput` still non-null + tests green | R12 | — | additive field invisible to fixed allowlist | unit | `npx vitest run src/lib/engine/remix/__tests__/` | ✅ stay-green | ⬜ pending |
| **Persists on a real run** — DB query after a real analyze | R1 | — | N/A | manual/integration | `npx tsx scripts/measure-pipeline.ts <video>` → `select verbatim from analysis_results where id=...` | ✅ harness | ⬜ pending |
| E2E under latency cap with verbatim live | R6 | — | token budget held by D-04.4 caps | manual | `npx tsx scripts/measure-pipeline.ts <video>` | ✅ harness | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/engine/__tests__/omni-analysis-verbatim.test.ts` — clone
  `omni-analysis-emotion-arc.test.ts`; cover schema accept/reject, backward-compat,
  prompt-literal, the **assembly-hop regression** (the bug), and the
  null-vs-`[inaudible]` contract assertions (D-02 / D-04.2).
- [ ] (If persistence Option A — dedicated column) confirm `src/types/database.types.ts`
  regen or hand-add `verbatim` to Row/Insert/Update (mirror emotion_arc :197/:251/:305).
- [ ] Real-run proof checklist (manual): one speech-bearing video (non-empty `verbatim`)
  + one silent video (`null`, NOT `[inaudible]`), each queried in `analysis_results`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Verbatim persists end-to-end on a real Omni run | R1 | Requires a live DashScope/Qwen call + DB write — not unit-mockable; this is the exact hop the emotion_arc bug hid in | Run `npx tsx scripts/measure-pipeline.ts <speech-video>`; then query `analysis_results` for the row's `verbatim`; assert non-empty `hook_verbatim.spoken_words` + per-segment text. Repeat with a silent video; assert `null`, not `[inaudible]`. |
| E2E latency under R6 cap with verbatim live | R6 | Real network/model latency; estimate only without a live run | `npx tsx scripts/measure-pipeline.ts <video>` — confirm total stays under the latency cap with the extra output tokens. |

---

## Validation Sign-Off

- [ ] All behaviors have an `<automated>` verify or a Wave 0 dependency (manual R1/R6 proofs noted above)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the verbatim unit test file)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s (quick) / suite baseline (wave)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
