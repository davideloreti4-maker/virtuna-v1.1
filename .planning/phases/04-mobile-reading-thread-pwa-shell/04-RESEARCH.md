# Phase 4: Mobile Reading Thread + PWA Shell - Research

**Researched:** 2026-06-12
**Domain:** Next.js 16 App Router presentation layer — SSE-reshape rendering, calm motion choreography, installable PWA (Serwist)
**Confidence:** HIGH (repo code read directly; Serwist setup verified via Context7 + official docs + npm; only the mid-stream-reveal *design choice* is a flagged open question, not a fact gap)

## Summary

Phase 4 is **presentation-only**. The engine is frozen at ENGINE_VERSION 3.19.0 and the Phase-2 view-model already decides *what is true*. This phase renders `ReadingBlock[]` into a mobile thread, reshapes the **existing** SSE `StageEvent` stream into a staged block reveal, choreographs a reserved verdict "throne" that crystallizes last, and ships a Serwist PWA shell. No `lib/engine/` edits, no new transport, no new view-model.

The single most important architectural finding — **the crux** — is that the view-model is **all-at-complete, not incremental**. `toReadingBlocks(canonical)` consumes a full `CanonicalReading`, which is only assembled from the `complete` SSE payload (`canonicalFromLive(result)`). Mid-stream, the only signal available is the named-stage `stage_start`/`stage_end` events (`wave_1`, `wave_2`, `wave_3_personas`, `aggregator`, plus post stages) and their derived per-panel readiness map (`panelReadyFromStages`). **There is no intermediate per-block data.** Therefore Phase 4 does NOT reveal real block *content* progressively — it reveals **calm placeholder slots** keyed to stage completion, then swaps each slot's real content in at `complete` when the blocks materialize. This is honest (no fabricated partial data) and matches D-02's "no fake provisional band" doctrine exactly. The throne holds a "forming" placeholder the entire stream and crystallizes once, at `complete`. (See Crux Question, below — this is the load-bearing decision the planner must lock.)

The second landmine is **Serwist × Next 16 × Turbopack**. Next 16 builds with Turbopack by default; the classic `withSerwistInit` plugin is webpack-only. Two valid paths exist (documented below). Recommendation: use the classic `withSerwistInit` plugin + `next build --webpack` for production builds (mature, well-trodden, `app/manifest.ts` + `app/sw.ts`), unless the team wants to keep Turbopack builds, in which case use `@serwist/turbopack`'s route-handler approach.

**Primary recommendation:** Build the thread as a client component driven by the existing `useAnalysisStream` hook. Map `panelReady` (stage readiness) → placeholder slots in the curated D-03a order; at `phase === 'complete'`, run `toReadingBlocks(canonicalFromLive(result))` once and fill every slot's real content via one `StageBlock` reveal each; crystallize the throne with one `StageBlock` motion. Ship Serwist via `withSerwistInit` + `next build --webpack`, `app/manifest.ts`, runtime-cache the app shell (StaleWhileRevalidate) and the per-session `/api/analysis/[id]` GET (NetworkFirst, never precached — it is auth-gated), and coach iOS install with a dismissible post-first-Reading hint.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**A. Thread framing & metaphor (READ-01)**
- **D-01:** Document-as-first-turn inside a minimal thread shell (hybrid). ONE rich, single-column structured turn (verdict throne leading, blocks below) — NOT 10 chat bubbles, NO avatar/bubble chrome. Lives inside a thread container that (a) pronounces first with no preceding user message, (b) carries the persistent "analyze new" action, (c) reserves the bottom for the Phase-5 "ask the expert" reply input — **present but inert/deferred in Phase 4**.

**B. Throne reveal behavior (READ-03)**
- **D-02:** Reserved calm "forming" placeholder → crystallize last (one motion). Throne present and reserved from t0 with a quiet neutral "forming the read…" state (NO band, NO number). Evidence blocks stage-reveal below it. At `complete`, band + one-sentence why crystallizes into the throne via the single DS-07 calm motion — the climax.
- **D-02a:** The demoted `/100` number appears only as in-body supporting evidence within the verdict block (per 02 D-07), NEVER in the throne headline. "Mixed signals" is a first-class throne state alongside the three bands.
- Rejected: provisional updating band (dishonest + unavailable from the engine); blank-then-drop-in (loses the "forming" reservation that builds the climax).

**C. Block order & pacing (READ-02 / READ-05)**
- **D-03:** Curated narrative order + streaming-driven reveal timing. Phase 4 OWNS render order (view-model emits pure data, NO order hints — 02 D-13). Sequence is FIXED; each block animates into its reserved slot as its underlying engine stage completes.
- **D-03a:** Proposed curated order (planner may tune within intent): Throne (verdict) → **Expert insight (Apollo)** → Hook → Retention → Audience → Drivers → Persona-read → Fixes → Content-summary → Audio *(conditional)*.
- **D-03b:** Apollo expert-insight pinned directly beneath the throne — foregrounded, never buried by late stage-completion (READ-05).
- **D-03c:** Pacing = as-soon-as-ready within fixed slots. No artificial one-at-a-time gating. Calm per-block reveal (DS-07). Throne crystallizes LAST regardless of being positioned first.
- **D-03d:** Resting-document re-open uses the SAME curated order → re-opened Reading looks identical to the live render, minus streaming delays.

**D. PWA install + offline scope (SHELL-04)**
- **D-04:** Install coaching = passive, post-first-Reading hint + a quiet menu affordance. Dismissible hint AFTER the first completed Reading coaching the iOS "Share → Add to Home Screen" flow, plus an always-available install affordance in the menu. NEVER a blocking modal. Dismissal is remembered.
- **D-05:** Offline scope = app shell offline + cache-on-view of opened Readings. Already-opened Readings cache as static resting documents (re-openable offline via the view-model from the persisted row). New analysis stays online-only. Serwist runtime caching of the app shell + the analysis GET route on view.
- Rejected: blocking install modal (anti-calm); offline-first full-history sync (Phase 5 owns the list).

