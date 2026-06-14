---
phase: 03-rich-visuals-as-drill-downs
plan: 02
subsystem: ui-reskin
tags: [reskin, flat-warm, matte, svg-charts, tier-2, theme-06, transplant]

# Dependency graph
requires:
  - phase: 03-rich-visuals-as-drill-downs
    plan: 01
    provides: "reskin-matte.test.ts static grep gate (the Wave-0 RED gate this plan flips GREEN for 4 of its 5 files)"
provides:
  - "ScoreDistribution.tsx — matte flat-warm (no glows, --color-frame latent bug fixed, solid coral you-marker + hairline ring)"
  - "RetentionChart.tsx — matte flat-warm (cream curve, flat cream-alpha survival area, coral drop/lock/time via token, niche/ghost overlay preserved)"
  - "CraftFilmstrip.tsx — matte chrome (no end-cap glow, no white-shine insets) with footage grade/grain/vignette preserved (Pitfall 4)"
  - "RetentionPlayer.tsx — matte (no backdrop blur, no glass tooltip, no coral knob glow); byte-for-byte RetentionChart fallback preserved"
affects: [03-03-reskin, 03-04-wiring, 03-05-wiring, D-07-human-uat-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Token-coral with alpha via oklch literal: where var(--color-accent) can't carry an inline alpha, use oklch(0.68 0.13 33 / A) (the matured terracotta), NOT the old #FF7F50/rgba(255,127,80) — keeps the matte-lint green AND the alpha"
    - "Cream-alpha (rgba(236,231,222,A)) is the canonical neutral for chart dots/curves/areas/guides/text — the exact value persona-cloud.tsx uses; replaces every white-alpha and #fff in the transplant charts"
    - "Matte distinction held: outer 0 0 Npx glows REMOVED; zero-blur hairline rings (inset 0 0 0 1px / 0 0 0 1px) and directional drop shadows (0 1px Npx, negative-spread chip) KEPT as legitimate depth (matches the lint's stripLegitShadows logic)"
    - "Footage-vs-chrome (Pitfall 4): kill UI shine (white insets, end-cap glow); KEEP energyGradeFilter + film grain + per-cell vignette (they read as filmed video, not chrome)"

key-files:
  created: []
  modified:
    - "src/components/board/verdict/ScoreDistribution.tsx"
    - "src/components/board/audience/RetentionChart.tsx"
    - "src/components/board/content-analysis/CraftFilmstrip.tsx"
    - "src/components/board/audience/RetentionPlayer.tsx"

key-decisions:
  - "Token-coral alpha via oklch(0.68 0.13 33 / A) inline literal — inline CSS can't apply alpha to var(--color-accent), and the matte-lint forbids the old #FF7F50/rgba(255,127,80) forms; the oklch body matches --color-accent exactly so it IS the matured terracotta, just with an alpha channel"
  - "Lock-line + filmstrip-drop-cell ring alphas bumped (0.22→0.4 lock, kept 0.14 ring) when moving off the old-coral rgba — the old coral and the matured terracotta differ slightly in chroma/lightness, so a tiny alpha lift preserves the same on-charcoal legibility"
  - "RetentionPlayer reskinned to matte-clean but NOT mounted (03-05 owns the discretionary mount decision) — this plan only keeps the file lint-green per the downstream gate; no wiring added"
  - "KeyframeImage.tsx left untouched (03-03 owns it) — it remains the single intentionally-RED matte-lint row"
  - "Backplate #0c0d0f (RetentionPlayer video) repointed to var(--color-surface) #1e1d1b (the darkest declared charcoal token) rather than var(--color-background) — a video letterbox wants the darker matte surface"

patterns-established:
  - "Paint-only re-treat: every edit is a color/shadow/gradient swap; zero geometry, prop-interface, mode-logic, or degradation-path changes — verified by the unchanged verdict/audience/content-analysis derive + behavior suites staying green"

requirements-completed: [READ-09]

# Metrics
duration: 14min
completed: 2026-06-15
---

# Phase 3 Plan 02: Tier-2 Re-treat (Heavy Charts → Flat-Warm Matte) Summary

**The four heaviest transplant charts — `ScoreDistribution`, `RetentionChart`, `CraftFilmstrip`, `RetentionPlayer` — get an actual visual re-treatment (glows/gradient-chrome/blur-glass killed, old `#FF7F50` repointed to the matured terracotta, white-alpha → cream-alpha) so they read flat-warm matte (SC-3 / D-07), flipping their rows of the 03-01 matte-lint GREEN while preserving every chart's geometry, props, footage grading, and degradation paths.**

## Performance

- **Duration:** ~14 min
- **Tasks:** 3 (4 files)
- **Files modified:** 4 (paint-only; 69 insertions / 76 deletions across the 3 task commits)

## Accomplishments
- **The matte gate flipped for all 4 owned files:** `reskin-matte.test.ts` went from **4 GREEN / 5 RED → 8 GREEN / 1 RED**. The lone remaining RED is `KeyframeImage.tsx`, which 03-03 owns (untouched here, as required).
- **The `--color-frame` latent bug is fixed:** `ScoreDistribution`'s you-marker dot border was `var(--color-frame, #161719)` — a token that does NOT exist, silently resolving to cold near-black. Repointed to `var(--color-surface)` (Pitfall 6 / RESEARCH landmine).
- **Footage grading preserved (Pitfall 4):** `CraftFilmstrip` lost its UI shine (white-inset highlights, end-cap glow) but KEEPS `energyGradeFilter`, the film grain (`opacity-[0.45]`), the soft-light grade pass, and per-cell vignette — it still reads as filmed video, not flat swatches.
- **No geometry / props / degradation touched:** all four are paint-only. The verdict (7 suites), audience (incl. the `RetentionPlayer` behavior test), and content-analysis derive suites stayed green; `npx tsc --noEmit` shows zero new errors in the four files.

## Task Commits

Each task committed atomically:

1. **Task 1: Re-treat ScoreDistribution.tsx (+ fix --color-frame bug)** — `e1b5bc80` (feat)
2. **Task 2: Re-treat RetentionChart.tsx** — `feeba6a1` (feat)
3. **Task 3: Re-treat CraftFilmstrip.tsx + RetentionPlayer.tsx** — `86e49d45` (feat)

**Plan metadata:** committed with this SUMMARY (docs).

## Files Created/Modified
- `src/components/board/verdict/ScoreDistribution.tsx` — removed all 3 outer glows (band `0 0 18px`, pin `0 0 9px`, dot `0 0 13px`); band → flat `oklch` token-coral 8% tint + hairline coral border (zero-blur ring kept); pin/dot = solid coral, dot gets a hairline `var(--color-surface)` ring (the `--color-frame` fix); panel bg gradient → solid `var(--color-surface)`; lane track inset-shine → flat `var(--color-border)`; lane fill gradient + in-band dots + ticks/baseline/chip → token-coral / cream-alpha; axis/scale-key text → `text-foreground-muted`.
- `src/components/board/audience/RetentionChart.tsx` — `retentionFill` gradient white-alpha stops → flat cream-alpha (`0.06→0`); curve stroke, y-guides, ghost line, niche tag, y-labels, time-axis → cream-alpha; drop dot / delta label / lock line / drop-time mark → `var(--color-accent)` / token-coral (was `#FF7F50` / old-coral rgba); filmstrip drop-cell border + hairline ring → token-coral, empty bg → cream-alpha; **footage darkening `filter` kept**; niche/ghost overlay logic untouched.
- `src/components/board/content-analysis/CraftFilmstrip.tsx` — end-cap glow (`0 0 10px`) removed (flat coral scalpel bar kept); white-shine insets removed from seam/hook-zone/strip (dark vignette kept); no-CTA tint → token-coral low-alpha; caption/axis/bars `text-white/*` + `rgba(244,244,245,…)` → `text-foreground-muted` / cream-alpha; **`energyGradeFilter` + grain + soft-light grade + vignette PRESERVED** (Pitfall 4).
- `src/components/board/audience/RetentionPlayer.tsx` — `backdropFilter: 'blur(2px)'` removed (flat dim); `#FF7F50` (knob, scrubber-fill, tooltip retention, readout) → `var(--color-accent)`; glass tooltip `#18191a` + inset shine → `var(--color-surface)` flat; video backplate `#0c0d0f` → `var(--color-surface)`; knob ring → single hairline token-coral (no glow); playhead/track/handle/icon `#fff` + white-alpha → cream; **byte-for-byte `RetentionChart` fallback when `videoSrc` null untouched** (file kept matte-clean but NOT mounted — 03-05 owns the discretionary mount).

## Decisions Made
- **Token-coral with alpha via `oklch(0.68 0.13 33 / A)`:** inline CSS cannot apply an alpha channel to `var(--color-accent)`, and the matte-lint forbids both old-coral forms (`#FF7F50`, `rgba(255,127,80,…)`). The `oklch` body is identical to `--color-accent`'s definition in `globals.css`, so these literals ARE the matured terracotta — just with the alpha the design needs (band tint, lock line, in-band dots, knob ring, filmstrip drop ring, end-cap tint).
- **Cream-alpha `rgba(236,231,222,A)` as the neutral:** the exact value `persona-cloud.tsx` already uses; it replaces every white-alpha and `#fff` for curves/dots/areas/guides/text per the UI-SPEC "never pure white" rule (THEME-06 / D-02).
- **Matte vs depth held precisely:** removed only the outer `0 0 Npx` halos. Kept zero-blur hairline rings (`inset 0 0 0 1px`, `0 0 0 1px`), the `CraftFilmstrip` dark vignette inset, and directional drop shadows (the you-chip `0 4px 14px -4px`, the scrubber handle `0 1px 3px`) — these are legitimate depth, mirroring exactly what the lint's `stripLegitShadows` permits.

## Deviations from Plan

The plan was executed as written — paint-only, all cited violation lines addressed. Three minor in-scope refinements (all within the re-treat mandate; none change geometry, props, or behavior — documented for the UAT reviewer's eye):

**1. [Refinement] Token-coral expressed as `oklch(…/ A)` rather than `var(--color-accent)` where an alpha is required**
- **Found during:** Task 1 (confidence band 8% tint + hairline border).
- **Detail:** The plan says "flat `--color-accent` ~8% tint". `var(--color-accent)` carries no alpha inline, so the tint/border/ring/dot-alpha cases use `oklch(0.68 0.13 33 / A)` — the same color body as the token. Solid (no-alpha) coral uses `var(--color-accent)` directly (pin, dot, drop dot, scrubber fill, scalpel bar, labels). This is the only faithful way to hit both "matte-lint green" and "coral at N%".
- **Files:** all 4.

**2. [Refinement] Lock-line alpha lifted 0.22 → 0.4 (RetentionChart) when moving off old-coral**
- **Found during:** Task 2.
- **Detail:** The old `rgba(255,127,80,0.22)` and the matured terracotta differ slightly in chroma/lightness; at 0.22 the token version read faint on charcoal. Bumped to 0.4 to preserve the same visual weight. Same reasoning kept the filmstrip drop-cell ring at 0.14 (already legible). Cosmetic, within the re-treat.
- **Files:** RetentionChart.tsx.

**3. [Refinement] Icon glyph + handle `#fff` → `var(--color-foreground)` (RetentionPlayer)**
- **Found during:** Task 3.
- **Detail:** Not lint-caught (`#fff`, not `rgba(255,255,255)`), but the UI-SPEC "never pure white" rule applies to all chart fills. Repointed the play/pause SVG glyphs + the scrubber handle to the cream foreground token for consistency. Cosmetic.
- **Files:** RetentionPlayer.tsx.

**Total deviations:** 3 cosmetic refinements, 0 architectural, 0 geometry/prop/behavior changes. No Rule 1–4 auto-fixes were triggered (no bugs, no missing functionality, no blockers, no architectural decisions).

## Matte-lint: before / after

| File | Before (03-01) | After (this plan) |
|------|----------------|-------------------|
| `ScoreDistribution.tsx` | RED (rgba coral ×6 + glows 0 0 9/13/18px) | **GREEN** |
| `RetentionChart.tsx` | RED (#FF7F50 ×3 + rgba coral ×3) | **GREEN** |
| `CraftFilmstrip.tsx` | RED (rgba coral ×2 + glow 0 0 10px) | **GREEN** |
| `RetentionPlayer.tsx` | RED (#FF7F50 ×4 + backdropFilter blur) | **GREEN** |
| `KeyframeImage.tsx` | RED (rgba coral ×1) | RED — **intentional, 03-03 owns it** (untouched) |
| (SegmentTable / PersonaGraph / StatTile / DataTable) | GREEN | GREEN (unchanged) |

**Gate tally:** matte-lint **8 passed / 1 failed** (the 1 = KeyframeImage, by design). `src/components/reading` = **91 passed / 13 todo / 1 failed** (the 1 = the same KeyframeImage matte-lint line — every panel render + degradation test passes).

## Load-bearing glow check (for the D-07 UAT reviewer)
No removed glow was load-bearing for legibility. The you-marker (pin + solid dot + hairline `--color-surface` ring) reads cleanly against the histogram without its halo; the confidence band's hairline coral border + 8% fill delineates it without the outer glow; the `CraftFilmstrip` coral scalpel bar stays a crisp 2px edge without its end-cap glow; the `RetentionPlayer` knob is a solid coral dot with a hairline ring. **One judgment call to confirm at UAT:** the `RetentionChart` lock-line alpha was lifted to 0.4 (from 0.22) to keep the same weight after the token swap — verify it doesn't read too strong against the curve.

## Issues Encountered
None. All three task verifications passed first-run; no auto-fix attempts were needed.

## Next Phase Readiness
- **03-03 (PersonaGraph + KeyframeImage reskin):** `KeyframeImage.tsx` is the last matte-lint RED row — reskin it (coral radial glow fallback → flat charcoal) to flip the gate fully GREEN. `PersonaGraph` is already matte-lint-GREEN but still needs its glass hover card / `<animate>` / white-alpha reskin (verified at the D-07 UAT gate, not this lint).
- **03-04 / 03-05 (wiring):** these four charts are now flat-warm and ready to mount as `DrillSheet` children. `RetentionPlayer` is matte-clean but NOT mounted — 03-05 decides the discretionary mount (default static `RetentionChart`; layer the player only if `useUploadedVideoSource(...).status === 'ready'`).
- **D-07 human-UAT gate:** the four reskinned surfaces are net-new visuals for the gate; the load-bearing-glow note above flags the one lock-line judgment call.

## Self-Check: PASSED

- Files: `ScoreDistribution.tsx`, `RetentionChart.tsx`, `CraftFilmstrip.tsx`, `RetentionPlayer.tsx`, `03-02-SUMMARY.md` — all FOUND.
- Commits: `e1b5bc80` (Task 1), `feeba6a1` (Task 2), `86e49d45` (Task 3) — all FOUND on `milestone/numen-rework`.
- Gate state confirmed: matte-lint 8 GREEN / 1 RED (KeyframeImage, by design); 4 owned files flipped GREEN; `src/components/reading` 91 passed / 13 todo / 1 (KeyframeImage) failed; tsc 0 new errors in the 4 files.

---
*Phase: 03-rich-visuals-as-drill-downs*
*Completed: 2026-06-15*
