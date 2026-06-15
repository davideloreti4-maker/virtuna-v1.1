---
phase: 02-the-reading
reviewed: 2026-06-14T21:15:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - src/app/(app)/analyze/layout.tsx
  - src/components/reading/reading.tsx
  - src/components/reading/index.ts
  - src/components/reading/score-gauge.tsx
  - src/components/reading/drill-sheet.tsx
  - src/components/reading/persona-cloud.tsx
  - src/components/reading/thumbnail-strip.tsx
  - src/components/reading/anti-virality-header.tsx
  - src/components/reading/driver-rows.tsx
  - src/components/reading/fix-first-list.tsx
  - src/components/reading/rewrite-item.tsx
  - src/components/reading/deeper-read.tsx
  - src/components/sidebar/Sidebar.tsx
  - src/components/ui/sheet.tsx
  - src/components/reading/__tests__/fixtures/reading-fixture.ts
  - src/components/reading/__tests__/reading.test.tsx
  - src/components/reading/__tests__/reading.degraded.test.tsx
  - src/components/reading/__tests__/reading.no-cut-data.test.tsx
  - src/components/reading/__tests__/score-gauge.test.tsx
  - src/components/reading/__tests__/drill-sheet.test.tsx
  - src/components/reading/__tests__/persona-cloud.test.tsx
  - src/components/reading/__tests__/thumbnail-strip.test.tsx
  - src/components/reading/__tests__/driver-rows.test.tsx
  - src/components/reading/__tests__/fix-first.test.tsx
  - src/components/reading/__tests__/rewrite-item.test.tsx
  - src/components/reading/__tests__/deeper-read.test.tsx
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
findings_open:
  critical: 0
  warning: 1
  info: 4
  total: 5
status: resolved
resolution: "CR-01 + WR-01/02/03/04/05 fixed (commits 3c899248, a947a3d6, d7fb3009, 28f73b67, 3d27a8a5, e044096c); WR-06 deferred to Phase 4 stage-reveal; IN-01..04 deferred (cosmetic). Suite 2041 green, build clean."
---

# Phase 2: Code Review Report

**Reviewed:** 2026-06-14T21:15:00Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** resolved (6 fixed, 5 deferred)

## Resolution (2026-06-14)

Fixed and committed atomically after review:
- **CR-01** fabricated `0%` watch → `heroWatchPct` nullable, caption gated, +regression test (both null paths) — `3c899248`
- **WR-01** RewriteItem `setTimeout` cleanup — `a947a3d6`
- **WR-02** gauge band "Low"→"Weak" alignment — `d7fb3009`
- **WR-03** clamp+finite-guard displayed score/aria — `28f73b67`
- **WR-04 (contrast)** override link coral→`--color-accent-foreground` via thin reading-local fork (shared board untouched) — `3d27a8a5`
- **WR-05** gate AntiViralityHeader on real `id` (no shared dismissal key) — `e044096c`

Deferred (by decision): **WR-06** (gauge 0→score transition is the Phase-4 stage-reveal animation) + **IN-01..04** (cosmetic/maintainability). Suite 2041 green, build clean.

## Summary

"The Reading" presentation layer is well-built: the single-source contract, READ-10 no-cut-data guard, panel allow-list, and per-block graceful degradation are all real and tested (68/68 tests green). No signed-URL logging anywhere in the namespace (honesty contract upheld there). Flat-warm tokens are respected in the reading components themselves.

However, the adversarial pass surfaced **one genuine honesty-contract hole the test suite does not cover**: the hero-owned watch% can render a fabricated `0%` (CR-01) — the exact `?? 0` fallback the brief flagged. Every test that exercises the empty-personas path happens to supply a non-null `weighted_completion_pct`, so the fabricated-0 branch is live but untested. There is also a user-facing band-vocabulary split ("Low" on the gauge vs "Weak" in Deeper read), an uncleaned `setTimeout` in RewriteItem, an unclamped gauge number/label, and several reuse-inherited token/contrast issues that the phase chose to surface above the gauge.

