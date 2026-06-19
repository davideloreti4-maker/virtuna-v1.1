---
phase: 09-living-audience-interactive-simulation-ux
plan: 02
subsystem: audience-lens
tags: [audience-lens, replay, persona-graph, onopen-seam, reduced-motion, theme-06]
requires:
  - "buildPersonaNodes/buildSegmentGroups/worstBadGroupKey from board/audience/audience-derive (Panel·10 node source)"
  - "MultiAudienceReadBlockRenderer from thread/multi-audience-read-block (the P8 Read header, reused verbatim)"
  - "cascadeOrder from audience-lens/lens-derive (W3 cascade seam, Plan 09-01)"
  - "HeatmapPayload.personas[].attentions[] timeline from lib/engine/types (the only real per-segment signal)"
  - "Sheet/SheetContent/SheetTitle from ui/sheet (Radix dialog bottom-sheet shell)"
provides:
  - "AudienceLens — reusable living-audience sheet (P8 Read header + scale toggle + Panel·10 cloud); the single v1 entry (D-04) W2/W3/W4 mount on"
  - "ReplayController — segment-by-segment replay driver (timeline path live), reducedMotion-gated, sr-only mirror"
  - "useLensScale — Panel·10 ⇄ Population·1,000 per-Lens last-used default (D-07)"
  - "PersonaGraph.attentionOverride — additive replay-driven per-node attention input"
  - "PersonaNode.quote — verbatim per-persona reaction surfaced in the drill-down card (LIVE-02)"
  - "The wired onOpen seam on the video Reading surface (Pitfall 1 closed)"
affects:
  - "W2 chat-with-persona drawer (mounts inside the AudienceLens shell)"
  - "W3 thin-signal skill mounts + staggered cascade (reuse the shell + cascadeOrder seam already imported)"
  - "W4 Population·1,000 swarm (fills the reserved PopulationSlot; honesty label already wired)"
tech-stack:
  added: []
  patterns:
    - "Radix bottom-sheet (ui/sheet) as the reusable Lens shell — portal-mounted, client-only"
    - "Lazy-initializer localStorage read (no setState-in-effect) for SSR-safe per-Lens last-used default"
    - "Additive, default-undefined props on shared kit components (PersonaGraph) so existing call sites stay byte-identical"
    - "Signal-shape-driven motion: timeline replay only where attentions[] exists; cascade for flat data (no synthesized pseudo-timeline, D-06)"
key-files:
  created:
    - "src/components/audience-lens/AudienceLens.tsx"
    - "src/components/audience-lens/ReplayController.tsx"
    - "src/components/audience-lens/use-lens-scale.ts"
  modified:
    - "src/components/board/_kit/PersonaGraph.tsx"
    - "src/components/board/audience/audience-derive.ts"
    - "src/components/reading/reading-panels.tsx"
    - "src/components/reading/__tests__/persona-cloud.test.tsx"
decisions:
  - "Lens shell = Radix bottom-sheet (ui/sheet) — reuses the shipped sheet primitive rather than a bespoke dialog; side=bottom for the mobile-first living surface"
  - "Reading surface carries NO Read block (it has a heatmap timeline, not a Read card) → readBlock optional; the Lens omits the header and leads with the replayable constellation"
  - "PersonaNode.quote sourced from heatmap segment_reasons (first non-empty inflection note) — the only real verbatim reaction text on the video surface; never fabricated (LIVE-02 honesty spine)"
  - "useLensScale seeds from a lazy localStorage read (not a mount effect) to satisfy react-hooks/set-state-in-effect while preserving D-07 last-used memory"
  - "reading-panels wraps the inline PersonaGraph in a ≥44px role=button affordance (rather than swapping to PersonaCloud) — minimal change to the shipped list-led panel, seam opens the Lens"
metrics:
  duration: 7m
  completed: "2026-06-19T10:15:30Z"
  tasks: 3
  files: 7
---

# Phase 9 Plan 02: AudienceLens shell + replay + wired onOpen seam Summary

Built the reusable AudienceLens bottom-sheet (P8 Read header reused verbatim + Panel·10 ⇄
Population·1,000 scale toggle + the replayable persona constellation), the ReplayController that
drives the cloud segment-by-segment from the real `attentions[]` timeline (reducedMotion-gated,
sr-only mirror), and wired the previously-dead `onOpen` seam on the video Reading surface so the
Lens actually opens — closing Pitfall 1. Node drill-down now shows verbatim reactions.

## What Was Built

### Task 1 — AudienceLens shell + P8 Read header + scale toggle (commit 6b89cadc)
- `AudienceLens.tsx`: `'use client'` Radix bottom-sheet (`ui/sheet`). Top-to-bottom layout per
  UI-SPEC: (1) HEADER renders `MultiAudienceReadBlockRenderer` verbatim when a `readBlock` is
  present (no recolor — landmine 9); (2) a `Panel · 10` ⇄ `Population · 1,000` segmented toggle
  whose Population side is a reserved `PopulationSlot` (W4 fills it; the honesty label
  "1,000 viewers instantiated from your 10 calibrated archetypes." is already wired); (3) the
  Panel·10 region over `buildPersonaNodes(...)`. Empty-nodes path omits the cloud and shows the
  "No audience reaction yet." empty copy. Flat-matte THEME-06 surfaces only, no glass / no
  backdrop-filter class.
