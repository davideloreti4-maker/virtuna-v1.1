# Phase 4: Mobile Reading Thread + PWA Shell - Pattern Map

**Mapped:** 2026-06-12
**Files analyzed:** 18 new + 3 modified
**Analogs found:** 18 / 21 (3 PWA files = first-of-kind, RESEARCH code examples are the source)

> **Phase posture:** presentation-only. Almost every NEW file COMPOSES an existing
> `src/components/numen/` primitive or RESHAPES the existing `useAnalysisStream`
> output. The two genuinely net-new pieces are the SSE→slot reshape layer and the
> Serwist PWA shell. This map ties each new file to its closest existing analog with
> concrete excerpts; where no codebase analog exists (the 3 PWA files), it points the
> planner at the verified RESEARCH code example instead.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/(app)/reading/page.tsx` | route (live) | request-response | `src/app/(app)/analyze/page.tsx` + `analyze/layout.tsx` | role-match (App Router page sibling-to-board) |
| `src/app/(app)/reading/[id]/page.tsx` | route (resting RSC) | request-response | `src/app/(app)/competitors/[handle]/page.tsx` (auth-scoped RSC fetch) + `analyze/[id]/page.tsx` (param + metadata) | role-match |
| `src/components/reading/reading-thread.tsx` | component (container) | event-driven (SSE) | `src/app/(app)/analyze/[id]/result-card.tsx` (drives `useAnalysisStream`, iterates slots by `panelReady`) | exact (same hook, same slot-gating shape) |
| `src/components/reading/throne.tsx` | component | event-driven | `stage-reveal.tsx` (StageBlock) + RESEARCH Pattern 2 + `result-card-skeleton.tsx` | role-match |
| `src/components/reading/blocks/verdict-block.tsx` | component | transform (render) | `verdict-swatch.tsx` + `view-model.ts` verdict shape + `numen-kit/page.tsx` composition | role-match |
| `src/components/reading/blocks/expert-insight-block.tsx` | component | transform | `numen-kit/page.tsx` (serif voice specimen) + `surface.tsx` | role-match |
| `src/components/reading/blocks/hook-block.tsx` | component | transform | `surface.tsx` + `result-card.tsx` render-when-ready | role-match |
| `src/components/reading/blocks/retention-block.tsx` (+ degraded) | component | transform | `surface.tsx`; degraded honest-block copy in 04-UI-SPEC | role-match |
| `src/components/reading/blocks/audience-block.tsx` | component | transform | `pill-chip.tsx` (intent chips) + `surface.tsx` | role-match |
| `src/components/reading/blocks/drivers-block.tsx` | component | transform | `surface.tsx` | role-match |
| `src/components/reading/blocks/persona-read-block.tsx` | component | transform | `surface.tsx` | role-match |
| `src/components/reading/blocks/fixes-block.tsx` | component | transform | `surface.tsx` + `pill-chip.tsx` | role-match |
| `src/components/reading/blocks/content-summary-block.tsx` | component | transform | `surface.tsx` (serif? NO — sans body) | role-match |
| `src/components/reading/blocks/degraded-block.tsx` | component | transform | `surface.tsx` + 04-UI-SPEC degraded copy | role-match |
| `src/components/reading/block-view.tsx` (kind→component switch) | component (dispatcher) | transform | `view-model.ts` `toReadingBlocks` switch + `block-types.ts` union (exhaustive `never`) | exact (mirror the union switch) |
| `src/lib/reading/stage-slots.ts` | utility (pure) | transform | `src/lib/engine/panel-mapping.ts` (`STAGE_TO_PANEL`, `panelReadyFromStages`) | exact (pure map sibling) |
| `src/components/reading/install-hint.tsx` | component | event-driven (localStorage) | `src/components/board/MobileBoardBanner.tsx` (localStorage dismissal + SSR-safe default) | exact (dismissible-banner pattern) |
| `src/components/reading/reply-composer.tsx` | component (inert) | request-response (deferred) | `glass.tsx` (the ONE Glass surface) | role-match |
| `src/app/manifest.ts` | config (metadata route) | file-I/O | `src/app/opengraph-image.tsx` (sibling metadata route) — RESEARCH §Manifest example | no codebase manifest; use RESEARCH |
| `src/app/sw.ts` | config (service worker) | file-I/O | none — RESEARCH §"Service worker entry (path A)" | no analog |
| `next.config.ts` (modify) | config | — | self (wrap existing `withSentryConfig`) — RESEARCH §"Serwist next.config wrap" | exact (extend in place) |

---

## Pattern Assignments

### `src/components/reading/reading-thread.tsx` (component, event-driven) — THE CRUX FILE

**Analog:** `src/app/(app)/analyze/[id]/result-card.tsx` — the only existing component that
drives `useAnalysisStream` and renders ordered slots gated by `panelReady`. Copy its
hook-consumption shape; REPLACE its panel grid with the curated single-column thread order.

**Hook consumption + slot gating** (`result-card.tsx:24-27, 56-60, 79-95`):
```tsx
import { useAnalysisStream } from "@/hooks/queries/use-analysis-stream";
import { PANEL_IDS, type PanelId } from "@/lib/engine/panel-mapping";