## Critical Issues

### CR-01: Hero watch% renders a fabricated `0%` when watch-through is genuinely unknown (D-13 / READ-10 violation)

**File:** `src/components/reading/reading.tsx:86-93` (and the unconditional caption at `150-152`)
**Issue:** `heroWatchPct` falls through to `Math.round((hm?.weighted_completion_pct ?? 0) * 100)`. When there are no personas (`buildPersonaNodes` returns `[]` → `averageWatchThrough` returns `null`) **and** `weighted_completion_pct` is `null`/`undefined` (the field is typed `number | null` and is genuinely absent on text / tiktok-url reads and on permalink rows where Pass 2 fell below threshold — see `types.ts:482`), the function returns `0`. The container then unconditionally renders `<span>{watch}%</span> watch` → **"0% watch"**. A literal `0%` presented as a real watch-through figure is precisely the fabricated-0 the honesty contract (D-13) forbids — the same class of bug `analysis_unavailable` exists to prevent for the score. The case is reachable and untested: every degraded-path test (`reading.test.tsx:115-136`, `reading.degraded.test.tsx`) supplies a non-null `weighted_completion_pct`, so the `?? 0` branch never fires in CI.

It is also reachable when `data.heatmap` is `null` entirely (a scored text/url read with no heatmap): `heroWatchPct(null)` → `worstBadGroupKey([])` → `buildPersonaNodes(null,…)` → `[]` → `null` → `Math.round((null ?? 0)*100)` = `0` → "0% watch" rendered beside a real gauge.

**Fix:** Make watch% nullable and omit the caption (or show an honest "watch% unavailable") when it cannot be derived, exactly like the score gate:
```tsx
// reading.tsx
function heroWatchPct(heatmap: HeatmapPayload | null | undefined): number | null {
  const hm = heatmap ?? null;
  const badKey = worstBadGroupKey(buildSegmentGroups(hm, undefined));
  const nodes = buildPersonaNodes(hm, undefined, badKey);
  const avg = averageWatchThrough(nodes);
  if (avg != null) return avg;
  const wc = hm?.weighted_completion_pct;
  return wc != null ? Math.round(wc * 100) : null; // ← no fabricated 0
}

// in the hero JSX:
const watch = heroWatchPct(data.heatmap);
…
{watch != null && (
  <p data-testid="reading-watch" className="text-sm text-foreground-secondary">
    <span className="font-semibold tabular-nums text-foreground">{watch}%</span> watch
  </p>
)}
```
Add a regression test: empty personas + `weighted_completion_pct: null` (and a `heatmap: null`) must NOT render "0% watch".

## Warnings

### WR-01: RewriteItem `setTimeout` is never cleared — leaks + "setState on unmounted component" warning

**File:** `src/components/reading/rewrite-item.tsx:27-37`
**Issue:** `handleCopy` schedules `setTimeout(() => setCopied(false), 1500)` with no handle and no cleanup. RewriteItem lives inside FixFirstList, which lives inside the thread; the DrillSheet/overflow toggles and route changes can unmount it within the 1.5 s window. The pending timer then calls `setCopied` on an unmounted component (React dev warning) and holds the closure alive. The other timer-bearing component in this phase has the same class of issue but this one is in new code.
**Fix:** Track and clear the timer (and clear any prior timer before scheduling a new one):
```tsx
const timer = useRef<ReturnType<typeof setTimeout>>();
useEffect(() => () => clearTimeout(timer.current), []);
function handleCopy() {
  navigator.clipboard.writeText(rewrite.variant).then(() => {
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  }).catch(() => {});
}
```

### WR-02: Gauge band word "Low" contradicts the app-wide "Weak" vocabulary shown in the same view