### Claude's Discretion
- Exact "forming" affordance visual for the throne placeholder (within D-02's calm/no-fake-band intent) — researcher/planner + UI-phase call.
- Exact verdict-block visual treatment of the demoted `/100` (small chip vs tap-to-expand) and the distinct "Mixed signals" visual — UI-phase owns the design contract. **(NOTE: the 04-UI-SPEC has already DECIDED several of these — see Project Constraints below. The /100 = quiet supporting chip in the verdict block body; "Mixed signals" = amber swatch, first-class.)**
- Precise per-block layout, the thread-shell chrome details, and the inert reply-input styling.
- Serwist config specifics (precache manifest, runtime cache strategies, `maxDuration` interplay) — researcher maps; this is architecture, not a visionary decision.
- Whether the curated order (D-03a) collapses/groups any low-value blocks on small viewports.

### Deferred Ideas (OUT OF SCOPE)
- **"Ask the expert" conversation round-trip** — reply input ships as an inert shell in P4; actual follow-up Q&A / agentic tools = Phase 5/6.
- **Home list of past Readings + per-video routing + ingestion** (SHELL-01/02/03, IN-*) = Phase 5.
- **Offline-first full-history sync** — beyond cache-on-view; deferred (Phase 5+ owns the list).
- **Desktop instrument (Konva keep-vs-retire)** = Phase 7.
- **iOS native share-sheet ingestion** → Capacitor milestone (WebKit #194593).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| READ-01 | AI pronounces first, unprompted — the Reading is the thread's first turn; user never faces a blank prompt | Thread shell renders the Reading turn immediately on stream start; the "forming" throne + placeholder slots ARE the first turn (no empty composer-first screen). Pattern: render the structured turn the moment `start()` fires. |
| READ-02 | Stage-reveal — each completed engine stage materializes its structured block (NOT token-streaming); reshape existing `StageEvent`/SSE into the Reading's block vocabulary | **Crux.** Map named-stage completions (`wave_1`/`wave_2`/`wave_3_personas`/`aggregator`) → placeholder slots reveal; real block content fills at `complete`. See SSE→Block Mapping + Crux Question. |
| READ-03 | Verdict in a reserved top "throne" slot, visibly forming while evidence assembles, crystallizing last as the climax | Throne = reserved `panel-2 Surface` from t0 with calm "forming the read…" placeholder; crystallizes via ONE `StageBlock` at `complete`. The HELD reserved presence + accruing evidence below IS "visibly forming" (no fake band). |
| READ-04 | Verdict = calibrated band + one-sentence why; confidence in band language, never a hedge | Already derived by the view-model (`verdict` block: `band`, `why`, `confidenceLanguage`, `score`). Phase 4 renders it; uses `VerdictSwatch` + `VERDICT_BANDS.label`. |
| READ-05 | ~10 evidence blocks re-composed from value-bearing engine fields, with expert insight (Apollo) foregrounded, not buried | View-model emits 11-kind union; Phase 4 renders in curated order with `expert-insight` pinned at slot 2 (under throne) regardless of its late `wave_2` stage completion. |
| READ-06 | A completed Reading persists as a re-openable resting document that opens on the verdict | Resting path uses `fromPersistedRow(row)` → `toReadingBlocks` → SAME render, no streaming, throne already crystallized. Opens scrolled to the verdict. Identical-render is the Phase-2 deep-equal guarantee (GREEN on `WEkihfOzJphv`). |
| READ-07 | Plain language throughout — calm restraint, NO engine jargon surfaced | Block-heading plain-language map locked in 04-UI-SPEC Copywriting Contract. No engine field names in any heading/body. |
| SHELL-04 | Installable PWA (Serwist + `manifest.ts`) with mobile-native feel + iOS add-to-home coaching | Serwist `withSerwistInit` + `app/manifest.ts` + `app/sw.ts`; iOS coaching = dismissible post-first-Reading hint; safe-area insets + 390px no-overflow + momentum scroll. See PWA Architecture. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Live SSE consume + stage tracking | Browser / Client (existing `useAnalysisStream`) | API (`/api/analyze` POST stream) | The hook owns transport + reconnect ladder; Phase 4 only consumes its return. The stream is server-produced. |
| `StageEvent` → block-slot reveal mapping | Browser / Client (new Phase-4 reshape layer) | — | Pure derivation from hook state; no server work. The curated order + placeholder logic is presentation. |
| Block content derivation (`toReadingBlocks`) | Browser / Client (at-mount, pure) | — | View-model is pure + runs client-side at `complete` (live) or at-mount (resting). No server compute. |
| Throne crystallization motion | Browser / Client (`StageBlock` / DS-07) | — | CSS/JS motion only. Reduced-motion handled in the kit. |
| Resting-document fetch | API (`GET /api/analysis/[id]`, auth-scoped) | Database (Supabase RLS) | Server route does the ownership-scoped read + `fromPersistedRow`. Auth-gated — cannot be precached. |
| App-shell + resting-Reading caching | Browser / Client (Service Worker, Serwist) | CDN (Vercel static) | SW intercepts navigations + the analysis GET; precache = static shell only. |
| PWA install + manifest | Browser / Client (manifest, install coaching) | CDN (static manifest/icons) | `app/manifest.ts` is a Next metadata route; install UX is client-only. |
| New analysis (POST `/api/analyze`) | API (server engine) | — | **Online-only by decision (D-05).** SW must NOT cache this POST. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.1.5 [VERIFIED: package.json] | App Router, metadata routes (`manifest.ts`), the host framework | Already the repo framework; frozen at this version per STATE.md |
| `react` / `react-dom` | 19.2.3 [VERIFIED: package.json] | Client components, the thread surface | Repo standard |
| `motion` | ^12.29.2 [VERIFIED: package.json] | The DS-07 calm reveal motion (`StageBlock` already built on `motion/react`) | New code standardizes on `motion` (D-10); the kit's `stage-reveal.tsx` already imports `motion/react` |
| `@tanstack/react-query` | ^5.90.21 [VERIFIED: package.json] | Already drives `useAnalysisStream` polling/permalink fetch | In-place; Phase 4 reuses, does not add |
| `tailwind-variants` | ^3.2.2 [VERIFIED: package.json] | The kit primitives (`surface`, `pillChip`, etc.) expose `tv()` results | Phase 1 kit pattern |
| `@serwist/next` | 9.5.11 [VERIFIED: npm registry — Context7-confirmed] | PWA service worker generation + Next plugin (`withSerwistInit`) | The chosen PWA tool (vision §stack: Serwist over next-pwa); latest stable, published 2026-05-03 |
| `serwist` | 9.5.11 [VERIFIED: npm registry — Context7-confirmed] | The service-worker runtime (`Serwist` class, caching strategies `NetworkFirst`/`StaleWhileRevalidate`) | Core dep of `@serwist/next`; provides `defaultCache` via `@serwist/next/worker` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@serwist/turbopack` | 9.5.11 [VERIFIED: npm registry] | ALTERNATIVE to `withSerwistInit` — serves the SW from a route handler, keeps Turbopack builds | ONLY if the team rejects `next build --webpack`. Requires `esbuild` or `esbuild-wasm` peer. See PWA Architecture path B. |
| `esbuild` / `esbuild-wasm` | >=0.25.0 [CITED: npm peerDependencies] | Peer of `@serwist/turbopack` (the route handler compiles the SW) | Only with path B |
| `lucide-react` | ^0.563.0 [VERIFIED: package.json] | Icons inside the Reading (D-09: Lucide only, NOT the Phosphor wrapper) | Already present; the UI-SPEC mandates Lucide-only inside the thread |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@serwist/next` (`withSerwistInit`, webpack build) | `@serwist/turbopack` (route handler, Turbopack build) | Webpack path is more documented + mature but forces `next build --webpack` (slower than Turbopack, loses the Next-16 default). Turbopack path keeps fast builds but is newer, serves SW from a dynamic route (`/serwist/sw.js`) not `public/sw.js`, and needs an esbuild peer. **Recommend webpack path** unless build-speed regression is unacceptable. |
| Custom SSE→block reshape | — | None — the reshape is bespoke presentation logic Phase 4 owns. No library applies. |
| `next-pwa` | (rejected) | Unmaintained; explicitly out of scope (REQUIREMENTS.md "Out of Scope"). |
| Hand-rolled service worker | Serwist precache+runtime | Workbox-class concerns (precache manifest, cache versioning, navigation fallback) are exactly what you must not hand-roll. |

**Installation (recommended path A — webpack build):**
```bash
pnpm add @serwist/next serwist
```
**Installation (alternative path B — Turbopack build):**
```bash
pnpm add @serwist/next serwist
pnpm add -D @serwist/turbopack esbuild
```

> **NOTE on the LogRocket article's install line** (`npm install @serwist/next @serwist/precaching @serwist/sw idb`): `@serwist/precaching`, `@serwist/sw`, and `idb` all EXIST on npm (verified) but are **NOT needed** for the current Serwist 9 API — precaching + strategies are folded into the core `serwist` package and `defaultCache` is imported from `@serwist/next/worker`. Do not install the extras unless a specific need arises. [VERIFIED: npm — all three resolve, but redundant per Context7 docs]

**Version verification performed:**
- `@serwist/next@9.5.11` — published 2026-05-03 [VERIFIED: `npm view`]. Peers: `next >=14.0.0` (covers 16.1.5), `react >=18.0.0`, `typescript >=5.0.0`. No postinstall script.
- `serwist@9.5.11` — published 2026-05-03 [VERIFIED]. No postinstall.
- `@serwist/turbopack@9.5.11` — published 2026-05-03 [VERIFIED]. Peers: `esbuild >=0.25.0 <1.0.0` OR `esbuild-wasm`, `next >=14.0.0`. No postinstall.
- A `10.0.0-preview.14` preview tag exists for all Serwist packages — **do NOT use the preview**; stay on `latest` (9.5.11). Serwist 10 will drop Next <15 support and may change the Turbopack API.

## Package Legitimacy Audit

> slopcheck could not be installed in this session (no `slopcheck` on PATH after pip attempt). Per protocol, packages are corroborated via **Context7 (official Serwist docs) + npm registry metadata** (age, no postinstall, correct peers). Serwist is a well-known Workbox fork with high Context7 source reputation; these are NOT assumed-from-training names.

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| `@serwist/next` | npm | published 2026-05-03 (active) | github.com/serwist/serwist | unavailable | Approved (Context7-confirmed, no postinstall, peer next>=14) |
| `serwist` | npm | published 2026-05-03 (active) | github.com/serwist/serwist | unavailable | Approved (Context7-confirmed, no postinstall) |
| `@serwist/turbopack` | npm | published 2026-05-03 (active) | github.com/serwist/serwist | unavailable | Approved-conditional (only path B; Context7 turbo docs confirm) |
| `esbuild` | npm | mature, ubiquitous | github.com/evanw/esbuild | unavailable | Approved (path B peer; canonical build tool) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable. Per protocol, the planner SHOULD gate the Serwist install behind a `checkpoint:human-verify` task (a one-line `npm view @serwist/next` confirmation) before install, even though all four packages are corroborated by Context7 + registry metadata. This is the conservative posture, not a real doubt about Serwist's legitimacy.*

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────────┐
   USER ACTION      │              MOBILE READING THREAD               │
   "Analyze new" ──▶│              (client component)                  │
                    │                                                  │
                    │  ┌────────────────────────────────────────────┐ │
   ┌────────────┐   │  │  useAnalysisStream()  (EXISTING hook)       │ │
   │ /api/analyze│◀─┼──┤  start(input) ──▶ POST body-reader SSE      │ │
   │  POST (SSE) │   │  │                                            │ │
   │  ONLINE-ONLY│──▶┼──┤  returns: { phase, stages[], result,       │ │
   │  (server    │   │  │            panelReady, analysisId, ... }   │ │
   │   engine)   │   │  └──────────────┬─────────────────────────────┘ │
   └────────────┘   │                 │                                │
                    │     ┌───────────▼────────────┐                   │
                    │     │  RESHAPE LAYER (NEW)    │                   │
                    │     │  panelReady → slot      │                   │
                    │     │  readiness in curated   │                   │
                    │     │  D-03a order            │                   │
                    │     └───────────┬─────────────┘                  │
                    │                 │                                │
                    │   phase!=='complete'        phase==='complete'   │
                    │        │                          │              │
                    │        ▼                          ▼              │
                    │  ┌──────────────┐    ┌──────────────────────┐    │
                    │  │ THRONE:      │    │ toReadingBlocks(      │    │
                    │  │ "forming…"   │    │  canonicalFromLive(   │    │
                    │  │ placeholder  │    │    result))           │    │
                    │  │              │    │  → ReadingBlock[]     │    │
                    │  │ SLOTS:       │    │                       │    │
                    │  │ stage-keyed  │    │ THRONE crystallizes   │    │
                    │  │ placeholders │    │ (1 StageBlock motion) │    │
                    │  │ reveal as    │    │ + each block fills    │    │
                    │  │ stages end   │    │ its slot (1 each)     │    │
                    │  └──────────────┘    └──────────────────────┘    │
                    └─────────────────────────────────────────────────┘

   RESTING RE-OPEN PATH (READ-06, offline-capable):
   ┌──────────────┐    ┌─────────────────────┐    ┌──────────────────────┐
   │ /reading/[id]│───▶│ GET /api/analysis/  │───▶│ fromPersistedRow(row)│
   │  navigation  │    │ [id]  (auth-scoped, │    │  → toReadingBlocks   │
   │              │    │  NetworkFirst cache)│    │  → SAME render,      │
   │              │◀───│  (Service Worker)   │◀───│  throne crystallized,│
   └──────────────┘    └─────────────────────┘    │  opens on verdict    │
                                                   └──────────────────────┘

   PWA SHELL (Serwist Service Worker):
   - Precache: static app shell (HTML/JS/CSS, manifest, icons)         [StaleWhileRevalidate]
   - Runtime:  GET /api/analysis/[id]  on view                         [NetworkFirst, NOT precached]
   - NEVER cache: POST /api/analyze  (online-only engine)
```

### Recommended Project Structure
```
src/
├── app/
│   ├── manifest.ts              # NEW — Next metadata route, MetadataRoute.Manifest
│   ├── sw.ts                    # NEW — Serwist service-worker entry (or app/serwist/[path]/route.ts for path B)
│   ├── (app)/
│   │   └── reading/             # NEW — the mobile thread surface (route TBD by planner; sits alongside the kept /analyze board)
│   │       ├── [id]/page.tsx    #   resting-document re-open (RSC fetch → client thread)
│   │       └── page.tsx         #   live new-analysis thread
│   └── ...
├── components/
│   └── reading/                 # NEW — Phase 4 render components (compose the numen kit; do NOT re-roll primitives)
│       ├── reading-thread.tsx   #   client; drives useAnalysisStream, owns slot order
│       ├── throne.tsx           #   reserved slot: forming placeholder ↔ crystallized verdict
│       ├── blocks/              #   one renderer per ReadingBlock.kind (verdict/expert-insight/hook/...)
│       ├── install-hint.tsx     #   iOS add-to-home coaching (dismissible, localStorage)
│       └── reply-composer.tsx   #   inert Glass shell (Phase-5 seam)
├── lib/
│   └── reading/                 # EXISTING — view-model, block-types, verdict-bands (DO NOT EDIT — Phase 2 locked)
│       └── stage-slots.ts       # NEW (optional) — pure map: PanelReadyState → curated slot reveal state
└── hooks/queries/
    └── use-analysis-stream.ts   # EXISTING — reshape its output; do NOT modify
```

### Pattern 1: SSE-stage → block-slot reveal (the reshape)
**What:** Drive a fixed ordered list of slots from the hook's `panelReady` map (stage readiness), not from block content (which only exists at `complete`).
**When to use:** The live thread, before `phase === 'complete'`.
**Concrete mapping** (derived from `src/lib/engine/panel-mapping.ts` `STAGE_TO_PANEL` + the curated D-03a order):

| Curated slot (D-03a) | ReadingBlock.kind | Drives off stage | `panelReady` key | When the slot's placeholder reveals |
|----------------------|-------------------|------------------|------------------|--------------------------------------|
| 1. Throne | `verdict` | `aggregator` | `verdict` | Slot RESERVED from t0; stays "forming" until `complete` (D-02) |
| 2. Expert insight | `expert-insight` | `wave_2` | `insight_hero` / `reasoning` | When `wave_2` ends (Apollo paints both per `STAGE_TO_PANEL`) |
| 3. Hook | `hook` | `wave_1` | `hook_decomp` | When `wave_1` ends |
| 4. Retention | `retention` / `retention-degraded` | `wave_3_personas` | `retention` | When `wave_3_personas` ends |
| 5. Audience | `audience` | `wave_3_personas` | `persona_breakdown` | When `wave_3_personas` ends |
| 6. Drivers | `drivers` | `aggregator` | `verdict`/`comparative_baseline` | When `aggregator` ends |
| 7. Persona-read | `persona-read` | `wave_3_personas` | `persona_breakdown` | When `wave_3_personas` ends |
| 8. Fixes | `fixes` | `aggregator` (suggestions) | `verdict` | When `aggregator` ends |
| 9. Content-summary | `content-summary` | `aggregator` (craft persist) | `verdict` | When `aggregator` ends / at `complete` |
| (degraded) | `analysis-degraded` | derived at `complete` | — | At `complete` only (depends on `signal_availability`) |

**Note:** There is NO `audio` block (dropped Phase 2 — `audio_fingerprint` is live-only). Do not render an audio slot. (block-types.ts header confirms.)

**Example (slot reveal, placeholder vs content):**
```tsx
// Source: derived from src/hooks/queries/use-analysis-stream.ts (panelReady) +
//         src/lib/engine/panel-mapping.ts (STAGE_TO_PANEL) + src/lib/reading/view-model.ts
"use client";
import { useAnalysisStream } from "@/hooks/queries/use-analysis-stream";
import { toReadingBlocks, canonicalFromLive } from "@/lib/reading/view-model";
import { StageBlock } from "@/components/numen/stage-reveal";

function ReadingThread() {
  const { phase, panelReady, result, start } = useAnalysisStream();

  // Real blocks ONLY exist at complete — the view-model is all-at-complete.
  const blocks = phase === "complete" && result
    ? toReadingBlocks(canonicalFromLive(result))
    : [];

  // Pre-complete: render placeholder slots keyed to stage readiness.
  // Post-complete: render real block content. Throne handled separately (always reserved).
  return (
    <div className="numen-surface">
      <Throne phase={phase} block={blocks.find(b => b.kind === "verdict")} />
      {CURATED_ORDER.map(({ kind, panelKey }) => {
        const ready = panelReady[panelKey] === "ready";
        const block = blocks.find(b => b.kind === kind);
        if (phase === "complete") {
          // honest omit-discipline: no block emitted → render nothing (D-14)
          return block ? <StageBlock key={kind} show><BlockView block={block} /></StageBlock> : null;
        }
        // pre-complete: reveal a calm placeholder slot when its stage is ready
        return <StageBlock key={kind} show={ready}><BlockPlaceholder kind={kind} /></StageBlock>;
      })}
    </div>
  );
}
```

### Pattern 2: Throne reserved-slot crystallization (no layout shift)
**What:** A top slot that reserves vertical space, holds a "forming" placeholder, then swaps to the verdict content WITHOUT the page jumping.
**When to use:** The throne, always.
**How:** Render the throne `Surface` (panel-2) with a min-height that fits both states, or render the forming placeholder and the verdict in the same container so the swap is opacity+content, not insert. At `complete`, conditionally render the verdict content inside one `StageBlock show`. Crystallize ONCE.
```tsx
// Source: src/components/numen/stage-reveal.tsx (DS-07 motion) + 04-UI-SPEC Throne reveal
function Throne({ phase, block }: { phase: AnalysisStreamPhase; block?: VerdictBlock }) {
  const crystallized = phase === "complete" && block;
  return (
    <Surface className="bg-numen-panel-2 p-6 min-h-[180px]" style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}>
      {!crystallized ? (
        // calm forming placeholder — NO band, NO number, NO spinner.
        // ONE soft pulse via animate-skeleton-breathe (suppress under reduced-motion).
        <FormingPlaceholder />
      ) : (
        <StageBlock show>
          <VerdictSwatch band={block.band} />
          <h1 className="text-[30px] font-semibold leading-[1.1]">{bandLabel(block.band)}</h1>
          <p className="font-serif text-[20px] leading-[1.25]">{block.why}</p>
          <p className="text-[14px] text-numen-text-muted">{block.confidenceLanguage}</p>
        </StageBlock>
      )}
    </Surface>
  );
}
```
**Layout-shift avoidance:** the `Surface` keeps a `min-h` ≥ the crystallized height so reserving the slot does not jump when content fills. The crystallization is opacity+small-translate (the StageBlock), never a height animation.

### Pattern 3: aria-live announce-once (avoid the storm)
**What:** Announce the verdict to screen readers ONCE at crystallization, never per-block.
**How:** A single `aria-live="polite"` region that is EMPTY during streaming and receives the verdict text only at `complete`. Do NOT put `aria-live` on each revealing block.
```tsx
// Source: 04-UI-SPEC Accessibility (announce verdict ONCE, polite)
<div aria-live="polite" className="sr-only">
  {phase === "complete" && block ? `${bandLabel(block.band)}. ${block.why}` : ""}
</div>
```

### Pattern 4: Resting-document parity (READ-06 / D-03d)
**What:** Re-opened Reading renders identically to live, minus streaming.
**How:** Server route fetches the row (`GET /api/analysis/[id]`), passes through `fromPersistedRow` → client runs `toReadingBlocks` at mount → renders the SAME curated order with `phase` effectively `complete` from the start (throne already crystallized, every slot filled). Opens scrolled to the verdict (`scrollIntoView` on the throne ref, or initial scroll position at the throne). **Do NOT branch the layout between live and resting** — same component, `phase` is the only difference. The deep-equal (`identical-render.test.ts`) is the proof the data is identical; Phase 4 must not introduce a render fork that breaks the felt parity.

### Anti-Patterns to Avoid
- **Deriving partial blocks mid-stream from `stages[]`.** The view-model is all-at-complete by design; fabricating partial block content would reintroduce exactly the "confident lie" the Phase-3 gate kills. Reveal PLACEHOLDERS on stage completion, real CONTENT at `complete`. (See Crux Question.)
- **A provisional/updating throne band.** Forbidden by D-02 — the engine `overall_score` only resolves at `complete`. The throne is "forming" (reserved, anticipatory), never a changing number.
- **`aria-live` on every block.** Creates the announce storm (04-UI-SPEC explicitly forbids). One polite region, announce verdict once.
- **Caching `POST /api/analyze` in the service worker.** Online-only by D-05. Serwist `defaultCache` won't cache POST by default, but the SW config must not add it.
- **Precaching `GET /api/analysis/[id]`.** It is auth-gated (returns 401 without a session). Precaching a per-user authenticated response risks cross-user leakage. Use NetworkFirst runtime caching keyed per session, never the precache manifest. (See Pitfall 4.)
- **`backdrop-filter` via Tailwind utility class.** Lightning CSS strips it in production. Glass blur MUST be inline style (the kit's `Glass` already does this — verified live on deployed build per STATE.md). The inert reply composer is the only Glass surface.
- **Rendering an empty shell for an omitted block.** Honest omit-discipline (D-14): the view-model silently omits absent blocks; render nothing, never a placeholder card for a missing block (distinct from the pre-complete forming placeholders, which are for blocks that WILL arrive).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Service worker precache + cache versioning + navigation fallback | Custom SW with manual `caches.open`/fetch handlers | Serwist `Serwist` class + `defaultCache` / `precacheEntries: self.__SW_MANIFEST` | Workbox-class edge cases (stale precache, cache cleanup, offline navigation) — solved problem |
| PWA manifest | Hand-written `public/manifest.json` | `app/manifest.ts` (`MetadataRoute.Manifest`) | Next App Router metadata route; type-safe, hashed, served correctly |
| SSE transport + reconnect ladder | New EventSource/fetch reader | EXISTING `useAnalysisStream` | Already built: POST body-reader → EventSource → polling fallback, visibility-aware, abort/reset. Reshape its output. |
| Reveal motion | New spring/tween config | EXISTING `StageBlock` (`stage-reveal.tsx`) | DS-07 calm motion is locked; reduced-motion handled; one motion for the whole product |
| Verdict band derivation | New thresholds | EXISTING `bandFor` / `VERDICT_BANDS` / `inDeadBand` | Phase-3 calibration target; "Mixed signals" dead-band logic already wired |
| Block content derivation | New field-mapping | EXISTING `toReadingBlocks` / `canonicalFromLive` / `fromPersistedRow` | Phase-2 locked; deep-equal-proven parity |
| iOS install detection | New UA sniffing | `window.matchMedia('(display-mode: standalone)')` + `navigator.standalone` | Standard feature-detection; UA sniffing is brittle |

**Key insight:** Nearly everything Phase 4 needs already exists. The phase's real work is **composition + choreography + the PWA shell**, not new logic. The two genuinely new pieces are (a) the SSE-stage→slot reshape layer and (b) the Serwist config + manifest + install coaching. Everything else is rendering locked contracts.

## Crux Question: Is the view-model incremental or all-at-complete?

**ANSWER: all-at-complete.** [VERIFIED: read `src/lib/reading/view-model.ts`, `block-types.ts`, `use-analysis-stream.ts`]

- `toReadingBlocks(c: CanonicalReading)` consumes a complete `CanonicalReading`. There is no per-stage partial variant.
- `canonicalFromLive(result: PredictionResult)` reads top-level fields (`result.hero`, `result.apollo_reasoning`, `result.factors`, etc.) that are ONLY populated in the `complete` SSE payload. The live `complete` event carries the full flat `PredictionResult` (verified against `live-WEkihfOzJphv.json`: 50+ top-level keys including `hero`, `apollo_reasoning`, `heatmap`, `factors`, `behavioral_predictions`, `suggestions`).
- Mid-stream, `useAnalysisStream` exposes `stages: StageEvent[]` (a log of `stage_start`/`stage_end`/`pass2_*`/`filmstrip_*` events) and the derived `panelReady: Record<PanelId, PanelReadyState>` map. **Neither carries block content** — only stage identity, timing, ok/error, and (for personas) per-persona partials + filmstrip URLs. None of these map to `ReadingBlock` data shapes.

**Therefore, how do blocks reveal progressively mid-stream?**
They do NOT reveal real content progressively. The honest, locked-decision-compatible pattern is:
1. **Pre-`complete`:** render reserved slots in the curated order; reveal a **calm placeholder** for each slot when its driving stage ends (`panelReady[key] === 'ready'`). The throne shows "forming the read…". This satisfies READ-02 "stage-reveal" (legible progress) and READ-03 "visibly forming" without fabricating data.
2. **At `complete`:** run `toReadingBlocks(canonicalFromLive(result))` once; fill each slot's real content via one `StageBlock` reveal; crystallize the throne via one `StageBlock` motion.

This is the ONLY approach consistent with D-02 ("no real provisional band exists mid-stream") and the Phase-3 anti-confident-lie doctrine. **The planner must lock this** — it is the single most consequential design decision in the phase, and it is already aligned with every locked CONTEXT decision.

**Secondary consideration (planner's call):** if a richer mid-stream feel is wanted, the per-stage `stage_end` events do carry SOME real fragments that COULD seed a placeholder's "skeleton with a hint" (e.g. `wave_3_personas` end implies retention/audience data is computed). But surfacing any of it as user-facing numbers before `complete` re-opens the honesty risk. Recommendation: keep placeholders content-free (skeleton + label only) until `complete`.

## Runtime State Inventory

> This is a greenfield-render phase (new components + new PWA files), NOT a rename/refactor. No stored data, live-service config, OS-registered state, or secrets are renamed or migrated. The one net-new runtime-state concern is the **service worker cache**, which is fresh (no prior SW exists).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no DB keys/collections renamed. The Reading reads existing `analysis_results` rows unchanged. | none |
| Live service config | None renamed. **New:** a service worker will register on the deployed origin (Vercel); first deploy installs it for all visitors. | Verify SW scope = `/`; ensure `disable` in dev so local dev is unaffected. |
| OS-registered state | None — no Task Scheduler / launchd / systemd. The PWA, once installed by a user, registers a home-screen icon (user action, not build state). | none (user-driven) |
| Secrets/env vars | None renamed. `NEXT_PUBLIC_*` may be referenced by manifest if env-specific icons are used (optional). | none required |
| Build artifacts | **New:** `public/sw.js` is GENERATED at build time (path A) — must be gitignored or committed-as-artifact per team convention; it is a build output, not source. Path B serves SW from a route (no file). | Add `public/sw.js` to `.gitignore` if using path A. |

## Common Pitfalls

### Pitfall 1: Serwist needs a webpack build on Next 16 (Turbopack is the default)
**What goes wrong:** `next build` uses Turbopack by default in Next 16. The classic `withSerwistInit` plugin hooks webpack — so `public/sw.js` never gets generated, and the PWA silently does not install in production.
**Why it happens:** Next 16 flipped the build default to Turbopack; Serwist 9's `@serwist/next` plugin is a webpack plugin.
**How to avoid:** Either (path A) set `"build": "next build --webpack"` in `package.json` and keep `withSerwistInit`; OR (path B) use `@serwist/turbopack`'s `createSerwistRoute` and keep the Turbopack build. The repo's `dev` script already uses `--turbopack` (fine — SW is disabled in dev). [CITED: serwist.pages.dev/docs/next/turbo + blog.logrocket.com/nextjs-16-pwa-offline-support]
**Warning signs:** No `public/sw.js` after build; Lighthouse "does not register a service worker"; install affordance never appears on Android.

### Pitfall 2: Service worker disabled in dev hides PWA bugs until deploy
**What goes wrong:** With `disable: process.env.NODE_ENV === 'development'` (the recommended setting), the SW never runs locally, so offline behavior, install prompts, and cache strategy are untested until a Vercel deploy.
**Why it happens:** SWs + HMR conflict; everyone disables in dev.
**How to avoid:** Verify the PWA on a **deployed Vercel preview build** (success criterion 5), not localhost. For a one-off local check, `next build --webpack && next start` (path A) or `next dev --webpack --experimental-https` exercises the SW. Lighthouse PWA audit runs against the deployed URL.
**Warning signs:** "works locally" with no SW actually present.

### Pitfall 3: The view-model is all-at-complete — no mid-stream block content
**What goes wrong:** A naive plan assumes each `stage_end` event carries the corresponding block's data and tries to render real content progressively. It does not exist; the code will read `undefined` or force a premature `toReadingBlocks` on an incomplete result.
**Why it happens:** "stage-reveal" (READ-02) sounds like progressive content; the actual contract reveals placeholders on stage completion and content at `complete`.
**How to avoid:** Render placeholders keyed to `panelReady`; derive real blocks ONLY at `phase === 'complete'`. (See Crux Question.)
**Warning signs:** Calling `canonicalFromLive(result)` when `result` is null/partial; blocks flickering with empty data mid-stream.

### Pitfall 4: Caching the auth-gated analysis GET can leak across users
**What goes wrong:** `GET /api/analysis/[id]` returns 401 without a session and is per-user scoped (RLS + `user_id` filter). If the service worker precaches it or caches it without session-awareness, a logged-out or different user could be served another user's Reading from cache.
**Why it happens:** Cache-on-view (D-05) is desirable, but the response is authenticated.
**How to avoid:** Use a **NetworkFirst runtime strategy** (network is authoritative, cache is the offline fallback) scoped to `/api/analysis/`, and clear the cache on logout. NEVER add the analysis GET to the precache manifest. Consider partitioning the cache name per-session if multiple accounts on one device is a concern. [CITED: serwist NetworkFirst docs]
**Warning signs:** A re-opened Reading shows stale/another user's data offline; cache survives logout.

### Pitfall 5: Lightning CSS strips `backdrop-filter` from class form (Glass blur)
**What goes wrong:** The inert reply composer (the only Glass surface) loses its blur in production if `backdrop-filter` is applied via a Tailwind class.
**Why it happens:** CLAUDE.md known issue — Lightning CSS strips the utility-class form in the production build.
**How to avoid:** The kit's `Glass` component already applies blur via inline `style` (verified live on deployed build per STATE.md Plan 04). Use `<Glass>` for the composer; never add a `backdrop-blur-*` class.
**Warning signs:** Composer looks flat (no blur) on the deployed build but fine in dev.

### Pitfall 6: Tailwind v4 dark tokens must be hex, not oklch
**What goes wrong:** Very dark colors (L < 0.15) compile incorrectly in Tailwind v4 `@theme`.
**Why it happens:** CLAUDE.md known issue. The `.numen-surface` tokens are already authored as exact hex (verified globals.css) — but any NEW dark color Phase 4 adds (e.g. a thread overlay) must follow the same rule.
**How to avoid:** Use the existing `--numen-*` tokens; if a new dark value is needed, author it as hex.
**Warning signs:** Off-color backgrounds in production only.

### Pitfall 7: safe-area-inset tokens don't exist yet
**What goes wrong:** The pinned header and inert composer overlap the iOS notch/home-bar in standalone PWA mode.
**Why it happens:** globals.css has spacing tokens but NO `env(safe-area-inset-*)` handling yet (verified — grep found none).
**How to avoid:** Phase 4 must add safe-area handling. Set `viewport-fit=cover` (in the viewport/meta), then use `env(safe-area-inset-top/bottom)` in the pinned header/composer via inline style or a utility. The UI-SPEC already calls for this (Spacing Scale → safe-area insets). [CITED: standard iOS PWA pattern]
**Warning signs:** Header content under the notch; composer under the home indicator in installed mode.

### Pitfall 8: `useReducedMotion()` returns `null` before resolution
**What goes wrong:** A reduced-motion user gets a transient slide on first paint if `null` is treated as "motion OK".
**Why it happens:** The media query resolves async on the client.
**How to avoid:** The kit's `StageBlock` already fails safe (`useReducedMotion() !== false` — only explicit `false` enables translate). Any NEW motion Phase 4 writes must follow the same guard. Also: suppress the throne's `animate-skeleton-breathe` pulse under reduced motion.
**Warning signs:** A flash of slide for reduced-motion users on the throne/blocks.

### Pitfall 9: Forming-state APCA contrast at lowest pulse opacity
**What goes wrong:** The "Forming the read…" placeholder pulses `animate-skeleton-breathe` (opacity 0.4↔0.6) on `text-numen-text-muted` (#bab2a5, Lc 60.1 at full opacity). At 0.4 opacity it may drop below APCA Lc 60.
**Why it happens:** Pulsing text opacity reduces effective contrast.
**How to avoid:** Either pulse a non-text container (a dot/bar) instead of the text, or verify the forming line passes APCA at its lowest opacity. (04-UI-SPEC non-blocking rec #3.) Run `scripts/check-apca.ts` after deciding.
**Warning signs:** Forming line hard to read mid-pulse.

## Code Examples

### Serwist next.config wrap (path A — webpack build, RECOMMENDED)
```typescript
// next.config.ts — wrap the EXISTING config (which already has Sentry + serverExternalPackages)
// Source: serwist.pages.dev/docs/next/getting-started + blog.logrocket.com/nextjs-16-pwa-offline-support
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",         // or "app/sw.ts" depending on the repo's app dir (this repo uses src/app)
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  disable: process.env.NODE_ENV === "development",
});

