# Phase 2: The Reading (user-facing "Simulation") - Pattern Map

**Mapped:** 2026-06-14
**Files analyzed:** 11 new components + 1 barrel + 1 route restructure (layout.tsx) = 13 surfaces
**Analogs found:** 13 / 13 (every new file has a grounded repo analog or a verbatim-reuse source)

> **Honors the 4 RESEARCH.md corrections.** This map is a *pattern source*, NOT a copy-reuse directive. The new directory is `src/components/reading/` (NOT `app/simulation/` — that legacy dir has 13 contradicting "Phase 13" components, VERIFIED present). The genuine reuse is the **pure helpers** (`verdict-derive`, `verdict-constants`, `audience-derive`) + the **vendored Radix primitives** (`ui/sheet.tsx`, `ui/accordion.tsx`) + **`verdict/AntiViralityHeader.tsx`** (the one clean as-is React reuse). The four board React components (`FactorBars`, `TopFixesList`, `InsightHeroFrame`, `PersonaGraph`) are **markup donors only** — they carry `useBoardStore`, dual streaming subscriptions, `camera`/`layout` props, and the OLD Raycast palette that must be severed/repointed.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/reading/reading.tsx` | component (container) | request-response (read) | `board/InsightHeroFrame.tsx` (assembly) + `usePermalinkAnalysis` (single source) | role-match (rebuild; single-source not dual-subscribe) |
| `src/components/reading/score-gauge.tsx` | component (SVG primitive) | transform | `board/_kit/PersonaGraph.tsx` (inline-SVG `<circle>` + token fill) — NO gauge lib exists | partial (technique-match; hand-rolled `stroke-dasharray`) |
| `src/components/reading/persona-cloud.tsx` | component (SVG primitive) | transform | `board/_kit/PersonaGraph.tsx` (golden-angle `mulberry32` layout) | role-match (strip to dots; no Canvas/hover/`<animate>`) |
| `src/components/reading/driver-rows.tsx` | component | transform | `board/verdict/FactorBars.tsx` (**grid markup ONLY**) | partial (5 mismatches — rebuild for 0–100) |
| `src/components/reading/fix-first-list.tsx` | component | transform | `board/verdict/TopFixesList.tsx` | role-match (drop `useBoardStore`, add empty state) |
| `src/components/reading/rewrite-item.tsx` | component | event-driven (clipboard) | `board/InsightHeroFrame.tsx` `RewriteItem` (L97–149) | exact (lift + repaint palette) |
| `src/components/reading/deeper-read.tsx` | component | transform | `board/InsightHeroFrame.tsx` `DimensionRow` (L155–180) + `ui/accordion.tsx` | role-match (3 remaining dims, inline expand) |
| `src/components/reading/thumbnail-strip.tsx` | component | file-I/O (signed `<img>`) | `board/_kit/KeyframeImage.tsx` + `_kit/keyframe.resolveKeyframeUrl` | role-match (single static poster) |
| `src/components/reading/drill-sheet.tsx` | component (container) | event-driven (open/close) | `ui/sheet.tsx` (Radix Dialog, `side` prop) + `useIsMobile` | exact (wrap; the P3/P5 mount point) |
| `src/components/reading/anti-virality-header.tsx` *(or re-export)* | component | request-response | `board/verdict/AntiViralityHeader.tsx` | **exact as-is reuse** (D-04) |
| `src/components/reading/index.ts` | config (barrel) | — | `board/_kit/index.ts` / `board/verdict/` barrel pattern | exact |
| `src/app/(app)/analyze/layout.tsx` | route (layout) | request-response | itself (current Board-mount) — **invert it (Landmine 0)** | n/a (structural restructure) |
| `src/app/(app)/analyze/[id]/page.tsx` | route (page) | request-response | itself (metadata-only shell) — **keep as-is** | n/a (unchanged) |

**Whitelisted engine fields the container reads** (READ-10 — never spread raw `PredictionResult`):
`overall_score`, `anti_virality_gated`, `anti_virality_reason`, `analysis_unavailable`, `partial_analysis`, `apollo_reasoning` (`dimensions[]`, `rewrites[]`), `variants.apollo` (dual-read), `counterfactuals.suggestions[]`, `heatmap` (`personas[]`, `weighted_top_dropoff_t`, `weighted_completion_pct`, `segments[]`, `dropoff_segment_indices`), `persona_simulation_results`, `hook_decomposition` (P2 Hook drill-down native content).

---

## Shared Patterns

### Pure helpers — REUSE VERBATIM (no copy, import as-is)
These are pure TS, no React, the SSOT. Re-deriving thresholds risks drift from the engine's bands.

**Source:** `src/components/board/verdict/verdict-constants.ts`
**Apply to:** `score-gauge.tsx` (band word), `fix-first-list.tsx` + `anti-virality-header` (`fixCount`, `COPY`)
```typescript
// verdict-constants.ts L4-8, L61-70 — bands are 70/40 (amber owns the WHOLE 40–69 band)
export const BAND_THRESHOLDS = { STRONG: 70, MID: 40 } as const;
export function bandFromScore(score: number): 'Strong' | 'Mid' | 'Low' {
  if (score >= BAND_THRESHOLDS.STRONG) return 'Strong';
  if (score >= BAND_THRESHOLDS.MID) return 'Mid';
  return 'Low';
}
export function fixCount(suggestions: ReadonlyArray<{ type: string }> | undefined): number {
  if (!suggestions) return 0;
  return Math.min(3, suggestions.filter((s) => s.type === 'fix').length);
}
// COPY.AV_HEADER(n) / COPY.AV_OVERRIDE_LINK — the gate banner copy (do not paraphrase)
```
> Use `bandFromScore()` ("Strong/Mid/Low") for the locked mock — **NOT** `bandLabel()` ("High potential/Solid contender/Needs work", verdict-derive L25, WRONG vocabulary).

**Source:** `src/components/board/verdict/verdict-derive.ts`
**Apply to:** `score-gauge.tsx` (zone color), `driver-rows.tsx` (weakest-lever zone color)
```typescript
// verdict-derive.ts L58-65 — 3-zone tone, the SINGLE SOURCE OF TRUTH for the gauge fill
export type ScoreTone = 'good' | 'warn' | 'crit' | 'neutral';
/** Band → hero status tone. ≥70 good, 40–69 warn, <40 crit. */
export function bandTone(score: number): ScoreTone {
  if (score >= 70) return 'good';   // green  --color-success
  if (score >= 40) return 'warn';   // amber  --color-warning  ← spans 40–69 (CORRECTION #2)
  return 'crit';                    // red    --color-error
}
```

**Source:** `src/components/board/audience/audience-derive.ts`
**Apply to:** `persona-cloud.tsx` (`buildPersonaNodes`, `averageWatchThrough`), `driver-rows.tsx` Retention value (`formatTime` — **seconds variant**)
```typescript
// audience-derive.ts L49-54 — formatTime takes SECONDS (CORRECTION #4 / Landmine 6)
export function formatTime(seconds: number): string {     // ← weighted_top_dropoff_t is seconds
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
}
// L422-461 buildPersonaNodes(heatmap, simResults, badKey) → PersonaNode[] (weight 0–1, tone:'accent' on worst slot)
// L464-468 averageWatchThrough(nodes) → 0–100 int | null   (NO ×100 — already an int)
// L292-297 worstBadGroupKey(groups) → SlotKey|null  (the badKey arg; coral worst-cluster)
```
> **`formatTime` COLLISION (CORRECTION #4):** `audience-derive.formatTime(seconds)` ≠ `TopFixesList.formatTime(ms)`. The Retention readout (D-06, `weighted_top_dropoff_t`) is **seconds** → use the `audience-derive` one. Fix-item timestamps (`suggestions[].timestamp_ms`) are **ms** → `÷1000`. Mixing them renders `0:08` as `0:00`.

### Palette migration — REQUIRED on every markup donor
**Source of OLD tokens:** the four board components were authored on the Raycast palette.
**Apply to:** `driver-rows.tsx`, `fix-first-list.tsx`, `rewrite-item.tsx`, `deeper-read.tsx`, `score-gauge.tsx`
```
text-emerald-400 / text-amber-400 / text-red-400  →  text-success / text-warning / text-error
text-white / text-white/[0.x]                     →  text-foreground / text-foreground-secondary / text-foreground-muted (cream, NEVER pure white)
#FF7F50 / #E8703F gradient + boxShadow glow       →  neutral cream fill, NO glow (FactorBars L44-49)
border-white/[0.06]                               →  KEEP (matches --color-border hairline) — just no inset-shine
```
**Verified token names** (`globals.css`): `--color-success` (`oklch(0.68 0.17 145)`), `--color-warning` (`oklch(0.75 0.15 85)`), `--color-error` (`oklch(0.60 0.20 25)`), `--color-accent` (coral `#d97757`), `--color-foreground/-secondary/-muted` (creams), `--color-surface` (`#1e1d1b`), `--color-surface-elevated` (`#2f2e2b`), `--color-border` (6%), `--shadow-float`, `--ease-out-cubic` (`cubic-bezier(0.215,0.61,0.355,1)`).

