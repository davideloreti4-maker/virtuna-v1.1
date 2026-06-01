# Phase 2: Remix Mode + One-Board-Two-Config - Research

**Researched:** 2026-06-01
**Domain:** Frontend integration — Next.js 15 / React / TypeScript / Konva board / Supabase persistence. No new external dependencies.
**Confidence:** HIGH (every integration point read in this session; codebase grep confirmed no pre-existing `mode`/`remix` symbols)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Intent Selector (REMIX-01)**
- **D-01:** Top-level segmented control ("Score my content" / "Remix a viral video") **above** the existing text/Video/URL input tabs. No auto-detect.
- **D-02:** Default intent on fresh dashboard load = **Score** (zero regression). No last-used persistence this phase.
- **D-03:** Score mode unchanged: text/Video/URL tabs in current order, caption field on video upload, existing grade flow intact.

**Remix Input Coupling (REMIX-01)**
- **D-04:** Remix selected → input shows **Video + Link only** (order: 1. Video, 2. Link). **Text hidden** (removed from DOM). Make invalid states unrepresentable.
- **D-05:** Remix → **no caption / additional text field** for either source. Pasting a link or picking a file is the entire interaction.
- **D-06:** Both Video upload and Link produce real Omni signal (INGEST-01) → both valid remix sources.

**Mode-Aware Board Layout (REMIX-02)**
- **D-07:** **1:1 positional swap** on desktop Konva canvas — Decode takes Verdict's exact bounds, Adapt takes Actions' exact bounds. Other frames unchanged.
- **D-08:** Mode drives layout via extended **`resolveBoardLayout(mode)`** — single source of truth returning score (verdict+actions) or remix (decode+adapt) frame set; consumed by desktop + mobile.
- **D-09:** Mobile card-stack (`BoardMobile.tsx`, <768px) — Decode + Adapt occupy exact slots Verdict + Actions held in score-mode card order; every shared card identical.

**Decode/Adapt Empty Shells (REMIX-02, this phase)**
- **D-10:** Each shell = titled frame (Decode / Adapt) + one quiet muted descriptor line. No skeleton/shimmer (would imply loading), not a bare frame (would read as broken).
- **D-11:** Descriptor copy = neutral "what this is for" line, no "coming soon" / no date promise.

**Data Model & Persistence (REMIX-02, success criterion 5)**
- **D-12:** New `mode` column on `analysis_results` — `TEXT NOT NULL DEFAULT 'score' CHECK (mode IN ('score','remix'))`. Distinct from `input_mode`. Column named `mode`.
- **D-13:** Backfill all existing rows to `'score'` in same migration. Column is total (never null).
- **D-14:** Fold `mode` into content hash in `prediction-cache.ts` — same URL under Score vs Remix yields different `content_hash`; entries do not collapse. Hash is the content identity; L2 keys on `content_hash`, so no cache-query-layer change.
- **D-15:** `/analyze/[id]` reads `mode` from persisted row as source of truth; live board + permalink reload must agree.

### Claude's Discretion
- Exact visual styling of the segmented control (must follow Raycast design language — 6% borders, 8px radius, Inter).
- Exact descriptor copy strings for Decode/Adapt shells (neutral, no promise — D-11). *(UI-SPEC §Copywriting has provided strings; treat as the locked default unless a better neutral line is found.)*
- Migration filename/timestamp; whether `mode` is threaded as a typed union (`'score' | 'remix'`).
- How segmented control state is held (local component state vs form state) — default Score, threads to submit correctly.

### Deferred Ideas (OUT OF SCOPE)
- **Last-used intent persistence** — deferred; default-to-Score sufficient (D-02).
- **Decode frame content** — Phase 3 (DECODE-01/02).
- **Adapt frame content + niche prompt** — Phase 4 (ADAPT-01/02).
- **Develop & predict + lineage (`parent_id`, "remixed from" chip)** — Phase 5. `parent_id` column **NOT added this phase**.
- **Mode analytics/telemetry** — not in scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REMIX-01 | Explicit intent selector ("Score my content" / "Remix a viral video"), no auto-detect; Remix routes submission down remix path + persists `mode='remix'` | `content-form.tsx` (`MODE_CONFIG`, `handleTabChange`, `ContentFormData`, `validate`, `isSubmitDisabled`) is the selector host; `Board.tsx:handleContentSubmit` builds the `stream.start()` payload; `use-analysis-stream.ts:AnalysisStreamInput` carries it; `route.ts` validates + persists. The remix ingestion path (`tiktok_url` → Omni) already exists from Phase 1. |
| REMIX-02 | One board, two configs — keep Input/Engine/Audience/Content Craft, swap Verdict+Actions → Decode+Adapt on desktop + mobile, no separate route; score board unchanged | `board-constants.ts:resolveBoardLayout` + `GROUP_FRAMES` + `AUTO_HEIGHT_FRAMES`; `board-types.ts:GroupId`; `Board.tsx` overlay dispatch (lines 470-484); `BoardMobile.tsx:MOBILE_ORDER` + `renderBody`; clone `VerdictNode.tsx` shape for `DecodeShellNode`/`AdaptShellNode`. Persistence threads `mode` to `resolveBoardLayout` via the analysis row. |
</phase_requirements>

## Summary

This is a **pure frontend + thin-persistence integration phase with zero new dependencies.** Every integration point named in CONTEXT.md and the UI-SPEC was verified against live code this session and is accurate. The work is: (1) add a two-segment intent control above the existing input tabs and couple Remix → Video+Link-only; (2) thread a `mode: 'score' | 'remix'` field from form → stream payload → API → a new `analysis_results.mode` column; (3) fold `mode` into the content hash so Score and Remix of the same URL are distinct cache entries; (4) make `resolveBoardLayout` mode-aware so it returns a `decode`/`adapt` frame set in remix mode; (5) build two static DOM shell components and dispatch them in both `Board.tsx` (canvas overlay) and `BoardMobile.tsx` (card stack); (6) read `mode` back from the persisted row on `/analyze/[id]` so the board config survives reload.

