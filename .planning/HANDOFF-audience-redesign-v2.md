# HANDOFF — Audience frame redesign (sketch phase, v1→v6)

**Branch:** `feat/actions-frame-inline-redesign` · **Date:** 2026-05-30
**Status:** ✅ **v7 "Calibrated" APPROVED + BUILT (Phase 1).** User picked v7 over v7b. Real React components shipped, wired to live engine data. tsc + eslint clean, **151/151** audience tests pass. UNCOMMITTED. Browser verification of the live frame was SKIPPED per user ("just finish without" the preview step) — board is auth-walled headlessly. **Remaining:** cleanup pass (delete dead heatmap/popover files + their tests) + a real authed board screenshot before committing.

### v7 = the approved direction (sketch: `.playwright-mcp/audience-sketch-v7.html`, render on Desktop `audience-v7-calibrated.png`)
The gap from v6→v7 (the "not-quite-Apple" tells, now fixed): **(1)** flat panel → Raycast material (gradient `linear-gradient(180deg,#1b1c1e,#161719)` + 1px top inset highlight `rgba(255,255,255,0.05) 0 1px 0 0 inset`); **(2)** 8% borders → **6%**; **(3)** killed the green status dot → monochrome + coral ≤2 marks; **(4)** de-duped hero vs table (hero 68% = weighted blend, New-viewers row = 61% FYP — no datum at two altitudes); **(5)** time-accurate drop lock (0:21 of 0:30 = **70%**, not visual-center 50%) tying curve dot ↔ filmstrip frame ↔ axis tick; **(6)** instrument chart (floor line, labeled niche ghost, coral hairline to the dot); **(7)** shaped table rows (inline retention bars); **(8)** collapsed type scale (~5 sizes) + grouped rhythm; **(9)** darkened keyframes `filter:brightness(.5) saturate(.7) contrast(1.04)`.
(v7b "Committed" — curve-hero, fused headline, 4-up instead of table — was rejected; sketch still at `.playwright-mcp/audience-sketch-v7b.html` if we ever revisit.)

### What got built (Phase 1) — all in `src/components/board/audience/`
- **NEW:** `AudienceHero.tsx` (number+status+sub+insight), `RetentionChart.tsx` (SVG survival curve + niche ghost + coral drop dot/lock-line/label + time-aligned darkened filmstrip + axis — **replaces** the canvas `RetentionCurve`+`use-retention-curve-canvas`), `SegmentTable.tsx` (4-group Who-leaves shaped rows), `MixFooter.tsx` (Adjust → inline `WeightOverrideDrawer`), `audience-derive.ts` (pure helpers) + `__tests__/audience-derive.test.ts` (29 tests).
- **REWRITTEN:** `AudienceNode.tsx` → thin wiring container (data/streaming/weights → 4 zones). `__tests__/AudienceNode.empty-state.test.tsx` updated.
- **Data wiring:** hero = `recomputedMetrics.weighted_completion_pct×100` (dirty) else `behavioral_predictions.completion_pct`; sub = `completion_percentile`; insight drop = largest negative step in `recomputedCurve ?? heatmap.weighted_curve` (auto-normalizes 0–1 vs 0–100); curve smooth monotone Catmull-Rom→Bézier; niche ghost = mean niche-slot `attentions` (fallback flat `niche_completion_pct`); filmstrip = `segments[].keyframe_uri` ⊕ `stream.filmstrips` ⊕ permalink ⊕ `pendingVideo.frames`; segment groups join `result.persona_simulation_results[].watch_through_pct` by **normalized** slot (`niche_deep→niche`, the documented drift) else mean attention; footer label from dominant `weights`.
- **Preserved:** permalink hydration, weight-override POST `/api/analyze/[id]/override`, empty state, streaming skeletons (choreography hook still called, visual reveal simplified), fluid widths for mobile `MobileFrameCard`.
- **Surprises confirmed:** persona sim results live at `result.persona_simulation_results` (sibling of `heatmap`, NOT nested); `weighted_curve`/`recomputeWeightedCurve` are 0–1, `completion_pct` is 0–100.

### Dead files still on disk (DELETE in cleanup — AudienceNode no longer imports them; their own tests still pass so left intact): `RetentionCurve.tsx`, `use-retention-curve-canvas.ts`, `HeatmapDrawer.tsx`, `PersonaRow.tsx`, `HeadlineChips.tsx`, `Filmstrip.tsx` (verify — `RetentionChart` may inline its own; check before deleting), `TapPopover.tsx`, `PersonaDetailInline.tsx`, `AntiViralityOverlay.tsx`, `DropoffMarkers.ts` + their `__tests__/*`. Re-run tsc+eslint+vitest after deletion.

> ⚠️ Sketches live in `.playwright-mcp/` (gitignored, local disk). The `localhost:8099` python server dies between sessions — **read the HTML files directly** or re-serve: `cd .playwright-mcp && python3 -m http.server 8099`.

---

## 0. TO RESUME IN A FRESH SESSION — paste this
1. `Read .planning/HANDOFF-audience-redesign-v2.md` (this file).
2. The current sketch: `.playwright-mcp/audience-sketch-v6.html` (Read it; or serve + screenshot via headless Chrome — see §6).
3. **A reference screenshot** of a surface whose *feel* we want (Apple/Linear/Raycast/Stripe/Revolut/Loom). ← the missing input that will break the guess-loop.