### Single-data-source pattern (sever the dual subscription)
**Source:** `usePermalinkAnalysis` (`src/hooks/queries/use-permalink-analysis.ts` L16-36) → `{ id, data: PredictionResult|null, isLoading }`.
**Apply to:** `reading.tsx` ONLY. Children receive data as **props** — they must NOT each call `usePermalinkAnalysis`/`useAnalysisStream` (the InsightHeroFrame anti-pattern). One subscription at the container; pass down. Keep the data source abstracted so Phase 4 can swap in `useAnalysisStream` without a rewrite.

### Dual-read (Pitfall 2 — permalink blank regression WPk976kozfWs)
**Source:** `InsightHeroFrame.tsx` L191-196.
**Apply to:** `reading.tsx` before deriving rows/rewrites/dims.
```typescript
// On permalink reload Apollo lives at variants.apollo; on live SSE at apollo_reasoning.
const apollo = data?.variants?.apollo ?? data?.apollo_reasoning ?? null;
```

---

## Pattern Assignments

### `src/components/reading/drill-sheet.tsx` (container, event-driven) — HIGHEST LEVERAGE (P3/P5 mount point)

**Analog:** `src/components/ui/sheet.tsx` (vendored Radix Dialog) + `src/hooks/useIsMobile.ts`

