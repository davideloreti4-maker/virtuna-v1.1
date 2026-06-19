---
phase: 09-living-audience-interactive-simulation-ux
plan: 04
subsystem: audience-lens
tags: [audience-lens, cluster-by-segment, staggered-cascade, rewrite-loop, chain-handoff, degrade-by-feature, theme-06, live-04, live-06, live-07]
requires:
  - "buildSegmentGroups/worstBadGroupKey/buildPersonaNodes from board/audience/audience-derive (cluster + node source)"
  - "cascadeOrder from audience-lens/lens-derive (deterministic reveal order, 09-01)"
  - "ReplayController cascade seam stubbed in 09-02 (completed here)"
  - "AudienceLens shell + PersonaChatDrawer mount from 09-02/09-03 (extended additively here)"
  - "CHAIN_HANDOFFS/handoffsFor + ChainHandoff shape from lib/tools/chain-handoff (Rewrite rides this)"
  - "PersonasBlock {archetype,verdict,quote} + card scrollQuote/fraction from lib/tools/blocks (flat Shape-B)"
provides:
  - "ClusterView — Temp×Disposition segment grouping; the single worst cluster reads coral (≤2 marks)"
  - "Completed staggered-cascade reveal in ReplayController (Play, cascadeOrder, reducedMotion-gated)"
  - "buildFlatPersonaNodes + clusterFlatNodes — pure Shape-B → PersonaNode adapters (degrade-by-feature)"
  - "AudienceLens.flatPersonas + AudienceLens.rewrite (LensRewrite) — additive props"
  - "Same-skill (from===to) Rewrite-for-audience CHAIN_HANDOFFS entries for idea/hooks/script/remix"
  - "Sticky coral Rewrite CTA + prior→new stop-count delta readout in AudienceLens"
  - "LensTrigger — the single shared onOpen-wired Lens entry across all 6 skills (D-04)"
  - "flat-card-reactions — honest fraction+lead-quote → flat Shape-B derivation for text cards"
affects:
  - "W4 Population·1,000 (flatPersonas + clusterFlatNodes feed the swarm on flat surfaces too)"
  - "Future host wiring: the Rewrite onRewrite re-POST + in-thread streaming is owned by each skill thread view"
tech-stack:
  added: []
  patterns:
    - "Signal-shape-driven Lens: heatmap (rich timeline) vs flatPersonas (Shape-B) resolve to the SAME PersonaNode[]+SegmentGroup[] so every view is shared (D-04)"
    - "Staggered cascade = reveal animation over cascadeOrder, NEVER a synthesized pseudo-timeline (D-06)"
    - "Same-skill self-handoff (from===to) in CHAIN_HANDOFFS — the regenerate flywheel rides the existing registry"
    - "Host-owned re-POST seam (LensRewrite.onRewrite): the Lens supplies lever-as-steering, the thread view owns the fetch + in-thread streaming"
    - "Honest flat derivation: real fraction counts + the one real lead verbatim; never fabricate per-persona quotes"
key-files:
  created:
    - "src/components/audience-lens/ClusterView.tsx"
    - "src/components/audience-lens/LensTrigger.tsx"
    - "src/components/audience-lens/flat-card-reactions.ts"
  modified:
    - "src/components/audience-lens/AudienceLens.tsx"
    - "src/components/audience-lens/ReplayController.tsx"
    - "src/components/board/audience/audience-derive.ts"
    - "src/lib/tools/chain-handoff.ts"
    - "src/lib/tools/__tests__/chain-handoff.test.ts"
    - "src/components/thread/idea-card-block.tsx"
    - "src/components/thread/hook-card-block.tsx"
    - "src/components/thread/script-card-block.tsx"
    - "src/components/thread/remix-card-block.tsx"
    - "src/components/thread/personas-block.tsx"
decisions:
  - "Cluster + cascade + Population all consume PersonaNode[] — so flat Shape-B is ADAPTED into PersonaNode[] (buildFlatPersonaNodes) rather than building a parallel flat view. One set of views, degraded by feature (D-04/D-06)"
  - "Flat watchThrough is BINARY-derived from the real verdict (stop→1, scroll→0); flat weight is flat (0.5) — never fabricate a continuous attention number the flat shape never emitted"
  - "A2 RESOLVED: idea/hooks/script runners accept a lever-steered self-handoff ({ask?,anchor?,platform}); remix/run REJECTS it (url-only schema) → the remix Rewrite re-develops via the PINNED /api/tools/ideas/develop route (no route change). Documented below"
  - "The Rewrite re-POST + in-thread streaming is HOST-owned (LensRewrite.onRewrite) — the Lens supplies the lever-as-steering anchor + platform and renders the delta, but does not own thread context"
  - "Text card-blocks carry only a single lead scrollQuote (no per-persona array) → flat-card-reactions expands the REAL fraction counts with the lead verbatim on the representative persona; all others carry empty quotes (honest about thin signal, never invented words)"
  - "All 5 flat mount surfaces open the IDENTICAL AudienceLens through one shared LensTrigger (D-04 — one reusable Lens, not six bespoke surfaces); the video Test surface (09-02) opens the same Lens with a heatmap"
  - "personas-block Lens mount is gated on an optional conceptText prop → byte-identical render when absent (no concept to chat/rewrite about)"
