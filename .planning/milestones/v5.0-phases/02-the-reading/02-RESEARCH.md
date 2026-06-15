# Phase 2: The Reading (user-facing "Simulation") — Research

**Researched:** 2026-06-14
**Domain:** Next.js 15 / React 19 / Tailwind v4 presentation-layer recompose — reduce ~40 `PredictionResult` fields into a consolidated vertical "Reading" thread on `/analyze/[id]`
**Confidence:** HIGH (every claim below verified against the actual repo source, not training data)

## Summary

CONTEXT.md (15 D-NN decisions) and 02-UI-SPEC.md (approved design contract) are exceptionally complete and already prescribe the bulk of all four focus areas. This research **verifies those prescriptions against the real source files** and resolves the genuinely-open technical risks. Headline: every UI-SPEC prescription holds up against the code, with **four corrections** the planner must absorb (below). The single biggest surprise is structural, not in any focus area: the `/analyze` route mounts `<Board />` from **`layout.tsx`**, not the page — page bodies return `null`. Phase 2 must restructure that layout/page relationship, which is a larger swap than "replace a component."

The four focus areas resolve cleanly to **zero new dependencies**: (1) drill-down → the already-vendored shadcn `Sheet` (Radix Dialog, `side` already supports `bottom`+`right`); (2) arc gauge → hand-rolled inline-SVG `stroke-dasharray` (no `react-circular-progressbar` in repo, none needed); (3) static persona cloud → strip `PersonaGraph`'s existing deterministic golden-angle SSR-safe layout down to dots; (4) recompose → the named components are Konva-free but carry **Board-context coupling** (`useBoardStore`, self-fetched data, OLD palette) that must be severed.

**Primary recommendation:** Build a small set of NEW presentation components in a fresh directory (`src/components/reading/`), feeding them from `usePermalinkAnalysis` at one top-level container; **adapt** (copy-and-repoint), do NOT import-and-wrap, the four board components — their value is the JSX/markup patterns and the pure `audience-derive` + `verdict-*` helpers, not the components as drop-in units. Reuse the pure helper modules verbatim; rebuild the React shells clean on the flat-warm tokens.

### Four corrections to the UI-SPEC the planner MUST absorb

1. **`FactorBars` is a 0–10 `Factor[]` primitive, NOT a 0–100 Apollo-dimension primitive.** D-05/UI-SPEC want the 3 driver rows fed by `apollo_reasoning.dimensions[].score` (0–100). `FactorBars` consumes `Factor` (`{ name, score: 0-10, max_score, id, rationale, improvement_tip }`) and renders `/{max_score}`. The *grid/markup* (`grid-cols-[130px_1fr_42px]`, 5px bar) is the reusable pattern; the *data contract is different*. Build a new `DriverRow`/`DriverRows` that takes the three `ApolloDimension`s (0–100, no `/10` suffix). [VERIFIED: src/components/board/verdict/FactorBars.tsx + src/lib/engine/types.ts ApolloDimensionSchema]

2. **The gauge amber zone is 40–69, not "<70."** UI-SPEC §Color phrases red as "`score < 70` per `bandTone`." The actual `bandTone()` is 3-zone: `≥70 → 'good'` (green), `40–69 → 'warn'` (amber), `<40 → 'crit'` (red). The gauge fill MUST use `bandTone(overall_score)` as the single source of truth and amber owns the whole 40–69 band. [VERIFIED: src/components/board/verdict/verdict-derive.ts bandTone + verdict-constants.ts BAND_THRESHOLDS {STRONG:70, MID:40}]

3. **Two different `formatTime` exist — a live footgun.** `audience-derive.formatTime(seconds)` takes **seconds**; `TopFixesList.formatTime(ms)` (and `insights-section.formatTimestamp(ms)`) take **milliseconds**. `weighted_top_dropoff_t` is in **seconds** (use `audience-derive.formatTime`). `counterfactuals.suggestions[].timestamp_ms` is in **ms** (use the ms variant). Mixing them silently renders `0:08` as `0:00` or vice-versa. [VERIFIED: audience-derive.ts L49 vs TopFixesList.tsx L13 vs types.ts CounterfactualSuggestionItem.timestamp_ms]

4. **A `src/components/app/simulation/` directory ALREADY EXISTS** (13 legacy "Phase 13" components, dated Jun 13: `results-panel.tsx`, `insights-section.tsx`, `impact-score.tsx`, …). It is a DIFFERENT, older non-board results surface with **different copy** ("What to Fix", badge variants) that contradicts the locked mock vocabulary. Do NOT extend or reuse it for the Reading, and do NOT name the new dir `simulation/` (collision). Recommend `src/components/reading/`. [VERIFIED: ls src/components/app/simulation/ + insights-section.tsx header]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch analysis by route id | Frontend Server (route) → Client hook | — | `usePermalinkAnalysis` is `'use client'` (`useParams` + TanStack); the `[id]/page.tsx` server shell only sets metadata. Keep data fetch client-side (matches existing seam; Phase 4 swaps in `useAnalysisStream`). |
| Reading thread composition (hero/rows/fix/deeper) | Client (RSC-incompatible) | — | All interactive (clipboard copy, Sheet open, inline expand) → `'use client'`. The 760px column chrome itself could be a server component but is simplest co-located. |
| Drill-down Sheet (mount point for P3/P5) | Client | — | Radix Dialog portal + focus trap = client-only. |
| Arc gauge / persona cloud render | Client (SVG) | — | Static SVG; could SSR, but lives in the client thread. Deterministic layout keeps it hydration-safe. |
| Score-zone / band derivation | Pure module (no tier) | — | `verdict-derive` / `audience-derive` are pure TS, run anywhere. |
| Engine data shape | Database/Storage (frozen) | — | Read-only; `GET /api/analysis/[id]`. No engine changes (3.19.0 frozen). |

## User Constraints (from CONTEXT.md)

> Copied so the planner honors them without re-reading. CONTEXT.md is the authority; this is a convenience mirror.