// existing nextConfig object stays; wrap it. Note the repo also wraps withSentryConfig
// in production — compose carefully: withSerwist(withSentryConfig(nextConfig, ...)) or
// keep the dev/prod split. The planner must reconcile the two HOCs.
export default withSerwist(nextConfig);
```
```jsonc
// package.json — production build MUST use webpack for path A
{ "scripts": { "build": "next build --webpack" } }
```

### Service worker entry (path A)
```typescript
// src/app/sw.ts
// Source: serwist.pages.dev/docs/serwist/core + @serwist/next/worker defaultCache
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,   // app shell — static assets only
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // cache-on-view of opened Readings — NetworkFirst (network authoritative, cache = offline fallback).
    // NEVER precached: this is auth-gated (401 without session). See Pitfall 4.
    {
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && url.pathname.startsWith("/api/analysis/"),
      handler: new NetworkFirst({ cacheName: "reading-resting" }),
    },
    ...defaultCache, // app-shell assets — StaleWhileRevalidate
  ],
});
serwist.addEventListeners();
```

### Manifest (Next App Router metadata route)
```typescript
// src/app/manifest.ts
// Source: Next.js App Router MetadataRoute.Manifest
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Numen — Content Intelligence",
    short_name: "Numen",
    start_url: "/",
    display: "standalone",
    background_color: "#1a1714",   // --numen-bg (warm near-black; hex per Tailwind v4 rule)
    theme_color: "#1a1714",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```
```typescript
// add viewport-fit=cover for safe-area insets (layout.tsx viewport export)
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };
```

### iOS install coaching (dismissible, post-first-Reading)
```tsx
// src/components/reading/install-hint.tsx
// Source: web.dev/learn/pwa/installation-prompt + MDN Making PWAs installable + magicbell PWA iOS guide
"use client";
import { useEffect, useState } from "react";