**The single most important architectural correction to the UI-SPEC:** frame **body content is plain DOM React, NOT Konva primitives.** `GroupFrame.tsx` draws only the rect/border chrome in Konva; the actual content (VerdictNode, ActionsNode, AudienceNode) renders as HTML inside `GroupFrameOverlay` — an absolutely-positioned, camera-transformed `pointer-events-none` div layer sitting on top of the canvas. The UI-SPEC §3/§4 "Konva Text nodes" / "Konva-renderable spec" for the shells is misleading. **DecodeShellNode and AdaptShellNode must be DOM components shaped like `VerdictNode` (a `<div>` returning JSX), not Konva `<Text>`/`<Rect>` nodes.** A planner who follows the UI-SPEC literally will produce shells that render nothing (Konva children inside the DOM overlay are invalid).

**Primary recommendation:** Thread a single `mode` value through one new field at each existing seam (no new routes, no new layout system, no new cache layer). Build the two shells as ~30-line static DOM components matching the FrameHero label idiom. Make `resolveBoardLayout` and `MOBILE_ORDER` mode-parameterized. The 1:1 bounds swap (D-07) means **no x/y/w/h math changes** — `decode` reuses `verdict` bounds, `adapt` reuses `actions` bounds; only the frame id/label/component differs.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Intent selector (Score/Remix) | Browser / Client (`content-form.tsx`) | — | Interactive control; client component already. Local `useState`. |
| Remix tab coupling (hide Text, drop caption) | Browser / Client (`content-form.tsx`) | — | Pure render-time filter of `MODE_CONFIG` + conditional textarea. |
| `mode` in submit payload | Browser / Client (`Board.tsx` → `use-analysis-stream.ts`) | — | Threads through existing `stream.start()` input object. |
| `mode` validation | API / Backend (`route.ts` + `AnalysisInputSchema`) | — | System boundary — validate at the Zod schema (CLAUDE.md: validate input at boundaries). |
| `mode` persistence | API / Backend (`route.ts` INSERT/UPSERT builders) + Database (`analysis_results.mode`) | — | Row write; new column with CHECK + default + backfill. |
| `mode` in content hash | API / Backend (`prediction-cache.ts:computeContentHash`) | — | Hash is content identity; segment mode into hashed string. |
| Board frame set selection | Browser / Client (`board-constants.ts:resolveBoardLayout`) | — | Single source of truth (D-08). Pure function — easily unit tested. |
| Decode/Adapt shell render (desktop) | Browser / Client (`Board.tsx` overlay dispatch + `DecodeShellNode`/`AdaptShellNode`) | — | DOM nodes inside `GroupFrameOverlay`. |
| Decode/Adapt shell render (mobile) | Browser / Client (`BoardMobile.tsx` `renderBody` switch) | — | Same DOM shell components, card-wrapped. |
| `mode` rehydrate on permalink | API → Client (`/api/analysis/[id]` returns row → board reads it) | — | Mode survives reload via the persisted row (D-15). |

## Standard Stack