### Locked Decisions (carried + D-01..D-15) — do NOT re-litigate
- **Product noun = "Simulation"** in all user-facing labels; `READ-*` IDs stay opaque (Phase 1 D-09).
- **Vertical order:** hero → 3 driver rows → Fix First → deeper read → composer (READ-01).
- **Score-forward, NO prose narration.** Banned: any verdict/horoscope sentence. Allowed: terse labels, data, the engine's actionable fix/rewrite text (D-15).
- **Watch-through % owned by the hero, shown exactly once** (READ-04).
- **Cut data never appears** (READ-10): `feature_vector`, `score_weights`, `signal_availability`, dead `*_score`, telemetry (`latency_ms`/`cost_cents`/model names), `critique`, `predicted_engagement`, dead modules.
- **Flat-warm tokens LOCKED (THEME-06):** app `#262624` / composer `#1e1d1b` / chip `#2f2e2b`; coral `oklch(0.68 0.13 33)`; serif Newsreader voice-only; score zones green `oklch(0.68 0.17 145)` / amber `oklch(0.75 0.15 85)` / red `oklch(0.60 0.20 25)`. Unify sidebar score chips onto these.
- **~760px centered column** (Phase 1 D-17); rich visuals may break wider only in Phase 3.
- **Route stays `/analyze/[id]`** (no `/s/[id]` rename).
- **D-01 Hero score = arc/radial gauge** (USER OVERRIDE of bare-number), fill zone-colored, flat stroked (no glow), animates fill in Phase 4.
- **D-02 Static persona cloud** (SVG/CSS dots, no Canvas, no hover); full `PersonaGraph` = Phase-3 drill-down.
- **D-03 Hero layout:** thumbnail strip top → gauge left | cloud right (desktop), stack on mobile; watch% with cloud.
- **D-04 Gate banner** above gauge when `anti_virality_gated`; score stays visible but subordinated; reuse `AntiViralityHeader`.
- **D-05 Driver row** = label + bar (0–100 fill) + value; **D-06 Retention** bar fills by retention score, value = `⚠ 0:08` drop time; **D-07** neutral cream bars, only the single weakest colored; **D-08** fixed funnel Hook→Retention→Shareability.
- **D-09/10/11 two-tier disclosure:** heavy → Sheet (bottom mobile / right desktop, the Phase-3 mount point); light ("N more fixes", "Deeper read") → inline expand.
- **D-12 seam:** Sheet shows real engine data in simple native form now; Phase 3 swaps rich charts into the same container.
- **D-13 honesty (correctness):** `analysis_unavailable`→fake-0 NEVER shown as real score (dedicated state); `partial_analysis`→annotation; `apollo_reasoning: null`→Deeper read shows only what's present.
- **D-14 empty states:** zero fixes → "Nothing urgent to fix"; no rewrites → fixes without rewrite chip.

### Claude's Discretion (researched + recommended below)
- Drill-down library (→ shadcn `Sheet`, §Focus 1)
- Open-panel URL behavior (→ shallow `?panel=` recommended, §Focus 1)
- Arc-gauge geometry/stroke/typography + reveal curve (→ §Focus 2)
- Video thumbnail source/behavior (→ static `<img>` poster, gated on real video, §Recompose)
- Component/motion library choice (→ `motion/react`, Radix, already in taste bar)
- Exact micro-copy (→ UI-SPEC §Copywriting defaults)