const DISMISS_KEY = "numen-install-hint-dismissed";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !("MSStream" in window);
}

export function InstallHint({ firstReadingComplete }: { firstReadingComplete: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!firstReadingComplete) return;
    if (isStandalone()) return;                          // already installed
    if (localStorage.getItem(DISMISS_KEY)) return;       // remembered dismissal
    if (isIOS()) setShow(true);                          // iOS = coached manual flow
    // Android: capture `beforeinstallprompt` separately for the menu affordance (below)
  }, [firstReadingComplete]);

  if (!show) return null;
  return (
    <Surface className="...">      {/* a calm card, NOT a toast, NOT a modal */}
      <p>Keep this on your home screen</p>
      <p className="text-numen-text-muted">Tap Share, then Add to Home Screen.</p>
      <IconButton aria-label="Dismiss" onClick={() => { localStorage.setItem(DISMISS_KEY, "1"); setShow(false); }} />
    </Surface>
  );
}
```
```tsx
// Android beforeinstallprompt capture (for the menu affordance only — iOS never fires this)
// Source: web.dev/learn/pwa/installation-prompt
let deferredPrompt: BeforeInstallPromptEvent | null = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();           // stop the mini-infobar
  deferredPrompt = e as BeforeInstallPromptEvent;
  // surface the install affordance in the menu; on click: await deferredPrompt.prompt()
});
```

### Turbopack alternative (path B — keeps Turbopack builds)
```typescript
// src/app/serwist/[[...path]]/route.ts  (route handler serves /serwist/sw.js)
// Source: serwist.pages.dev/docs/next/turbo
import { createSerwistRoute } from "@serwist/turbopack";
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "src/app/sw.ts",
    useNativeEsbuild: true,   // requires the `esbuild` peer (else esbuild-wasm)
  });
