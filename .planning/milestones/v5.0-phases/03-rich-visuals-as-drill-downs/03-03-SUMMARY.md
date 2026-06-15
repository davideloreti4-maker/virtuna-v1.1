---
phase: 03-rich-visuals-as-drill-downs
plan: 03
subsystem: ui-reskin
tags: [reskin, flat-warm, matte, tier-1, tier-2, svg, persona-graph, theme-06, mobile-tap, reduced-motion]

# Dependency graph
requires:
  - phase: 03-rich-visuals-as-drill-downs
    plan: 01
    provides: "reskin-matte.test.ts static grep gate (this plan flips its LAST RED row — KeyframeImage — GREEN, gate now 9/9)"
  - phase: 03-rich-visuals-as-drill-downs
    plan: 02
    provides: "the cream-alpha + token-coral patterns (rgba(236,231,222,A) neutral; var(--color-accent) scalpel) this plan reuses on the table/tile/keyframe + persona surfaces"
provides:
  - "SegmentTable.tsx / DataTable.tsx / StatTile.tsx — Tier-1 flat-warm token-swap (cream text, hairline --color-border, coral scalpel kept on the bad row / accent tile)"
  - "KeyframeImage.tsx — Tier-2: coral radial-glow fallback -> flat energy-graded charcoal; matte-lint's last RED row flipped GREEN"
  - "PersonaGraph.tsx — Tier-2 real re-treat: cream-alpha SVG dots/links/nodes, flat --color-surface hover card (no glass/shadow-xl), <animate> pulse gated on reducedMotion, AND a mobile tap-to-reveal (pin/dismiss) path for the hover card"