To screenshot a sketch (headless Chrome, no Playwright lock):
```
cd .playwright-mcp && (python3 -m http.server 8099 &) ; sleep 1
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --force-device-scale-factor=3 --virtual-time-budget=6000 --window-size=1000,900 \
  --screenshot="out.png" "http://localhost:8099/audience-sketch-v6.html"
```
(`--virtual-time-budget` lets the picsum keyframe images load before capture.)

---

## 1. GOAL
Rework the **Audience board frame** ground-up. Deliver max user value from the engine's retention/persona data, at the craft bar of **Apple / Linear / Raycast / Stripe / Revolut / Loom**. Sketch-first (HTML), then build real React components.

## 2. THE DESIGN RULESET (Layer-2 — the critical artifact, derived from a deep code audit)
1. **Coral ≤ 2 marks/frame** — accent is a scalpel, not a highlighter. Everything else neutral.
2. **One metric per visual** — survival ≠ attention ≠ intent; never share an axis. The curve shows **survival only** (% still watching, from `swipe_predicted_at`).
3. **No datum at two altitudes** — kill repetition (the old frame stated "drop at 21s" 4×).
4. **Zero popups** — detail expands inline / on tap.
5. **No fabricated numbers** — (old frame's "Test Audience · 200" was hardcoded; real personas = 10 archetypes).
6. **Plain language, sentence-case** — no ALLCAPS jargon; read like a human analyst.
7. **Dividers not boxes; values right-aligned; ≤4 type sizes; 3 text colors.**
8. **Every mark answers who / where / why / fix** — or it's cut.

## 3. CRAFT LESSONS (the "AI-slop" tells, fixed across v4→v6)
- **Type-size soup** (had ~12 sizes) → use **4** (e.g. 11 / 13 / 15 / 40).
- **Opacity mush** (6 greys) → **3 text levels** (~.95 / .50 / .30).
- **Emoji icons** (⚖⚠↻) → **inline-SVG icons** (codebase has `@phosphor-icons/react`).
- **Muddy coral fill** under the curve → **neutral chart, white line, coral = one dot.** No color wash.
- **Angular polyline curve** → **smooth monotone Bézier.**
- **Empty placeholder keyframe boxes** → **real darkened video stills** (mock used `picsum.photos/seed/X/240/135`; prod uses `segments[].keyframe_uri`).
- **iOS-slider-looking rows** → either mini retention **sparklines** (data, not control) or a **stripped name+value list**.
- **Overstuffed + verbose** = the deepest issue. v6's bet: **radical subtraction** — one thing with conviction, ~60% fewer words, big air. Detail (sparklines/intents/reasoning) moves to tap, not the resting state.

## 4. ITERATION LOG (all in `.playwright-mcp/`)
- `audience-sketches.html` — concepts **A** (Diagnosis / prose-led), **B** (Timeline / survival bars), **C** (Scorecard + inline drill) side-by-side, + the **v3** hybrid column appended. (A/B/C left with their original defects on purpose for contrast.)
- `audience-sketch-v3.html` — corrected hybrid: A's verdict + time-honest curve + B's survival bars + C's drill + keyframes-as-axis. Passed all 8 rules but read as a "dashboard widget."
- `audience-sketch-v4.html` — craft pass (strict system, real icons, area-fill chart, dot-on-baseline rows).
- `audience-sketch-v5.html` — real video stills + smooth curve + per-row sparklines.
- **`audience-sketch-v6.html`** ← **current best**: neutral white chart + single coral dot, big quiet hero, stripped segment list, max air. Still "not quite Apple/Linear" per user.

## 5. DATA MODEL + COMPONENT INVENTORY
See the prior handoff `.planning/HANDOFF-audience-redesign.md` §4 (component inventory: `src/components/board/audience/*`) and §5 (data model: `src/lib/engine/types.ts` — `HeatmapPayload` L27-58, `BehavioralPredictions` L576-592, `PersonaSimulationResult` L624-639). Key live fields the redesign uses:
- `heatmap.segments[]` {t_start,t_end,label,keyframe_uri} · `heatmap.personas[]` {slot_type,swipe_predicted_at,segment_reasons} · `niche_completion_pct` / `vs_niche_diff_pct`.
- **Unsurfaced gold** to exploit: `persona_simulation_results[].reasoning` (the "why"), per-persona save/share/comment/rewatch intents.
- ⚠ **slot_type drift**: raw schema = `niche_deep`, board contract = `niche` (`audience-types.ts:4`). The 10→4 group fold keys on this — reconcile or the niche group renders empty.

## 6. NEXT STEPS (resume here)
1. **Authed browser verification** (skipped this session — board redirects to `/login` headlessly). Log in, open `/analyze/z05dIjbz4v4W`, pan to the Audience preset, screenshot, compare to `audience-sketch-v7.html`. Check the **mobile card** too (`localStorage virtuna-board-view-mode=cards`). Fix any live-data gaps (real curve shape, real keyframes, segment % join). Quick no-auth alt: a throwaway `src/app/v7preview/page.tsx` mounting the 4 zones with mock props (was planned, not built).
2. **Cleanup pass** — delete the dead files listed in §status + their tests; re-run `npx tsc --noEmit` + `npx eslint src/components/board/audience` + `npx vitest run src/components/board`.
3. **Commit** (uncommitted now). Suggested: `feat(audience): rebuild Audience frame as v7 calibrated retention story`. ⚠ parallel session auto-commits to this branch — check `git log`/`git status` first.

## 7. METRIC SPLIT (locked, from prior handoff)
Input frame keeps the 4 engagement percentiles (the outcome scorecard). **Audience frame = retention diagnosis only.** No engagement-% duplication.