// Register client-side via Serwist's provider/window helper, swUrl="/serwist/sw.js"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next-pwa` | Serwist (`@serwist/next` 9.5.x) | `next-pwa` unmaintained ~2023 | Serwist is the maintained Workbox fork; this repo mandates it |
| Webpack-only Next builds | Turbopack default in Next 16 | Next 16 (late 2025) | Serwist webpack plugin needs `next build --webpack`, OR use `@serwist/turbopack` |
| `public/manifest.json` | `app/manifest.ts` metadata route | Next 13+ App Router | Type-safe, hashed |
| `beforeinstallprompt` everywhere | iOS = coached manual flow (no `beforeinstallprompt` on Safari) | iOS Safari never supported it | iOS needs a custom dismissible Add-to-Home-Screen hint |

**Deprecated/outdated:**
- `next-pwa`: unmaintained — out of scope.
- The LogRocket article's `@serwist/precaching`/`@serwist/sw`/`idb` install line: those packages exist but are redundant in Serwist 9 (folded into `serwist` core). Install only `@serwist/next` + `serwist`.
- Serwist `10.0.0-preview.*`: preview only — do not adopt; stay on `9.5.11`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `next build --webpack` produces a working Serwist SW on Next 16.1.5 (path A) | PWA Architecture / Pitfall 1 | If the `--webpack` flag is removed/changed in a Next 16 patch, path A breaks → fall back to path B (`@serwist/turbopack`). Verify on a Vercel preview before committing the build script. [ASSUMED from 2026 community articles — not tested in THIS repo] |
| A2 | The composition order of `withSerwist(...)` and `withSentryConfig(...)` HOCs in next.config is compatible | Code Examples (next.config) | If the HOCs conflict, the build fails or one wraps the other incorrectly. The planner must test the composed config. The repo only applies Sentry in prod, Serwist needs prod too — they overlap. [ASSUMED] |
| A3 | NetworkFirst on `/api/analysis/` is sufficient cross-user safety; clearing cache on logout is the right mitigation | Pitfall 4 | If multiple accounts share a device and the cache isn't partitioned/cleared, a stale Reading could surface. Lower risk (NetworkFirst prefers live network) but the planner should confirm the logout-clear hook exists. [ASSUMED] |
| A4 | The icon assets (icon-192/512, maskable) need to be created — the repo has `apple-icon.png`/`icon.svg` but not the manifest PNG sizes | Manifest example | If existing assets suffice, no new asset work; if not, a design task is needed. [ASSUMED — repo has icon.svg + apple-icon.png 1.2K, sizes unverified for manifest] |
| A5 | `@serwist/next/worker` exports `defaultCache` on 9.5.11 | sw.ts example | If the subpath/export name differs, the import fails. Context7 shows `@serwist/vite/worker` and `@serwist/next/worker` both export `defaultCache`; the LogRocket Next 16 article uses `@serwist/next/worker`. Verify at install. [ASSUMED — cross-referenced two sources, not run] |

