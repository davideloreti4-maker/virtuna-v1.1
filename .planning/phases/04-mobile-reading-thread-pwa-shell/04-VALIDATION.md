---
phase: 4
slug: mobile-reading-thread-pwa-shell
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-12
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 (+ `@testing-library/react` 16.3.2, `vitest-axe` 0.1.0, happy-dom 20.9.0) [VERIFIED: package.json] |
| **Config file** | `vitest.config.ts` (existing; `include` covers `src/**/__tests__/*.test.ts(x)` and `tests/**/*.test.tsx`) |
| **Quick run command** | `npx vitest run src/components/reading` (scoped) |
| **Full suite command** | `npm test` (`vitest run`) — includes the existing `src/lib/reading` 37/37 |
| **Estimated runtime** | ~20–35 seconds full suite (happy-dom, no browser) |
| **E2E / PWA** | `npm run e2e` (Playwright) + Lighthouse against the deployed Vercel preview (manual gate) |

**Baseline confirmed:** repo uses Vitest; the existing `src/lib/reading` suite is 37/37 green
(STATE.md). No framework install needed.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/components/reading` (+ `src/lib/reading` when the task touched it).
- **After every plan wave:** Run `npm test` (full suite — must stay GREEN, incl. the existing 37/37 reading suite) + `npx tsc --noEmit`.
- **Before `/gsd:verify-work`:** Full suite green + `npx tsc --noEmit` clean + Lighthouse PWA installable on a deployed Vercel preview.
- **Max feedback latency:** ~35 seconds (scoped quick run is faster, ~10s).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | READ-05 | T-04-02 | no engine jargon / no field names leak | unit | `npx vitest run src/lib/reading/__tests__/stage-slots.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | READ-05, READ-07 | T-04-01 / T-04-02 | JSX-escaped engine text; no jargon | unit | `npx vitest run src/components/reading/blocks/__tests__/blocks.test.tsx` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | READ-05 | T-04-01 | exhaustive dispatch; no empty shell | unit + tsc | `npx vitest run src/components/reading/blocks/__tests__/blocks.test.tsx && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | READ-03, READ-04 | T-04-03 | no fake band/number pre-complete | unit | `npx vitest run src/components/reading/__tests__/throne.test.tsx src/components/reading/blocks/__tests__/verdict-block.test.tsx` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | READ-01, READ-02, READ-05 | T-04-03 / T-04-05 | crux discipline (no canonicalFromLive on partial); one aria-live | unit | `npx vitest run src/components/reading/__tests__/reading-thread.test.tsx` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 3 | READ-01, READ-06 | T-04-06 | user_id ownership scope; notFound on miss | unit + parity | `npx vitest run src/components/reading/__tests__/resting-render.test.tsx src/lib/reading/__tests__/identical-render.test.ts` | ❌ W0 (existing parity ✅) | ⬜ pending |
| 04-03-02 | 03 | 3 | READ-07, SHELL-04 | T-04-07 | composer cannot send; no tap error | unit | `npx vitest run src/components/reading/__tests__/reply-composer.test.tsx src/components/reading/__tests__/install-hint.test.tsx` | ❌ W0 | ⬜ pending |
| 04-03-03 | 03 | 3 | READ-01, READ-07 | T-04-05 | one aria-live region; reduced-motion; 44px | unit (vitest-axe) | `npx vitest run src/components/reading/__tests__/a11y.test.tsx` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 1 | SHELL-04 | T-04-CACHE / T-04-SCOPE / T-04-SC | NetworkFirst (never precache) analysis GET; POST never cached | config grep | `grep -q withSerwistInit next.config.ts && grep -v '^#' src/app/sw.ts \| grep -q /api/analysis/` | ❌ W0 | ⬜ pending |
| 04-04-02 | 04 | 1 | SHELL-04 | T-04-CACHE | hex (not oklch) theme; manifest valid | config grep | `grep -q "MetadataRoute.Manifest" src/app/manifest.ts && grep -q viewportFit src/app/layout.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity:** no run of 3 consecutive tasks lacks an automated verify — every task above
has an `<automated>` command. PWA installability (the one inherently-manual behavior) is covered by
the blocking-human checkpoint in Plan 04 + the Manual-Only table below.

---

## Wave 0 Requirements

Wave-0 RED scaffolds are created as the FIRST step of the task that owns them (the GSD RED-first
convention — each test file is written failing before its implementation):

- [ ] `src/lib/reading/__tests__/stage-slots.test.ts` — READ-05 curated order (Plan 01 Task 1)
- [ ] `src/components/reading/blocks/__tests__/blocks.test.tsx` — READ-05/07 per-block render + jargon assertion (Plan 01 Task 2/3)
- [ ] `src/components/reading/__tests__/throne.test.tsx` — READ-03 forming↔crystallize (Plan 02 Task 1)
- [ ] `src/components/reading/blocks/__tests__/verdict-block.test.tsx` — READ-04 demoted /100 (Plan 02 Task 1)
- [ ] `src/components/reading/__tests__/use-analysis-stream-mock.tsx` — shared stream mock (drive phase/panelReady/result) (Plan 02 Task 2)
- [ ] `src/components/reading/__tests__/reading-thread.test.tsx` — READ-01/02/05 crux (Plan 02 Task 2)
- [ ] `src/components/reading/__tests__/resting-render.test.tsx` — READ-06 parity (Plan 03 Task 1)
- [ ] `src/components/reading/__tests__/reply-composer.test.tsx` — inert composer (Plan 03 Task 2)
- [ ] `src/components/reading/__tests__/install-hint.test.tsx` — SHELL-04 install coaching (Plan 03 Task 2)
- [ ] `src/components/reading/__tests__/a11y.test.tsx` — a11y (Plan 03 Task 3)
- **Framework install:** none — Vitest + Playwright + vitest-axe already present.
- **Existing coverage reused:** `src/lib/reading/__tests__/identical-render.test.ts` (the Phase-2 deep-equal parity, GREEN on `WEkihfOzJphv`) backs READ-06.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PWA installability (SW registers, manifest valid, "Installable") | SHELL-04 | The SW is `disable`d in dev (HMR conflict); only a deployed build runs it | `next build --webpack` → deploy Vercel preview → Lighthouse (PWA category) on the preview URL must pass "Installable" + "Service worker registers" (Plan 04 blocking-human checkpoint) |
| iOS Add-to-Home-Screen coaching + standalone launch | SHELL-04 | iOS Safari has no `beforeinstallprompt`; install is a manual coached flow only verifiable on a device | On iPhone Safari open the preview → after the first Reading completes the hint appears → Share → Add to Home Screen → launches standalone with no notch overlap (safe-area insets) |
| Mobile-native feel at 390px (no horizontal overflow, momentum scroll, pinned header/composer) | SHELL-04 | Felt-quality / device viewport behavior not reliably assertable in happy-dom | On a 390px-wide device/emulator confirm no horizontal scroll, momentum scrolling, the pinned header + inert composer respect the safe areas |
| Throne crystallization motion reads as ONE calm lock (no spin/bounce) | READ-03 | Motion timing/feel is a visual judgment | On the deployed preview run a live analysis; confirm the throne holds "forming", then crystallizes once with the calm DS-07 motion — never a slot-machine spin |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (all commands are `vitest run`, never `vitest` watch)
- [x] Feedback latency < 35s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-12
