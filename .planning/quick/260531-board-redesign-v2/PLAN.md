---
task: board-redesign-v2
status: in-progress
started: 2026-05-31
branch: feat/actions-frame-inline-redesign
model_policy: opus-4.8 for ALL work incl. execution agents
---

# Board Redesign v2 — "Premium, not busy"

Second rework. Prior board (4 frames SHIPPED e00f463 + content-craft built) reads **too busy / not premium**. Root cause: each frame rolls its own cards/bars/charts → visual divergence. Fix = one shared design language + ruthless hierarchy, extracted from analytics refs (TikTok, YouTube, Instagram, Stripe, Linear, Artificial Societies).

## Locked decisions
- **Layout:** every frame = `Hero + tile-row + tabbed depth`.
- **Rollout:** all 5 frames in parallel, AFTER the shared kit exists.
- **Audience:** Artificial-Societies persona **node-graph as hero**; retention curve → a tab.

---

## DESIGN CONTRACT (every frame conforms)

### The 7 rules (from the refs)
1. **One hero per frame.** A single dominant number/object. Never competing heroes.
2. **Metric tiles.** Tiny muted caps label · huge `tabular-nums` value · small green/red delta.
3. **Progressive disclosure via tabs.** Secondary depth hides behind tabs, never stacks.
4. **One calm chart.** Single line/area, dotted = previous/comparison, muted grid, few axis labels.
5. **Monochrome + ONE accent (coral).** Color only for: accent highlight, active tab, primary CTA, current-series line. Deltas use success/error green/red — NOT coral.
6. **Whitespace + alignment.** Generous margins, left labels, right-aligned numbers.
7. **Tables only on drill-down**, clean rows w/ inline sparkline.

### Tokens (exact — from globals.css)
- bg `#07080a` · surface `#18191a` · elevated `#222326`
- border `white/[0.06]` · border-hover `white/[0.1]` · hover bg `white/[0.05]`
- text: primary `white` / `--foreground` · secondary `white/55`–`gray-400 #9c9c9d` · muted `gray-500 #848586`
- accent coral-500 `#FF7F50` (accent-foreground `#1a0f0a`)
- success `oklch(0.68 0.17 145)` · error `oklch(0.60 0.20 25)` (use `--color-success`/`--color-error`)
- font Inter, `letter-spacing 0.2px` body; numbers `tabular-nums`

### Type scale (px — frames are world-space px scaled by camera)
| token | spec |
|---|---|
| hero number | `text-[44px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-white` |
| hero unit | `text-[16px] font-medium text-white/40` |
| hero label (caps) | `text-[10px] uppercase tracking-[0.1em] text-white/45` |
| hero status word | `text-[13px] font-semibold` (tone color) |
| hero insight | `text-[13px] leading-[1.4] text-white/60` (`text-wrap:balance`) |
| tile label | `text-[9.5px] uppercase tracking-[0.08em] text-white/55` |
| tile value | `text-[18px] font-semibold leading-none tabular-nums text-white/95` |
| delta | `text-[11px] font-medium` + ▲/▼, success/error |
| tab trigger | `text-[12px] font-medium`; active `text-white` + 1.5px coral underline; idle `text-white/45` |
| section head | `text-[11px] uppercase tracking-[0.08em] text-white/45` |
| body | `text-[13px] leading-[1.45] text-white/70` |

### Spacing
- frame body padding `p-4` (16px) · section gap `space-y-4` (16px) · tile gap `gap-[9px]`
- hero block: ~`py-3` top, number→label tight, delta inline-right or under
- max ~3 visible sections before the fold; everything else tabbed/collapsed

---

## SHARED KIT — `src/components/board/_kit/`  (build FIRST, I own this)

All client components. Pure-presentational (data mapped by each frame). Each gets a `__tests__` sibling.

1. **`Delta.tsx`** — `<Delta value={number} suffix?="%" dir?="up"|"down"|"auto" invert?=false />`. ▲/▼ + colored. `auto` infers dir from sign; `invert` flips good/bad (e.g. drop-off where down=good).
2. **`FrameHero.tsx`** — `{ label, value, unit?, delta?, status?:{word,tone:'good'|'warn'|'crit'|'neutral'}, insight?, align?:'center'|'left', children? }`. Big number block. `children` slot lets Audience pass the node-graph as hero visual.
3. **`StatTile.tsx` + `StatTileRow.tsx`** — generalize SignalTiles. Tile `{ k, v, u?, delta?, s?, em?, tone? }`. Row = `@container` grid `grid-cols-2 @[420px]:grid-cols-4 gap-[9px]`. min-h-[72px], rounded-[11px], border white/6, bg white/[0.016].
4. **`FrameTabs.tsx`** — wraps `ui/tabs`. `{ tabs:[{value,label,count?}], value?, defaultValue?, onValueChange?, children }`. Underline-active coral, idle white/45, `text-[12px]`. No pill bg.
5. **`TrendChart.tsx`** — recharts. `{ data:[{x, current, previous?}], height?, yFormat?, xFormat?, fill?=true }`. Current = coral line (+ soft coral area if fill). Previous = dotted white/25. Grid `white/[0.04]` horizontal only. Axis labels `text-[10px] white/35`, minimal ticks. ResponsiveContainer.
6. **`MiniSparkline.tsx`** — inline svg, `{ points:number[], w?=64, h?=20, tone? }`. For table rows.
7. **`DataTable.tsx`** — `{ columns:[{key,label,align?,render?}], rows }`. Rows: 1px white/[0.05] divider, label left, right-aligned tabular numbers, optional sparkline cell. hover bg white/[0.02]. No outer border.
8. **`PersonaGraph.tsx`** (Audience hero) — force/packed node cloud. `{ personas:[{id,label,weight,watchThrough,segment,tone}], onHover? }`. SVG, deterministic layout (seeded — NO Math.random at module/render: precompute via d3 force with fixed seed OR d3-hierarchy pack). Node radius ∝ weight, fill = segment tone (coral for the worst-retention cluster, else white/20–60 ramp), faint links. Hover → floating glass detail card (AS-style: persona label, watch-through %, "drops at Xs", segment). Respect reduced-motion (no float animation).