**File:** `src/components/reading/score-gauge.tsx:52,103` (via `bandFromScore` → `'Strong'|'Mid'|'Low'`) vs `src/components/reading/deeper-read.tsx:27-31` (`BAND_LABEL` → `'Strong'|'Mid'|'Weak'`)
**Issue:** The hero gauge prints the band word from `bandFromScore(score)` which returns **"Low"** for `<40`. Deeper read (and the sidebar/score-zone language) renders the engine's `dim.band` enum whose low bucket is **"Weak"**. Both can appear on screen simultaneously (gauge says "Low", Deeper read credibility says "Weak"). Two different words for the same concept in one viewport reads as a defect to users and undermines the "one score-color language" goal stated in the Sidebar header comment.
**Fix:** Pick one vocabulary for user-facing band words. Either map the gauge's `<40` word to "Weak" (a small `GAUGE_BAND_LABEL` in score-gauge that overrides "Low"→"Weak"), or document why the score-derived band and the dimension-derived band intentionally differ. Lowest-risk: align the gauge to "Weak".

### WR-03: ScoreGauge renders the raw, unclamped score in both the number and the aria-label

**File:** `src/components/reading/score-gauge.tsx:48,57,96-98`
**Issue:** The arc fill clamps (`pct = clamp(score, 0, 100)/100`), but the centered number (`{score}`), the band style, and `aria-label={`Score ${score} of 100, ${band}`}` all use the **raw** prop. A malformed score (engine/regression bug yielding `105`, `-3`, or `NaN`) would display "Score 105 of 100" / a negative number / "NaN", while the arc silently clamps — a confusing, dishonest read. `overall_score` is typed `number` with no guarantee of range at this boundary.
**Fix:** Clamp once and reuse for display + label:
```tsx
const shown = Math.round(clamp(Number.isFinite(score) ? score : 0, 0, 100));
// use `shown` in aria-label, the <span>, and band derivation
```

### WR-04: AntiViralityHeader surfaced above the gauge bypasses flat-warm tokens (raw white + coral-on-coral override link)

**File:** `src/components/reading/anti-virality-header.tsx:16` (verbatim re-export of `board/verdict/AntiViralityHeader.tsx:57-73`)
**Issue:** The phase deliberately mounts this banner ABOVE the gauge (D-04) and re-exports it verbatim, so its styling is now part of The Reading's surface. That styling violates the locked flat-warm rules: `color: 'rgba(255,255,255,0.9)'` (raw white, not a `--color-foreground*` token) and an override button whose text color is `var(--color-accent)` (coral) sitting on a gradient that **starts** at `var(--color-accent)` — coral-text-on-coral-gradient at the left edge is effectively invisible / fails contrast. "Verbatim board reuse" was the explicit decision, but the result is a token-bypassing, low-contrast control in the new namespace.
**Fix:** Either fork a flat-warm variant for the Reading (token foreground, ensure the "Post anyway →" link has a non-coral readable color against the gradient), or add an explicit waiver noting the gate banner is exempt from THEME-06 pending a Phase-3/4 restyle. At minimum fix the coral-on-coral override link contrast.

### WR-05: `analysisId={id ?? ''}` produces a shared localStorage dismissal key across all id-less reads

**File:** `src/components/reading/reading.tsx:124` → `anti-virality-header.tsx:11-22,30-32`
**Issue:** When `id` is null but `data` exists (a plausible live-SSE state: result streamed before the `/analyze/[id]` URL transition), the banner receives `analysisId=''`, so its dismissal key collapses to the constant `virtuna:verdict-av-override:`. A user who dismissed the gate on one id-less stream would have it pre-dismissed for the next — a cross-read state bleed. Permalink reloads always carry an id, so the blast radius is the streaming window only.
**Fix:** Don't render the gate until a real id exists (`{id && <AntiViralityHeader result={data} analysisId={id} />}`), or pass a stable per-result key instead of `''`.

