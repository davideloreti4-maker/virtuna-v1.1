---
phase: 09-living-audience-interactive-simulation-ux
fixed_at: 2026-06-19T13:10:00Z
review_path: .planning/phases/09-living-audience-interactive-simulation-ux-draft-not-yet-disc/09-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
deferred_info: 4
status: all_fixed
---

# Phase 9: Code Review Fix Report

**Fixed at:** 2026-06-19T13:10:00Z
**Source review:** 09-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (Critical + Warning): 9
- Fixed: 9
- Skipped: 0
- Info findings (out of scope, deferred): 4

**Verification (post-fix):**
- `npx vitest run src/components/audience-lens src/components/reading/__tests__/persona-cloud.test.tsx src/lib/tools/runners/__tests__/chat-runner.test.ts src/lib/tools/__tests__/chain-handoff.test.ts` → **exit 0** (5 files, 39 tests passed)
- `npm run build` → **exit 0** (Compiled successfully)
- Each fix typechecked with `tsc --noEmit` before commit (no new errors in touched files; pre-existing test-file TS errors unrelated to this work were left untouched).

## Fixed Issues

### CR-01: Flat-card persona chat silently non-functional (display label sent as `archetype`)
**Files modified:** `src/components/audience-lens/flat-card-reactions.ts`, `src/components/audience-lens/AudienceLens.tsx`, `src/components/thread/hook-card-block.tsx`
**Commit:** f95d6869
**Applied fix:** Flat surfaces no longer leak a display label (or `viewer_N` placeholder) into `personaGrounding.archetype`.
- `cardScrollQuoteReactions` attaches a lead archetype to `FlatPersonaReaction.archetype` ONLY when the value is a genuine `ARCHETYPES` registry enum; any non-enum (the hook card's "Stops the skeptic" tag, or a placeholder) is rejected and the persona stays `viewer_N`.
- `hook-card-block` stops passing the humanized `audienceArchetype` label as the grounding archetype.
- `AudienceLens` filters the "Ask them why →" list to registry-enum archetypes (`ARCHETYPES.includes`) and hides the whole row when none are groundable — so the UI never promises an in-voice answer it cannot deliver, and rehydration never 400s on these surfaces.

The flagship "Ask them why →" path now grounds correctly on surfaces carrying a real registry archetype (heatmap / PersonasBlock paths), and degrades cleanly (no affordance) on flat card surfaces that carry no enum, instead of failing open.

### CR-02: PersonaChatDrawer "Retry →" was dead
**Files modified:** `src/components/audience-lens/PersonaChatDrawer.tsx`
**Commit:** 6a7f3275
**Applied fix:** Added `lastQuestion` state; `send(override?)` re-asks the preserved question on retry without clearing the composer or appending a duplicate user turn. Retry button now calls `send(lastQuestion)` and is disabled when empty / streaming. `lastQuestion` resets on archetype switch.

### WR-01: `weightedRollup` breakdown could disagree with the headline
**Files modified:** `src/components/audience-lens/lens-derive.ts`
**Commit:** 617b3495
**Applied fix:** Round each per-archetype stop contribution first, then derive the headline as the SUM of those rounded rows (identity by construction). Still the weighted rollup of the real 10's verdicts — no fabrication. Preserves the existing `stop + scroll === total` and Population sampling-tolerance tests.

### WR-02: Coral toning in flat cloud vs cluster table disagreed
**Files modified:** `src/components/audience-lens/AudienceLens.tsx`, `src/components/board/audience/audience-derive.ts`
**Commit:** bdaeb6cf
**Applied fix:** Exported `archetypeToSlot` from `audience-derive`; the flat cloud now tones a node coral iff its archetype maps to the worst slot key (slot identity), instead of re-running the `<40%`-stop rule on a single-node fold (which never tripped the threshold for a single node). Cloud and table now highlight the same cluster.

### WR-03: SSE token frames not split-resilient
**Files modified:** `src/components/audience-lens/PersonaChatDrawer.tsx`
**Commit:** 6a7f3275 (committed with CR-02 — same file)
**Applied fix:** Wrapped the per-frame parse in try/catch and concatenate ALL `data:` lines per frame (multi-line SSE data support). A garbled / split-mid-JSON / keepalive frame is skipped instead of throwing out of the read loop and discarding the rest of a recoverable stream.

### WR-04: Cascade `setInterval` torn down + recreated every tick
**Files modified:** `src/components/audience-lens/AudienceLens.tsx`, `src/components/audience-lens/ReplayController.tsx`
**Commit:** ffdae1ca
**Applied fix:** Both cascade effects now depend on the `cascading` BOOLEAN (not the advancing counter), so the interval is created once on start and cleared once on end. Population advances via the functional updater; ReplayController reads the terminal node count off a ref. Named the Population cascade step/tick constants (`CASCADE_STEP`, `CASCADE_TICK_MS`). No `Math.random` / `Date.now` introduced (determinism gate intact).

### WR-05: `MAX_PRIOR_TURNS` slice / per-block role attribution invariant
**Files modified:** `src/app/api/tools/chat/route.ts`
**Commit:** 98a0f8cd
**Applied fix:** Documented the one-markdown-block-per-message invariant the open-chat anchor relies on (role attributed per message; the slice cap counts blocks = turns only while the invariant holds), plus the per-block-role remediation needed if multi-block messages are ever introduced. Comment-only — the non-persona chat path is byte-identical in behavior.

### WR-06: `ScaleToggle` used tab roles without tabpanel wiring
**Files modified:** `src/components/audience-lens/AudienceLens.tsx`
**Commit:** ef6f683c
**Applied fix:** Downgraded from `role="tablist"`/`role="tab"`/`aria-selected` to the correct inline segmented-control pattern: `role="group"` + per-button `aria-pressed`. Removes the unfulfilled ARIA tabs promise (no tabpanels, no aria-controls, no roving tabindex existed).

### WR-07: lead-quote attachment vs doc comment divergence
**Files modified:** `src/components/audience-lens/flat-card-reactions.ts`
**Commit:** d3232d26
**Applied fix:** Named the lead index explicitly with the stops-first rationale and the recompute path if emit order ever changes, and aligned both the top-of-file and inline doc comments to state the verbatim anchors the first stop persona (= persona 0, since personas are emitted stops-first; persona 0 in the all-scroll case). No behavior change; honesty framing and code now agree.

## Skipped Issues

None — all in-scope (Critical + Warning) findings were fixed.

## Deferred (Info — out of scope per the task)

The 4 Info findings were intentionally NOT touched (scope: BLOCKER + WARNING only):
- IN-01: `resolvedWeights` dead computation in chat-runner.
- IN-02: `ReplayMirror` strongest/weakest collapse for a single node.
- IN-03: magic numbers / duplicated mulberry32 PRNG across PersonaGraph/PopulationSwarm/lens-derive. (Note: WR-04 named the AudienceLens cascade-step/tick constants, but the broader PRNG-dedup + seed-offset hoist remains deferred.)
- IN-04: `as`-cast block narrowing in the chat route GET/POST rehydration paths.

## Honesty-spine / determinism constraints (verified)

- Counters remain the weighted rollup of the real 10 (D-02); WR-01 made the breakdown sum to the headline WITHOUT fabricating any reaction.
- No `Math.random` / `Date.now` introduced in the lens/swarm/cascade paths (determinism gate intact; lens-derive tests still assert byte-identical output).
- The non-persona (open) chat path is unchanged in behavior (WR-05 is comment-only).
- All commits made WITH hooks (no `--no-verify`).

---

_Fixed: 2026-06-19T13:10:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