**The `side` prop already does both forms** (sheet.tsx L47-74) — no `vaul`, no new dep:
```tsx
// SheetContent accepts side: "top" | "right" | "bottom" | "left" with correct slide anims + responsive width
side === "right"  && "inset-y-0 right-0 h-full w-3/4 ... slide-in-from-right sm:max-w-sm"
side === "bottom" && "inset-x-0 bottom-0 h-auto border-t ... slide-in-from-bottom"
// Radix ships the focus trap, Esc-to-close, scroll-lock, aria-modal — do NOT hand-roll
```

**Mobile/desktop switch** (`useIsMobile.ts` L12-26) — returns `false` SSR→first-paint, flips after mount; harmless for the Sheet (portal only opens post-hydration on user tap):
```typescript
export function useIsMobile(): boolean { /* MOBILE_BREAKPOINT = 768; defaults true */ }
```

**Generic container API** (the load-bearing artifact — `children`-based so P3/P5 add panel *types* without touching this file):
```tsx
// 'use client'  — title is REQUIRED (Radix SheetTitle warns if absent)
interface DrillSheetProps { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: React.ReactNode; }
// <Sheet open onOpenChange><SheetContent side={isMobile ? 'bottom' : 'right'} className="bg-surface border-[--color-border] sm:max-w-[560px] data-[side=bottom]:max-h-[85vh] rounded-t-[16px] sm:rounded-none">
```
**Flat-warm reskin:** drop `shadow-lg` (overlay `bg-black/50` already dims); surface `--color-surface`; hairline `--color-border`; NO inset shine; NO blur (matte). One `useState<{open, panelId}>` at the `reading.tsx` level drives a single `DrillSheet`; the child is chosen by `panelId`.