affects: [03-04-wiring, D-07-human-uat-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cream-alpha neutral rgba(236,231,222,A) is now the canonical fill for the persona dots/links/nodes too (matches persona-cloud.tsx L109 + the 03-02 charts) — every white-alpha render value in PersonaGraph is gone"
    - "Tap-to-reveal on a hover-only SVG: dual state — `hover` (desktop pointer preview) + `pinned` (tap/click), card renders for `active = pinned ?? hover`; node onClick toggles pinned with stopPropagation, container onClick dismisses. No hover-only affordance on touch (UI-SPEC § Mobile interactivity downgrade)"
    - "Matte fallback for a missing keyframe: an energy-graded CHARCOAL radial (cream-alpha center -> --color-surface edge) — the grade still reads, but no coral halo impersonating real footage"
    - "Comment hygiene for the matte-lint: reworded the two PersonaGraph comments that described removed values so they don't contain the literal forbidden render strings (shadow-xl / bg-[#18191a] / rgba(255,255,255)) — keeps both the AC grep and any future stricter scan clean"

key-files:
  created: []
  modified:
    - "src/components/board/audience/SegmentTable.tsx"
    - "src/components/board/_kit/DataTable.tsx"
    - "src/components/board/_kit/StatTile.tsx"
    - "src/components/board/_kit/KeyframeImage.tsx"
    - "src/components/board/_kit/PersonaGraph.tsx"

key-decisions:
  - "PersonaGraph tap model = `pinned ?? hover` (two states, one card): desktop hover still previews; touch (no hover) pins the card via tap; tap on empty canvas dismisses. The node onClick stopPropagation prevents the container's dismiss handler from immediately clearing a fresh tap. This is the prop the 03-04 panel does NOT need to pass — it works self-contained; the panel only passes reducedMotion=usePrefersReducedMotion()."
  - "Non-accent SVG strokes fold the alpha into the cream rgba and set strokeOpacity={1} (links/hover-ring/node stroke) rather than keep a separate strokeOpacity multiplier — keeps the effective dimming identical (0.06 link, 0.4 ring, 0.12 node) while removing every white-alpha value. The ACCENT branch keeps var(--color-accent) + strokeOpacity={0.6} verbatim (coral at 60% preserved)."
  - "KeyframeImage missing-frame fallback = energy-graded charcoal radial rgba(236,231,222, 0.02 + energy*0.05) center -> var(--color-surface) edge (was coral rgba(255,127,80,…) -> #0b0a10). The black bottom-edge legibility scrim (L83) and the black/55 timecode/badge backplates STAY — they are legibility over real imagery, not Raycast chrome."
  - "StatTile default tile bg = bg-[var(--color-surface-elevated)]/40 (a low-alpha lift of the chip token) rather than a flat opaque chip — preserves the same barely-there elevation the old bg-white/[0.016] gave against the panel surface, on-token."
  - "DataTable row divider border-white/[0.04] -> --color-border (the hairline token). Slightly stronger than the old 0.04 but removes the magic value; the dividers read as calm hairlines, consistent with the header divider."

patterns-established:
  - "Token-swap + interaction-only re-treat: every edit is a color/shadow value swap or a touch-affordance addition; zero geometry, prop-interface, derive, or degradation-path change — verified by the full board (469) + reading (92) suites staying green and tsc showing no new errors in the 5 files"

requirements-completed: [READ-09]

# Metrics
duration: 14min
completed: 2026-06-14
---

# Phase 3 Plan 03: Tier-1 Token-Swaps + the PersonaGraph Re-treat Summary

**The four table/tile/keyframe primitives (`SegmentTable`, `DataTable`, `StatTile`, `KeyframeImage`) get the mechanical flat-warm token-swap and `PersonaGraph` gets its real Tier-2 re-treatment — cream-alpha SVG, a flat `--color-surface` hover card (no glass / no `shadow-xl`), the `<animate>` pulse gated on `reducedMotion`, and a mobile tap-to-reveal path — so the persona cloud and the supporting primitives read flat-warm matte (SC-3 / D-07), flipping the matte-lint's last RED row (`KeyframeImage`) GREEN to take the gate to 9/9.**

## Performance

- **Duration:** ~14 min
- **Tasks:** 2 (5 files)
- **Files modified:** 5 (token + interaction only; 65 insertions / 42 deletions across the 2 task commits)

## Accomplishments
- **The matte-lint is fully GREEN — 9/9.** `KeyframeImage.tsx` was the single remaining RED row after 03-02; its coral radial-glow fallback is now a flat energy-graded charcoal wash, flipping it GREEN. The reading suite's previously-RED matte line now passes too.
- **PersonaGraph genuinely re-treated (not a fake lint pass).** The static matte-lint never scanned PersonaGraph (its issues aren't the gate's forbidden render strings), so the real work was done by evidence, not by chasing a green check: every white-alpha dot/link/node → cream-alpha; the glass `bg-[#18191a]/95 … shadow-xl` hover card → flat `bg-surface` + hairline `--color-border` + `shadow-float` (the one allowed float shadow); the `<animate>` pulse stays gated on `reducedMotion`; and a **mobile tap-to-reveal** path was added (the verified D-07 UAT target).
- **The coral scalpel is preserved everywhere it belongs.** `text-accent` bad row in SegmentTable, the `border-accent/25 bg-accent/[0.035]` accent tile in StatTile, the `bg-accent` marked/timecode badge + `border-accent/60` marked border in KeyframeImage, and the `var(--color-accent)` worst-cluster dots/nodes/strokes in PersonaGraph — all kept verbatim. Coral never broadened to neutral chrome.
- **No geometry / props / derive / degradation touched.** All five are token + interaction only. The full board suite (469) and reading suite (92) stayed green; `npx tsc --noEmit` shows zero new errors in the five files. PersonaGraph's golden-angle layout (mulberry32 seed, VB_W/VB_H) and `PersonaGraphProps` are byte-for-byte unchanged — PersonaCloud's borrowed geometry does not diverge.

## Task Commits

Each task committed atomically:

1. **Task 1: Token-swap SegmentTable, DataTable, StatTile, KeyframeImage to flat-warm** — `f1fb230a` (feat)
2. **Task 2: Re-treat PersonaGraph.tsx — matte SVG + reduced-motion gate + mobile tap** — `877fba35` (feat)

**Plan metadata:** committed with this SUMMARY (docs).

## Files Created/Modified
- `src/components/board/audience/SegmentTable.tsx` — non-bad name `text-white/90` → `text-foreground`, value `text-white/90` → `text-foreground`, desc `text-white/40` → `text-foreground-muted`; **bad-row `text-accent` kept** (the single worst-group coral scalpel, L63/L79).
- `src/components/board/_kit/DataTable.tsx` — header/cell `text-white/90|80|70` → cream tokens by weight (`text-foreground` for the right-aligned value, `text-foreground-secondary` for label/other), header caps `text-white/35` → `text-foreground-muted`; header divider `border-white/[0.06]` → `border-[var(--color-border)]`; row divider `border-white/[0.04]` → `border-[var(--color-border)]`; **subtle `hover:bg-white/[0.02]` kept**.
- `src/components/board/_kit/StatTile.tsx` — default tile `border-white/[0.06] bg-white/[0.016]` → `border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40`; caps `text-white/55` → `text-foreground-muted`; value `text-white/95` → `text-foreground`; unit `text-white/40` → `text-foreground-muted`; sub-caption `text-white/55` → `text-foreground-muted`, `em text-white/75` → `text-foreground-secondary`; **`border-accent/25 bg-accent/[0.035]` accent tile kept**.
- `src/components/board/_kit/KeyframeImage.tsx` — **coral radial-glow fallback** `rgba(255,127,80,…) → #0b0a10` → flat energy-graded charcoal `rgba(236,231,222, 0.02+energy*0.05)` center → `var(--color-surface)` edge (no halo impersonating footage); backplate `bg-[#0c0b10]` → `bg-[var(--color-surface)]`; non-marked border `border-white/[0.07]` → `border-[var(--color-border)]`; play affordance `bg-white/15` → `bg-[rgba(236,231,222,0.15)]` + arrow `border-l-white/90` → `border-l-foreground`; timecode/badge `text-white/85` → `text-foreground`; **`bg-accent` marked/timecode badge + `border-accent/60` marked border + the black/55 legibility scrims kept**. This is the file that flips the matte-lint to 9/9.
- `src/components/board/_kit/PersonaGraph.tsx` — viewer-dot fill (L108), node fill (L174): `rgba(255,255,255,A)` → `rgba(236,231,222,A)` (cream, matches persona-cloud); link `stroke="white" strokeOpacity={0.06}` → `stroke="rgba(236,231,222,0.06)"`; hover-ring non-accent `white` → `rgba(236,231,222,0.4)`; node non-accent stroke `white`+`strokeOpacity 0.12` → `rgba(236,231,222,0.12)`+`strokeOpacity 1`; **accent (coral) branch kept verbatim** on dots/nodes/ring/stroke; hover card `border-white/10 bg-[#18191a]/95 shadow-xl` → `border-[var(--color-border)] bg-surface shadow-float`; card text `text-white/*` → cream tokens; `<animate>` pulse **stays** behind `{!reducedMotion && …}`; **mobile tap path added** (see below).

## Mobile tap-to-reveal — HOW it works (for 03-04 wiring + the UAT reviewer)
The hover card used to be desktop-only (`onMouseEnter`/`onMouseLeave`). It now reveals on both pointer and touch via **two states + one rendered card**:
- `hover` — set on node `onMouseEnter`, cleared on `onMouseLeave` (desktop pointer preview, unchanged).
- `pinned` — set on node `onClick` (which fires on tap), **toggled** (tap the same node again to dismiss). The node handler calls `e.stopPropagation()`.
- `active = pinned ?? hover` — the card renders for `active`; the hover-ring highlights `active`.
- The **container `<div>` `onClick` clears `pinned`** → a tap on the empty canvas dismisses the card. The node's `stopPropagation` keeps a fresh node-tap from being immediately cleared by the container handler.

**Net behavior:** desktop = hover to preview (as before). Touch = tap a dot to pin its card, tap elsewhere (or the same dot) to dismiss. No hover-only affordance gates the card on touch (UI-SPEC § Mobile interactivity downgrade, D-07 discretion).

**03-04 panel-wiring note:** the personas panel only needs to pass `reducedMotion={usePrefersReducedMotion()}` (so the `<animate>` pulse respects the OS setting). The tap interaction is **self-contained** in PersonaGraph — no extra prop. Build `PersonaNode[]` via `buildPersonaNodes(heatmap, simResults, worstBadGroupKey(buildSegmentGroups(...)))` (the same call PersonaCloud already makes).

## Decisions Made
- **`pinned ?? hover` tap model** — the cleanest way to satisfy both "desktop hover preview" and "touch tap-to-reveal + dismiss" without the two fighting. `onClick` (not `onPointerUp`/`onTouchStart`) was chosen because click fires on tap on all touch browsers and gives a deliberate "pin" semantic; `stopPropagation` on the node vs the container's dismiss `onClick` is the standard tap-outside pattern.
- **Fold stroke alpha into the cream rgba (strokeOpacity={1}) for non-accent SVG strokes** — removes every literal `rgba(255,255,255,…)` / `white` render value (the actual goal) while keeping the effective dimming identical. The accent branch deliberately keeps `var(--color-accent)` + the separate `strokeOpacity` so the coral weight is byte-for-byte preserved.
- **Energy-graded CHARCOAL fallback for missing keyframes** — the old fallback used a coral radial to fake "warm footage"; the matte taste bar forbids a coral halo, so the grade is now a cream-alpha → `--color-surface` charcoal wash. `energy` still drives a subtle center lift, so the filmstrip's energy grading still reads, just without the coral.
- **Black legibility scrims kept** — the KeyframeImage bottom-edge `rgba(0,0,0,0.5)` overlay and the `bg-black/55` timecode/badge plates are legibility over real photography, not Raycast chrome (the reskin_map explicitly allows the scrim). Only the coral *halo* and the white-alpha *UI* were swapped.
- **Comment hygiene** — two PersonaGraph comments originally quoted the removed strings (`shadow-xl`, `bg-[#18191a]`, `rgba(255,255,255)`); reworded to "no glass, no heavy drop shadow" etc. so neither the Task-2 AC grep nor any stricter future scan trips on a comment.

## Deviations from Plan

The plan was executed as written — token + interaction only, every cited reskin_map line addressed. Three minor in-scope refinements (none change geometry, props, or behavior — documented for the UAT reviewer's eye):

**1. [Refinement] Non-accent SVG strokes use a cream rgba with `strokeOpacity={1}` rather than `white` + a separate opacity**
- **Found during:** Task 2 (links L166, hover-ring L194, node stroke L203).
- **Detail:** The reskin_map says "cream-alpha stroke". Keeping a `strokeOpacity` multiplier on top of a cream-alpha value would double-dim; instead the alpha lives in the rgba and `strokeOpacity` is `1` (or omitted for the link/ring). Effective dimming is identical (0.06 / 0.4 / 0.12). The accent branch keeps its `strokeOpacity={0.6}` verbatim.
- **Files:** PersonaGraph.tsx.

**2. [Refinement] DataTable row divider `border-white/[0.04]` → `--color-border` (the 0.06 hairline token), not a 0.04 cream-alpha literal**
- **Found during:** Task 1 (DataTable L71).
- **Detail:** The reskin_map said "→ cream token" for L71; rather than invent a `rgba(236,231,222,0.04)` magic value for the divider, it points to `--color-border` (the canonical hairline), matching the header divider. Marginally stronger than 0.04 but on-token and visually calm.
- **Files:** DataTable.tsx.

**3. [Refinement] StatTile default tile bg = `--color-surface-elevated`/40 low-alpha (not a flat opaque chip)**
- **Found during:** Task 1 (StatTile L31).
- **Detail:** The reskin_map said "`bg-surface-elevated` low-alpha"; the old `bg-white/[0.016]` was a barely-there lift, so the new value is `/40` alpha to preserve the same subtle elevation against the panel surface rather than a solid chip (which would read heavier than the original).
- **Files:** StatTile.tsx.

**Total deviations:** 3 cosmetic refinements, 0 architectural, 0 geometry/prop/behavior changes. No Rule 1–4 auto-fixes were triggered (no bugs, no missing functionality, no blockers, no architectural decisions).

## Matte-lint: before / after

| File | Before (after 03-02) | After (this plan) |
|------|----------------------|-------------------|
| `KeyframeImage.tsx` | RED (rgba coral ×1 — the radial fallback) | **GREEN** |
| `PersonaGraph.tsx` | GREEN (lint never caught its issues — see note) | **GREEN** (genuinely re-treated; verified at D-07) |
| (ScoreDistribution / RetentionChart / CraftFilmstrip / RetentionPlayer / SegmentTable / StatTile / DataTable) | GREEN | GREEN (unchanged) |

**Gate tally:** matte-lint **9 passed / 0 failed** (was 8/1). `src/components/board` = **469 passed / 0 failed**. `src/components/reading` = **92 passed / 0 failed** (the previously-RED KeyframeImage matte line now passes). `npx tsc --noEmit` = 0 new errors in the 5 files.

## D-07 UAT notes for PersonaGraph (the lint does NOT cover it — verify live)
The static matte-lint carries none of PersonaGraph's forbidden strings, so these are the things to confirm by eye on a real Simulation at the phase-close gate:
- **Cream-alpha dots/links read as calm neutral** (not the old bright white) against the charcoal panel; the **single coral worst-cluster** still pops as the scalpel.
- **The hover/tap card is flat** — solid `--color-surface`, hairline border, the soft `shadow-float` (no glass blur, no `shadow-xl` halo).
- **The `<animate>` pulse**: it's gated on `reducedMotion` (so it's OFF for reduced-motion users). For motion-on users it's a slow 3–6s opacity breathe — **D-07 judgment call carried from the plan: if it reads busy at UAT, drop it** (the gate is `{!reducedMotion && <animate …>}`; removing the `<animate>` block is a one-line change).
- **Touch:** on a real device, tap a dot → its card pins; tap empty canvas → dismiss; tap the same dot → dismiss. No card should be unreachable on touch.

## Issues Encountered
None. All task verifications passed first-run; no auto-fix attempts were needed. One comment-hygiene tidy in Task 2 (reworded two comments so the AC grep is clean) — within the task, not a deviation.

## Next Phase Readiness
- **03-04 (wiring):** all five surfaces are now flat-warm and ready to mount as `DrillSheet` children. The personas panel passes `reducedMotion={usePrefersReducedMotion()}` to PersonaGraph; the tap interaction is self-contained (no extra prop). SegmentTable/StatTile/KeyframeImage are cream-on-charcoal and slot into the retention + shareability panels unchanged.
- **D-07 human-UAT gate:** PersonaGraph + KeyframeImage are net-new reskinned surfaces for the gate; the PersonaGraph notes above flag the `<animate>`-pulse judgment call and the touch flow to verify.
- **Gate state:** matte-lint 9/9 GREEN (KeyframeImage flipped — the Wave-0 gate is now fully satisfied). Board 469 / reading 92 green; tsc 0 new errors in the 5 files.

## Self-Check: PASSED

- Files: `SegmentTable.tsx`, `DataTable.tsx`, `StatTile.tsx`, `KeyframeImage.tsx`, `PersonaGraph.tsx`, `03-03-SUMMARY.md` — all FOUND.
- Commits: `f1fb230a` (Task 1), `877fba35` (Task 2) — both FOUND on `milestone/numen-rework`.
- Gate state confirmed: matte-lint 9 GREEN / 0 RED (KeyframeImage flipped GREEN); board 469 passed / 0 failed; reading 92 passed / 0 failed; tsc 0 new errors in the 5 files. PersonaGraph AC greps verified (no glass/glow/white-render strings, reducedMotion gate + cream-alpha present, node-level onClick tap handler present).

---
*Phase: 03-rich-visuals-as-drill-downs*
*Completed: 2026-06-14*
