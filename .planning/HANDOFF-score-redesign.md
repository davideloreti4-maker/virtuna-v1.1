# HANDOFF — Score frame UI/UX redesign

**Branch:** `feat/actions-frame-inline-redesign`
**Date:** 2026-05-30

---

## ★ SESSION UPDATE (2026-05-30 build) — READ FIRST, supersedes §0–§2 below

**The curve was the slop.** The bell hero was a *fabricated symmetric gaussian* (no real distribution behind it; confidence hidden in a footnote; left 60% dead). Diagnosed + killed it. Explored 3 honest heroes (curve / lane / beeswarm-field) → user chose **field + lane fallback**.

**Hard data constraint discovered:** the niche RPC returns **aggregate only** (`median/p75/count`) — *"never individual rows"* (privacy guard). So "each dot = a real post" is NOT honestly buildable. User chose to extend the RPC with a **privacy-safe 10-bin histogram** (aggregate counts, no rows). Also confirmed `overall_score` is an **absolute 0-100 score, not a percentile** → copy now uses honest cohort position ("top 25% of your niche · N posts"), not a fake "Nth percentile".

**BUILT (real components; `npx tsc` 0 errors, `eslint` clean, 95 verdict tests green):**
- NEW `ScoreDistribution.tsx` — hero with 3 honest modes by data availability: **field** (grounded dot-histogram from bin counts, n≥20), **lane** (median+p75 ticks + confidence band, thin cohort), **absolute** (score/100 + band, no niche). Confidence band derived from `confidence` (0-1), labelled "likely lo–hi".
- NEW `FactorBars.tsx` — reclaims `factors[].score` (0-10) as committed bars; "keep" tag on strongest, coral on weakest.
- NEW `SignalTiles.tsx` + `verdict-derive.ts` (`confidenceRange`/`bandLabel`/`comparativeLine`/`deriveOneMove`/`deriveSignalTiles` — pure, tested).
- RECOMPOSED `VerdictNode.tsx` — ⚡ one-move banner + verdict head + hero + bars + tiles + slim history. AV-gated state surfaces `TopFixesList`.
- AUDIT BUGS FOLDED: killed root `aria-live` storm (single sr-only region); LOW-confidence dot = `--color-error` (was coral); dropped dead popover + uncalibrated path; `TopFixesList` timestamp anchor gated on `has_video`; slimmed `VsHistoryCollapsible` (niche chart removed — hero owns it).
- DEAD now (left in place, tests still green): `PercentileChip`, `WhyVerdictCollapsible`, `assembleReasoningBuckets`, `deriveVerdictSummary`. Retire in a follow-up.

**Backend (worker):** `supabase/migrations/20260531000002_niche_histogram.sql` — drops+recreates `compute_niche_percentiles` returning `(median,p75,count,histogram INT[10])`; route + `use-comparisons` + `database.types.ts` updated to thread `histogram`.

**⚠ REMAINING / NEXT:**
1. **Apply the migration** (`supabase db push` or dashboard) — until then the hero shows **lane fallback** (histogram=zeros). This is the gate to seeing the field mode live.
2. Screenshot the real board with field data (migration applied) to confirm craft end-to-end; check **BoardMobile** (366) verdict path.
3. Visually verify the **AV-gated** state (TopFixesList) + the **streaming/skeleton** state in the real board.
4. **Not committed.** Commit when ready (auto-push hook is on).
5. Records: `score-v7-frames.png`/`score-v7-states.png` (approved mockup), `real-desktop.png` (real component, lane mode). Mockups persist in `.playwright-mcp/score-v7.html`.

---

**Status (pre-build, historical):** Design exploration. **Lane B (distribution-curve hero) chosen**, refined to `score-v4.html`. User still pushing for Apple/Linear/Raycast-grade polish — **not final-signed-off yet**. No real components touched. All work is throwaway HTML mockups (gitignored, persist on disk in `.playwright-mcp/`).

> This is part of the larger Board UX overhaul (see `[[board-ux-overhaul]]` memory + `.planning/HANDOFF-audience-redesign.md`). The Audience frame redesign (`audience-v2`) is **approved** and is the craft bar for every other frame.

---

## 0. WHAT THE USER WANTS (read first)

Rework the **Score frame** (the board frame currently `src/components/board/verdict/`) from the ground up so it:
- Delivers the **best user value** from the engine's output (surface unused data).
- Matches **Raycast / Anthropic / Linear / Apple / Stripe / Revolut / Loom** craft — "something a big company would release."
- Is a **family member** of the already-approved `audience-v2` redesign.