metrics:
  duration: 12m
  completed: "2026-06-19T12:46:00Z"
  tasks: 3
  files: 13
---

# Phase 9 Plan 04: Cluster-by-segment + Rewrite loop + reusable Lens mounted across the text skills Summary

Added the cluster-by-segment view (the room grouped by the Temp×Disposition lens, worst
cluster coral) and completed the staggered-cascade reveal on the Lens; closed the
Rewrite-for-audience flywheel through same-skill `CHAIN_HANDOFFS` self-handoff entries
(lever-as-steering → new card + Read → honest delta); and mounted the single reusable
`AudienceLens` inline across the four text skills + the text Read via one shared
`LensTrigger`, degrading to cascade-only where there is no real timeline (D-06).

## What Was Built

### Task 1 — Cluster-by-segment view + staggered cascade (commit dadeb937)
- `ClusterView.tsx`: renders `SegmentGroup[]` (from the pure, shipped `buildSegmentGroups` /
  `clusterFlatNodes`) as a per-slot watch-through list; the single worst cluster
  (`worstBadGroupKey`, <40%-stop rule) reads coral on both the % label and the bar fill (≤2
  coral marks per UI-SPEC). Presentation only — the grouping math is NOT re-derived.
- `ReplayController.tsx`: completed the cascade path the 09-02 stub left. On flat surfaces (no
  `attentions[]` timeline) a **"Play"** control reveals nodes one-by-one in `cascadeOrder`
  (stops first, heaviest first), dimming un-revealed nodes via `attentionOverride`. It is a
  reveal animation, NOT a fabricated pseudo-timeline (D-06). All motion gated on `reducedMotion`
  (static cloud + the always-present sr-only mirror cover the reduced path).
- `audience-derive.ts`: added `buildFlatPersonaNodes(reactions)` + `clusterFlatNodes(nodes)` —
  pure adapters mapping flat Shape-B `{archetype,verdict,quote}` into `PersonaNode[]` +
  `SegmentGroup[]` so cluster/cascade/Population/drill all work on flat surfaces (binary
  watchThrough from the real verdict; flat weight; slot via an archetype heuristic).
- `AudienceLens.tsx`: branches node/cluster derivation on signal shape (`heatmap` rich vs
  `flatPersonas` flat), renders `<ClusterView>`, and orders the "Ask them why →" list by
  `cascadeOrder` so the chat list reads in lockstep with the reveal.

### Task 2 — Rewrite-for-audience CHAIN_HANDOFFS + sticky CTA + delta (commit 6d91d135)
- `chain-handoff.ts`: appended four same-skill (from===to) Rewrite entries
  (`ctaLabel: "Rewrite for this audience →"`, `anchorFrom: "card"`) for idea/hooks/script/remix.
- `chain-handoff.test.ts`: +5 cases asserting each from===to entry + its pinned endpoint, and
  that non-regenerable surfaces (discover/test) get NO self-handoff Rewrite. 16/16 green.
- `AudienceLens.tsx`: additive `rewrite?: LensRewrite` prop + a sticky coral CTA
  (`--shadow-button`) that injects the Read's lever as the steering anchor via the host-owned
  `onRewrite` seam, then renders the **delta** (prior `N/T stop` → new `N/T stop` + a one-line
  "the lever moved the room / cost you stops / no change"). Hidden where `rewrite` is absent
  (plain chat turns — no regenerable concept object, D-05).

### Task 3 — Mount the reusable Lens inline across the text skills + text Read (commit 39521e28)
- `LensTrigger.tsx`: the single shared `onOpen`-wired entry (≥44px, Enter/Space, role=button)
  that opens the IDENTICAL `<AudienceLens>` in cascade mode (flat Shape-B, no timeline). D-04 —
  one reusable Lens; the video Test surface opens the same Lens with a heatmap instead.
- `flat-card-reactions.ts`: `cardScrollQuoteReactions(fraction, scrollQuote, archetypeHint?)` —
  honestly expands a card's REAL `fraction` ("6/10 stop") into T flat personas (N stop / T−N
  scroll) with the one real lead verbatim on the representative persona and EMPTY quotes for the
  rest (never invents words the SIM did not return).
- Mounted `LensTrigger` on the lead scroll-quote of all four card-blocks
  (idea/hook/script/remix) and on `personas-block` (the text Read shape — 1:1, gated on an
  optional `conceptText` so it stays byte-identical when absent).

## Verification

- `npx vitest run src/lib/tools/__tests__/chain-handoff.test.ts` → 16 passed / 0 failed (5 new
  Rewrite cases: from===to + pinned endpoints + the discover/test no-self-handoff guard).
- Related suites (`persona-cloud.test.tsx`, `lens-derive.test.ts`, thread block tests) →
  32 + 10 passed / 0 failed — the additive Lens/adapter/mount changes broke nothing.