## Open Questions (RESOLVED in plans)

> All three resolved during planning (round-1 checker accepted as non-blocking): Q1 → Plan 03 picks `(app)/reading` + `[id]`; Q2 → Plan 04 checkpoint locks Path A; Q3 → Plan 04 Task 2 generates 192/512/maskable icons.

1. **Where does the mobile thread route live, and does it replace `/analyze`?** — RESOLVED: Plan 03 → new `(app)/reading` + `[id]` route, board untouched.
   - What we know: the board stays for desktop until Phase 7; the thread is the new primary mobile surface. The Reading thread "replaces the Konva board as the primary `/analyze`-class entry."
   - What's unclear: exact route (`/reading`, `/analyze` swapped by viewport, or a new path) and how it coexists with the kept `/analyze` board layout (which mounts `<Board>` in `analyze/layout.tsx`).
   - Recommendation: planner decides the route; a new `(app)/reading/[id]` + `(app)/reading/page.tsx` keeps the board untouched and avoids breaking the desktop surface. Mobile/desktop split can be a later (Phase 7) concern.

2. **Path A (webpack build) vs Path B (Turbopack route handler) for Serwist?**
   - What we know: both work; A is more documented, B keeps Turbopack build speed.
   - What's unclear: whether the team accepts a `next build --webpack` regression (loses Turbopack's faster prod build).
   - Recommendation: **Path A** for maturity unless build time is a measured problem; gate the decision in planning. Either way, verify on a Vercel preview.