### Deferred Ideas (OUT OF SCOPE for Phase 2)
- Full Canvas `PersonaGraph` drill-down → Phase 3
- Rich board visuals (RetentionChart, filmstrip, SegmentTable, emotion arc) → Phase 3 (READ-09)
- Naming reconciliation (brief/requirements prose still say "Reading") → separate prose pass
- Shareable/deep-linked panels that survive share → v2 (`SHARE-01`)

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| READ-01 | Vertical thread IA: hero → rows → Fix First → deeper → composer | New `Reading` container composes ordered sections; mounts in the Phase-1 760px column (§Recompose). |
| READ-02 | Score-forward hero, no prose | Arc gauge (§Focus 2) from `overall_score`; band word via `bandFromScore` (Strong/Mid/Low); zero verdict sentences (D-15). |
| READ-03 | Hero layout (thumbnail / gauge / cloud) | `KeyframeImage`-pattern `<img>` + gauge + static cloud, grid desktop / stack mobile (§Recompose, §Focus 3). |
| READ-04 | Watch-through % once, hero-owned | `averageWatchThrough(nodes)` (0–100) beside cloud; never repeated in rows (§Data shapes). |
| READ-05 | 3 driver rows with bars | New `DriverRows` from 3 `ApolloDimension`s (0–100), NOT `FactorBars` (correction #1). |
| READ-06 | Retention readout = drop time; row detail taps | Retention value = `⚠ formatTime(weighted_top_dropoff_t)` (seconds!); each row opens the Sheet (§Focus 1, correction #3). |
| READ-07 | Two-tier disclosure (Sheet + inline) | shadcn `Sheet` heavy; `Accordion`/`useState` inline (§Focus 1). |
| READ-08 | Fix First + copyable rewrites + Deeper read; degraded/empty states | `counterfactuals.suggestions` (fixes) + `apollo_reasoning.rewrites` (copy) + remaining 3 dims; D-13/D-14 null handling (§Data shapes, §Pitfalls). |
| READ-10 | Cut data never renders | Whitelist the rendered fields; never spread the raw `PredictionResult` into JSX. |

*(READ-09 rich visuals = Phase 3, explicitly out of scope.)*

## Standard Stack

**Zero new dependencies.** Everything required is already installed and vendored. [VERIFIED: package.json + ls src/components/ui/]

### Core (already in repo)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `radix-ui` (Dialog) via `src/components/ui/sheet.tsx` | radix-ui ^1.4.3 | Drill-down Sheet (bottom/right) | First-party vendored shadcn; `side` prop already does both forms; focus trap + a11y built in. |
| `@radix-ui/react-accordion` via `src/components/ui/accordion.tsx` | ^1.2.12 | Inline "Deeper read" / "N more fixes" expand | Light reveal, in-thread (D-10). |
| `motion` | ^12.29.2 | Gauge fill reveal (Phase-4-owned), inline expand height | Import from `motion/react`. Calm-motion taste bar. |
| inline SVG (no lib) | — | Arc gauge + static persona cloud | `stroke-dasharray` gauge; reuse `PersonaGraph` golden-angle math. No `react-circular-progressbar` present and none needed. |
| `lucide-react` / `@phosphor-icons/react` | ^0.563 / ^2.1.10 | Icons (`⚠` is a literal char; warning/copy icons optional) | Both installed; Lucide is shadcn default. |
| pure helpers (no React) | — | `audience-derive.*`, `verdict-derive.*`, `verdict-constants.*` | Reuse VERBATIM — `buildPersonaNodes`, `averageWatchThrough`, `findBiggestDrop`, `formatTime`, `bandTone`, `bandFromScore`, `fixCount`, `COPY`. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff / Verdict |
|------------|-----------|--------------------|
| shadcn `Sheet` (Radix Dialog) | `vaul` (drawer w/ native snap points + drag) | `vaul` gives best-in-class mobile drag-to-dismiss + velocity snap. **NOT installed; do NOT add.** UI-SPEC explicitly rules it out. Radix Dialog has no drag-to-dismiss, but back-button + overlay-tap + close-button cover dismissal. **Verdict: Sheet.** If a future phase wants drag physics, revisit `vaul` then. [VERIFIED: vaul absent from package.json] |
| Hand-rolled SVG gauge | `react-circular-progressbar` | A 40-line SVG is trivial, fully token-controllable, no dep, animates via `stroke-dashoffset`. Library adds bundle + its own styling layer fighting flat-warm. **Verdict: hand-roll.** |
| New `DriverRows` | adapt `FactorBars` in place | `FactorBars` is 0–10 + `/max` suffix + sorts strongest-first + coral fix-bar + glow — wrong on five axes for D-05/06/07. Cheaper to write fresh than to fork its behavior. **Verdict: new component, borrow the grid.** |
| Reuse `src/components/app/simulation/*` | — | Legacy non-board surface, contradicting copy. **Verdict: ignore; fresh `reading/` dir.** |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed in this phase. All libraries used are already present in `package.json` (verified) and the two UI primitives (`sheet`, `accordion`) are already vendored in `src/components/ui/`. **Package Legitimacy Gate: not triggered (nothing to vet).** If a future plan wants a third-party block or `vaul`, the registry-vetting gate must run first.

---

## Focus 1 — Drill-down Sheet/Drawer (HIGHEST LEVERAGE — the Phase-3/5 seam)

### Recommendation: shadcn `Sheet` (already vendored), wrapped in one generic `<DrillSheet>`

`src/components/ui/sheet.tsx` is Radix-`Dialog`-based and its `SheetContent` already accepts `side: "top" | "right" | "bottom" | "left"` with the correct slide animations and responsive width. [VERIFIED: src/components/ui/sheet.tsx] This is the entire mechanism — no new dependency, no `vaul`.

**Library comparison (all evaluated against what's actually installed):**

| Option | Installed? | Mobile bottom-sheet | Desktop right-drawer | Drag-to-dismiss / snap | Focus trap + a11y | Reduced-motion | Next-15 app-router fit | Verdict |
|--------|-----------|---------------------|----------------------|------------------------|-------------------|----------------|------------------------|---------|
| shadcn `Sheet` (Radix Dialog) | ✅ vendored | ✅ `side="bottom"` | ✅ `side="right"` | ❌ none (overlay-tap + close btn + Esc) | ✅ Radix Dialog built-in | honor via `usePrefersReducedMotion` on enter anim | ✅ `'use client'`, portal | **CHOSEN** |
| `vaul` | ❌ NOT in package.json | ✅ best | partial | ✅ native | ✅ | ✅ | ✅ | rejected (not installed; UI-SPEC rules out) |
| Radix `Dialog` raw (`ui/dialog.tsx`) | ✅ vendored | possible, manual | possible, manual | ❌ | ✅ | manual | ✅ | redundant — `Sheet` IS this, styled |
| `motion`/Framer hand-rolled | ✅ | manual everything | manual | ✅ if built | ❌ must add focus trap by hand | ✅ | ✅ | rejected — re-implements Radix Dialog a11y for no gain |

Radix Dialog ships the focus trap, `Esc`-to-close, scroll-lock, `aria-modal`, and inert-background that a hand-rolled `motion` sheet would have to re-implement. Drag-to-dismiss is the only thing lost, and the back-button (below) + overlay-tap + close button cover dismissal for v1.

### The generic container API (this is the load-bearing artifact — P3 and P5 mount here)

Build one `<DrillSheet>` that is panel-agnostic. The caller passes the panel as `children`; the mobile/desktop switch is internal via the existing `useIsMobile` hook. [VERIFIED: src/hooks/useIsMobile.ts exports `useIsMobile()` and `useIsMobileHydrated()`]

```tsx
// src/components/reading/drill-sheet.tsx  ('use client')
// Source pattern: src/components/ui/sheet.tsx (Radix Dialog) + useIsMobile
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/useIsMobile';

export interface DrillSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;            // SheetTitle — required for a11y (Radix warns if absent)
  children: React.ReactNode; // ANY panel: Phase-2 native content, Phase-3 RetentionChart, Phase-5 chat
}

export function DrillSheet({ open, onOpenChange, title, children }: DrillSheetProps) {
  const isMobile = useIsMobile();            // bottom on mobile, right on desktop (D-11)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        // flat-warm reskin: drop shadow-lg, hairline border, charcoal surface (D-09 / UI-SPEC)
        className="bg-surface border-[--color-border] sm:max-w-[560px] data-[side=bottom]:max-h-[85vh] rounded-t-[16px] sm:rounded-none"
      >
        <SheetHeader className="px-6">
          <SheetTitle className="text-foreground">{title}</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto px-6 pb-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
```

**Why `children`-based, not a panel registry:** Phase 3 and Phase 5 add panel *types* without touching `DrillSheet`. The caller (a row, the cloud, a chat trigger) owns which panel; `DrillSheet` only owns the surface + the mobile/desktop switch + a11y. This is the minimum API that keeps the seam open. A single shared `useState` (`{ open, panelId }`) at the `Reading` container level drives one `DrillSheet` instance; the rendered child is chosen by `panelId`. [grounded in D-09/D-12 + the existing `ui/sheet.tsx` contract]

**Flat-warm reskin checklist** (UI-SPEC §Two-tier): replace `shadow-lg` with `--shadow-float` *only if* it should read as floating (overlay already dims via `bg-black/50` — usually no extra shadow needed); border = hairline `--color-border`; surface = `--color-surface` (`#1e1d1b`); **no inset-shine shadow**; `rounded-t-[16px]` on the mobile bottom variant for the sheet-handle feel (the `--radius` header value). Per CLAUDE.md, if any blur is wanted it must be an inline `style={{ backdropFilter }}` (Lightning CSS strips the CSS class) — but flat-warm is matte, so prefer no blur.

### `useIsMobile` hydration footgun

`useIsMobile()` returns `false` on the server and first client render, then flips after mount. [VERIFIED: src/hooks/useIsMobile.ts has both `useIsMobile()` and `useIsMobileHydrated()`] Because the Sheet renders into a portal that only opens on user interaction (post-hydration), the SSR-default `false` (→ `right`) is harmless — by the time a user taps a row the value is correct. **No SSR mismatch** for the Sheet itself. (Contrast: if you keyed *thread layout* off `useIsMobile` you would risk a flash — but the thread is CSS-responsive, not JS-switched.) If a first-paint-correct value is ever needed, `useIsMobileHydrated()` returns `{ isMobile, hydrated }`.

### Open-panel URL sync — recommendation: shallow `?panel=<rowId>`, with a pragmatic Next-15 caveat

**Desired feel (D-09 discretion):** browser **back** closes the sheet on mobile; the panel is shareable/deep-linkable.

**Next 15 app-router reality:** App Router has **no `router.push(url, { shallow: true })`** (that was Pages Router; it is removed in App Router). The supported shallow-update mechanism is the native **`window.history.pushState` / `replaceState`** — Next 15 explicitly documents using the History API directly for query-param updates without re-running server components, and `useSearchParams()` re-reads them. [CITED: nextjs.org/docs/app — "Using the native History API"] The existing Board already does exactly this pattern (`replaceState` to sync camera/preset). [VERIFIED: src/components/board/Board.tsx L283-293 uses `serializeCamera` + a debounced `replaceState`]

**Recommended implementation:**
- **Open a panel:** `window.history.pushState(null, '', `?panel=${rowId}`)` (a new history entry → back button pops it).
- **Sync sheet→URL and URL→sheet:** drive `DrillSheet open` from a state that reads `useSearchParams().get('panel')`; on `onOpenChange(false)` call `history.back()` if the panel param is present (so closing via overlay/Esc also pops history), else `pushState` without it.
- **Listen for back:** Radix already closes on `Esc`; for the hardware/browser back, a `popstate` effect syncs the open state to the (now absent) param. Because `pushState` adds the entry, back removes it and `popstate` fires.

**Caveat / acceptable fallback:** wiring `pushState`-open with `history.back()`-close so that *every* dismissal path (overlay tap, Esc, close button, hardware back) stays consistent is fiddly. If it proves flaky in the build, **pure-ephemeral `useState` is an acceptable v1** (UI-SPEC says so) — the sheet still opens/closes, it just won't deep-link or intercept hardware-back. Recommendation stands at shallow-sync because back-closes-the-sheet is the stated mobile target, but it is explicitly downgradeable. `useSearchParams()` MUST be inside a `Suspense` boundary in app router (it opts the subtree into client rendering) — the Reading is already `'use client'`, so wrap the container or accept the `'use client'` boundary. [CITED: nextjs.org/docs/app/api-reference/functions/use-search-params — Suspense requirement]

---

## Focus 2 — Arc / radial gauge (D-01, user override)

### Recommendation: hand-rolled inline SVG, `stroke-dasharray`/`stroke-dashoffset`, fill = `bandTone` zone color

No gauge library exists in the repo and none is warranted. The canonical SVG technique:

```tsx
// src/components/reading/score-gauge.tsx  ('use client')
import { bandTone } from '@/components/board/verdict/verdict-derive';
import { bandFromScore } from '@/components/board/verdict/verdict-constants';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

const ZONE_VAR = { good: 'var(--color-success)', warn: 'var(--color-warning)', crit: 'var(--color-error)' } as const;

export function ScoreGauge({ score, size = 120, stroke = 8 }: { score: number; size?: number; stroke?: number }) {
  const reduced = usePrefersReducedMotion();
  const r = (size - stroke) / 2;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const sweep = 0.75;                       // 270° dial (gap at bottom). Use 1 for a full ring.
  const arcLen = circumference * sweep;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const dash = arcLen * pct;
  const tone = bandTone(score);             // 'good' | 'warn' | 'crit'  ← SSOT, amber spans 40-69
  const color = ZONE_VAR[tone === 'neutral' ? 'warn' : tone];

  return (
    <div role="img" aria-label={`Score ${score} of 100, ${bandFromScore(score)}`}>
      <svg width={size} height={size} className="-rotate-[225deg]">{/* start at lower-left for a 270° dial */}
        {/* track */}
        <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={stroke}
          stroke="var(--color-border)" strokeLinecap="round"
          strokeDasharray={`${arcLen} ${circumference}`} />
        {/* fill — Phase 4 animates `dash` 0→value; Phase 2 renders at rest */}
        <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={stroke}
          stroke={color} strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={reduced ? undefined : { transition: 'stroke-dasharray 700ms var(--ease-out-cubic)' }} />
      </svg>
      {/* number + band word centered via absolute overlay, Inter 36px semibold tabular-nums */}
    </div>
  );
}
```

**Geometry (UI-SPEC defaults, confirmed sound):** ~120px desktop / ~96px mobile; **8px** stroke; `round` linecaps; **270° sweep** (gap at bottom, rotate `-225deg` so the opening sits at the dial bottom) OR a full 360° ring — pick one and keep consistent across the app. Track = `--color-border` (6% hairline). Fill = zone color from `bandTone`. Number Inter **36px / 600 / `tabular-nums`** cream; band word below, sans medium 16px, same zone color. [VERIFIED tokens: globals.css `--color-success/-warning/-error`, `--ease-out-cubic` cubic-bezier(0.215,0.61,0.355,1); src/components/ui/sheet.tsx uses radix; bandTone in verdict-derive]

**The `pathLength=100` alternative** (cleaner than computing `circumference`): set `pathLength={100}` on the `<circle>`, then `strokeDasharray={`${pct100} 100`}` where `pct100` is the raw 0–100 score — the browser remaps the geometry so the score IS the dash length. Either works; the explicit-circumference version above avoids a (minor) Safari `pathLength`-on-`<circle>` edge case, so it is the safer default for a stroked arc. Both are library-free.

**Phase-4-ready animation contract (keep this so P4 needs no rewrite):** the fill value is a **prop** (`score`). Phase 2 renders the component with the final score (at rest, filled). Phase 4 will mount the same component fed from `useAnalysisStream` and the `stroke-dasharray` CSS `transition` makes the fill glide 0→score automatically as the prop updates — OR Phase 4 drives an explicit `motion` value. Either way the component's public API (`score` prop) is unchanged. **Respect `usePrefersReducedMotion`** — drop the `transition` when reduced (snap to final). [VERIFIED: src/hooks/usePrefersReducedMotion.ts]

**a11y:** `role="img"` + `aria-label="Score 71 of 100, Strong"` (the visual number is decorative-redundant; the label carries it). Matte — **no glow/halo/filter** (flat-warm).

---

## Focus 3 — Static persona cloud (D-02)

### Recommendation: strip `PersonaGraph`'s existing deterministic layout to a dot-only static SVG

`PersonaGraph` already solves the hard part: a **deterministic golden-angle (Fibonacci) layout** seeded with `mulberry32`, which is **SSR-safe and hydration-stable** (no `Math.random`, no physics, no effects). [VERIFIED: src/components/board/_kit/PersonaGraph.tsx L37-72] The Phase-2 cloud is `PersonaGraph` minus: the 200 viewer dots, the nearest-neighbour links, the hover card, and the `<animate>` pulse.

**Data:** `buildPersonaNodes(heatmap, persona_simulation_results, badKey)` → `PersonaNode[]` where each node already carries `weight` (0–1, max-normalized → drives radius), `watchThrough` (0–1), and `tone: 'accent'` for the single worst-retention slot. [VERIFIED: audience-derive.ts L422-461] `badKey` comes from `worstBadGroupKey(buildSegmentGroups(heatmap, simResults))`. [VERIFIED: audience-derive.ts L292-297]

```tsx
// src/components/reading/persona-cloud.tsx
// Layout math copied verbatim from PersonaGraph (golden-angle, deterministic).
const VB_W = 320, VB_H = 200;
const golden = Math.PI * (3 - Math.sqrt(5));
function layout(nodes: PersonaNode[]) {
  const cx = VB_W / 2, cy = VB_H / 2, n = Math.max(nodes.length, 1);
  const maxR = Math.min(VB_W, VB_H) * 0.42;
  return nodes.map((p, i) => {
    const t = (i + 0.5) / n, r = Math.sqrt(t) * maxR, a = i * golden;
    return { ...p, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r,
             rad: 4 + Math.max(0, Math.min(1, p.weight)) * 9 };  // smaller than PersonaGraph's 6+13
  });
}
// render: <svg role="img"> one <circle> per node; tone==='accent' → fill var(--color-accent),
// else cream rgba(236,231,222,0.2 + watchThrough*0.5). sr-only <ul> mirrors segments.
```

**Worst cluster in coral:** the `tone:'accent'` dots → `var(--color-accent)`; all others neutral cream (NOT white — D-02/UI-SPEC). Dot radius ∝ `weight`. Keep it visually lighter than the Canvas version (fewer/smaller dots — one per persona, ~up to 10, not 200).

**Graceful degradation (REQUIRED):** `buildPersonaNodes` returns `[]` when `heatmap.personas` is empty. [VERIFIED: audience-derive.ts L428] When `nodes.length === 0`, render **no cloud** (omit it) rather than an empty box — the hero still shows gauge + watch% (if any). When personas are sparse (1–3), the golden-angle layout still produces sensible non-overlapping positions. **Do not** crash on `null` heatmap (`heatmap?.personas ?? []` is already the helper's guard).

**Watch% (READ-04, once):** prefer `averageWatchThrough(nodes)` → **already 0–100 int** (no ×100). [VERIFIED: audience-derive.ts L464-468] Fallback to top-level `weighted_completion_pct` which is **0–1 → needs ×100**. [VERIFIED: types.ts L482 `weighted_completion_pct?: number|null` documented 0-1] Render once as `{n}% watch` beside the cloud.

**a11y:** wrap in `role="img"` + an `sr-only <ul>` mirroring each persona's segment + watch-through (reuse the exact pattern at PersonaGraph L237-245).

**Phase-3 seam:** make the cloud a button/tap target that opens `DrillSheet` with the full `PersonaGraph` mounted — wire the open affordance in Phase 2, mount the rich Canvas component in Phase 3 (D-02).

---

## Focus 4 — Recompose landmines (verified against real source)

### Landmine 0 (the big structural one, not in the brief): the route mounts Board in `layout.tsx`, not the page

[VERIFIED: src/app/(app)/analyze/layout.tsx + [id]/page.tsx]

```
analyze/layout.tsx  →  renders <Board /> + <div className="sr-only">{children}</div>
analyze/[id]/page.tsx  →  returns null  (server shell, metadata only)
```

The comment in `layout.tsx` says: *"In Phase 2 the page bodies become server-only data fetchers; actual UI lives inside `<Board>`'s DOM overlays. We keep `children` here only to satisfy Next.js."* **Phase 2 must invert this:** retire the `<Board />` mount, and render the new `<Reading />` thread either from the `layout.tsx` (so it persists across the submit→`/analyze/[id]` transition like Board did) or move it into `[id]/page.tsx`. Recommendation: **render `<Reading />` in `layout.tsx`** (same persistence rationale Board used — survives the URL transition; `usePermalinkAnalysis` reads `useParams()` so it works from either, and the `/analyze` no-id composer state is the Phase-1 shell). Keep `[id]/page.tsx` as the metadata-only server shell. This is a **layout restructure**, size the task accordingly — it is not "swap `<Board/>` for `<Reading/>`" one-for-one because the composer/no-id state and the `<AppShell>` 760px column interplay (Phase 1) must keep working. [VERIFIED: src/app/(app)/layout.tsx wraps children in `<AppShell>`]

### Landmine 1: `InsightHeroFrame` self-fetches data and ignores its Board props

[VERIFIED: InsightHeroFrame.tsx L184-187]
- Takes `{ camera, layout }` but **ignores both** (`_camera`, `_layout`) — trivial to drop. ✅ no Konva/camera coupling in the body.
- **BUT** it calls `usePermalinkAnalysis()` **and** `useAnalysisStream({ initialData })` internally and reads `panelReady['insight_hero']` (a streaming gate). For Phase 2's static permalink Reading, you want **one** data source at the container, passed down as props — not every leaf re-subscribing. **Action:** do not import `InsightHeroFrame` as-is. Lift its *logic* (the `apollo = variants.apollo ?? apollo_reasoning` dual-read, the dimension rows, the rewrite-with-drop-label) into new prop-driven components fed by the container's single `usePermalinkAnalysis`. Keep the dual-read (`variants.apollo ?? apollo_reasoning`) — it prevents the permalink-blank regression (WPk976kozfWs). [VERIFIED: InsightHeroFrame.tsx L191-196]
- Uses OLD palette throughout: `text-emerald-400`/`text-amber-400`/`text-red-400`, `text-white`, `text-white/40` → must repoint to `text-success`/`text-warning`/`text-error` + `text-foreground[-secondary|-muted]` (UI-SPEC §Palette migration).

### Landmine 2: `FactorBars` data contract mismatch (correction #1, restated as a landmine)

[VERIFIED: FactorBars.tsx + ApolloDimensionSchema]
- Consumes `Factor[]` (0–10), sorts strongest→weakest, tags top "keep", renders weakest with **`#FF7F50` coral gradient + `boxShadow: 0 0 10px rgba(255,127,80,0.5)` glow** and a `/{max_score}` suffix.
- D-05/06/07 want: 3 fixed-order `ApolloDimension`s (0–100), neutral cream bars, only the single weakest colored by its **zone** color (not coral), value = score (Retention value = drop time instead). **Five mismatches.** Build new `DriverRows`; borrow only `grid-cols-[130px_1fr_42px]` + the 5px `rounded-full` bar markup. **Strip the glow and the coral gradient** (flat-warm, matte).
- Dimension source: `apollo_reasoning.dimensions` is `ApolloDimension[]` length-6, order `[hook, retention, clarity, share_pull, substance, credibility]`. Driver rows = find `hook`, `retention`, `share_pull`. Deeper read = `clarity`, `substance`, `credibility`. [VERIFIED: ApolloDimensionSchema name enum]

### Landmine 3: `TopFixesList` depends on `useBoardStore`

[VERIFIED: TopFixesList.tsx L2,21 imports `useBoardStore`, calls `setActivePreset('audience')`]
- The timestamp anchor button calls `setActivePreset('audience')` to **pan the Konva board to the audience frame** — **dead in the thread** (no Board, no Konva presets). [VERIFIED: board-store.ts L129,245]
- `formatTime(ms)` here takes **milliseconds** (`fix.timestamp_ms`). Different from `audience-derive.formatTime(seconds)` (correction #3).
- **Action:** new `FixFirstList` — keep the fix-item card markup (`headline` + `detail`), **drop the `useBoardStore` import and the audience-jump anchor** entirely (or convert the timestamp into a Sheet-open / inline label). Filter `counterfactuals.suggestions` to `type==='fix'`, top-3. Add the D-14 empty state ("Nothing urgent to fix"). The rewrites (copy-to-clipboard) come from `apollo_reasoning.rewrites` (`{ original, variant, lever_fixed }`) — reuse `InsightHeroFrame`'s `RewriteItem` pattern (struck-through original + variant + Copy button → "Copied" 1.5s). [VERIFIED: types.ts CounterfactualSuggestionItem + ApolloRewriteSchema; InsightHeroFrame.tsx L97-149]

### Landmine 4: `AntiViralityHeader` is clean — reuse nearly as-is

[VERIFIED: AntiViralityHeader.tsx — token-based gradient `var(--color-accent)`→`var(--color-warning)`, takes `{ result, analysisId }`, self-manages localStorage dismissal, returns `null` when not gated]
- Already flat-warm-compatible (token gradient, no glow). Takes `result: PredictionResult | null` + `analysisId: string`. **The only reuse with low friction.** Pass `usePermalinkAnalysis().data` + `.id`. It reads `counterfactuals?.suggestions` for `fixCount` and `COPY.AV_HEADER(n)`. ✅
- Place it **above the gauge** (D-04); score stays visible (the banner doesn't hide it).

### Landmine 5: honesty-flag null handling (D-13 — correctness, not polish)

[VERIFIED: types.ts L369-393] These are **REQUIRED** boolean fields (always present on fresh runs; derivable on reload):
- `analysis_unavailable: boolean` — when true, `overall_score` is a **fabricated 0**. The container MUST short-circuit to the dedicated "We couldn't analyze this video" state **before** rendering the gauge. **NEVER pass the 0 to `ScoreGauge`.** Gate at the top of `Reading`.
- `partial_analysis: boolean` — render a small "Partial read — based on half the usual signals" annotation near the hero; everything else still renders.
- `apollo_reasoning: null | {…}` — when null (DeepSeek circuit-breaker open), there are **no rewrites, no dimensions**. Driver rows (which need `dimensions`) and Deeper read must **degrade**: hero gauge + gate **still resolve** from `overall_score` + `anti_virality_gated` (never null). Decide row behavior when dimensions are absent: either hide the rows or fall back to a neutral state — recommend **hide the driver-row bars' values gracefully** (show labels, omit bar) or omit the rows section; do NOT render `0`/`undefined` as a score. [VERIFIED: apollo_reasoning is `…| null`, overall_score is non-null `number`, anti_virality_gated is required `boolean`]
- `counterfactuals?.suggestions` is a **separate** field from `apollo_reasoning` — fixes can exist when rewrites don't, and vice-versa. Handle independently (D-14). [VERIFIED: types.ts — `counterfactuals?: CounterfactualResult` is its own top-level field, unrelated to `apollo_reasoning`]

### Landmine 6: `formatTime` seconds-vs-ms (correction #3, restated)

- `weighted_top_dropoff_t` → **seconds** → `audience-derive.formatTime()`. [VERIFIED: types.ts L483 documented + audience-derive.ts L49]
- `counterfactuals.suggestions[].timestamp_ms` → **ms** → divide by 1000 (the `TopFixesList`/`insights-section` ms variant). [VERIFIED: types.ts CounterfactualSuggestionItem.timestamp_ms]
- The Retention row value uses the **seconds** one (`⚠ ${formatTime(weighted_top_dropoff_t)}`).

## Architecture Patterns

### System data flow

```
GET /api/analysis/[id]
        │  (TanStack Query, staleTime:Infinity)
        ▼
usePermalinkAnalysis()  →  { id, data: PredictionResult|null, isLoading }
        │   (ONE subscription, at the container)
        ▼
<Reading data={…} id={…}>                    ── rendered from analyze/layout.tsx
   │
   ├─ analysis_unavailable? ──► <CouldNotAnalyze/>   (short-circuit, D-13)
   │
   ├─ <ThumbnailStrip src={keyframe} />               (gated on real video)
   ├─ <AntiViralityHeader result id />                (reuse, when gated, D-04)
   ├─ HERO: <ScoreGauge score={overall_score}/> | <PersonaCloud nodes/> + "{n}% watch"
   ├─ <DriverRows dims={[hook, retention, share_pull]}  onRowTap={openSheet}/>   (D-05/06/07/08)
   ├─ FIX FIRST: <FixFirstList fixes={counterfactuals.suggestions}             (D-08, D-14)
   │              rewrites={apollo_reasoning?.rewrites}/>  + inline "N more fixes →"
   ├─ <DeeperRead dims={[clarity, substance, credibility]}/>  inline-expand     (D-10, D-13)
   └─ (composer = Phase-1 shell, bottom-pinned when id exists)

   shared:  const [panel, setPanel] = useState<PanelId|null>()
            <DrillSheet open={!!panel} onOpenChange=… title=…>{panelFor(panel)}</DrillSheet>
            ▲ Phase 3 swaps native panels → rich charts; Phase 5 adds a chat panel
```

### Recommended new structure
```
src/components/reading/        # NEW — avoids the legacy app/simulation/ collision
├── reading.tsx                # container; single usePermalinkAnalysis; D-13 gate; owns panel state
├── score-gauge.tsx            # Focus 2
├── persona-cloud.tsx          # Focus 3 (reuses PersonaGraph golden-angle math)
├── driver-rows.tsx            # Focus 4 L2 (NOT FactorBars; 0-100 ApolloDimension)
├── fix-first-list.tsx         # Focus 4 L3 (no useBoardStore)
├── rewrite-item.tsx           # lifted from InsightHeroFrame
├── deeper-read.tsx            # remaining 3 dims, inline Accordion
├── thumbnail-strip.tsx        # static <img>, KeyframeImage pattern
├── drill-sheet.tsx            # Focus 1 — the Phase-3/5 mount point
└── index.ts                   # barrel
# REUSE VERBATIM (no copy): audience-derive.ts, verdict-derive.ts, verdict-constants.ts
# REUSE AS-IS: board/verdict/AntiViralityHeader.tsx
```

### Anti-patterns to avoid
- **Spreading raw `PredictionResult` into JSX** → leaks cut data (READ-10). Whitelist fields explicitly.
- **Importing the four board components as drop-in units** → drags in `useBoardStore`, dual streaming subscriptions, `camera`/`layout` props, OLD palette. Adapt the markup; don't wrap the components.
- **Keying thread layout off `useIsMobile`** → hydration flash. Use CSS responsive (`flex-col md:flex-row`) for the thread; reserve `useIsMobile` for the Sheet side only.
- **Passing a fabricated `0` to the gauge** when `analysis_unavailable` (D-13).
- **Coral on more than the three allowed surfaces** (worst-cluster dots, primary actions/Copy/send, gate banner) — "if two things are coral, one is wrong" (BRAND-BIBLE).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal focus trap / scroll-lock / Esc / aria-modal | custom `motion` overlay | shadcn `Sheet` (Radix Dialog) | Radix ships correct a11y + inert background; hand-rolled traps regress on Tab order. |
| Inline expand (Deeper read / N more fixes) | manual height-animate | `ui/accordion.tsx` (Radix) or simple `useState` | Already vendored; handles a11y + reduced-motion. |
| Persona dot layout | physics sim / d3-force | reuse `PersonaGraph` golden-angle + `mulberry32` | Deterministic, SSR-safe, already proven; physics is non-deterministic → hydration mismatch. |
| Score band / tone / drop detection / watch% | re-derive thresholds | `bandTone`, `bandFromScore`, `findBiggestDrop`, `averageWatchThrough`, `buildPersonaNodes` | Pure, tested, the SSOT. Re-deriving risks drift from the engine's bands. |
| Gauge | `react-circular-progressbar` | 40-line inline SVG | No dep; full token control; trivial. |

**Key insight:** the genuine reuse value in this phase is the **pure helper modules** (`audience-derive`, `verdict-*`) and the **Radix primitives**, not the board React components. Recompose = new clean shells on flat-warm tokens, fed by the pure helpers.

## Common Pitfalls

### Pitfall 1: Tailwind v4 oklch L<0.15 miscompile + Lightning CSS strips backdrop-filter
**What goes wrong:** very dark tokens compile wrong in `@theme`; `backdrop-filter` CSS classes get stripped.
**How to avoid:** dark surfaces use hex (already done in THEME-06: `#262624`/`#1e1d1b`/`#2f2e2b`). If any blur is needed on the Sheet, apply via inline `style={{ backdropFilter: 'blur(Xpx)' }}` — but flat-warm is matte, prefer none. [CITED: ./CLAUDE.md Known Technical Issues]

### Pitfall 2: permalink blank on reload (already-fixed regression WPk976kozfWs)
**What goes wrong:** on reload, Apollo lives at `variants.apollo`, not `apollo_reasoning` (live SSE shape). Reading from only one blanks the hero.
**How to avoid:** dual-read `variants.apollo ?? apollo_reasoning ?? null` (lift from InsightHeroFrame L191-196). [VERIFIED]

### Pitfall 3: dev-server CSS cache
**What goes wrong:** flat-warm/token CSS changes don't appear.
**How to avoid:** kill dev server + clear `.next/` + `node_modules/.cache/` + browser cache. [CITED: ./CLAUDE.md]

### Pitfall 4: `useSearchParams` without Suspense (if doing `?panel=` sync)
**What goes wrong:** app router throws / forces the whole route to client without a boundary.
**How to avoid:** wrap the `useSearchParams` consumer in `<Suspense>` (the Reading container is `'use client'` already; ensure the param-reader is bounded). [CITED: nextjs.org/docs/app/api-reference/functions/use-search-params]

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| Pages Router `router.push(url,{shallow:true})` | App Router native `history.pushState/replaceState` + `useSearchParams` | Next 13+ App Router | The `?panel=` sync uses the History API, not a Next router option. Board already does this. |
| Konva `<Board />` 8-frame canvas at `/analyze/[id]` | Recomposed DOM/React vertical thread | This phase | Canvas shell retired; frame-content components' markup recomposed. |

**Deprecated/outdated for this phase:**
- `react-circular-progressbar` (not needed — hand-roll).
- `vaul` (not installed — do not add; `Sheet` covers it).
- `bandLabel()` ("High potential/Solid contender/Needs work") — WRONG vocabulary; use `bandFromScore()` ("Strong/Mid/Low") for the locked mock. [VERIFIED: verdict-derive.ts L25 vs verdict-constants.ts L61]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Rendering `<Reading/>` from `layout.tsx` (Board's old mount) is the right home, vs `[id]/page.tsx` | Landmine 0 | If the no-id `/analyze` composer state needs different treatment, may need page-level split. Low risk — `usePermalinkAnalysis` works from either; planner confirms during task design. |
| A2 | `?panel=` shallow sync via `pushState`+`history.back()` is implementable cleanly enough to ship in v1 | Focus 1 | If fiddly, fall back to ephemeral `useState` (UI-SPEC sanctions this). Explicitly downgradeable, not a blocker. |
| A3 | Hiding driver-row bars (vs showing a neutral fallback) is the right degrade when `apollo_reasoning: null` | Landmine 5 | UX-leaning; planner/executor picks the exact empty treatment within D-13's "show only what's present." |

**All other claims in this research are VERIFIED against repo source or CITED to Next.js docs.**

## Open Questions (RESOLVED)

1. **Thread mount location (`layout.tsx` vs `[id]/page.tsx`).**
   - Known: Board mounted in `layout.tsx`; pages return `null`; `usePermalinkAnalysis` reads `useParams()`.
   - Unclear: whether the no-id `/analyze` composer needs the same persistent mount.
   - Recommendation: mount `<Reading/>` in `layout.tsx`, keep `[id]/page.tsx` metadata-only. Planner validates against the Phase-1 composer/shell during task breakdown.
   - **RESOLVED** by plan 02-05 Task 2 — mount `<Reading/>` in `src/app/(app)/analyze/layout.tsx` (Board mount retired), `[id]/page.tsx` stays metadata-only.

2. **Driver-row degrade when dimensions absent.**
   - Known: gauge + gate never go null; `dimensions` does (via `apollo_reasoning: null`).
   - Recommendation: hide bars/values gracefully; never render `0`. Exact treatment = executor discretion within D-13.
   - **RESOLVED** by plan 02-03 Task 1 + CONTEXT D-13 — DriverRows hides bars/values gracefully when dimensions are absent and never renders a fabricated `0`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| shadcn `Sheet` (Radix Dialog) | Drill-down | ✓ vendored | radix-ui ^1.4.3 | — |
| `@radix-ui/react-accordion` | Inline expand | ✓ | ^1.2.12 | `useState` toggle |
| `motion` | gauge/expand motion | ✓ | ^12.29.2 (`motion/react`) | CSS transition |
| `usePermalinkAnalysis` / `useIsMobile` / `usePrefersReducedMotion` | data + switches | ✓ | in-repo | — |
| `audience-derive` / `verdict-derive` / `verdict-constants` | pure helpers | ✓ | in-repo | — |
| `GET /api/analysis/[id]` | data source | ✓ | existing route | — |

**Missing with no fallback:** none.
**Missing with fallback:** `vaul` (not installed → `Sheet`); gauge lib (not installed → hand-roll). Both intentional.

## Validation Architecture

> nyquist_validation = true [VERIFIED: .planning/config.json L61]. vitest present.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4 + @testing-library/react 16 + happy-dom; vitest-axe for a11y |
| Config file | `vitest.config.ts` (present) |
| Quick run command | `npx vitest run src/components/reading` |
| Full suite command | `npm test` (`vitest run`) |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| READ-02 | gauge fill zone = `bandTone(score)`; band word = `bandFromScore` | unit | `npx vitest run src/components/reading/__tests__/score-gauge.test.tsx` | ❌ Wave 0 |
| READ-04 | watch% rendered exactly once, from `averageWatchThrough` (0–100) | unit | `npx vitest run …/reading.watch-pct.test.tsx` | ❌ Wave 0 |
| READ-05/06 | 3 rows, 0–100 fill, Retention value = `⚠ formatTime(weighted_top_dropoff_t)` seconds | unit | `npx vitest run …/driver-rows.test.tsx` | ❌ Wave 0 |
| READ-07 | row tap opens Sheet; "Deeper read"/"N more" expand inline (no Sheet) | unit (RTL `userEvent`) | `npx vitest run …/drill-sheet.test.tsx` | ❌ Wave 0 |
| READ-08 | rewrites copy to clipboard; D-14 empty "Nothing urgent to fix" | unit | `npx vitest run …/fix-first.test.tsx` | ❌ Wave 0 |
| READ-08/D-13 | `analysis_unavailable` → "couldn't analyze", NEVER the 0; `apollo_reasoning:null` → degrade | unit | `npx vitest run …/reading.degraded.test.tsx` | ❌ Wave 0 |
| READ-10 | no cut field (`feature_vector`, `cost_cents`, model names…) in rendered DOM | unit (assert absent) | `npx vitest run …/reading.no-cut-data.test.tsx` | ❌ Wave 0 |
| a11y | gauge `role=img`+label; cloud sr-only mirror; Sheet focus trap | axe | `vitest-axe` in each render test | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/components/reading`
- **Per wave merge:** `npm test` (full suite — currently ~1967 green per Phase-1 record; must stay green)
- **Phase gate:** full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/reading/__tests__/` directory — none exist yet for the new components.
- [ ] Reuse the existing `audience-derive.test.ts` patterns + the engine `__tests__/factories.ts` (a `PredictionResult` factory exists) for fixtures. [VERIFIED: src/lib/engine/__tests__/factories.ts present]
- [ ] No framework install needed (Vitest configured). `AntiViralityHeader` already has tests to model degraded-state assertions on. [VERIFIED: AntiViralityHeader.test.tsx + .override.test.tsx]

## Security Domain

> `security_enforcement` not present in config.json (absent = enabled by agent rule). This is a presentation-only phase with no auth/crypto/storage changes (engine frozen, read-only fetch behind existing IDOR-defended route).

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase-1 `(app)/layout.tsx` already does the server `auth.getUser()` redirect. [VERIFIED] |
| V3 Session | no | unchanged |
| V4 Access Control | no (inherited) | `GET /api/analysis/[id]` is IDOR-defended server-side (per page comment); Phase 2 only consumes it. |
| V5 Input Validation | minimal | The only "input" is the route `id` (already validated by the API) and clipboard writes (no injection surface). `?panel=` value is a closed enum of row ids — validate against the known set before opening, don't reflect arbitrary strings. |
| V6 Cryptography | no | none |

| Pattern | STRIDE | Mitigation |
|---------|--------|-----------|
| Reflected `?panel=` value | Tampering/XSS | Map the param through a closed allow-list (`hook`/`retention`/`shareability`/`personas`); never render the raw value or use it as a key into untrusted markup. |
| Cut-data leak in DOM | Information disclosure | Whitelist rendered fields (READ-10); never spread raw `PredictionResult`. |
| Signed keyframe URL in `<img>` | Info disclosure | Use the existing `resolveKeyframeUrl`/`KeyframeImage` gate (real-video only); `alt=""` decorative; don't log the signed URL. |

## Sources

### Primary (HIGH — verified against repo)
- `src/lib/engine/types.ts` — `PredictionResult`, `ApolloDimensionSchema`, `ApolloRewriteSchema`, `CounterfactualSuggestionItem`, `HeatmapPayload`, honesty flags (L300-490, 560-600, 835-895)
- `src/components/board/InsightHeroFrame.tsx`, `verdict/FactorBars.tsx`, `verdict/AntiViralityHeader.tsx`, `verdict/TopFixesList.tsx`
- `src/components/board/audience/audience-derive.ts` (buildPersonaNodes, averageWatchThrough, findBiggestDrop, formatTime), `_kit/PersonaGraph.tsx` (golden-angle layout)
- `src/components/board/verdict/verdict-derive.ts` (bandTone, bandLabel), `verdict-constants.ts` (bandFromScore, BAND_THRESHOLDS, COPY, fixCount)
- `src/components/ui/sheet.tsx` (Radix Dialog, side prop), `ui/accordion.tsx`, `ui/popover.tsx`, `ui/dialog.tsx`
- `src/hooks/queries/use-permalink-analysis.ts`, `src/hooks/useIsMobile.ts`, `src/hooks/usePrefersReducedMotion.ts`
- `src/app/(app)/analyze/layout.tsx` + `[id]/page.tsx`, `src/app/(app)/layout.tsx` (AppShell), `src/components/board/Board.tsx` (replaceState pattern L283-293)
- `src/app/globals.css` (THEME-06 tokens: success/warning/error, accent, surfaces, ease-out-cubic, shadow-float), `package.json`, `.planning/config.json`
- `02-CONTEXT.md`, `02-UI-SPEC.md`, `./CLAUDE.md`

### Secondary (MEDIUM — official docs)
- nextjs.org/docs/app — "Using the native History API" (pushState/replaceState for shallow query updates in App Router)
- nextjs.org/docs/app/api-reference/functions/use-search-params (Suspense requirement; client opt-in)

### Tertiary (LOW)
- none — all claims grounded in repo source or Next.js official docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every lib verified present/absent in package.json + vendored files inspected.
- Focus 1 (Sheet/URL): HIGH on Sheet (source read); MEDIUM on `?panel=` ergonomics (App Router History API cited; clean wiring flagged A2/downgradeable).
- Focus 2 (gauge): HIGH — technique standard, tokens verified, animation contract grounded in usePrefersReducedMotion.
- Focus 3 (cloud): HIGH — reuses verified deterministic layout + verified data helper.
- Focus 4 (recompose): HIGH — all four components + route + store read directly; four corrections each VERIFIED.
- Pitfalls: HIGH — drawn from CLAUDE.md + in-code regression notes (WPk976kozfWs).

**Research date:** 2026-06-14
**Valid until:** 2026-07-14 (stable; repo + frozen engine. Re-verify only if package.json or `src/lib/engine/types.ts` changes.)

## RESEARCH COMPLETE