const { panelReady, phase, result, error, reconnect } = useAnalysisStream({
  initialData: initialData ? ({ id: analysisId, ...initialData } as any) : null,
});
// ...
{PANEL_IDS.map((id) => (
  <div key={id} data-panel-id={id} data-panel-ready={panelReady[id]}>
    {panelReady[id] === "ready" ? <RealContent /> : <PanelSkeleton ready={panelReady[id]} />}
  </div>
))}
```

**What changes vs the analog (per CONTEXT D-03 + RESEARCH Crux):**
- Replace `PANEL_IDS.map` (engine panel order) with a Phase-4-OWNED `CURATED_ORDER`
  constant (D-03a: throne → expert-insight → hook → retention → audience → drivers →
  persona-read → fixes → content-summary). Phase 4 owns order; the view-model emits NO
  order hints (block-types.ts D-13).
- Derive real blocks ONLY at `phase === "complete"` — the view-model is all-at-complete:
  ```tsx
  import { toReadingBlocks, canonicalFromLive } from "@/lib/reading/view-model";
  const blocks = phase === "complete" && result
    ? toReadingBlocks(canonicalFromLive(result)) : [];
  ```
  (verified return shape: `use-analysis-stream.ts:97-108` `AnalysisStreamReturn` →
  `{ start, result, stages, partial, panelReady, phase, error, reconnect, analysisId, ... }`)
- Pre-complete: reveal a content-free PLACEHOLDER per slot keyed to `panelReady[key] === "ready"`
  (mapped via the new `stage-slots.ts`). Never call `canonicalFromLive` on a partial result
  (RESEARCH Pitfall 3).
- Wrap the surface in `<div className="numen-surface">` — load-bearing scope class
  (globals.css:356; warm tokens resolve only inside it).
- Throne handled separately (always reserved); see `throne.tsx`.
- aria-live announce-ONCE region (one polite region, empty until complete; RESEARCH Pattern 3 /
  04-UI-SPEC Accessibility) — do NOT put aria-live on each block (the analog's per-`role=alert`
  error region is fine; the storm risk is per-block live regions).

**Error region** (`result-card.tsx:129-144`) — reuse the in-thread calm error pattern, but
restyle to `.numen-surface` tokens + UI-SPEC copy ("That didn't go through…"), NOT the
analog's `red-500/*` classes (those are the legacy coral app).

---

### `src/lib/reading/stage-slots.ts` (utility, pure) — the reshape map

**Analog:** `src/lib/engine/panel-mapping.ts` — the canonical pure stage→readiness map.
Build the curated-slot variant the SAME way (frozen `as const` array + pure reducer).

**Pattern to mirror** (`panel-mapping.ts:10-38`):
```ts
export const PANEL_IDS = [ "verdict", "retention", "persona_breakdown", "hook_decomp", ... ] as const;
export type PanelId = (typeof PANEL_IDS)[number];
export type PanelReadyState = "idle" | "loading" | "ready" | "error";

export const STAGE_TO_PANEL: Record<string, readonly PanelId[]> = {
  wave_1: ["hook_decomp", "similar_videos", "emotion_arc"],
  wave_2: ["reasoning", "insight_hero"],          // Apollo paints both
  wave_3_personas: ["retention", "persona_breakdown"],
  aggregator: ["verdict", "comparative_baseline", "optimal_post", "anti_virality"],
};
```

**What `stage-slots.ts` adds:** a `CURATED_ORDER: readonly { kind: ReadingBlock['kind']; panelKey: PanelId }[]`
binding each curated slot (D-03a) to its driving `PanelId`, per the RESEARCH SSE→Block
mapping table:

| Slot | `ReadingBlock.kind` | `panelKey` (PanelId) | reveals when |
|------|---------------------|----------------------|--------------|
| 2 | `expert-insight` | `insight_hero` / `reasoning` | `wave_2` ends |
| 3 | `hook` | `hook_decomp` | `wave_1` ends |
| 4 | `retention`/`retention-degraded` | `retention` | `wave_3_personas` ends |
| 5 | `audience` | `persona_breakdown` | `wave_3_personas` ends |
| 6 | `drivers` | `verdict` | `aggregator` ends |
| 7 | `persona-read` | `persona_breakdown` | `wave_3_personas` ends |
| 8 | `fixes` | `verdict` | `aggregator` ends |
| 9 | `content-summary` | `verdict` | `aggregator` ends |

Throne (`verdict`) is reserved from t0, NOT in this reveal map (D-02). No `audio` slot
(dropped Phase 2 — block-types.ts:55). `analysis-degraded` is derived at complete only.
`lib/reading/` is Phase-2-frozen for the EXISTING files — this is a NEW sibling file, allowed.

---

### `src/components/reading/block-view.tsx` (dispatcher) — kind→component switch

**Analog:** `src/lib/reading/view-model.ts:129-188` `toReadingBlocks` + `block-types.ts:57-87`
the discriminated union. The renderer mirrors the union the producer emits — exhaustive
`switch (block.kind)` with a `never`-typed default (block-types.ts D-13 header: "Consumers
`switch (block.kind)` with a `never`-typed default for exhaustiveness").

**Union to switch on** (`block-types.ts:57-87`) — 11 kinds:
`verdict | expert-insight | hook | retention | retention-degraded | audience | fixes |
drivers | persona-read | content-summary | analysis-degraded`.

```tsx
// mirror the union; exhaustive default catches a new kind at compile time
function BlockView({ block }: { block: ReadingBlock }) {
  switch (block.kind) {
    case "verdict": return <VerdictBlock block={block} />;
    case "expert-insight": return <ExpertInsightBlock block={block} />;
    // ... one case per kind ...
    default: { const _exhaustive: never = block; return null; }
  }
}
```

**Honest omit-discipline (D-14):** the view-model SILENTLY omits absent blocks
(`view-model.ts:153,163,183,187` — `if (...) blocks.push(...)`). `block-view` renders only
what the array contains; NEVER render an empty shell for a missing block (distinct from the
pre-complete forming placeholders).

---

### `src/components/reading/throne.tsx` (component, event-driven)

**Analog:** `src/components/numen/stage-reveal.tsx` (the ONE motion) + `verdict-swatch.tsx`
+ RESEARCH Pattern 2. No fake band mid-stream; crystallize ONCE at `complete`.

**Crystallization motion — reuse `StageBlock`, do NOT roll new motion** (`stage-reveal.tsx:49-82`):
```tsx
import { StageBlock } from "@/components/numen/stage-reveal";
// StageBlock: opacity calm-tween (NUMEN_EASE_CALM) + high-damping spring translate
// (stiffness 220 / damping 30 → no overshoot). Reduced-motion zeroes the translate
// (reduce = useReducedMotion() !== false — fails SAFE on null). RESEARCH Pitfall 8.
```

**Verdict swatch** (`verdict-swatch.tsx:21-57`) — band → muted peer color, literal class
strings (never `bg-${verdict}` interpolation):
```tsx
import { VerdictSwatch } from "@/components/numen/verdict-swatch";
<VerdictSwatch verdict={block.band /* 'good'|'mixed'|'bad' */} size="lg" />
```
> NOTE band-id mismatch the planner must bridge: `verdict-bands.ts:34-37` band ids are
> `high | solid | needs-work`, the throne label words ("High potential" etc.) come from
> `VERDICT_BANDS[].label`, but `VerdictSwatch` takes `good | mixed | bad`. Map band→swatch
> color in the verdict/throne renderer ("Mixed signals" → `mixed` amber, first-class).

**Forming placeholder** (CONTEXT D-02 / 04-UI-SPEC) — reserved `panel-2 Surface` with a
`min-h` ≥ crystallized height (no layout shift, RESEARCH Pattern 2), muted "Forming the
read…" line, single `animate-skeleton-breathe` pulse (globals.css:293, `1.2s`), SUPPRESSED
under reduced motion. NO band, NO `/100`, NO spinner. APCA caveat (RESEARCH Pitfall 9):
pulse a non-text container OR verify the line passes APCA at 0.4 opacity.

---

### `src/app/(app)/reading/page.tsx` (route, live)

**Analog:** `src/app/(app)/analyze/page.tsx:1-15` + `analyze/layout.tsx:1-20` — the kept
board entry. Coexistence rule: do NOT touch `/analyze` (board stays for desktop until
Phase 7); add `/reading` as a NEW sibling under the SAME `(app)` group (auth + AppShell
inherited from `(app)/layout.tsx:14-35`).

**Metadata + page shape** (`analyze/page.tsx:1-6`):
```tsx
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Reading | Numen', description: '...' };
```
Unlike the analyze page (`return null` — Board mounts in layout), the reading page renders
the client `<ReadingThread />` directly (no shared-layout Board trick needed; the thread is
self-contained). The `(app)` group already provides server-side auth (`(app)/layout.tsx:17-23`).

---

### `src/app/(app)/reading/[id]/page.tsx` (route, resting RSC)

**Analog:** `src/app/(app)/competitors/[handle]/page.tsx:1-40` (auth-scoped RSC + Supabase
server client + `notFound()`) for the FETCH shape; `analyze/[id]/page.tsx:1-8` for the
`params: Promise<{ id }>` + `generateMetadata` shape.

**Server-component fetch pattern** (`competitors/[handle]/page.tsx:1-3`):
```tsx
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
// async server component; await params; supabase server read; notFound() on miss
```
**Resting-document parity (READ-06 / D-03d, RESEARCH Pattern 4):** fetch the row server-side
→ pass through `fromPersistedRow(row)` (`from-persisted-row.ts:87`) → hydrate the SAME
`<ReadingThread>` client component with `initialData` (overall_score != null) so the hook
short-circuits to `phase: 'complete'` (throne already crystallized, every slot filled). The
hook's `initialData` short-circuit is the documented mechanism (`use-analysis-stream.ts:89-92`
`UseAnalysisStreamOptions` / `result-card.tsx:9` "overall_score != null → all panels ready").
Do NOT fork the layout between live and resting; opens scrolled to the throne.

---

### `src/components/reading/install-hint.tsx` (component, localStorage)

**Analog:** `src/components/board/MobileBoardBanner.tsx:1-76` — the canonical SSR-safe
localStorage-dismissal pattern in this repo. Copy its structure exactly; swap the trigger
(viewport-width → `firstReadingComplete` + iOS standalone detection) and the chrome
(`GlassPanel` → numen `Surface` card, Phosphor `X` → Lucide `X`).

**Dismissal pattern to copy** (`MobileBoardBanner.tsx:8-50`):
```tsx
const STORAGE_KEY = 'numen-install-hint-dismissed';
function readDismissed(): boolean { try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return true; } }
function writeDismissed(): void { try { localStorage.setItem(STORAGE_KEY, '1'); } catch {} }