No new packages. Everything required is already installed and in use.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 15.x | App router, route handlers, SSR | Project framework `[VERIFIED: package.json + codebase]` |
| `react` / `react-konva` | (installed) | Board canvas chrome | Existing board stack `[VERIFIED: GroupFrame.tsx imports react-konva]` |
| `zod` | (installed) | `AnalysisInputSchema` validation | Existing validation boundary `[VERIFIED: types.ts:135]` |
| `@tanstack/react-query` | (installed) | Stream/permalink hydration | Existing data layer `[VERIFIED: use-analysis-stream.ts]` |
| `@supabase/*` | (installed) | Persistence + migrations | Existing `[VERIFIED: route.ts, migrations dir]` |
| `node:crypto` | builtin | `createHash('sha256')` for content hash | Zero-dep, already used `[VERIFIED: prediction-cache.ts:1]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | (installed) | Selector iconography (if any) | Form-layer icons (existing `MODE_CONFIG` uses `Type`/`Link`/`Video`) |
| `@phosphor-icons/react` | (installed) | Board-layer icons | Only if a shell needs an icon (likely not — D-10 is text-only) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Local `useState` in ContentForm for `mode` | Lift to a Zustand store (e.g. `simulation-store`) | Not needed this phase — no cross-component read of intent before submit; D-02 says no persistence. Local state is simpler and matches `activeTab` pattern. |
| New `mode` column | Reuse `variants` JSONB bag | Rejected by D-12: `mode` is queried/filtered identity, needs a real column with CHECK; JSONB can't enforce the constraint and complicates the content-hash/permalink read. |

**Installation:** None. `npm install` adds nothing.

## Package Legitimacy Audit

> No external packages installed this phase. Audit not applicable.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

REQUIREMENTS.md Out-of-Scope explicitly lists "New npm dependencies" as rejected — research SUMMARY confirmed all capabilities exist in installed deps. `[CITED: .planning/REQUIREMENTS.md §Out of Scope]`

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────── INPUT (client) ──────────────────────────────┐
│  ContentForm (content-form.tsx)                                          │
│   ┌──────────────────────────────────────────────────────────┐          │
│   │ [ Intent Selector: Score | Remix ]   ← NEW, top-level     │          │
│   └──────────────────────────────────────────────────────────┘          │
│   mode='remix' ──► MODE_CONFIG filtered to [Video, Link]; Text removed   │
│                    caption textarea suppressed (D-04/D-05)               │
│   onSubmit(formData incl. mode) ──────────────────────────────┐          │
└───────────────────────────────────────────────────────────────┼─────────┘
                                                                 ▼
                         CommandBar.onContentSubmit ──► Board.handleContentSubmit
                                                                 │ adds mode
                                                                 ▼
                          stream.start({ ...input, mode })  (use-analysis-stream)
                                                                 │ POST /api/analyze
                                                                 ▼
┌─────────────────────────── API (server) ────────────────────────────────┐
│  route.ts                                                                │
│   AnalysisInputSchema.parse(body)  ← add `mode` to schema                │
│   contentHash = computeContentHash(validated)  ← folds mode (D-14)       │
│   lookupPredictionCache(contentHash, userId)   ← keyed on hash → distinct│
│   INSERT/UPSERT analysis_results { ...row, mode }  ← buildInsertRow +     │
│                                                       placeholder INSERT  │
└───────────────────────────────────────────────────────────────┼─────────┘
                                                                 ▼
                    analysis_results.mode  (TEXT NOT NULL DEFAULT 'score')
                                                                 │
        ┌────────────────────────────────────────────────────────┘
        ▼ (live SSE)                          ▼ (permalink reload: GET /api/analysis/[id])
┌─────────────────────────── BOARD (client) ──────────────────────────────┐
│  Board.tsx  /  BoardMobile.tsx                                           │
│   mode (from stream.result.mode OR permalink row.mode)                   │
│        │                                                                 │
│        ▼                                                                 │
│   resolveBoardLayout(measuredH, mode)  ← NEW mode param (D-08)           │
│        │  score → [...input, engine, audience, VERDICT, ACTIONS, ca]     │
│        │  remix → [...input, engine, audience, DECODE,  ADAPT,  ca]      │
│        ▼                                                                 │
│   overlay dispatch:  layout.id==='decode' → <DecodeShellNode/>  (DOM)    │
│                      layout.id==='adapt'  → <AdaptShellNode/>   (DOM)    │
│   mobile: MOBILE_ORDER(mode) + renderBody switch adds decode/adapt cases │
└──────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/components/board/
├── board-constants.ts        # EXTEND: resolveBoardLayout(measured, mode), AUTO_HEIGHT_FRAMES
├── board-types.ts            # EXTEND: GroupId += 'decode' | 'adapt'
├── Board.tsx                 # EXTEND: derive mode; pass to resolveBoardLayout; dispatch shells
├── BoardMobile.tsx           # EXTEND: MOBILE_ORDER(mode); renderBody decode/adapt cases
├── decode/                   # NEW (mirror verdict/ dir convention)
│   └── DecodeShellNode.tsx   # NEW static DOM shell
└── adapt/                    # NEW
    └── AdaptShellNode.tsx    # NEW static DOM shell

src/components/app/content-form.tsx   # EXTEND: intent selector + coupling + mode field
src/hooks/queries/use-analysis-stream.ts  # EXTEND: AnalysisStreamInput += mode
src/lib/engine/types.ts        # EXTEND: AnalysisInputSchema += mode; AnalysisInput type
src/lib/engine/cache/prediction-cache.ts  # EXTEND: computeContentHash folds mode
src/app/api/analyze/route.ts   # EXTEND: persist mode in both INSERT builders + placeholder
src/types/database.types.ts    # EXTEND: analysis_results Row/Insert/Update += mode (regen or hand-edit)
supabase/migrations/202606XXXXXXXX_add_mode_to_analysis_results.sql  # NEW
```

### Pattern 1: Frame body is DOM, not Konva (CRITICAL)
**What:** The board renders in two stacked layers. `GroupFrame.tsx` (react-konva `<Group>`/`<Rect>`) draws only the frame's background rect + border on the WebGL canvas. All content nodes (`VerdictNode`, `ActionsNode`, `AudienceNode`, `ContentAnalysisFrame`, `InputResultCard`, `EngineGroup`) are plain React DOM, rendered as `children` of `GroupFrameOverlay` — an absolutely-positioned HTML div layer (`Board.tsx:454-486`) transformed to match the camera.
**When to use:** Always, for the new shells.
**Example:** `VerdictNode` returns `<div className="relative flex w-full flex-col gap-4">…</div>` — pure JSX. Copy this shape.
```tsx
// Source: VerdictNode.tsx:84-89 (verified this session)
return (
  <div className="relative flex w-full flex-col gap-4" data-testid="verdict-node">
    {/* ...DOM... */}
  </div>
);
```
**Anti-pattern:** Do NOT write `<Text>`/`<Rect>` Konva nodes for the shells. The UI-SPEC §3/§4 "Konva-renderable spec" should be read as *visual intent* (label + descriptor, the listed colors/sizes), implemented in DOM. Map the spec values to Tailwind/inline styles: frame label = `text-[10px] uppercase tracking-[0.1em] text-white/45` (the existing FrameHero label idiom, `FrameHero.tsx:65`); descriptor = `text-xs leading-[1.4] text-white/35` (matches the UI-SPEC mobile DOM block at §3/§4).