3. **Manifest icon assets — do existing icons cover 192/512/maskable?**
   - What we know: repo has `src/app/icon.svg` (367B) + `src/app/apple-icon.png` (1.2K).
   - What's unclear: whether manifest-spec PNG sizes (192, 512, maskable) exist.
   - Recommendation: planner adds an icon-generation task if missing; Next can also generate from `icon.svg` but maskable needs a dedicated asset.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build/dev | ✓ | v22.22.3 | — |
| pnpm | package install | ✓ | (pnpm-lock.yaml present) | npm |
| Next | framework | ✓ | 16.1.5 | — |
| `motion` | reveal motion | ✓ | 12.29.2 | — |
| `@serwist/next` + `serwist` | PWA | ✗ (not yet installed) | 9.5.11 (target) | none — must install (verified legit) |
| `@serwist/turbopack` + `esbuild` | PWA path B only | ✗ | 9.5.11 / >=0.25 | path A (no extra deps) |
| Vercel deploy | Lighthouse PWA verification (criterion 5) | ✓ (deployed per CLAUDE.md) | — | — |
| Lighthouse | PWA installability audit | ✓ (Chrome DevTools / CLI) | — | manual install test |

**Missing dependencies with no fallback:** Serwist (`@serwist/next`, `serwist`) — must be installed; verified legitimate.
**Missing dependencies with fallback:** `@serwist/turbopack`/`esbuild` — only if path B is chosen; path A avoids them.

## Validation Architecture

> nyquist_validation is not explicitly disabled in config; section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 (+ `@testing-library/react` 16.3.2, `vitest-axe` 0.1.0, happy-dom 20.9.0) [VERIFIED: package.json] |
| Config file | `vitest.config.ts` (existing; `include` covers `tests/**/*.test.tsx` and `src/**/__tests__/*.test.ts` per STATE.md Plan 04) |
| Quick run command | `pnpm test` (`vitest run`) — or scoped: `pnpm vitest run src/components/reading` |
| Full suite command | `pnpm test` (`vitest run`) |
| E2E (deployed PWA) | `pnpm e2e` (Playwright) + Lighthouse against the Vercel preview |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| READ-01 | Reading is first turn, no blank prompt | unit (render) | `pnpm vitest run src/components/reading/__tests__/reading-thread.test.tsx` | ❌ Wave 0 |
| READ-02 | placeholder slots reveal on stage readiness; content fills at complete | unit (drive panelReady) | `pnpm vitest run .../reading-thread.test.tsx` | ❌ Wave 0 |
| READ-03 | throne reserved → crystallizes once at complete | unit (phase transition) | `pnpm vitest run .../throne.test.tsx` | ❌ Wave 0 |
| READ-04 | verdict = band+why+confidence language, /100 in body only | unit (render against fixture) | `pnpm vitest run .../blocks/verdict.test.tsx` | ❌ Wave 0 |
| READ-05 | curated order; expert-insight at slot 2 regardless of late stage | unit (order assertion) | `pnpm vitest run .../reading-thread.test.tsx` | ❌ Wave 0 |
| READ-06 | resting render = live render (parity); opens on verdict | unit (fixture-driven) + reuse `identical-render.test.ts` | `pnpm vitest run src/lib/reading/__tests__/identical-render.test.ts` | ✅ (existing parity test) / ❌ resting-render test Wave 0 |
| READ-07 | no engine jargon in headings/body | unit (string assertion) | `pnpm vitest run .../copy.test.tsx` | ❌ Wave 0 |
| SHELL-04 | manifest valid; SW registers; installable | e2e + Lighthouse | Lighthouse PWA audit on Vercel preview | ❌ Wave 0 (manual/CI) |
| a11y | aria-live once; reduced-motion; 44px targets | unit (vitest-axe) | `pnpm vitest run .../a11y.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run src/components/reading` (scoped quick run).
- **Per wave merge:** `pnpm test` (full Vitest suite — must stay GREEN, including the existing `src/lib/reading` 37/37).
- **Phase gate:** full suite green + Lighthouse PWA installable on a deployed Vercel preview before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `src/components/reading/__tests__/reading-thread.test.tsx` — READ-01/02/05 (drive a mock `useAnalysisStream`)
- [ ] `src/components/reading/__tests__/throne.test.tsx` — READ-03 crystallization
- [ ] `src/components/reading/blocks/__tests__/*.test.tsx` — per-block render against `live-WEkihfOzJphv.json`
- [ ] `src/components/reading/__tests__/a11y.test.tsx` — vitest-axe + aria-live-once + reduced-motion
- [ ] A test util/mock for `useAnalysisStream` (drive `phase`/`panelReady`/`result` deterministically) — shared fixture
- [ ] Lighthouse PWA check in CI or a documented manual step against the Vercel preview
- Framework install: none — Vitest + Playwright already present.