User has rejected 4 rounds for being "AI slop / unrefined." The complaint is **accumulated craft**, not layout. v4 is the closest. The gap now is fine detail + motion. **Next session: get final sign-off on v4's direction, or push the ONE element the user flags as cheapest.**

---

## 1. THE APPROVED BAR — `audience-v2`

- Reference image: `audience-v2.png` (repo root). Mockup: `.playwright-mcp/audience-mockup.html`.
- Why it's refined (and my early Score sketches weren't):
  1. **A signature data-visualization is the emotional hero** (the retention curve). A bare number + tiny decorative bars always reads as a wireframe.
  2. **Zonal composition** — ⚡ one-fix banner → zones with `10px` uppercase `.09–.12em` caps labels + `22–26px` rhythm.
  3. **Stat tiles** (`.stat`: 1px 6% border, 8–11px radius, `min-height ~78`, k=10px caps / v=18px 650 tabular / sub).
  4. **One accent**: coral = your line + the one thing to fix. Everything healthy = neutral.
  5. Softer ink (`#f2f3f4`), generous air, committed micro-viz (not 54px decorative bars).

---

## 2. CHOSEN DIRECTION — Lane B, "The Verdict" (current = `score-v4.html`)

**Signature viz = a score-distribution curve** (solves the audit's "the number means nothing alone"): your position in the field, niche median tick, and **confidence rendered as the range** (likely 70–82). It's the Score analog of Audience's retention curve.

**Composition (desktop 480px / mobile 366px):**
1. **⚡ one-move banner** — pulls the single action to the top. `One move — add a replay beat at 0:06 · your weakest lever +6 pts` (coral inline-SVG bolt, NOT emoji).
2. **Zone ① The verdict** — big `77ᵗʰ` (Inter Tight) + `High potential` band + `ahead of 77% of comedy posts` + `• Confidence MEDIUM · likely 70–82` (amber dot, reason-bearing). Then the **distribution-curve panel**: bordered card w/ depth, gradient stroke, neutral fill, dashed niche-median tick (labelled `MEDIAN` in its own lane), coral **you marker** = line + glow dot + an always-on annotation **chip** (`you · 77th`) connected to the marker.
3. **Zone ② What drives it** — 5 **committed full-width factor bars**: name + track(gradient fill) + `N/10`. Reclaimed 0–10 scores. Top factor gets a neutral `keep` tag (reinforcement). Weakest = the inline **coral** fix bar (gradient + glow). **No per-factor prose.**
4. **Zone ③ Signals** — 4 **stat tiles** (Hook 7.2/10 · Completion 68% · Sound Rising vel 87 · TikTok fit 72/100) — surfaces unused engine data in audience-v2's tile style. Then `vs your last 10` collapsed.

Mobile = same, tiles 2-up.

### Locked design rules
- **ONE accent.** Coral = the single fix/risk bar + the "you" marker ONLY. Hero number **neutral** at all scores (no coral-at-≥70). **No green.** No muddy coral area-fills (coral over dark = brown — use coral marker + glow, neutral fills for areas).
- **Reclaim `factors[].score` 0–10** and render it (bars). It's currently discarded — see §5.
- **Confidence** = quiet, reason-bearing footnote (drive the reason from `signal_availability`); render hero as a **range** when MED/LOW.
- **Typeface:** Inter (body) + **Inter Tight** (big numerals). Softer ink `#f4f5f6` / `#f2f3f4`.
- Tokens: bg `#07080a`/`#08090b`, frame `#161719`/`#18191a`, coral `#FF7F50`, 6% borders / 10% hover, radii 8/10/12/14/16, `letter-spacing .2px`.

---

## 3. MOCKUP FILES (in `.playwright-mcp/`, gitignored, persist on disk)

| File | What | Verdict |
|---|---|---|
| `score-sketches.html` | A·Instrument / B·Gauge / C·Diagnosis / D·Hybrid, 4-up compare | superseded, "AI slop" |
| `score-sketch-d.html` | D + D′ no-niche degraded state | the no-niche logic worth keeping |
| `score-v2.html` | first refined (distribution hero) | muddy coral fill, system-font, floaty |
| `score-v3.html` | A·density vs B·curve, killed muddy fill | user picked **B** |
| **`score-v4.html`** | **B refined: real Inter+Inter Tight, annotation chip, clean curve** | **CURRENT BEST — start here** |
| `fonts/inter-var.woff2`, `fonts/inter-tight-var.woff2` | downloaded so mockups render real Inter | reuse via `@font-face`, served from `/fonts/` |

**CRITICAL craft lesson:** mockups MUST `@font-face` local Inter (`font-display:block`) or they render system-font fallback in the screenshot browser (Google Fonts CDN is blocked there) → looks cheap. The real app already self-hosts Inter via `next/font/google` (`src/app/layout.tsx`).

Other craft wins discovered: annotation **chip + connector** on the curve; **gradient stroke** on the curve; **gradient fills** on bars; coral **glow** (`box-shadow`/SVG `feGaussianBlur`) instead of coral fills.

---

## 4. DEEPENED AUDIT (5-agent workflow, all verified) — key findings

### My original findings — adversarial pass CORRECTED 4:
- **F2 niche "hardcoded null" → FALSE.** Niche is computed **live** via `compute_niche_percentiles` RPC (non-null when `society_id` set + cohort ≥5). The `VsHistoryCollapsible.tsx:147` "niche always null" comment is **stale**. (First-run zero-reference problem still real → that's why v4/D′ designs a no-niche state.)
- **F5 "low-contrast" → FALSE.** `#848586` on `#07080a` = 5.4:1, **passes AA**. It's a density/scannability problem, not a11y.
- **F6 header alignment** — partial; pill is `self-end` at band-label row, not the giant-number baseline.
- **F9 niche "always coming soon"** — overstated; only when `niche===null` (common case, but not always).

### Upheld core problems (the redesign fixes these): F1 duplication, F3 discarded factor scores, F4 underplayed confidence, F7 triple-encoded score, F8 jargon, F10 inverted IA, F11 no positional encoding.

### Verified bugs/landmines to FOLD INTO THE BUILD (code-confirmed):
- **`reasoning` is hardcoded `''` at `aggregator.ts:1120`** → the "Why this score?" intro paragraph **never renders at runtime**. (Decide: wire it, or drop the intro.)
- **score=null partial permalink → likely crash:** `assembleReasoningBuckets` calls `result.factors.filter(...)` on a truthy-but-partial result; `currentScore=null` → NaN into Recharts/telemetry. **P1, verify.**
- **Confidence popover** (`PercentileChip.tsx:87-102`): `role="dialog"` but no Escape / outside-click / focus mgmt. **P1 a11y.**
- **Root `aria-live="polite"`** wraps whole frame (`VerdictNode.tsx:74`) → announcement storm; 3 overlapping live regions. **P1.**
- **`isCalibrated={true}` hardcoded** (`VerdictNode.tsx:92`) → `(score uncalibrated)` is dead code even when aggregator forces `confidence=0.2`.
- **text/tiktok_url mode:** `TopFixesList` renders `0:00` timestamp anchors that jump to an empty audience filmstrip. **P1, misleading.**
- React keys: `plainList` index-keyed, works/mightNot keyed by `f.name` not `f.id` → collisions.
- `deriveVerdictSummary` risk uses `improvement_tip` with no non-empty guard → "Watch out: <name>" w/ no advice.
- Two accordions: inconsistent default-open + localStorage parsing.
- `animate-skeleton-breathe` ignores `prefers-reduced-motion` (no `motion-safe`, no `@media` guard in globals.css).
- LOW-confidence dot uses `bg-accent` (coral) = same as a top score → semantically inverted.

---

## 5. DATA MODEL — unused high-value fields (the "best user value" lever)

Score frame uses ~6 of 30+ `PredictionResult` fields (`src/lib/engine/types.ts`). High-value, unused, belong in Score:
- **`factors[].score` 0–10** (`types.ts:186`) — DISCARDED in `assembleReasoningBuckets.ts:36-37` after bucketing. **Thread it through `ReasoningBuckets` (no type change — already `PredictionResult['factors']`) and render as the bars.** This is the #1 change.
- **`counterfactuals` type=`reinforcement`** — filtered out at `assembleReasoningBuckets.ts:41` → no "what to keep" for mid/high band. (v4 surfaces via the neutral `keep` tag.)
- **`platform_fit.rationale` + `watermark_penalty`** — named score driver, never shown (→ Signals tile).
- **`matched_trends` / `audio_fingerprint`** sound name + velocity (→ Signals "Sound · Rising vel 87").
- **`weighted_hook_score` / `weighted_top_dropoff_t`** — scalar bridge to Audience (→ Signals "Hook 7.2", and the ⚡ fix timestamp).
- **`anti_virality_reason`** ('confidence' vs 'timeline_pattern') — changes the advice; dropped today.
- **`confidence` numeric (0–1)** + **`signal_availability`** + **`score_weights`** — power the confidence-with-reason + the likely-range.

**Don't duplicate (owned elsewhere):** `predicted_engagement`/`behavioral_predictions` → Input frame; persona data/`heatmap`/`emotion_arc` → Audience; `optimal_post_window` → Actions. Coordinate, don't copy.

---

## 6. COMPONENT INVENTORY — real files to touch for the build

Dir: `src/components/board/verdict/`
| File | Role now | Redesign action |
|---|---|---|
| `VerdictNode.tsx` | container, summary, accordions | recompose into ⚡ banner + 3 zones; fix aria-live storm; pass real `isCalibrated` |
| `PercentileChip.tsx` | big number + confidence GlassPill + popover | → Inter Tight number + neutral verdict band + reason-bearing confidence + **new distribution-curve viz**; fix popover a11y |
| `WhyVerdictCollapsible.tsx` | factor prose buckets (default open) | → committed factor **bars** w/ reclaimed scores; kill prose; merge to fewer sections |
| `assembleReasoningBuckets.ts` | buckets factors, **discards score** (:36-37) | **stop discarding `score`**; surface reinforcement; (decide on empty `reasoning`) |
| `verdict-constants.ts` | COPY, `BAND_THRESHOLDS`, `deriveVerdictSummary` | retire jargon ("Counterfactual considered"); guard empty `improvement_tip` |
| `VsHistoryCollapsible.tsx` | history + niche charts | fix stale "niche null" comment; first-run state; chart a11y/`role=img` |
| `AntiViralityHeader.tsx` | coral→warning gradient banner | flat coral surface (no gradient); fix "Post anyway" contrast |
| `TopFixesList.tsx` | top-3 fixes (AV) | nested-card double-tint; suppress timestamp anchors for text/tiktok modes |

New component likely: a `ScoreDistribution` SVG viz (the hero). Data: `overall_score` + niche distribution (from `compute_niche_percentiles` RPC) + `confidence` range. Mobile reuses VerdictNode via `BoardMobile.tsx` (no current mobile adaptation — add one).

Engine: `src/lib/engine/aggregator.ts` (`aggregateScores`, factor mapping ~995-1002), `types.ts` (`PredictionResult` 217-339, `Factor` 183-190, `SignalAvailability` 350).

---

## 7. INFRA / RESUME CHECKLIST

```bash
# mock server (mockups live here, gitignored)
cd /Users/davideloreti/virtuna-v1.1/.playwright-mcp && python3 -m http.server 8099
# → http://localhost:8099/score-v4.html   (current best)
# → http://localhost:8099/audience-mockup.html  (the approved bar)

# fonts already downloaded to .playwright-mcp/fonts/ (inter-var, inter-tight-var)

# real app
npm run dev   # http://localhost:3000  (Next 15 + turbopack)
# test board permalink with real data: /analyze/z05dIjbz4v4W
# card mode: localStorage.setItem('virtuna-board-view-mode','cards')

# checks before any commit
npx tsc --noEmit -p tsconfig.json
npx eslint <files>
npx vitest run src/components/board
```

Playwright MCP browser idles out between turns and the singleton lock can stick. If "Browser is already in use", kill stale chrome: `pkill -f "mcp-chrome-"` + `rm -f <userdatadir>/SingletonLock`, then re-navigate. Batch navigate→resize→screenshot in ONE message so the browser stays alive.

---

## 8. IMMEDIATE NEXT STEPS (fresh session)

1. Open `score-v4.html` + `audience-mockup.html` side by side. Get the user's final read on v4.
2. If user flags a specific element as "cheapest," push that ONE piece to final (likely candidates: curve silhouette/weighting, the verdict header, factor-bar styling). Iterate in the mockup; screenshot each pass (real fonts already wired).
3. Once the hero/composition is locked, design the **no-niche / first-run state** (see `score-sketch-d.html` D′) and the **anti-virality** + **streaming/skeleton** states before building.
4. Then build zone-by-zone in real components (§6), folding in the §4 verified bugs. `assembleReasoningBuckets` "stop discarding score" is the keystone change. Screenshot + run board tests at each step.
5. Consider whether `gsd-quick`/`gsd-ui-phase` is the right build vehicle (a UI-SPEC.md from v4 would be ideal).

## 9. OPEN QUESTIONS
- Does the distribution curve survive the **no-niche first-run** case gracefully? (D′ shows the pattern: drop cohort/×niche, keep number+band+factors+fix.)
- Wire the empty `reasoning` field, or drop the intro entirely? (currently dead)
- Is `score-v4`'s 480px width right for the auto-sized board frame, or should it match the real frame width?
- Motion spec (curve draw-in, number count-up?) — a static mock can't convey it; may be part of the "premium feel" gap.