### Pattern 2: Single-source-of-truth layout resolver (D-08)
**What:** `resolveBoardLayout(measured)` currently maps `GROUP_FRAMES` → measured-height-reflowed array. Extend signature to `resolveBoardLayout(measured, mode = 'score')`. In remix mode, swap the `verdict` entry → `decode` (same x/y/w/h) and `actions` → `adapt` (same x/y/w/h). All other entries identical.
**When to use:** The only place mode affects layout. Both `Board.tsx` and `BoardMobile.tsx` consume it (or `MOBILE_ORDER` mirrors the swap).
**Example (shape to follow):**
```ts
// resolveBoardLayout returns 6 frames; in remix mode the 4th/5th swap id+label
// but keep verdict/actions bounds verbatim (D-07 1:1 positional swap).
// verdict bounds: { x: 864, y: 0, width: 360, height: 280 }
// actions bounds: { x: 864, y: 312, width: 360, height: 760 }
```
**Note on the `h()`/`base[]` lookup:** `resolveBoardLayout` indexes `base` (built from `GROUP_FRAMES`) by id. `decode`/`adapt` are NOT in `GROUP_FRAMES`, so the resolver must reuse `verdict`/`actions` bounds for them rather than looking up `base['decode']` (which is `undefined`). Two clean options for the planner:
- (a) Compute remix frames by taking the score frames and rewriting `{id, label}` on the verdict/actions entries — bounds already correct, no `base` lookup for the new ids.
- (b) Add `decode`/`adapt` to `GROUP_FRAMES` with identical bounds and add to `AUTO_HEIGHT_FRAMES`, then filter the returned set by mode. Heavier; (a) is the minimal-diff path.
Option (a) avoids touching `GROUP_FRAMES` (which has a tested `BOARD_BOUNDS` derivation and a 56-assertion gap-regression test suite) — recommended.

### Pattern 3: Static empty-state copy already has a home
**What:** `GroupFrameOverlay.tsx:13-32` holds `EMPTY_STATE_COPY` keyed by frame id (title + sub) for the pre-analysis empty state, and `ARIA_LABEL:42-49`. Add `decode`/`adapt` keys to both. But the **shell descriptor (D-10/D-11) is distinct from the empty state** — the shell descriptor must render even when there IS an analysis (the frame is intentionally contentless this phase). So the descriptor lives in the shell component body, not in `EMPTY_STATE_COPY`. Add `decode`/`adapt` to `ARIA_LABEL` for the overlay's `aria-label` regardless.
**When to use:** Add aria + empty-copy keys to avoid `undefined` lookups; render the descriptor inside the shell component.

### Anti-Patterns to Avoid
- **Konva primitives for shells** — see Pattern 1. They render nothing in the DOM overlay.
- **A second route for remix** — REQUIREMENTS Out-of-Scope rejects a separate Studio/Discover surface. Reconfigure the existing board only.
- **Touching `GROUP_FRAMES` bounds** — the 1:1 swap (D-07) means bounds are reused verbatim. Don't re-space; Phase 3/4 may.
- **A second rate limiter / new API route for remix** — STATE.md Plan 03 confirmed the 429 branch is mode-agnostic; `mode` is additive metadata on `/api/analyze`.
- **Auto-detect mine-vs-theirs** — explicitly rejected (REQUIREMENTS Out-of-Scope, D-01).
- **Adding `parent_id` this phase** — that's Phase 5 (DEVELOP-02). CONTEXT Deferred explicitly excludes it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Frame chrome (rect/border/title bar) | Custom Konva drawing for shells | Existing `GroupFrame` chrome (it already draws every frame's rect by id) + `GroupFrameOverlay` for DOM body | Chrome is rendered by the generic frame loop in `Board.tsx:435-441` for ALL ids; the shell only supplies overlay body |
| Frame title label styling | New typography | `FrameHero` label idiom or `MobileFrameCard` label prop | UI-SPEC typography table already maps to existing 10px/uppercase pattern |
| Content hash | New hashing scheme | `computeContentHash` (`node:crypto` SHA-256) | Already deterministic + tested; just segment `mode` in |
| Cache lookup keying | New cache layer | `lookupPredictionCache` (keys on `content_hash`) | Hash change alone makes Score/Remix distinct (D-14); no query-layer change |
| Permalink rehydrate | New fetch | `/api/analysis/[id]` GET (returns `select('*')` → includes new `mode` column automatically) | `select('*')` means the new column flows through with zero route change for the read |
| Mobile card chrome | New card component | `MobileFrameCard` (label + collapse + Raycast card) | Already the mobile frame wrapper; just add decode/adapt to `renderBody` |

**Key insight:** This phase is almost entirely *threading an existing value through existing seams.* The only genuinely new artifacts are two ~30-line static DOM shell components and one migration. Everything else is an additive edit to a function signature, a Zod schema, a switch statement, or an INSERT object.

## Common Pitfalls

### Pitfall 1: Building shells as Konva nodes (UI-SPEC literal trap)
**What goes wrong:** Following UI-SPEC §3/§4 "Konva-renderable spec" literally produces `<Text>`/`<Rect>` shells that render nothing inside the DOM overlay layer.
**Why it happens:** UI-SPEC describes the visual in Konva terms, but the board's content layer is DOM (`GroupFrameOverlay`), not canvas.
**How to avoid:** Build `DecodeShellNode`/`AdaptShellNode` as DOM components shaped like `VerdictNode`. Map the spec's Konva coordinates/colors to Tailwind/inline styles.
**Warning signs:** Frame border shows on canvas but the descriptor text never appears; React-konva "div is not a valid Konva node" type errors.

### Pitfall 2: `resolveBoardLayout` `base[id]` lookup is undefined for new ids
**What goes wrong:** Adding `decode`/`adapt` to `GroupId` then calling `base['decode']` returns `undefined` → `bounds` throws.
**Why it happens:** `base` is built from `GROUP_FRAMES`, which has no `decode`/`adapt` entries.
**How to avoid:** Use Pattern 2 option (a): compute remix frames by rewriting `{id,label}` on the existing verdict/actions entries (bounds already resolved), not by looking up new ids in `base`.
**Warning signs:** `Cannot read properties of undefined (reading 'bounds')` in the layout resolver.