## Security Domain

> security_enforcement not disabled in config; section included. This is a client-presentation phase with one auth-gated data route and a new service worker.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth; existing Supabase session reused |
| V3 Session Management | yes | The service worker caches an auth-gated GET — cache must be session-aware and cleared on logout (Pitfall 4) |
| V4 Access Control | yes | `/api/analysis/[id]` is RLS + `user_id` scoped (existing, unchanged); the SW must not weaken it via shared cache |
| V5 Input Validation | no | No new user input is processed in Phase 4 (the reply composer is inert/non-sending) |
| V6 Cryptography | no | No crypto introduced |
| V12 Files/Resources | yes | Manifest icons + SW served from the origin; ensure SW scope is `/` and not over-broad |

### Known Threat Patterns for {Next 16 client + Serwist SW + auth-gated API}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cached authenticated response served to a different user (shared device) | Information Disclosure | NetworkFirst (network authoritative) + clear SW cache on logout; never precache `/api/analysis/`; consider per-session cache name (Pitfall 4) |
| Stale Reading served offline after access revoked | Information Disclosure | NetworkFirst prefers live; cache only the already-viewed Reading; bound cache lifetime |
| Service worker over-broad scope intercepts unintended routes | Tampering | Scope SW at `/`; do NOT cache the `/api/analyze` POST or auth routes |
| Inert reply composer accidentally wired to send | (deferred) | It must be non-focusable-to-send and show no error on tap (UI-SPEC); Phase 5 owns the wiring seam |

## Project Constraints (from CLAUDE.md + 04-UI-SPEC)

These carry the same authority as locked decisions; the planner must not recommend approaches that contradict them.

- **Stack:** Next.js 16.1.5, TypeScript, Tailwind v4, Supabase. Package manager: **pnpm** (npm fallback). TypeScript over JS. Functional components + hooks. Server components by default, client only when interactive (the live thread is client; the resting fetch is RSC).
- **Tailwind v4 oklch bug:** dark colors (L < 0.15) compile incorrectly in `@theme` — use exact hex. The `.numen-surface` tokens already comply; any new dark value follows suit.
- **Lightning CSS strips `backdrop-filter`:** apply via React inline style, never a class. The kit `Glass` already does this.
- **Dev server CSS caching:** kill dev server + clear `.next/` + `node_modules/.cache/` + browser cache when CSS changes don't appear.
- **`.numen-surface` scope class is load-bearing:** the entire Reading mounts under it; legacy coral `@theme` tokens (`bg-accent`, `border-border`) MUST NOT appear in the thread.
- **Lucide icons only** inside the Reading (D-09) — NOT the Phosphor `ui/icon.tsx` wrapper.
- **Glass is rare** — reserved for the inert reply composer ONLY; every other block is a `Surface`.
- **Two voice serif moments only** (Source Serif 4): the throne's one-sentence why + the expert-insight lead line. Serif nowhere else.
- **Weight discipline:** sans regular(400)+semibold(600) in body; medium(500) only at the 14px caption tier; never bold(700) in `.numen-surface`.
- **DS-07 is the ONLY motion:** reuse `StageBlock`; do not introduce new entrance/presence theater.
- **`new code standardizes on `motion`** (not framer-motion); framer-motion retained on 4 legacy files (do not touch them, do not import from it in new code).
- **No engine edits** — `lib/engine/` and `lib/reading/` (Phase 2 contracts) are frozen for this phase.
- **File org:** components under `src/components/`, no files in repo root, keep files under ~500 lines.
- **Build-not-ship:** Phase 4 builds against `live-WEkihfOzJphv.json`; MUST NOT ship to users until the deferred Phase-3 GO (`03-GATE-DECISION.md`) reads GO.

## Sources

### Primary (HIGH confidence)
- Repo code read directly: `src/hooks/queries/use-analysis-stream.ts`, `src/lib/reading/{view-model,block-types,from-persisted-row,verdict-bands}.ts`, `src/lib/engine/{events,panel-mapping}.ts`, `src/app/api/analyze/route.ts`, `src/app/api/analysis/[id]/route.ts`, `src/components/numen/{stage-reveal,surface,glass}.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `next.config.ts`, `package.json`, `live-WEkihfOzJphv.json` fixture
- Context7 `/websites/serwist_pages_dev` — Next.js getting-started, turbo route handler, Serwist core config, NetworkFirst, defaultCache (312 snippets, High reputation)
- npm registry (`npm view`) — `@serwist/next@9.5.11`, `serwist@9.5.11`, `@serwist/turbopack@9.5.11` versions, peers, publish dates, no-postinstall verification
- Phase docs: `04-CONTEXT.md`, `04-UI-SPEC.md`, `REQUIREMENTS.md`, `STATE.md`, `NUMEN-SURFACE-VISION.md`

### Secondary (MEDIUM confidence)
- [serwist.pages.dev/docs/next/getting-started](https://serwist.pages.dev/docs/next/getting-started) — `withSerwistInit` setup
- [serwist.pages.dev/docs/next/turbo](https://serwist.pages.dev/docs/next/turbo) — `@serwist/turbopack` route handler (path B)
- [blog.logrocket.com/nextjs-16-pwa-offline-support](https://blog.logrocket.com/nextjs-16-pwa-offline-support/) — Next 16 + Serwist, the `next build --webpack` requirement
- [aurorascharff.no/posts/dynamically-generating-pwa-app-icons-nextjs-16-serwist](https://aurorascharff.no/posts/dynamically-generating-pwa-app-icons-nextjs-16-serwist/) — Next 16 manifest + Serwist, "works with Turbopack, --webpack for local PWA test"
- [web.dev/learn/pwa/installation-prompt](https://web.dev/learn/pwa/installation-prompt) — `beforeinstallprompt` capture, iOS coaching
- [developer.mozilla.org/.../Making_PWAs_installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) — install detection
- [magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) — iOS PWA limits, standalone detection

### Tertiary (LOW confidence)
- The `next build --webpack` flag stability on Next 16 patch releases (A1) — community-reported, not tested in this repo. Verify on a Vercel preview.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via npm + Context7; repo deps read from package.json
- Architecture (SSE→block reshape, crux): HIGH — derived directly from reading the hook, view-model, events, and panel-mapping source; the all-at-complete finding is a code fact, not an inference
- PWA setup (Serwist × Next 16 × Turbopack): MEDIUM-HIGH — two valid paths documented from official docs + Context7 + two 2026 articles; the `--webpack` build behavior on THIS repo is the one thing to verify on a preview (A1)
- Pitfalls: HIGH — most are repo-grounded (Lightning CSS, oklch, safe-area absence, reduced-motion guard all verified in code/CLAUDE.md)

**Research date:** 2026-06-12
**Valid until:** ~2026-07-12 (30 days; Serwist 9.x stable, Next 16.1.5 frozen). Re-check if Serwist 10 ships or the repo bumps Next.