**Kit index** `_kit/index.ts` re-exports all. **Contract test:** kit compiles + renders in isolation before frames import it.

---

## FRAME SPECS (parallel agents, one per frame, after kit lands)

Each frame: keep existing data hooks (`useAnalysisStream`+`usePermalinkAnalysis`) & derive helpers; **only re-compose the presentation** into Hero+tiles+tabs using the kit. Preserve testids where tests assert them; update tests as needed. Preserve streaming/empty/gated states.

### F1 — SCORE (`verdict/`)  ⟶ busiest, biggest win
- **Hero:** `overall_score` /100, label "VIRALITY SCORE", delta vs niche median, status word by band. Anti-virality gated → hero turns crit (coral), one-line top fix as `insight` (fold `AntiViralityHeader`+`TopFixesList` lead into hero).
- **Tiles (4):** Share · Completion · Comment · Save percentiles, each `delta` vs niche.
- **Tabs:** `Breakdown` (FactorBars + the 4 engine SignalTiles) · `Distribution` (ScoreDistribution histogram) · `History` (VsHistoryCollapsible, only if prior exists).
- Kill the 7-section stack. Reuse FactorBars/ScoreDistribution internals, restyle to tokens.

### F2 — AUDIENCE (`audience/`)
- **Hero:** `PersonaGraph` node-cloud (the 10 personas) + overlaid watch-through % big number + status word + 1-line insight.
- **Tiles (3):** Avg watch-through · Niche completion % · Personas finishing (n/10).
- **Tabs:** `Retention` (RetentionChart survival curve → TrendChart current-vs-weighted) · `Who leaves` (SegmentTable → DataTable) · `Mix` (weight override; move drawer inline-calm or portal).

### F3 — ACTIONS (`actions/`)
- **Hero:** the ONE move verb headline (tone by band): "Post it" / "Polish the hook" / "Rework it". `insight` = why.
- **Body:** best-time as ONE calm card; if needs-work, hero rewrite block + CopyButton.
- **List:** suggestions as Linear-style task rows (`DataTable` or row list) under a `Fixes` section/tab. Keep the view-kind router logic; unify the layout so all kinds share Hero+rows.

### F4 — INPUT + ENGINE (input column)
- **Input hero:** engagement "Top X%" percentile (keep `useCountIn`), label "PREDICTED RANK", status word. Gated → "Hold" coral.
- **Tiles (4):** the engagement percentiles (current StatTile row).
- **Engine:** calm horizontal **stepper** (Linear progress aesthetic) — 5 stages, subtle coral progress, findings behind expand/`Signals` tab. De-densify EngineGroup.

### F5 — CONTENT CRAFT (`content-analysis/`)  ⟶ closest already
- **Hero:** `CraftFilmstrip` (keep) + headline (keep accent-on-weak-word).
- **Replace `CraftRail` bars → `StatTileRow`** of the 4–5 pillars (value + weak-link accent). One emotion-arc line stays calm over the filmstrip.
- Minimal change; mostly token alignment + rail→tiles.

---

## SEQUENCE
- **P0 ✅ DONE:** built `_kit/` (9 components) + 14 tests green, type-clean.
- **P1 ✅ DONE:** 5 opus agents rebuilt all frames; each green in isolation.
- **P2 ✅ DONE (automated):** integration verified — full board suite **342/342**, `tsc` clean (only pre-existing predict-sweep.ts), `next build` clean. Built dev preview `/board-preview` + Playwright-screenshot all 5 frames; design language confirmed calm + premium vs refs.
- **P2.5 ⏳ PENDING:** live-data pixel QA on the authed board (synthetic-data preview done; real `/analyze/[id]` needs auth env) + user sign-off on visual direction.
- **P3 ⏳ PENDING:** mobile card-stack check, reduced-motion, a11y (axe), atomic commits per frame, gate/remove dev `/board-preview` route before merge.

## VERIFY (Boris rule)
Build green · board+backend tests green · Playwright screenshots of all 5 frames on real/seeded data, compared against refs · mobile + reduced-motion pass. No "should work".

## Done-when
All 5 frames render Hero+tiles+tabs in one shared language, demonstrably calmer than e00f463, screenshots approved by user.