### Pitfall 3: Mode not threaded to `computePresetTargets` / camera presets
**What goes wrong:** `computePresetTargets` and `CAMERA_PRESET_TARGETS` reference the `verdict` preset key explicitly (`board-constants.ts:72`, `:166-180`). In remix mode `byId.verdict` is undefined → the `verdict` preset (Audience+Verdict union) computation reads `undefined.x`.
**Why it happens:** Camera presets hard-reference `verdict`. `computePresetTargets` does `const ver = byId.verdict;` then `ver.x`.
**How to avoid:** In remix mode the right-column hero is `decode` (same bounds). Make `computePresetTargets` fall back: `const ver = byId.verdict ?? byId.decode;`. Keep the preset KEY name `verdict` (it's internal/`CameraPresetKey`) OR add a guard. The camera preset is internal (D-09 note: "not user-facing in CameraOverlay"), so a `?? byId.decode` fallback is the minimal safe fix.
**Warning signs:** Board crashes on remix permalink load inside `computePresetTargets`; `ver.x` undefined.

### Pitfall 4: `mode` lost on permalink reload (D-15)
**What goes wrong:** Board renders score config on a remix permalink because mode isn't read from the row.
**Why it happens:** `Board.tsx` derives layout from `resolveBoardLayout(measuredH)` with no mode input; `stream.result`/permalink row must surface `mode`.
**How to avoid:** (1) Persist `mode` to the row (D-12). (2) `/api/analysis/[id]` uses `select('*')` so `mode` flows through automatically — verify it appears in the `enriched` object (it's spread via `...data`). (3) In `Board.tsx`, derive `const mode = (stream.result as {mode?})?.mode ?? 'score'` and pass to `resolveBoardLayout`. (4) `PredictionResult` type currently has no `mode` field — add it (optional) so the value survives the cache hydrate (`rowToPredictionResult` spreads the raw row, so it carries through, but the type must allow it to avoid casts everywhere).
**Warning signs:** Live remix board correct, but reloading `/analyze/[id]` shows verdict+actions.

### Pitfall 5: Content-hash change silently invalidates ALL existing caches
**What goes wrong:** Folding `mode` into the hash changes the hash for *every* input, including score-mode ones. Existing L1/L2 cache entries (keyed on old hash) become permanent misses; existing `analysis_results.content_hash` rows won't match new lookups.
**Why it happens:** `computeContentHash` output changes for the same content once `mode` is appended.
**How to avoid:** Two acceptable strategies — the planner must pick and document: (a) **only append a mode segment when `mode==='remix'`** so score-mode hashes are byte-identical to today (zero cache invalidation for the unchanged score path — strongly preferred, aligns with D-03 "score unchanged"); or (b) append mode unconditionally and accept a one-time cache cold-start. Strategy (a) preserves the score path's cache exactly and is the minimal-regression choice. Note: cache misses are non-fatal (they just re-run the pipeline), but (a) avoids needless re-spend on the score path.
**Warning signs:** Score-mode analyses that used to hit cache now always re-run; latency regression on the score path.

### Pitfall 6: Zod `.refine` doesn't validate the mode↔input_mode coupling
**What goes wrong:** A `mode='remix'` + `input_mode='text'` payload (which D-04 forbids in the UI) could still reach the API and would produce a dead-end (text yields no Decode signal).
**Why it happens:** The UI hides Text in remix, but the API is the real boundary (CLAUDE.md: validate at boundaries).
**How to avoid:** Add `mode: z.enum(['score','remix']).default('score')` to `AnalysisInputSchema`, and extend the existing `.refine` to reject `mode==='remix' && input_mode==='text'` with a clear message. This makes the invalid state unrepresentable server-side too (D-04 rationale).
**Warning signs:** A remix+text row persists and Phase 3 Decode has no video signal to tear down.

### Pitfall 7: `AnalysisStreamInput` and `handleContentSubmit` drop the field
**What goes wrong:** `mode` set on `ContentFormData` but never forwarded — `Board.tsx:handleContentSubmit` builds `stream.start({...})` with an explicit allowlist of fields (it does NOT spread `data`).
**Why it happens:** `handleContentSubmit` (`Board.tsx:282-312`) constructs the stream input field-by-field; `AnalysisStreamInput` (`use-analysis-stream.ts:59`) is a closed interface.
**How to avoid:** Add `mode` to `AnalysisStreamInput`, `ContentFormData`, and explicitly add `mode: data.mode` in the `stream.start({...})` object. Three touch points; missing any one drops the value.
**Warning signs:** `mode='remix'` selected, but the row persists `mode='score'` (the default).

### Pitfall 8: ContentForm tab-coupling state desync (Remix → hidden Text was active)
**What goes wrong:** User on Text tab, then switches intent to Remix → Text tab is removed but `activeTab` still `'text'` → broken/empty render or stale `input_mode`.
**Why it happens:** `activeTab` is independent of the new intent state.
**How to avoid:** When intent flips to Remix, if `activeTab==='text'` reset it to `'video_upload'` (the D-04 default remix tab) and update `formData.input_mode` accordingly. When flipping back to Score, restore is not required (all tabs available) but `formData` must remain consistent.
**Warning signs:** Empty input area after selecting Remix from a Text-active state; submit disabled with no visible field.

### Pitfall 9: Tailwind v4 / backdrop-filter (project-known)
**What goes wrong:** Glass blur or very-dark tokens compile wrong (CLAUDE.md known issues).
**Why it happens:** Lightning CSS strips `backdrop-filter`; Tailwind v4 `oklch` inaccuracy for L<0.15.
**How to avoid:** The shells are flat dark cards (no glass needed) — the `MobileFrameCard` already uses solid `bg-[#18191a]` + inline `boxShadow`, and the canvas `GroupFrame` rect is solid. No backdrop-filter required for shells. If any blur is added, apply via React inline `style={{ backdropFilter }}`. Use exact hex for dark tokens.
**Warning signs:** Invisible/incorrect shell backgrounds; missing blur.

## Code Examples

### DecodeShellNode (DOM shell — clone shape from VerdictNode)
```tsx
// Source pattern: VerdictNode.tsx:84-89 + FrameHero.tsx:65 label idiom (verified)
// File: src/components/board/decode/DecodeShellNode.tsx
export function DecodeShellNode() {
  return (
    <div className="relative flex w-full flex-col gap-2" data-testid="decode-shell">
      <span className="text-[10px] uppercase tracking-[0.1em] text-white/45">Decode</span>
      <p className="max-w-[44ch] text-xs leading-[1.4] text-white/35" style={{ textWrap: 'balance' }}>
        Structural breakdown of why this video worked.
      </p>
    </div>
  );
}
// AdaptShellNode identical with label "Adapt" + descriptor
// "Niche-adapted concepts drawn from the source format."  (UI-SPEC §Copywriting)
```
*Note:* the frame's title bar + border come from `GroupFrame`/`GroupFrameOverlay`; the shell body may not even need to repeat the label if the overlay title bar already shows it — the planner should check whether `GroupFrameOverlay` renders the label from `layout.label` (it has a title-bar). If it does, the shell body is just the descriptor `<p>`. (UI-SPEC shows both label + descriptor; reconcile against the overlay's title-bar rendering during planning.)

### Mode-aware mobile order
```ts
// Source pattern: BoardMobile.tsx:24-31 (verified)
const MOBILE_ORDER_SCORE: GroupId[] = ['input','verdict','audience','actions','content-analysis','engine'];
const MOBILE_ORDER_REMIX: GroupId[] = ['input','decode','audience','adapt','content-analysis','engine'];
// renderBody switch adds: case 'decode': return <DecodeShellNode/>;  case 'adapt': return <AdaptShellNode/>;
```

### Content hash mode fold (score-path-safe strategy 5a)
```ts
// Source: prediction-cache.ts:31-48 (verified). Append mode segment ONLY for remix
// so score-mode hashes stay byte-identical (zero cache invalidation on score path).
export function computeContentHash(input: AnalysisInput, videoBuffer?: Buffer): string {
  const h = createHash("sha256");
  // ...existing per-input_mode update...
  if (input.mode === 'remix') h.update('::mode=remix'); // segment only in remix
  return h.digest("hex");
}
```

### Migration shape (D-12/D-13)
```sql
-- supabase/migrations/202606XXXXXXXX_add_mode_to_analysis_results.sql
ALTER TABLE analysis_results
  ADD COLUMN mode TEXT NOT NULL DEFAULT 'score'
  CHECK (mode IN ('score','remix'));
-- DEFAULT 'score' backfills all existing rows in the same statement (D-13).
-- No separate UPDATE needed: NOT NULL DEFAULT applies to existing rows on ADD COLUMN.
```

## Runtime State Inventory

> This phase adds a column and threads a value. It is additive, not a rename/migration of existing identifiers, but `mode` participates in the content hash (cache identity) — so a partial inventory is warranted.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `analysis_results` rows have no `mode` today. New column with `DEFAULT 'score'` backfills all historical rows in the ADD COLUMN statement (D-13). | Migration only; no separate data migration. |
| Live service config | None. No external service stores `mode`. Apify/Omni/DashScope are mode-agnostic (Phase 1 confirmed the ingestion path is shared). | None — verified by STATE.md Plan 03 (429 branch + pipeline mode-agnostic). |
| OS-registered state | None — pure web app on Vercel. | None. |
| Secrets/env vars | None — `mode` is a row field, not a secret/env name. | None. |
| Build artifacts | `database.types.ts` is a generated artifact carrying the row shape; it must gain `mode` (regen via Supabase CLI/MCP, or hand-edit Row/Insert/Update). The cache (`content_hash`) is runtime state: see Pitfall 5 — the score-path-safe hash strategy avoids invalidating existing `content_hash` rows. | Regenerate or hand-edit `database.types.ts`; pick hash strategy 5a. |

**The canonical question — after every file is updated, what runtime systems still cache the old shape?** The L1 in-memory cache (`prediction-cache.ts` `L1`) and the L2 `analysis_results.content_hash` rows. Strategy 5a (mode segment only in remix) keeps every existing score-mode hash byte-identical, so no existing cache entry is orphaned.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tiktok_url` analyzed caption text only | `tiktok_url` produces real Omni video signal via Supabase re-host + derive-and-drop | Phase 1 (2026-06-01, INGEST-01 closed) | Remix Link source is now valid (D-06); the remix path this phase routes into is real, not a stub |

**Deprecated/outdated:** None relevant.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `GroupFrameOverlay` renders the frame title from `layout.label` in its title bar, so the shell body may only need the descriptor `<p>` (not a repeated label). | Code Examples (DecodeShellNode note) | LOW — if the overlay does NOT show a title bar for these ids, the shell needs to render the label too (UI-SPEC includes it anyway). Planner must read the rest of `GroupFrameOverlay` (lines 60+) to confirm. |
| A2 | Adding `mode` to `PredictionResult` (optional) is the cleanest way to carry it from row → board without casts; `rowToPredictionResult` already spreads the raw row so it flows through at runtime. | Pitfall 4 | LOW — alternative is to read `mode` directly off the permalink/stream payload as a loose cast; either works. Affects typing ergonomics only. |
| A3 | Descriptor copy strings ("Structural breakdown of why this video worked." / "Niche-adapted concepts drawn from the source format.") are acceptable as the locked default. | UI-SPEC §Copywriting | LOW — D-11 leaves exact strings to discretion; these are neutral and date-free. User may tweak wording. |
| A4 | The board can derive `mode` from `stream.result.mode` during live analysis. The SSE `complete` payload is `finalResult` (`PredictionResult`); it carries `mode` only if `mode` is added to `PredictionResult`/the result object the pipeline returns. | Pitfall 4 / A2 | MEDIUM — if the pipeline/aggregator does NOT echo `mode` onto the result, the live board (pre-reload) won't know mode from `stream.result`. **Mitigation:** the board already holds the submitted `mode` in `handleContentSubmit` scope; the live layout can use the *submitted* mode (client-side state) and rely on the persisted row only for permalink reload. Planner should wire live mode from the form-submit value, and reload mode from the row — both must agree (success criterion 5). |

## Open Questions (RESOLVED)

1. **Where does the live board read `mode` from before reload?**
   - What we know: `handleContentSubmit` knows `mode` at submit time (it's in `ContentFormData`). The board reads layout from `resolveBoardLayout(measuredH)` with no mode today.
   - What's unclear: Whether to (a) hold a `mode` board-store/local state set at submit and on permalink hydrate, or (b) thread `mode` onto `PredictionResult` and read from `stream.result`.
   - Recommendation: Add a small `mode` slice to `board-store` (or local `Board` state) set by `handleContentSubmit` for the live path, and overwritten from the permalink row's `mode` on `/analyze/[id]` hydrate. This guarantees live + reload agree (criterion 5) without depending on the pipeline echoing `mode`. Confirm during planning by reading `board-store.ts`.
   - **RESOLVED (Plan 03 Task 3):** `boardMode` is derived in `Board.tsx` as `stream.result.mode ?? permalinkQuery.data.mode ?? 'score'`. Plan 01 added optional `mode` to `PredictionResult` + persists it at both INSERT sites, and `/api/analysis/[id]` `select('*')` carries the row field — so the submit→row→result chain echoes mode on the live path and the persisted row is the source of truth on reload. No new `board-store` slice needed (kept simpler than the original recommendation); if the SSE complete payload does not echo mode, Plan 03 T3 additionally holds the submitted intent in local Board state for the live path (A4 fallback).

2. **Does `GroupFrameOverlay` show a title bar (label) for decode/adapt?**
   - What we know: It has a title-bar region and `EMPTY_STATE_COPY`/`ARIA_LABEL` maps keyed by id.
   - What's unclear: Exact title-bar rendering for arbitrary ids (only read lines 1-60).
   - Recommendation: Read `GroupFrameOverlay.tsx` in full during planning; add `decode`/`adapt` to `ARIA_LABEL` and `EMPTY_STATE_COPY` to prevent `undefined` lookups, and decide whether the shell repeats the label.
   - **RESOLVED (Plan 02 Task 3):** `GroupFrameOverlay.tsx:157` renders the title from `layout.label` (confirmed by reading the full file this session — Assumption A1 holds), so the shell body renders the descriptor `<p>` ONLY (no repeated label). Plan 02 T3 adds `decode`/`adapt` keys to both `ARIA_LABEL` ("Decode frame — structural breakdown" / "Adapt frame — niche concepts") and `EMPTY_STATE_COPY` (empty titles so the empty-state block skips) to prevent `undefined` lookups.

3. **`database.types.ts` regen vs hand-edit?**
   - What we know: It's generated; Supabase MCP `generate_typescript_types` exists.
   - Recommendation: Prefer MCP regen after the migration is applied; fall back to a targeted hand-edit of the `analysis_results` Row/Insert/Update blocks (add `mode: string` / `mode?: string`). Hand-edit is low-risk and avoids a full regen diff.
   - **RESOLVED (Plan 01 Tasks 2 & 3):** Plan 01 T2 hand-edits `database.types.ts` — `mode: string` on Row, `mode?: string` on Insert/Update — so typecheck passes in the same wave. Plan 01 T3 (the [BLOCKING] DB-push checkpoint) optionally regenerates types via Supabase MCP `generate_typescript_types` after the migration applies and diffs against the hand-edit, reconciling any drift. Hand-edit is the authoritative fallback per this question.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase (migrations + DB) | `mode` column, persistence | ✓ | project-linked | — (MCP `apply_migration` available) |
| Node `crypto` | content hash | ✓ | builtin | — |
| Vitest | unit tests (board-constants, prediction-cache) | ✓ | installed (test files exist) | — |
| Next.js dev/build | the whole app | ✓ | 15.x | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (unit/component) + existing `__tests__` dirs `[VERIFIED: test files listed]` |
| Config file | (project root vitest config — present; existing suites run) |
| Quick run command | `npm test -- <path>` (vitest filtered) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REMIX-01 | Intent selector renders, default Score, Remix hides Text + caption, coupling resets activeTab | component | `npm test -- src/components/app/__tests__/content-form.test.tsx` | ❌ Wave 0 (no content-form test today) |
| REMIX-01 | `mode` threaded to API payload | unit/component | covered in content-form / Board submit test | ❌ Wave 0 |
| REMIX-01 | `AnalysisInputSchema` accepts mode, rejects remix+text | unit | `npm test -- src/lib/engine/__tests__/types` (or extend prediction-cache/types test) | ❌ Wave 0 (schema test may not exist) |
| REMIX-02 | `resolveBoardLayout(measured,'remix')` swaps verdict→decode, actions→adapt, bounds identical; score mode unchanged | unit | `npm test -- src/components/board/__tests__/board-constants.test.ts` | ✅ (extend existing 56-assertion suite) |
| REMIX-02 | Desktop dispatch renders DecodeShellNode/AdaptShellNode in remix | component | `npm test -- src/components/board/__tests__/Board.test.tsx` | ✅ (extend) |
| REMIX-02 | Mobile order + renderBody for decode/adapt; score order unchanged | component | `npm test -- src/components/board/__tests__/BoardMobile.test.tsx` | ✅ (extend) |
| REMIX-02 (crit 5) | `computeContentHash` differs for same URL across mode; score-mode hash unchanged | unit | `npm test -- src/lib/engine/__tests__/prediction-cache.test.ts` | ✅ (extend) |
| REMIX-02 (crit 5) | mode survives permalink reload (row → layout) | component/integration | extend `Board.test.tsx` permalink path | ✅ (extend) |

### Sampling Rate
- **Per task commit:** `npm test -- <touched test file>` + `npm run lint`
- **Per wave merge:** `npm test` (full) + `npm run build`
- **Phase gate:** Full suite green + build succeeds before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/app/__tests__/content-form.test.tsx` — covers REMIX-01 selector + coupling (likely new)
- [ ] `src/components/board/decode/__tests__/DecodeShellNode.test.tsx` + adapt equivalent — shell renders label + descriptor, no skeleton
- [ ] Schema test for `mode` enum + remix+text rejection (extend types test or add one)
- [ ] Extend existing `board-constants.test.ts`, `prediction-cache.test.ts`, `Board.test.tsx`, `BoardMobile.test.tsx` (all exist)

## Security Domain

> `security_enforcement` default = enabled. This phase touches a system boundary (`/api/analyze` input) and persistence.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | unchanged — route already auths via Supabase `getUser()` |
| V3 Session Management | no | unchanged |
| V4 Access Control | yes | `analysis_results` reads/writes already scoped by `user_id` (route + cache lookup `.eq('user_id', userId)`); `mode` adds no new access surface. Keep the user_id filter on all `mode`-bearing queries. |
| V5 Input Validation | yes | `mode` validated via `AnalysisInputSchema` Zod enum (`z.enum(['score','remix']).default('score')`) + `.refine` rejecting remix+text. CHECK constraint at DB layer is defense-in-depth. |
| V6 Cryptography | no | content hash is non-security SHA-256 (cache identity, not auth) — unchanged |

### Known Threat Patterns for Next.js + Supabase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Mode tampering (client sends arbitrary mode) | Tampering | Zod enum + DB CHECK constraint reject any non-`score`/`remix` value |
| Cache cross-tenant leak | Information Disclosure | Existing `cacheKey` includes `userId`; `lookupPredictionCache` filters `.eq('user_id', userId)` — unchanged, mode doesn't widen scope |
| Cost exhaustion via remix paste-spam | DoS | Existing mode-agnostic daily rate limiter (`route.ts:296-314`, STATE Plan 03) covers remix path — do NOT add a second limiter |
| Invalid remix+text dead-end persisted | Tampering (logic) | `.refine` rejects remix+text server-side (Pitfall 6) |

## Sources

### Primary (HIGH confidence — read this session)
- `src/components/app/content-form.tsx` — selector host, `MODE_CONFIG`, `ContentFormData`, `validate`, `isSubmitDisabled`, tab coupling
- `src/components/board/board-constants.ts` — `GROUP_FRAMES`, `resolveBoardLayout`, `AUTO_HEIGHT_FRAMES`, `computePresetTargets`, `CAMERA_PRESET_TARGETS`
- `src/components/board/board-types.ts` — `GroupId`, `CameraPresetKey`
- `src/components/board/Board.tsx` — overlay dispatch (470-484), `handleContentSubmit` (282-312), mobile branch
- `src/components/board/BoardMobile.tsx` — `MOBILE_ORDER`, `renderBody`
- `src/components/board/GroupFrame.tsx` (grep) — confirms chrome is Konva, body is DOM
- `src/components/board/GroupFrameOverlay.tsx` — `EMPTY_STATE_COPY`, `ARIA_LABEL`, DOM body slot
- `src/components/board/verdict/VerdictNode.tsx` — DOM node shape to clone
- `src/components/board/_kit/FrameHero.tsx` + `_kit/index.ts` — label idiom, kit exports
- `src/components/board/MobileFrameCard.tsx` — mobile card chrome
- `src/hooks/queries/use-analysis-stream.ts` — `AnalysisStreamInput`, dispatch, permalink hydrate
- `src/app/api/analyze/route.ts` — validation, `buildInsertRow`, placeholder INSERT, mode-agnostic rate limiter
- `src/app/api/analysis/[id]/route.ts` — `select('*')` permalink read
- `src/lib/engine/cache/prediction-cache.ts` — `computeContentHash`, `cacheKey`, `lookupPredictionCache`, `rowToPredictionResult`
- `src/lib/engine/types.ts` — `AnalysisInputSchema`, `AnalysisInput`, `PredictionResult` shape
- `src/types/database.types.ts` — `analysis_results` Row/Insert (no `mode`/`parent_id` today)
- `supabase/migrations/` — latest `20260531000003`; additive timestamped style
- `.planning/STATE.md` — Plan 03 mode-agnostic confirmations
- `.planning/REQUIREMENTS.md` — REMIX-01/02 acceptance, Out-of-Scope
- `.planning/phases/02.../02-CONTEXT.md` + `02-UI-SPEC.md` — locked decisions, visual contract
- Codebase grep: no pre-existing `'remix'`/`mode==='remix'` symbol → greenfield for `mode`

### Secondary (MEDIUM)
- `src/components/command-bar/CommandBar.tsx` (grep) — `onContentSubmit` wiring confirms form→board→stream chain

### Tertiary (LOW)
- None — all claims sourced from read code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; all libs verified in codebase
- Integration points: HIGH — every file in CONTEXT/UI-SPEC `canonical_refs` read and confirmed accurate
- Architecture (DOM-not-Konva correction): HIGH — confirmed via `GroupFrame.tsx` (react-konva) vs `GroupFrameOverlay`/`VerdictNode` (DOM)
- Pitfalls: HIGH for 1,2,5,6,7,8 (read directly); MEDIUM for 3,4 (camera preset + live-mode-source require one more file read during planning — flagged as Open Questions)

**Research date:** 2026-06-01
**Valid until:** 2026-06-30 (stable internal codebase; re-verify only if board-constants or content-form is refactored before planning)