const [dismissed, setDismissed] = useState<boolean>(true);   // SSR-safe default
useEffect(() => { setDismissed(readDismissed()); }, []);     // hydrate on client
if (!show || dismissed) return null;
const handleDismiss = () => { writeDismissed(); setDismissed(true); };
```
**Trigger logic** (RESEARCH §iOS install coaching) — gate on `firstReadingComplete`,
`isStandalone()` (matchMedia `(display-mode: standalone)` + `navigator.standalone`), `isIOS()`.
Calm `Surface` card (NOT toast, NOT modal — CONTEXT D-04), UI-SPEC copy "Keep this on your
home screen / Tap Share, then Add to Home Screen." Dismiss via `IconButton` (always `aria-label`).

> Chrome difference: `MobileBoardBanner` uses `@phosphor-icons/react` + `GlassPanel` (legacy
> coral app). The install-hint lives in the Reading → Lucide-only (`X` from `lucide-react`,
> per `numen-kit/page.tsx:2-9` import style) + numen `Surface`, mounted under `.numen-surface`.

---

### `src/components/reading/reply-composer.tsx` (component, inert)

**Analog:** `src/components/numen/glass.tsx:36-55` — the ONE Glass surface in the Reading
(UI-SPEC: Glass is RARE, reserved for the composer ONLY). Blur via inline style (already
correct in `Glass` — Lightning CSS strips the utility-class form, RESEARCH Pitfall 5).

```tsx
import { Glass } from "@/components/numen/glass";
// inert: placeholder "Ask about this Reading…", disabled/non-focusable-to-send,
// no error on tap, no send handler (Phase 5/6 seam). CONTEXT D-01(c).
<Glass className="...">{/* disabled input shell */}</Glass>
```
Respects `env(safe-area-inset-bottom)` (pinned, iOS home-bar — RESEARCH Pitfall 7; safe-area
tokens don't exist yet, add inline-style handling). Agentic follow-up chips render inert via
`PillChip intent="agentic"` (`pill-chip.tsx:35` — faint accent ring is the allowed Phase-6 seam).

---

### Per-block components (`blocks/*.tsx`) — shared composition recipe

**Analog:** `src/components/numen/surface.tsx:34-45` (every evidence block IS a `Surface`) +
`src/app/(kit)/numen-kit/page.tsx:1-30` (the canonical composition/import recipe — every kit
primitive mounted under `.numen-surface`, Lucide imports, per-file import paths).

**Composition conventions (all block files):**
- Container = `<Surface>` (`bg-numen-panel`, hairline border, 12px radius). NEVER `Glass`
  (composer-only) and NEVER a `data-panel-*` grid card like the legacy `result-card.tsx`.
- Plain-language heading (18px sans semibold) from the UI-SPEC Copywriting map — NO engine
  jargon (READ-07): "What keeps them watching" not "Retention heatmap".
- Serif (`--font-serif`) ONLY in two places: the throne `why` and the **expert-insight lead
  line** (`expert-insight-block.tsx`). Serif nowhere else (UI-SPEC DS-04).
- `verdict-block.tsx`: render the demoted `/100` as a quiet 14px supporting chip in the BODY
  (`{score} / 100`, `text-numen-text-muted`, hairline border) — NEVER in the throne headline,
  NEVER accent (D-02a). Block shape: `view-model.ts:134-140`
  `{ band, why, confidenceLanguage, score }`.
- `audience-block.tsx`: intent chips via `PillChip intent="instant"` (`pill-chip.tsx:54-88`),
  Lucide icons. Block shape: `block-types.ts:70-77` `{ share, completion, comment, save, intents[] }`.
- `fixes-block.tsx`: items from `block-types.ts:79,94-99` (`Fix[]` — `headline`, optional `detail`).
- Reveal: each block wrapped in ONE `StageBlock show` at complete (`reading-thread.tsx` owns
  the wrap; the block component itself is presentation-only).
- XSS: React default JSX escaping for all dynamic engine text (`result-card.tsx:16-21` note);
  NEVER `dangerouslySetInnerHTML`.

---

### `src/app/manifest.ts` (config, metadata route)

**Analog:** `src/app/opengraph-image.tsx:1-8` — the existing sibling Next metadata route
(file-convention export, no import wiring). No `manifest.json` exists; use the RESEARCH
§Manifest verified example.

```ts
import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Numen — Content Intelligence", short_name: "Numen", start_url: "/",
    display: "standalone",
    background_color: "#1a1714", theme_color: "#1a1714",   // --numen-bg, HEX (Tailwind v4 oklch rule)
    icons: [ /* 192, 512, 512-maskable */ ],
  };
}
```
**Icon assets:** repo has `src/app/icon.svg` (367B) + `apple-icon.png` (1.2K) but NOT the
manifest PNG sizes (192/512/maskable). RESEARCH Open-Q3/A4 — planner adds an icon-generation
task if the sizes are missing. Add `viewportFit: "cover"` to the `layout.tsx` viewport export
(currently `layout.tsx:21-24`, missing it) for safe-area insets.

---

### `src/app/sw.ts` (config, service worker) — NO codebase analog

**Source:** RESEARCH §"Service worker entry (path A)" (Context7-verified). First service
worker in the repo. Key constraints from CONTEXT D-05 + RESEARCH Pitfall 4:
- `precacheEntries: self.__SW_MANIFEST` (app shell, static only) + `...defaultCache` from
  `@serwist/next/worker` (StaleWhileRevalidate).
- Runtime `NetworkFirst` for `/api/analysis/` (cache-on-view of opened Readings) — NEVER
  precache it (auth-gated 401; cross-user leak risk).
- NEVER cache `POST /api/analyze` (online-only engine, D-05).
- `disable: process.env.NODE_ENV === "development"` (SW off in dev; verify on Vercel preview).
- Gate the Serwist install behind a `checkpoint:human-verify` (`npm view @serwist/next`) —
  slopcheck was unavailable (RESEARCH Package Legitimacy Audit).

---

### `next.config.ts` (modify in place)

**Analog:** ITSELF (`next.config.ts:1-42`) — already wraps `withSentryConfig` in prod with a
dev/prod split. Compose `withSerwistInit` carefully with the existing Sentry HOC (RESEARCH
Assumption A2 — the planner must test the composed config). Path A (`withSerwistInit` +
`"build": "next build --webpack"`) is recommended; Next 16 defaults to Turbopack and the
classic plugin is webpack-only (RESEARCH Pitfall 1). The existing `webpack:` key
(`next.config.ts:9-18`, canvas external) confirms the repo already customizes webpack.

```ts
import withSerwistInit from "@serwist/next";
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts", swDest: "public/sw.js",
  cacheOnNavigation: true, disable: process.env.NODE_ENV === "development",
});
// compose with the existing dev/prod Sentry split (next.config.ts:33-41)
```
Add `public/sw.js` (generated build artifact, path A) to `.gitignore` (RESEARCH Runtime State
Inventory; current `.gitignore` has no sw entry).

---

## Shared Patterns

### The ONE motion (DS-07)
**Source:** `src/components/numen/stage-reveal.tsx:28-82`
**Apply to:** the throne crystallization AND every per-block reveal — wrap in `<StageBlock show>`.
Do NOT introduce any new entrance/presence motion (CONTEXT §Established Patterns; RESEARCH
Don't-Hand-Roll). Reduced-motion is handled inside (`reduce = useReducedMotion() !== false`,
fails safe on `null`).
```tsx
import { StageBlock } from "@/components/numen/stage-reveal";
<StageBlock show={revealed}><BlockSurface /></StageBlock>
```

### `.numen-surface` scope class (load-bearing)
**Source:** `src/app/globals.css:356-392`
**Apply to:** the thread root container (one `<div className="numen-surface">` wrapping the
whole Reading). Every `bg-numen-*` / `text-numen-*` / `border-numen-border` / verdict color
resolves ONLY inside this scope; outside it those vars are undefined and break. The legacy
coral `@theme` (`bg-accent`, `border-border`) MUST NOT appear anywhere in the thread.

### tailwind-variants `tv()` named-export kit pattern
**Source:** `surface.tsx:20-22`, `verdict-swatch.tsx:21-36`, `pill-chip.tsx:26-40`,
`icon-button.tsx:21-23`
**Apply to:** any NEW reading primitive that needs variants — export a `tv()` result as a
named lowercase const (`export const surface = tv({...})`), compose the caller `className`
through `cn()` so external overrides win, expose `VariantProps<typeof x>`. Use LITERAL class
strings, never `bg-${dynamic}` interpolation (verdict-swatch.tsx:11 warning). Most blocks just
COMPOSE `Surface`/`PillChip` and won't need a new `tv()`.

### Lucide-only icons inside the Reading (D-09)
**Source:** `src/app/(kit)/numen-kit/page.tsx:1-9` (Lucide import style); `pill-chip.tsx:84`
`[&>svg]:size-4` SVG-constrain pattern
**Apply to:** all reading components. Import from `lucide-react`, NOT the Phosphor
`@/components/ui/icon` wrapper (which the legacy board / `MobileBoardBanner.tsx:3-4` uses).

### View-model is all-at-complete (the crux discipline)
**Source:** `src/lib/reading/view-model.ts:52,129` + `use-analysis-stream.ts:97-108`
**Apply to:** `reading-thread.tsx` and `[id]/page.tsx`. Real blocks exist ONLY at
`phase === 'complete'` (live) or via `initialData` short-circuit (resting). Mid-stream =
content-free placeholders keyed to `panelReady`. NEVER call `canonicalFromLive(result)` on a
null/partial result (RESEARCH Pitfall 3). Throne stays "forming" until complete (D-02).

### Honest omit-discipline (D-14)
**Source:** `view-model.ts:144-187` (conditional `blocks.push`)
**Apply to:** `block-view.tsx` + all blocks. Render only emitted blocks; never an empty shell
for an absent one. `retention-degraded` / `analysis-degraded` are FIRST-CLASS honest blocks
(`block-types.ts:67-68,86-87`), never a red error toast.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/app/sw.ts` | config (service worker) | file-I/O | First service worker in the repo. Use RESEARCH §"Service worker entry (path A)" (Context7-verified Serwist 9 API). |
| `src/app/manifest.ts` | config (metadata route) | file-I/O | No `manifest.json` / manifest route exists. `opengraph-image.tsx` is the closest *metadata-route* sibling (file convention), but the manifest body is new — use RESEARCH §Manifest. |
| (icon PNG assets 192/512/maskable) | asset | file-I/O | Repo has `icon.svg` + `apple-icon.png` only; manifest PNG sizes absent. Planner adds a generation task (RESEARCH Open-Q3). |

---

## Metadata

**Analog search scope:** `src/components/numen/`, `src/lib/reading/`, `src/lib/engine/`,
`src/app/(app)/` (analyze, competitors, layout), `src/app/` (layout, opengraph-image,
metadata routes), `src/hooks/queries/`, `src/components/board/` (localStorage/dismissible),
`next.config.ts`, `globals.css`, `.gitignore`, `public/`.
**Files scanned:** ~30 (read 18 in full, grep-targeted ~12).
**Pattern extraction date:** 2026-06-12