> **`?panel=` URL sync (Claude's Discretion):** App Router has NO `router.push(url,{shallow:true})`. Use native `window.history.pushState`/`replaceState` — `Board.tsx` L283-293 already does this (`serializeCamera` + debounced `replaceState`). `useSearchParams()` MUST be inside `<Suspense>`. Downgradeable to pure `useState` for v1 (UI-SPEC sanctions). Validate `panel` against a closed allow-list (`hook`/`retention`/`shareability`/`personas`) before opening — never reflect arbitrary strings (Security V5).

---

### `src/components/reading/score-gauge.tsx` (SVG primitive, transform)

**Analog:** `board/_kit/PersonaGraph.tsx` (inline-SVG `<circle>` with token `stroke`/fill — the closest SVG idiom in repo). **No gauge library exists; none warranted** — hand-roll `stroke-dasharray`.

**SVG-circle + token-stroke idiom** (PersonaGraph L179-196 shows the `<circle>` + `var(--color-accent)` fill + `stroke` pattern to mirror):
```tsx
<circle cx={nd.x} cy={nd.y} r={nd.rad} fill={fill}
  stroke={accent ? 'var(--color-accent)' : 'white'} strokeOpacity={...} strokeWidth={...} />
```

**Build (hand-rolled — RESEARCH §Focus 2):**
```tsx
// 'use client'  — fill = bandTone(score) zone color (SSOT, amber spans 40–69)
const ZONE = { good: 'var(--color-success)', warn: 'var(--color-warning)', crit: 'var(--color-error)' };
const r = (size - stroke) / 2, C = 2 * Math.PI * r, arcLen = C * 0.75 /*270° dial*/;
const dash = arcLen * (clamp(score,0,100) / 100);
const color = ZONE[bandTone(score) === 'neutral' ? 'warn' : bandTone(score)];
// track <circle stroke="var(--color-border)" strokeDasharray={`${arcLen} ${C}`}/>
// fill  <circle stroke={color} strokeLinecap="round" strokeDasharray={`${dash} ${C}`}
//   style={reduced ? undefined : { transition: 'stroke-dasharray 700ms var(--ease-out-cubic)' }}/>
// role="img" aria-label={`Score ${score} of 100, ${bandFromScore(score)}`}
```
**Geometry (UI-SPEC):** ~120px desktop / ~96px mobile; 8px stroke; round caps; 270° sweep (`-rotate-[225deg]`). Number Inter 36px/600/`tabular-nums` cream; band word sans medium 16px same zone color. **NO glow/halo/filter** (matte). **Phase-4 contract:** fill is a **prop** (`score`) — the CSS `transition` glides 0→score automatically when P4 drives it from `useAnalysisStream`; respect `usePrefersReducedMotion` (`hooks/usePrefersReducedMotion.ts` — defaults `true` SSR).

---

### `src/components/reading/persona-cloud.tsx` (SVG primitive, transform)

**Analog:** `board/_kit/PersonaGraph.tsx` — **strip** the deterministic golden-angle layout to dots. Drops: 200 viewer dots, nearest-neighbour links, hover card, `<animate>` pulse.

**Layout math — copy VERBATIM** (PersonaGraph L55-72; SSR-safe, hydration-stable, no `Math.random`):
```tsx
const VB_W = 320, VB_H = 200;
const golden = Math.PI * (3 - Math.sqrt(5));
const cx = VB_W/2, cy = VB_H/2, n = Math.max(personas.length, 1);
const maxR = Math.min(VB_W, VB_H) * 0.42;
nodes = personas.map((p, i) => {
  const t = (i + 0.5) / n, r = Math.sqrt(t) * maxR, a = i * golden;
  return { ...p, x: cx + Math.cos(a)*r, y: cy + Math.sin(a)*r,
           rad: 4 + clamp01(p.weight) * 9 };   // smaller than PersonaGraph's 6 + 13 (D-02 lighter)
});
```

**Worst-cluster coral + a11y mirror** (PersonaGraph L157-160 fill rule + L237-245 sr-only `<ul>` — reuse exactly):
```tsx
// tone==='accent' → fill var(--color-accent); else cream rgba(236,231,222, 0.2 + watchThrough*0.5) — NOT white
// <ul className="sr-only">{personas.map(p => <li>{p.label}: {Math.round(p.watchThrough*100)}% watch-through ...</li>)}</ul>
```
**Data:** `buildPersonaNodes(heatmap, persona_simulation_results, worstBadGroupKey(...))` (audience-derive). **Degradation (REQUIRED):** `buildPersonaNodes` returns `[]` when `heatmap.personas` empty (L428) → render **no cloud** (omit), hero still shows gauge + watch%. **Watch% (READ-04, once):** `averageWatchThrough(nodes)` (already 0–100, NO ×100) → `{n}% watch` beside cloud. **Phase-3 seam:** make the cloud a tap target that opens `DrillSheet` with the full `PersonaGraph` (mount the Canvas component in P3).

---

### `src/components/reading/driver-rows.tsx` (component, transform) — CORRECTION #1

**Analog:** `board/verdict/FactorBars.tsx` — **borrow the grid markup ONLY; rebuild the data + behavior.**

**The 5 mismatches** (why this is NOT a copy-reuse): `FactorBars` consumes `Factor[]` **0–10** with a `/{max_score}` suffix, **sorts strongest-first**, tags top "keep", and renders the weakest with a **`#FF7F50` coral gradient + `boxShadow` glow**. D-05/06/07/08 want 3 **fixed-order** `ApolloDimension`s **0–100**, neutral cream bars, **only the single weakest** in its **zone** color (amber/red, NOT coral), value = score (Retention value = drop time).

**Borrow ONLY the grid + bar markup** (FactorBars L25-52 — widen value col for `⚠ 0:08`):
```tsx
// REUSE: the 3-col grid + 5px rounded-full bar geometry
<div className="grid items-center gap-[15px] grid-cols-[130px_1fr_42px] sm:grid-cols-[152px_1fr_42px] py-[8.5px]">
  <div className="... text-[12.5px] font-medium">{label}</div>
  <div className="h-[5px] rounded-full bg-white/[0.06]"><div className="h-full rounded-full" style={{ width: `${pct}%`, /* … */ }}/></div>
  <div className="text-right text-[13px] font-semibold tabular-nums">{value}</div>
</div>
// STRIP (FactorBars L44-49): the `linear-gradient(90deg,#E8703F,#FF7F50)` + `boxShadow:'0 0 10px rgba(255,127,80,0.5)'`
//   → neutral cream fill; only weakest = its zone color (var(--color-warning|--color-error)); NO glow
```

**Data contract** (engine `types.ts` L840-848 — VERIFIED 0–100):
```typescript
// ApolloDimension: { name: 'hook'|'retention'|'clarity'|'share_pull'|'substance'|'credibility'; band; score: 0–100; lever; evidence }
// dimensions[] is length-6, order [hook, retention, clarity, share_pull, substance, credibility]
// Driver rows = find hook, retention, share_pull   |   Deeper read = clarity, substance, credibility
```
**Rules:** fixed funnel Hook→Retention→Shareability (D-08, NO sort). Bar `pct = dimension.score` (0–100, no `/10`). Weakest = `min(score)` across the 3 → that bar+value takes its zone color + `⚠`. **Retention value column** = `⚠ ${formatTime(weighted_top_dropoff_t)}` (audience-derive **seconds** variant), while its bar still fills by retention `score` (D-06: bar=how good, value=where it breaks). Each row = a ≥44px tap target → `onRowTap(panelId)` opens `DrillSheet`. **Degrade (D-13):** when `apollo_reasoning: null` (no `dimensions`), hide bars/values gracefully — never render `0`.

---

### `src/components/reading/fix-first-list.tsx` (component, transform)

**Analog:** `board/verdict/TopFixesList.tsx` — keep the fix-item card markup; **drop `useBoardStore` and the audience-jump anchor** (dead in the thread — no Konva preset).

**REUSE the card + filter** (TopFixesList L24, L34-62):
```tsx
const fixes = suggestions.filter((s) => s.type === 'fix').slice(0, 3);   // top-3 fixes (D-08)
// <li className="rounded-[8px] border border-white/[0.06] bg-white/[0.02] p-2">
//   <span className="text-xs font-medium">{fix.headline}</span>
//   <span className="text-xs text-foreground-muted">{fix.detail}</span>
```
**DROP** (TopFixesList L2, L21, L41-54):
```tsx
import { useBoardStore } from '@/stores/board-store';        // ← remove
const setActivePreset = useBoardStore((s) => s.setActivePreset);  // ← remove
<button onClick={() => setActivePreset('audience')}>[seg · {formatTime(fix.timestamp_ms)}]</button>  // ← remove (panel-pan dead)
```
**Data** (`types.ts` L573-579): `CounterfactualSuggestionItem { type; headline; detail; timestamp_ms /*MS*/; signal_anchor }`. If a timestamp is shown, `formatTime(fix.timestamp_ms / 1000)` or the ms variant — **NOT** the seconds one. **Empty state (D-14):** zero fixes → heading `Nothing urgent to fix` / body `This one's solid.` (a win, not blank — replaces the analog's `return null`). Rewrites rendered via `<RewriteItem>` (below); inline `{n} more fixes →` expand via `useState` or `Accordion`.

---

### `src/components/reading/rewrite-item.tsx` (component, event-driven / clipboard)

**Analog:** `InsightHeroFrame.tsx` `RewriteItem` (L97-149) — **lift nearly verbatim, repoint palette.**

**Copy-to-clipboard pattern** (L100-111 — keep exactly):
```tsx
function handleCopy() {
  navigator.clipboard.writeText(rewrite.variant)
    .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })
    .catch(() => {/* clipboard unavailable — no-op */});
}
// <del className="text-foreground-muted">{rewrite.original}</del>   (was text-white/40)
// <p className="text-foreground">{rewrite.variant}</p>              (was text-white)
// <button ...>{copied ? 'Copied' : 'Copy'}</button>  ← Copy is one of the 3 sanctioned coral surfaces
```
**Data** (`types.ts` L855-859): `ApolloRewrite { original; variant; lever_fixed }`. Source = `apollo.rewrites` (dual-read). **D-14:** no rewrites → render fixes WITHOUT the rewrite chip (no placeholder).

---

### `src/components/reading/deeper-read.tsx` (component, transform — inline expand)

**Analog:** `InsightHeroFrame.tsx` `DimensionRow` (L155-180) for the row markup + `ui/accordion.tsx` (Radix) for the inline expand.

**Dimension-row markup** (L162-178 — repoint `BAND_COLOR` L75-79 OLD palette → zone tokens):
```tsx
// <span>{DIM_NAME_LABEL[dim.name]}</span> <span className="tabular-nums">{dim.score}</span> <span className={bandColor}>{BAND_LABEL[dim.band]}</span>
// BAND_COLOR { strong:'text-emerald-400', mid:'text-amber-400', weak:'text-red-400' } → text-success/-warning/-error
```
**Inline expand** (`accordion.tsx` — already vendored, handles a11y + reduced-motion; NOT a Sheet, D-10):
```tsx
// AccordionRoot / AccordionItem / AccordionTrigger ("Deeper read") / AccordionContent
```
**Data:** the remaining 3 dims `clarity`, `substance`, `credibility` from `apollo.dimensions`. **D-13:** `apollo_reasoning: null` → omit missing dims silently (render only what's present); hero/rows still resolve from `overall_score`.

---

### `src/components/reading/thumbnail-strip.tsx` (component, file-I/O / signed `<img>`)

**Analog:** `board/_kit/KeyframeImage.tsx` + `board/_kit/keyframe.resolveKeyframeUrl` (`_kit/index.ts` L14-15).

**Signed-`<img>` + failure-fallback idiom** (KeyframeImage L47-69 — plain `<img>`, NOT `next/image`, signed dynamic URLs):
```tsx
const [failed, setFailed] = useState(false);
const showImg = !!src && !failed;
// <img src={src ?? undefined} alt="" onError={() => setFailed(true)} .../>   // decorative alt=""
```
**Gate on real video** (UI-SPEC §thumbnail): `resolveKeyframeUrl(heatmap.segments[0])` or first filmstrip frame; text/tiktok-url with no keyframe → render **no strip, no broken placeholder** (mirror `resolveKeyframeUrl`'s real-video gate). Static poster (inline-playable deferred). **Do NOT log the signed URL** (Security: info disclosure).

---

### `src/components/reading/anti-virality-header.tsx` (component, request-response) — THE clean as-is reuse (D-04)

**Analog:** `board/verdict/AntiViralityHeader.tsx` — **reuse as-is** (re-export or thin wrapper). VERIFIED clean: token gradient `var(--color-accent)`→`var(--color-warning)` (no glow), self-manages localStorage dismissal, returns `null` when not gated.
```tsx
// AntiViralityHeader.tsx L46-72 — already flat-warm-compatible; takes { result, analysisId }
// reads counterfactuals?.suggestions for fixCount + COPY.AV_HEADER(n); COPY.AV_OVERRIDE_LINK 'Post anyway →'
```
**Wire:** `<AntiViralityHeader result={data} analysisId={id} />` — place **above the gauge** (D-04); the banner does NOT hide the score (score stays visible, subordinated). The only friction-free board-React reuse in the phase.

---

### `src/components/reading/reading.tsx` (container, request-response) — owns the D-13 gate + panel state

**Analog:** `InsightHeroFrame.tsx` (assembly logic donor) + `usePermalinkAnalysis` (single source).

**Composition + short-circuit order** (RESEARCH data-flow diagram):
```tsx
// 'use client'
const { id, data } = usePermalinkAnalysis();
const apollo = data?.variants?.apollo ?? data?.apollo_reasoning ?? null;   // dual-read (Pitfall 2)
const [panel, setPanel] = useState<PanelId | null>(null);

if (!data) return <ReadingError/>;                            // fetch/permalink failure
if (data.analysis_unavailable) return <CouldNotAnalyze/>;    // D-13: NEVER pass the fake 0 to ScoreGauge — GATE FIRST
// data.partial_analysis → small "Partial read — based on half the usual signals." annotation near hero
//
// <ThumbnailStrip/>  <AntiViralityHeader result={data} analysisId={id}/>  (when gated, D-04)
// HERO:  <ScoreGauge score={data.overall_score}/> | <PersonaCloud nodes={...}/> + "{n}% watch"
// <DriverRows dims={[hook, retention, share_pull]} dropT={data.weighted_top_dropoff_t} onRowTap={setPanel}/>
// FIX FIRST: <FixFirstList fixes={data.counterfactuals?.suggestions} rewrites={apollo?.rewrites}/>
// <DeeperRead dims={[clarity, substance, credibility]}/>  (inline accordion)
// <DrillSheet open={!!panel} onOpenChange={(o)=>!o && setPanel(null)} title={...}>{panelFor(panel)}</DrillSheet>
```
**Honesty flags** (`types.ts` L369-393, all REQUIRED booleans): `analysis_unavailable` → short-circuit; `partial_analysis` → annotation; `apollo_reasoning: null` → rows/deeper degrade, hero/gate still resolve. **READ-10:** never spread raw `data` into JSX — read whitelisted fields only.

---

### `src/components/reading/index.ts` (barrel)

**Analog:** `board/_kit/index.ts` (`export { KeyframeImage } from './KeyframeImage'` named-export pattern) / the `board/verdict/` flat-module convention. Barrel the public Reading components; kebab-case files, `"use client"` on interactive ones.

---

### `src/app/(app)/analyze/layout.tsx` (route layout) — LANDMINE 0 (the big structural one)

**Analog:** itself — **invert the current mount.** VERIFIED: today it renders `<Board />` + `<div className="sr-only">{children}</div>`; `[id]/page.tsx` returns `null`.
```tsx
// CURRENT (layout.tsx L9-20):
<Suspense fallback={null}>
  <Board />                                    // ← retire the Konva 8-frame canvas mount
  <div className="sr-only">{children}</div>    // ← page bodies are sr-only stubs
</Suspense>
```
**Restructure:** replace `<Board/>` with `<Reading/>` rendered from `layout.tsx` (same persistence rationale Board used — survives the submit→`/analyze/[id]` URL transition; `usePermalinkAnalysis` reads `useParams()` so it works from the layout). Keep `[id]/page.tsx` metadata-only. **Size this as a layout restructure, NOT a 1-for-1 swap** — the no-id `/analyze` composer state + the Phase-1 `<AppShell>` 760px column interplay (`(app)/layout.tsx`) must keep working. The Konva shell/camera/pan-zoom dies; the frame-*content* logic lives on in `reading/`.

---

## No Analog Found

None. Every new file maps to a grounded repo source (verbatim-reuse helper, vendored Radix primitive, markup-donor board component, or route-self for the restructure). Three are *technique/partial* matches that rebuild rather than copy — flagged inline:

| File | Why partial (rebuild, not copy) |
|------|--------------------------------|
| `score-gauge.tsx` | No gauge lib in repo; PersonaGraph gives the inline-SVG `<circle>`+token idiom but the `stroke-dasharray` arc is hand-rolled fresh. |
| `driver-rows.tsx` | `FactorBars` is the markup donor only — 5 data/behavior mismatches (0–10 vs 0–100, `/max` suffix, sort, coral fix-bar, glow) force a rebuild (CORRECTION #1). |
| `persona-cloud.tsx` | `PersonaGraph` layout math copied verbatim, but the Canvas/200-dots/hover/`<animate>` are stripped — a different (static, lighter) component. |

---

## Metadata

**Analog search scope:** `src/components/board/{verdict,audience,_kit}/`, `src/components/ui/`, `src/components/app/simulation/` (legacy — VERIFIED 13 contradicting components, NOT reused), `src/hooks/{,queries/}`, `src/app/(app)/analyze/`, `src/lib/engine/types.ts`, `src/app/globals.css`.
**Files scanned:** ~22 source files read + grepped.
**Pattern extraction date:** 2026-06-14
**Corrections honored:** all 4 (FactorBars markup-only / `src/components/reading/` not `app/simulation/` / pure-helpers+Radix reuse not board-React / `formatTime` seconds-vs-ms). Plus CORRECTION #2 (amber spans 40–69 via `bandTone` SSOT) absorbed into the gauge + driver-rows assignments.

## PATTERN MAPPING COMPLETE
