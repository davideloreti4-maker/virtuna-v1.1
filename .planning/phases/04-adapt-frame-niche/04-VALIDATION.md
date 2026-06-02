---
phase: 4
slug: adapt-frame-niche
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-02
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 04-RESEARCH.md §Validation Architecture + §Security Domain.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 (`package.json:104`) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/lib/engine/remix src/components/board/adapt src/app/api/remix` |
| **Full suite command** | `npm test` (`vitest run`) |
| **DOM env directive** | `/** @vitest-environment happy-dom */` (per AdaptShellNode.test.tsx) |
| **Estimated runtime** | ~quick <15s scoped · full suite per existing baseline |

---

## Sampling Rate

- **After every task commit:** `npx vitest run src/lib/engine/remix src/components/board/adapt src/app/api/remix`
- **After every plan wave:** `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds (scoped quick run)

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| ADAPT-01 | adapt.ts returns exactly 3 concepts, each with hook/angle/who_its_for/format_borrowed (Zod `.length(3)`) | unit | `npx vitest run src/lib/engine/remix/__tests__/adapt.test.ts` | ❌ W0 | ⬜ pending |
| ADAPT-01 | malformed/short Qwen output → repair attempt; final invalid → null (graceful) | unit (mock Qwen client) | same file | ❌ W0 | ⬜ pending |
| ADAPT-01 | input builder signature only accepts AdaptInput — source caption/content_summary unrepresentable (Pitfall 1, D-01) | unit | same file | ❌ W0 | ⬜ pending |
| ADAPT-01 | concepts drawn from `repeatable[]`; `luck[]` excluded from prompt (D-01) | unit | same file | ❌ W0 | ⬜ pending |
| ADAPT-01 | 3 stacked AdaptConceptCard render hook headline + format_borrowed chip + 2 muted rows (D-09) | component | `npx vitest run src/components/board/adapt/__tests__` | ❌ W0 | ⬜ pending |
| ADAPT-02 | empty niche (both null) shows inline NichePicker; populated niche renders cards (D-11) | component | adapt dir | ❌ W0 | ⬜ pending |
| ADAPT-02 | inline niche PATCH awaited (mutateAsync) then generate — no race (Pitfall 5, D-12) | component (mock hooks) | adapt dir | ❌ W0 | ⬜ pending |
| D-05 | variants.remix.adapt rehydrates on reload, no regeneration (Pitfall 3) | component | adapt dir | ❌ W0 | ⬜ pending |
| D-05 | read-merge-write preserves variants.craft + variants.remix.decode (Pitfall 2) | unit (endpoint/persist) | `npx vitest run src/app/api/remix/adapt/__tests__` | ❌ W0 | ⬜ pending |
| D-06 | adapt failure leaves Decode frame intact (independent failure, Pitfall 4) | component | adapt dir | ❌ W0 | ⬜ pending |
| ADAPT crit 5 | grade-mode board unchanged (no regression) | existing suite | `npm test` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/engine/remix/__tests__/adapt.test.ts` — exactly-3, repair loop, no-caption guard, luck-exclusion (mock `getQwenClient`)
- [ ] `src/components/board/adapt/__tests__/AdaptFrameBody.test.tsx` — niche-prompt vs cards, rehydrate-no-regen, independent failure
- [ ] `src/components/board/adapt/__tests__/AdaptConceptCard.test.tsx` — card anatomy (hook/chip/rows)
- [ ] `src/app/api/remix/adapt/__tests__/route.test.ts` — read-merge-write preservation, auth (401), Zod body validation
- [ ] Test fixture: `src/lib/engine/remix/decode.fixture.ts` doubles as the test input fixture (hand-authored, D-02)
- [ ] Qwen client mock pattern — reference existing engine `__tests__` mocking `getQwenClient`/`chat.completions.create`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Concept *quality* (genuinely format-not-content, distinct, on-niche) | ADAPT-01 | LLM output semantics not unit-assertable beyond schema/leak guards | Run a real remix on a known viral video with a populated niche; eyeball the 3 concepts for format-borrowing (not subject-copying) and niche relevance |
| Raycast styling of cards + inline picker (6% borders, 8px/12px radius, Inter, no glow) | UI-SPEC | Visual conformance | Inspect Adapt frame on desktop canvas + mobile (<768px) card-stack against UI-SPEC |

---

## Security Domain (ASVS L1)

| ASVS | Applies | Control |
|------|---------|---------|
| V2 Authentication | yes | New `/api/remix/adapt` MUST call `supabase.auth.getUser()` → 401 (mirror creator-profile/route.ts:54-58) |
| V4 Access Control | yes | Verify the analysis row belongs to the caller before writing `variants.remix.adapt`; service-client update scoped `.eq("id", id)`; RLS backstop |
| V5 Input Validation | yes | Zod-validate adapt request body (analysis id, decode payload, niche) — mirror `creatorProfilePatchSchema.safeParse` |

**Threat mitigations to verify in plans:**
- Unauthenticated adapt generation (cost abuse) → `getUser()` 401 + row-ownership check
- Source-caption leak to DashScope/Alibaba (Info Disclosure) → D-01 structural guard (caption never in adapt input; aligns with derive-and-drop IP boundary)
- Cross-user `variants` write (Elevation) → ownership check + `.eq("id", id)` + RLS

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
