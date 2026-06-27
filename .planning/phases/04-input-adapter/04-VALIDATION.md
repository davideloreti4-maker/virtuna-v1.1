---
phase: 4
slug: input-adapter
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-27
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `04-RESEARCH.md` § Validation Architecture + § Security Domain.
> Task IDs (`4-NN-NN`) resolve when the planner lands `*-PLAN.md`; rows below are keyed by behavior/requirement until then.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (already installed; engine tests under `src/lib/engine/__tests__/` + per-module `__tests__/`) |
| **Config file** | `vitest.config.*` (present — confirm exact path in Wave 0) |
| **Quick run command** | `node ./node_modules/vitest/vitest.mjs run src/lib/engine/stimulus` |
| **Full suite command** | `node ./node_modules/vitest/vitest.mjs run` |
| **Estimated runtime** | quick ~10s · full suite TBD (confirm Wave 0) |

> ⚠️ Test-runner quirk (locked): `npm test` / `npx vitest` print fake PASS(0)/FAIL(0). Tests MUST run via `node ./node_modules/vitest/vitest.mjs run`.

---

## Sampling Rate

- **After every task commit:** Run `node ./node_modules/vitest/vitest.mjs run src/lib/engine/stimulus`
- **After every plan wave:** Run `node ./node_modules/vitest/vitest.mjs run` (full suite — catches any accidental Socials-path regression)
- **Before `/gsd-verify-work`:** Full suite green + the D-02 structural smoke green
- **Max feedback latency:** ~15 seconds (quick run)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | 1 | IN-01 | — | text input → `Stimulus{kind:"text", content, tier:"flash"}` | unit | `… run src/lib/engine/stimulus/__tests__/normalize.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | 1 | IN-01 | T-V12 | `.txt`/`.md` `File` → `content`=file text; bad ext rejected; oversize rejected | unit | `… run src/lib/engine/stimulus/__tests__/ingest.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | 1 | IN-02 | — | `resolveSim1Tier`: video→"max"; text/file_text/image→"flash" (pure fn) | unit | `… run src/lib/engine/stimulus/__tests__/tier.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | 1 | IN-03 | T-V5 | image `File` → base64 data URL; vision call shape (model=REASONING, `image_url`+text items); `getQwenClient` **mocked** | unit | `… run src/lib/engine/stimulus/__tests__/vision.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | 0 | IN-03 (A2) | — | real base64 PNG → `qwen3.7-plus` returns parseable read | smoke (live, gated) | `it.skip` unless `DASHSCOPE_API_KEY` present | ❌ W0 | ⬜ pending |
| TBD | — | 1 | D-06 | — | person-video → `Stimulus{kind:"video", tier:"max", subject.isProfiledSubject, subject.goal}` | unit | `… run src/lib/engine/stimulus/__tests__/normalize.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | * | D-02 | — | Socials path structurally unchanged (`normalizeInput`/`AnalysisInput`/`ContentPayload`/pipeline branches untouched) | light structural smoke | `… run src/lib/engine/stimulus/__tests__/socials-untouched.smoke.test.ts` + existing `normalize.test.ts`/`pipeline.test.ts` stay green | ❌ W0 (new) / ✅ (existing) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> Vision model call is **mocked** in unit tests (assert request shape + response parse). The only live touch is the gated A2 base64 smoke (Wave 0, `DASHSCOPE_API_KEY`-gated). Tier rule is a **pure function** — fully unit-testable, no model call.

---

## Wave 0 Requirements

- [ ] `src/lib/engine/stimulus/__tests__/normalize.test.ts` — stubs for IN-01 + D-06
- [ ] `src/lib/engine/stimulus/__tests__/tier.test.ts` — stubs for IN-02 (pure fn)
- [ ] `src/lib/engine/stimulus/__tests__/vision.test.ts` — stubs for IN-03 (mock `getQwenClient`)
- [ ] `src/lib/engine/stimulus/__tests__/ingest.test.ts` — file validate (size/type/ext)
- [ ] `src/lib/engine/stimulus/__tests__/socials-untouched.smoke.test.ts` — D-02 structural smoke
- [ ] A2 base64 vision live smoke (gated on `DASHSCOPE_API_KEY`)
- [ ] Confirm `vitest.config` path (framework already installed — no install needed)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A2: live base64 image accepted by `qwen3.7-plus` | IN-03 | Requires a live `DASHSCOPE_API_KEY` + network; cited in DashScope docs but not yet exercised in-repo | Run the gated smoke with `DASHSCOPE_API_KEY` set; if base64 `data:` URL is rejected, fall back to the proven Storage→signed-URL path (avatar pattern). Verify before relying on in-memory base64. |

*All other phase behaviors have automated (mocked/pure) verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