- Task gates: `grep buildSegmentGroups` + `grep cascadeOrder` in AudienceLens.tsx → present;
  `grep "Rewrite for this audience"` in chain-handoff.ts → present; all 5 flat mount files
  contain `AudienceLens`.
- Determinism gate: no `Math.random` / `Date.now` in any new file (cascade rides the pure
  `cascadeOrder`; flat adapters are pure).
- `npm run build` → compiled successfully + TypeScript passed (exit 0). `npm run lint` →
  clean on all created/modified files (the cascade effect was restructured to avoid
  `react-hooks/set-state-in-effect`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] react-hooks/set-state-in-effect on the cascade terminal reset**
- **Found during:** Task 1 (npm run lint)
- **Issue:** The cascade effect's terminal branch (`if (revealed >= reveal.length) { setRevealed(null); return; }`)
  was a synchronous setState inside the effect body → tripped the project's
  `react-hooks/set-state-in-effect` error rule (same rule that bit 09-02).
- **Fix:** Removed the synchronous early-return; the interval tick itself terminates by
  returning `null` once `next > reveal.length`, so the effect never calls setState
  synchronously. Behavior (reveal then settle to all-present) preserved.
- **Files modified:** src/components/audience-lens/ReplayController.tsx
- **Commit:** dadeb937 (folded in before commit)

### A2 disposition (Rewrite self-handoff — RESOLVED)

The plan flagged Assumption A2 (do originating runners accept a lever-steered self-handoff
re-POST?). Verified the four runner routes (read-only):

| Skill | Route | Body schema | Self-handoff? |
|-------|-------|-------------|---------------|
| idea | `/api/tools/ideas` | `{ ask?, platform? }` | ✅ lever rides `ask` |
| hooks | `/api/tools/hooks` | `{ ask?, anchor?, platform? }` | ✅ lever `ask` + concept `anchor` |
| script | `/api/tools/script` | `{ ask?, anchor?, platform? }` | ✅ same shape as hooks |
| remix | `/api/tools/remix/run` | `{ url, platform }` ONLY | ❌ rejects (no ask/anchor) |

**Minimal adjustment (no route change):** the remix Rewrite entry routes to the PINNED
`/api/tools/ideas/develop` (the remix's already-confirmed downstream develop route, which accepts
`{ anchor, platform }`) — re-developing the adapted concept steered by the lever. `from` stays
`"remix"` (the originating card); only the endpoint differs. No runner code was modified — the
existing schemas already accept the steered re-POST for idea/hooks/script.

## Known Stubs

- **Host-owned Rewrite wiring is the integration seam, not yet wired at call sites.** The
  `AudienceLens.rewrite.onRewrite` re-POST + in-thread streaming + delta-from-new-Read is owned
  by each skill's thread view (it holds thread context). This plan ships the Lens-side contract
  (the lever-as-steering anchor, the sticky CTA, the delta readout) and the registry entries; a
  thread view must pass a `rewrite={...}` prop to light the CTA. Until then the CTA is simply
  absent (the prop is optional) — no broken/empty UI. Intentional: the flywheel's Lens half is
  complete; the thread-view binding is a thin downstream wire-up (matches how 09-03 left
  `conceptText` to be passed at mount sites).
- **`personas-block` / card `conceptText` not yet threaded from `MessageBlocks`.** The uniform
  `BLOCK_COMPONENTS` map passes only `{ block }`; the optional `conceptText` (and `rewrite`) must
  be supplied by a per-surface wrapper. Absent ⇒ byte-identical render (no Lens affordance). The
  card-blocks already self-source their concept (hookLine / title+angle / opener / adaptedHook),
  so the four text skills light up immediately; only the standalone personas-block awaits the
  concept prop.

## Notes for Downstream

- **W4 Population:** `buildFlatPersonaNodes` + `clusterFlatNodes` give the swarm the same
  `PersonaNode[]` on flat surfaces — `instantiatePopulation`/`weightedRollup` work unchanged.
- **Wiring the Rewrite flywheel:** in each skill thread view, pass `rewrite={{ endpoint:
  handoffsFor(skill).find(h => h.to===skill)!.endpoint, lever, platform, priorStopCount,
  priorTotal, onRewrite }}` to the Lens; `onRewrite` does the re-POST (lever as the steering
  `ask`/`anchor`), streams the new card in-thread, and resolves with the new Read's stop/total
  for the delta.
- **Cluster on flat surfaces** groups all `viewer_N` placeholders into the `fyp` slot (cards
  carry no per-persona archetype); the PersonasBlock / MultiAudienceRead path carries real
  archetypes and clusters across all four slots.

## Self-Check: PASSED

- FOUND: src/components/audience-lens/ClusterView.tsx
- FOUND: src/components/audience-lens/LensTrigger.tsx
- FOUND: src/components/audience-lens/flat-card-reactions.ts
- FOUND: src/components/audience-lens/AudienceLens.tsx
- FOUND: src/components/audience-lens/ReplayController.tsx
- FOUND: src/lib/tools/chain-handoff.ts
- FOUND: src/lib/tools/__tests__/chain-handoff.test.ts
- Commits FOUND: dadeb937, 6d91d135, 39521e28