### WR-06: Gauge fill animates 0→score on the very first permalink mount, implying a "calculation" that didn't happen

**File:** `src/components/reading/score-gauge.tsx:89-91`
**Issue:** When motion is enabled, the fill `<circle>` always carries `transition: stroke-dasharray 700ms`. On a permalink reload the score is known instantly, yet the dash transitions from its initial 0 to the final value, so the gauge appears to "fill up" as if computing live. The component's own contract comment says the transition is for the Phase-4 live stream "as the prop updates" — but on first mount there is no prior value, so this is an unintended reveal animation on static data. Not incorrect data, but it visually fabricates a computation step on a cached read.
**Fix:** Gate the transition so it only applies after first paint (e.g., enable the transition in a `useEffect`/`useState` flip, or set the initial `dash` to the final value via a ref so only subsequent prop changes animate). Phase 4 can opt back into the 0→value glide explicitly.

## Info

### IN-01: Inconsistent CSS-var class convention (`[--color-border]` vs `[var(--color-border)]`)

**File:** `src/components/reading/drill-sheet.tsx:52`, `src/components/reading/thumbnail-strip.tsx:44`
**Issue:** These two files use the Tailwind v4 bare-var shorthand `border-[--color-border]`, while every other reading component uses the explicit `border-[var(--color-border)]`. Both compile correctly in v4 (the bare form auto-wraps in `var()`), so this is cosmetic, but the split convention is a readability/grep hazard.
**Fix:** Standardize on `border-[var(--color-border)]` to match the rest of the namespace.

### IN-02: `heroWatchPct` recomputes the full persona pipeline; `PersonaCloud` computes it again independently

**File:** `src/components/reading/reading.tsx:86-93` and `src/components/reading/persona-cloud.tsx:46-49`
**Issue:** The container calls `buildSegmentGroups`/`worstBadGroupKey`/`buildPersonaNodes` to derive watch%, and `PersonaCloud` calls the same three again (memoized) to draw dots. Correctness is fine (pure functions, same inputs) but the derivation is duplicated rather than computed once and shared. (Performance is out of v1 scope; flagged only as a maintainability/duplication note since a future input-shape change must be kept in sync across two call sites.)
**Fix:** Optionally compute `nodes`/`badKey` once in the container and pass `nodes` (or the derived watch%) into `PersonaCloud` as a prop.

### IN-03: `partial_analysis` + `analysis_unavailable` ordering is correct but undocumented at the call site

**File:** `src/components/reading/reading.tsx:110,134`
**Issue:** `analysis_unavailable` short-circuits before the partial annotation, so a row that is somehow both flagged unavailable and partial correctly shows only "couldn't analyze". This is the right precedence, but it relies on the engine guaranteeing the two flags are mutually exclusive (they are, per `types.ts:378-387`). A one-line comment asserting the invariant would prevent a future refactor from reordering them.
**Fix:** Add a brief comment noting `analysis_unavailable` wins over `partial_analysis` by design.

### IN-04: `RewriteSection` and `FixCard` keys use array index alongside non-unique fields

**File:** `src/components/reading/fix-first-list.tsx:88,92,120` and `src/components/reading/reading.tsx` (rewrites `key={`${rw.lever_fixed}-${i}`}`)
**Issue:** Keys combine a content field with the array index (`top-${fix.timestamp_ms}-${i}`, `${rw.lever_fixed}-${i}`). The fixture has two rewrites sharing the same `original` and distinct `lever_fixed`, so today keys are unique, but folding the index into the key defeats React's reconciliation if the list is ever reordered/filtered (the index, not identity, drives the key). Low risk for a static, append-only list.
**Fix:** Prefer a stable identity (e.g., `timestamp_ms` alone if guaranteed unique, or `rw.lever_fixed`) without the index, or accept the index-keyed list explicitly given it never reorders.

---

_Reviewed: 2026-06-14T21:15:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
