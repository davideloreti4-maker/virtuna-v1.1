---
phase: 4
slug: live-audience-node-the-killer-feature
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-27
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 04-RESEARCH.md §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + vitest-axe 0.1.0 |
| **Config file** | `vitest.config.ts` (repo root, verified) |
| **Quick run command** | `npm test -- src/components/board/audience/__tests__/<file>.test.tsx -t "<name>"` |
| **Full suite command** | `npm test` (alias: `vitest run`) |
| **Estimated runtime** | ~45s full suite |

---

## Sampling Rate

- **After every task commit:** Run targeted file (`npm test -- <file>`)
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Command | Wave 0 |
|-----|----------|-----------|---------|--------|
| R1.2 | AudienceNode renders all 5 chips against fixture | unit | `npm test -- HeadlineChips.test.tsx` | ❌ |
| R1.2 | Filmstrip swaps placeholder → img on `filmstrip_segment_ready` | unit | `npm test -- Filmstrip.test.tsx` | ❌ |
| R1.2 | RetentionCurve renders weighted_curve from fixture, DPR-aware | unit | `npm test -- RetentionCurve.test.tsx` | ❌ |
| R1.2 | DropoffMarkers cluster collapse at 12px / 6px thresholds | unit (pure fn) | `npm test -- DropoffMarkers.test.ts` | ❌ |
| R1.2 | HeatmapDrawer renders 10 × N grid, attention-proportional fills | unit | `npm test -- HeatmapDrawer.test.tsx` | ❌ |
| R1.2 | Choreography skeleton order = fixed archetype hierarchy | unit (hook) | `npm test -- use-audience-choreography.test.ts` | ❌ |
| R1.2 | TapPopover positions at tap coordinate, escape-dismisses | integration | `npm test -- TapPopover.test.tsx` | ❌ |
| R1.2 | PersonaInspector opens on row-label tap (bottom-sheet mobile) | integration | `npm test -- PersonaInspector.test.tsx` | ❌ |
| R1.2 | Anti-virality dual-trigger drives correct visual variant | unit | `npm test -- AntiViralityOverlay.test.tsx` | ❌ |
| R1.2 | Mobile portrait: heatmap drawer opens bottom-sheet | integration | `npm test -- HeatmapDrawer.mobile.test.tsx` | ❌ |
| R1.2 | Reduced-motion: jump-cut to weighted curve, no morph | integration | `npm test -- RetentionCurve.reduced-motion.test.tsx` | ❌ |
| R2.2 | Pass 2 streaming partials drive row state transitions | unit (hook) | `npm test -- use-audience-choreography.streaming.test.ts` | ❌ |
| R2.3 | Client weight recompute matches server `buildWeightedCurve` | unit (pure fn) | `npm test -- use-client-weights.test.ts` | ❌ |
| R2.3 | Slider drag rebalance maintains sum=1.0 ±epsilon | unit (pure fn) | `npm test -- weight-rebalance.test.ts` | ❌ |
| R1.2 (a11y) | Heatmap grid passes axe-core with role=grid + aria-rowcount | a11y | `npm test -- HeatmapDrawer.a11y.test.tsx` | ❌ |
| R1.2 (a11y) | TapPopover focus-traps and returns focus on close | a11y | `npm test -- TapPopover.a11y.test.tsx` | ❌ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/board/audience/__tests__/HeadlineChips.test.tsx` — fixture-based chip render
- [ ] `src/components/board/audience/__tests__/Filmstrip.test.tsx` — SSE-driven swap
- [ ] `src/components/board/audience/__tests__/RetentionCurve.test.tsx` — Canvas DPR, Catmull-Rom
- [ ] `src/components/board/audience/__tests__/DropoffMarkers.test.ts` — cluster thresholds (pure)
- [ ] `src/components/board/audience/__tests__/HeatmapDrawer.test.tsx` — 10×N grid render
- [ ] `src/components/board/audience/__tests__/use-audience-choreography.test.ts` — skeleton hook
- [ ] `src/components/board/audience/__tests__/use-audience-choreography.streaming.test.ts` — partial-driven transitions
- [ ] `src/components/board/audience/__tests__/TapPopover.test.tsx` — positioning + dismiss
- [ ] `src/components/board/audience/__tests__/PersonaInspector.test.tsx` — desktop drawer + mobile bottom-sheet
- [ ] `src/components/board/audience/__tests__/AntiViralityOverlay.test.tsx` — dual-trigger variants
- [ ] `src/components/board/audience/__tests__/HeatmapDrawer.mobile.test.tsx` — mobile bottom-sheet
- [ ] `src/components/board/audience/__tests__/RetentionCurve.reduced-motion.test.tsx` — jump-cut path
- [ ] `src/components/board/audience/__tests__/use-client-weights.test.ts` — recompute parity vs server
- [ ] `src/components/board/audience/__tests__/weight-rebalance.test.ts` — sum=1 invariant
- [ ] `src/components/board/audience/__tests__/HeatmapDrawer.a11y.test.tsx` — axe-core grid
- [ ] `src/components/board/audience/__tests__/TapPopover.a11y.test.tsx` — focus trap
- [ ] `src/components/board/audience/__tests__/fixtures/` — HeatmapPayload fixtures (small / streaming / anti-virality)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 60fps on iPhone 13+, 45fps on iPhone 11+ during streaming choreography | R1.2 success criteria | Real-device perf measurement; no headless equivalent | Connect device via Safari Web Inspector, record Timeline during a full Pass 2 stream, verify FPS bands |
| Pinch-zoom on heatmap on iOS Safari | R1.2 mobile portrait | Touch gesture fidelity needs real touch | Open phase 4 dev URL on iPhone, two-finger pinch on heatmap, verify smooth zoom + no Konva pan conflict |
| Visual parity vs UI-SPEC mockups | R1.2 success criteria | Pixel-level design fidelity | Playwright snapshot vs `04-UI-SPEC.md` reference images; side-by-side review |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