- `use-lens-scale.ts`: `useLensScale` hook — per-Lens last-used default (D-07), module-level
  `lastUsed` seeded from a lazy localStorage read, persisted on change.

### Task 2 — ReplayController + PersonaGraph replay-driven attention (commit fd6f69e6)
- `ReplayController.tsx`: given the nodes + heatmap, builds per-node `attentions[]` timelines
  aligned by persona id. "Replay reactions" advances a segment index on a calm 700ms tick,
  feeding the current segment's per-node attention vector into `PersonaGraph.attentionOverride`
  so nodes light/dim as the room watches. The cascade seam (`cascadeOrder`) is imported and
  exercised for W3; no pseudo-timeline is synthesized for flat data (D-06). All motion gated on
  `reducedMotion`; the sr-only aggregate mirror ("Audience reaction summary: {n} of {total}…")
  is always present.
- `PersonaGraph.tsx`: additive `attentionOverride?: number[]` prop (when `length === nodes.length`,
  per-node fill opacity reflects the replayed segment) + `PersonaNode.quote?` rendered in the
  detail card. Both default-undefined — existing call sites (reading-panels) compile byte-identical.

### Task 3 — Wire the onOpen seam + lock the cloud test (commit d1a5ae17)
- `reading-panels.tsx`: `PersonasPanel`/`AudienceList` now hold `lensOpen` state; the inline
  `<PersonaGraph>` is wrapped in a ≥44px `role="button"` Enter/Space-activatable affordance whose
  handler opens `<AudienceLens>` with this Reading's `heatmap` + `persona_simulation_results`
  (the rich-signal surface). No Read block on this surface → header omitted.
- `audience-derive.ts`: `buildPersonaNodes` now stamps each node with `quote` from the persona's
  first non-empty `segment_reasons` note — the verbatim drill-down text (LIVE-02), never fabricated.
- `persona-cloud.test.tsx`: +3 tests locking the `onOpen` interactive contract (role=button +
  tabIndex 0 + ≥44px + fires on click/Enter/Space when provided; inert when absent).

## Verification

- `npx vitest run .../persona-cloud.test.tsx` → 9 passed / 0 failed (seam locked).
- Related suites (`kit.test.tsx`, `reading.panels.test.tsx`, `lens-derive.test.ts`) → 54 passed /
  0 failed — additive PersonaGraph/buildPersonaNodes changes broke nothing.
- `grep AudienceLens src/components/reading/reading-panels.tsx` → present (Pitfall 1 closed).
- Replay drives segment-by-segment from `attentions[]`; reducedMotion-gated; sr-only mirror present.
- P8 Read header reused verbatim via `MultiAudienceReadBlockRenderer` (no recolor).
- No executable `Math.random` / no synthesized timeline in any new motion/geometry (the only
  literal occurrence is a prohibition comment in 09-01's `lens-derive.ts`).
- `npm run build` → compiled successfully (exit 0). `npm run lint` → new/modified files clean
  (pre-existing repo-wide lint debt untouched, out of scope).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] react-hooks/set-state-in-effect on useLensScale localStorage hydration**
- **Found during:** Task 1 (npm run lint)
- **Issue:** Hydrating the scale from localStorage in a mount `useEffect` via `setScale(stored)`
  tripped the project's `react-hooks/set-state-in-effect` lint rule (error), failing lint.
- **Fix:** Moved the localStorage read into the `useState` lazy initializer (`readInitialScale`)
  — no setState-in-effect, no cascading render. SSR-safe because the Lens mounts client-side
  only (Radix portal); behavior (per-Lens last-used default, D-07) preserved.
- **Files modified:** src/components/audience-lens/use-lens-scale.ts
- **Commit:** 6b89cadc (folded in before commit)

**2. [Rule 3 - Blocking] Math.random literal in a doc comment tripped the determinism grep**
- **Found during:** Task 2 (verify grep)
- **Issue:** A doc comment in ReplayController wrote the literal "No `Math.random` anywhere",
  which trips the `grep -L 'Math.random'` determinism gate even though it is non-executable.
- **Fix:** Reworded the comment to "No nondeterministic randomness anywhere" — same intent, no
  literal. No code change.
- **Files modified:** src/components/audience-lens/ReplayController.tsx
- **Commit:** fd6f69e6 (folded in before commit)

## Notes for Downstream

- **W2 (chat):** mount the persona chat drawer inside `AudienceLens` over the Panel·10 region;
  the "Ask them why →" secondary CTA per node + the chat-drawer empty copy are specced in UI-SPEC.
- **W3 (thin-signal mounts + cascade):** reuse the `AudienceLens` shell; drive the flat-skill
  staggered reveal off `cascadeOrder(nodes)` (already imported in ReplayController) — the "Play"
  control replaces "Replay reactions" when no `attentions[]` timeline exists.
- **W4 (Population·1,000):** fill `PopulationSlot` with the deterministic swarm via
  `instantiatePopulation` + `weightedRollup` (lens-derive); the honesty label + toggle are wired.
- The sticky "Rewrite for this audience →" primary CTA (UI-SPEC) is NOT in this wave — add it when
  the originating-skill regenerate handoff is available.

## Self-Check: PASSED

- FOUND: src/components/audience-lens/AudienceLens.tsx
- FOUND: src/components/audience-lens/ReplayController.tsx
- FOUND: src/components/audience-lens/use-lens-scale.ts
- Commits FOUND: 6b89cadc, fd6f69e6, d1a5ae17
