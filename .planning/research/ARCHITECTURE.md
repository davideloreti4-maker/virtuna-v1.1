# Architecture Research — Numen Surface (v5.0)

**Domain:** Mobile-first thread-per-video intelligence surface over an existing stage-emitting AI engine (Next.js 15 / Supabase / Vercel)
**Researched:** 2026-06-11
**Confidence:** HIGH (verified against the live codebase — every integration point below cites a real file)

> **Headline finding.** The hardest parts of this milestone are **already built and shipped** in the engine work. The pipeline already emits a typed `StageEvent` discriminated union at every stage boundary (`events.ts`); `/api/analyze` already wraps it in a real SSE `ReadableStream`; `panel-mapping.ts` is already a stage→view-model reducer; `analysis_chats` is already a per-analysis thread table; and the verdict-as-band already exists as `HeroBlock` + `verdict-derive.ts`. **Numen Surface is overwhelmingly a re-composition of existing data flows into new mobile-native blocks — not new backend plumbing.** The architectural risk is concentrated in exactly one place the vision already flagged: the **view-model layer (~40 → ~10 fields)**, which is ENG-06 D-12.

---

## Standard Architecture

### System Overview (target — Numen Surface)

```
┌──────────────────────────────────────────────────────────────────────┐
│  CLIENT (mobile-first thread; desktop = same thread widened)           │
│  ┌───────────┐  ┌──────────────────┐  ┌────────────┐  ┌────────────┐  │
│  │ Home list │  │ Reading thread   │  │ Composer / │  │ Desktop    │  │
│  │ (Readings)│  │ (blocks + throne)│  │ tool chips │  │ instrument │  │
│  └─────┬─────┘  └────────┬─────────┘  └─────┬──────┘  └─────┬──────┘  │
│        │                 │                  │               │         │
│        │        useReadingStream (SSE reader; stage→block)  │         │
├────────┼─────────────────┼──────────────────┼───────────────┼─────────┤
│  VIEW-MODEL  (NEW — the crux)                                          │
│  reading-view-model.ts:  PredictionResult(~40) → ReadingBlock[](~10)   │
│  stage→block readiness:  panel-mapping.ts (EXISTS, extend block ids)   │
│  verdict band+why:       verdict-derive.ts + HeroBlock (EXISTS)        │
├────────────────────────────────────────────────────────────────────── ┤
│  SERVER (Next.js App Router — route handlers, server actions)          │
│  POST /api/analyze (SSE, EXISTS)   GET /api/analyze/[id]/stream (resume)│
│  POST /api/analyze/[id]/chat (instant follow-up, EXISTS)               │
│  POST /api/analyze/[id]/tool/[name] (NEW — agentic)                    │
│  GET  /api/analysis/history (home list, EXISTS)                        │
├──────────────────────────────────────────────────────────────────────┤
│  ENGINE (UNTOUCHED — v4.1 Apollo 3.19.0)                               │
│  runPredictionPipeline → onEvent(StageEvent) → aggregateScores         │
│  (Omni → Audience-Sim → Apollo) → PredictionResult                     │
├──────────────────────────────────────────────────────────────────────┤
│  PROVIDERS / STORES                                                    │
│  ScrapingProvider (Apify, EXISTS)   Qwen/DashScope   Supabase Storage  │
│  Postgres: analysis_results · analysis_chats · projects (all EXIST)    │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status / Implementation |
|-----------|----------------|--------------------------|
| Engine pipeline | Produce `PredictionResult`; emit `StageEvent` at each `timed()` boundary | **EXISTS** `src/lib/engine/pipeline.ts`, `aggregator.ts`, `events.ts`. Untouched. |
| SSE forwarder | Stream `started`/`stage_start`/`stage_end`/`complete`/`error` over `text/event-stream` | **EXISTS** `src/app/api/analyze/route.ts` (`ReadableStream`, `send(event,data)`, `maxDuration=300`, `X-Accel-Buffering: no`) |
| Stream-resume route | Re-attach to an in-flight or persisted run on reload | **EXISTS** `src/app/api/analyze/[id]/stream/route.ts` (reads placeholder row + `variants.filmstrip_segments`) |
| Stage→view-model reducer | Map stage names → which blocks are loading/ready/error | **EXISTS** `src/lib/engine/panel-mapping.ts` (`STAGE_TO_PANEL`, `panelReadyFromStages`) — **extend, don't rebuild** |
| **Reading view-model** | Map ~40 `PredictionResult` fields → ~10 value-bearing `ReadingBlock`s | **NEW — the architectural crux (ENG-06 D-12 / F43)** |
| Verdict derivation | Band + one-line why from `HeroBlock` + score/confidence | **EXISTS** `HeroBlock` in `types.ts`, `verdict-derive.ts` (`bandLabel`, `confidenceRange`, `comparativeLine`) |
| Thread store | Persist Reading turn + follow-ups + tool results | **EXISTS for chat** `analysis_chats`; **EXTEND** for tool-result blocks |
| Home list | Vertical list of past Readings (verdict cards) | **EXISTS data** `GET /api/analysis/history`; **NEW UI** |
| Instant follow-up | Re-interpret existing data, no new spend | **EXISTS** `POST /api/analyze/[id]/chat` (Qwen, grounds on persisted row) |
| Agentic tool | Fetch new data (competitors/back-catalog/trends) → append block | **NEW route** wrapping existing `ScrapingProvider` (`src/lib/scraping/apify-provider.ts`) |
| Ingestion | share-target / upload / paste-URL → kickoff | **EXISTS plumbing** `resolveAndRehost`, Storage signing; **NEW** share-target manifest + thread-creation entry |

---

## Recommended Project Structure

```
src/
├── app/
│   ├── (app)/                       # NEW route group — the Numen shell
│   │   ├── page.tsx                 # Home = list of past Readings (server comp)
│   │   ├── reading/[id]/page.tsx    # Per-video thread (replaces /analyze board route)
│   │   └── new/                     # Ingestion entry (upload / paste / share-target landing)
│   ├── api/analyze/
│   │   ├── route.ts                 # EXISTS — SSE kickoff (keep as-is)
│   │   └── [id]/
│   │       ├── stream/route.ts      # EXISTS — resume/replay
│   │       ├── chat/route.ts        # EXISTS — instant follow-up
│   │       └── tool/[name]/route.ts # NEW — agentic tool execution
│   └── manifest.ts / share-target   # NEW — PWA share-target (Android share-sheet)
├── lib/
│   ├── engine/                      # UNTOUCHED (presentation-layer milestone)
│   │   ├── events.ts                # EXISTS — StageEvent union (the seam)
│   │   └── panel-mapping.ts         # EXTEND — add Numen block ids
│   ├── reading/                     # NEW — the view-model layer
│   │   ├── view-model.ts            # PredictionResult → ReadingBlock[] (the crux, D-12)
│   │   ├── block-types.ts           # ReadingBlock discriminated union (~10 kinds)
│   │   ├── verdict.ts               # re-export/lift verdict-derive (band + why)
│   │   └── stage-to-block.ts        # extend STAGE_TO_PANEL → block readiness
│   ├── thread/                      # NEW — thread assembly
│   │   └── thread-model.ts          # Reading turn + chat turns + tool turns → ordered messages
│   ├── tools/                       # NEW — agentic tool registry
│   │   ├── registry.ts              # tool id → {label, kind: instant|agentic, runner}
│   │   └── competitors.ts           # wraps ScrapingProvider
│   └── scraping/                    # EXISTS — ScrapingProvider/Apify (reuse)
└── components/
    ├── reading/                     # NEW — the block vocabulary (mobile-native)
    │   ├── ReadingThread.tsx        # thread container (the spine)
    │   ├── ThroneSlot.tsx           # reserved verdict slot (forms last)
    │   ├── blocks/                  # one component per ReadingBlock kind
    │   └── Composer.tsx + ToolChip  # follow-ups + tools
    └── board/                       # RETIRE as primary → desktop instrument only
```

### Structure Rationale

- **`lib/reading/` is new and load-bearing.** It is the only place the ~40→~10 mapping lives. Keeping it a pure module (no React, no fetch) makes it unit-testable against persisted `PredictionResult` fixtures — critical because the SMOKE GATE must validate it against *real* output before any UI consumes it.
- **`lib/engine/` stays frozen.** Vision §7/§7a: this is a presentation milestone. The only engine-adjacent edit is *extending* `panel-mapping.ts` block ids (it was explicitly designed as "the contract" for surfaces to import).
- **`components/board/` is not deleted — it is demoted.** Vision §4 keeps the dense board as the desktop-only instrument layer. Build order ships mobile thread first; board survives untouched behind a desktop breakpoint until a later phase.

---

## Architectural Patterns

### Pattern 1: Stage-reveal via the existing StageEvent SSE (NOT token streaming)

**What:** The engine already calls `onEvent(StageEvent)` at every `timed()` boundary; `/api/analyze` already forwards those as named SSE events. The client reader translates each `stage_end` into a *block materialization*, not text tokens.

**When to use:** The Reading's first turn. This is the vision's "stage-reveal, not chatbot text streaming."

**Trade-offs:** Reuses 100% of the existing transport (no new wrapper needed). The only mismatch: `STAGE_TO_PANEL` keys (`wave_1`, `wave_2`, `wave_3_personas`, `aggregator`) are the *old board panel* names — these must be remapped to Numen block ids, and the verdict must be wired to `aggregator` (last stage) so it "forms last," matching vision §4.

**Example:**
```typescript
// StageEvent union (events.ts, EXISTS):
// { type: "stage_start"; stage; wave }
// { type: "stage_end";   stage; wave; duration_ms; ok; warning? }
// client reader (NEW useReadingStream): on stage_end → mark block(s) ready
const blocks = stageToBlock(stage);             // extend STAGE_TO_PANEL
for (const b of blocks) setReady(b, ev.ok ? "ready" : "error");
// verdict block keyed to "aggregator" stage → crystallizes last (throne)
```

### Pattern 2: View-model layer — the ~40→~10 prune (ENG-06 D-12, F43)

**What:** A pure function `toReadingBlocks(result: PredictionResult): ReadingBlock[]` that selects only value-bearing fields and shapes them into the ~10 block kinds the Reading composes. `panel-mapping.ts` and `verdict-derive.ts` are the *precedent* (they already do honest, per-field derivation that "omits what isn't present").

**When to use:** Between every engine output (live SSE `complete` OR persisted row replay) and the UI. Both paths must funnel through the same function so a live Reading and a re-opened resting document are byte-identical.

**Trade-offs:** This is the single highest-risk artifact. Doing it wrong = the surface re-introduces the F36/F38/F43 problems (three scorecards, jargon, bloat) the rebrand exists to fix. Doing it as ENG-06 D-12 (surface demand-driven prune) means it is designed *once*, driven by what the blocks actually need.

**Candidate value-bearing fields (verify at SMOKE GATE — this is the D-12 work):**
`hero` (`HeroBlock`: verdict_line / ceiling / the_one_fix / go_no_go / post_window), `overall_score` + `confidence` + `confidence_label` (→ band, demoted to evidence), `verbatim` (hook + per-segment text), `heatmap` (segments / personas / weighted_curve), `counterfactuals` (band-adaptive rewrites), `emotion_arc`, `reasoning`, `anti_virality_gated` / `analysis_unavailable` (honesty states), `optimal_post_window`, `signal_availability` (degradation honesty). Everything else (raw factors, hook_decomposition sub-scores, ml_score, trend_score, gemini_score, feature_vector) is candidate **dead-tail** for the Reading.

**Example:**
```typescript
// lib/reading/view-model.ts (NEW)
export function toReadingBlocks(r: PredictionResult): ReadingBlock[] {
  return [
    verdictBlock(r.hero, r.overall_score, r.confidence, r.anti_virality_gated), // throne
    hookBlock(r.verbatim?.hook),
    retentionBlock(r.heatmap),
    fixBlock(r.counterfactuals, r.hero?.the_one_fix),
    // ...~10 total; null-omitting like verdict-derive.ts
  ].filter(Boolean);
}
```

### Pattern 3: Thread = one analysis_results row + ordered turn log

**What:** A "thread" is not a new aggregate. It is: the `analysis_results` row (the Reading's source data) + the ordered `analysis_chats` turns (follow-ups + tool results) belonging to that `analysis_id`. The home list is `GET /api/analysis/history`. Per-video isolation (vision: "per-video threads, not one persistent relationship") falls out naturally — the thread is keyed by `analysis_id`.

**When to use:** Every Reading. Replay on reload = read row → `toReadingBlocks` (Reading turn) + read `analysis_chats` (tail).

**Trade-offs:** Reuse is near-total. The one schema gap: `analysis_chats.role IN ('user','assistant')` and `content TEXT` cannot represent a *structured tool-result block*. Resolution below (Pattern 4).

### Pattern 4: Agentic tool turn — provider-backed, persisted as a structured turn

**What:** A tool tap → `POST /api/analyze/[id]/tool/[name]` → tool registry runner → `ScrapingProvider` (Apify) → result persisted as a chat turn → appended as a block. Latency is forgiven inside the thread ("working…" beat); failures are voiced in-persona (vision §4), never error toasts.

**When to use:** Agentic follow-ups (competitors / back-catalog / trends / brand-fit). Instant follow-ups keep using `/chat` (no new spend).

**Trade-offs:** Two viable persistence shapes for tool results:
- **(Recommended) Extend `analysis_chats`:** add `kind TEXT DEFAULT 'text'` + `payload JSONB NULL` + widen the role check to allow `'tool'`. Minimal migration, keeps one ordered turn log, replay stays trivial.
- (Alternative) New `analysis_tool_runs` table joined by `analysis_id` + `created_at`. More normalized, but forces the client to merge two ordered streams to rebuild the thread. Avoid unless tool runs need independent lifecycle (re-run, cache, cost tracking) — which they may later, so leave the door open.

**Example:**
```typescript
// POST /api/analyze/[id]/tool/competitors  (NEW)
const provider = createScrapingProvider();          // EXISTS
const data = await provider.scrapeProfile(handle);  // Apify behind abstraction
await supabase.from("analysis_chats").insert({
  analysis_id, user_id, role: "tool",
  kind: "competitor_result", payload: data, content: summarizeInPersona(data),
});
```

---

## Data Flow

### Ingestion → stage-reveal kickoff → first block

```
share-sheet / upload / paste-URL
    ↓ (share-target manifest OR /new form)
[client] resolve input → POST /api/analyze (Accept: text/event-stream)
    ↓
[server] auth → rate-limit → cache lookup → INSERT placeholder row (id, overall_score=null)
    ↓                                          ↑ (this id IS the thread/Reading id)
    ↓  open ReadableStream → send("started",{id})  → client navigates to /reading/[id]
runPredictionPipeline(onEvent=send stage_start/stage_end) → aggregateScores
    ↓ each stage_end → SSE → useReadingStream → stageToBlock() → block materializes
    ↓
send("complete", PredictionResult) → toReadingBlocks() → verdict crystallizes in throne
    ↓
UPSERT analysis_results by id (row becomes the resting document)
```
*All plumbing in the first three lines EXISTS.* `started` carries the id (`route-started-event.test.ts` confirms it), so the client can navigate to the thread URL immediately and the throne renders empty-then-forming. Cache hit short-circuits to a single `complete` event (already implemented) — the Reading then renders instantly with no stage-reveal, which is correct.

### Reading replay (re-open from home list)

```
/reading/[id] (server) → read analysis_results row (EXISTS persisted: hero, heatmap,
   verbatim, counterfactuals, emotion_arc, confidence_label, anti_virality_gated...)
    ↓ toReadingBlocks(row)  → identical blocks to the live "complete" path
    ↓ read analysis_chats(analysis_id) → follow-up + tool turns
    ↓ render settled thread, opening ON the verdict (vision §4)
```
Resting-document re-openability needs **no new persistence** — the engine work already persists every value-bearing field (migrations `20260531000000`, `20260604000000`, `add_heatmap`, `variants.hero`). The only addition is the tool-turn `kind`/`payload` column (Pattern 4).

### Follow-up flows

```
INSTANT  : tap/text → POST /api/analyze/[id]/chat → Qwen grounded on row → SSE tokens
           → persist user+assistant turns (EXISTS, zero engine spend)
AGENTIC  : tap → POST /api/analyze/[id]/tool/[name] → ScrapingProvider → persist tool turn
           → append result block (NEW; "working…" beat; in-persona failure)
```

---

## Scalability & Failure

| Concern | Mechanism | Status |
|---------|-----------|--------|
| Long run vs Vercel 300s cap | `maxDuration=300`, `nodejs` runtime, `X-Accel-Buffering: no` | EXISTS; engine cuts brought E2E to ~62–74s |
| Reload mid-run | placeholder row + `GET /[id]/stream` resume | EXISTS |
| DashScope 429 on live rig | retry/circuit-breaker in engine; **SMOKE GATE watch item** | EXISTS infra; verify at gate |
| Tool latency/failure | in-thread "working…" + in-persona error turn | NEW (Pattern 4) |
| Cross-user IDOR | RLS on `analysis_results` + `analysis_chats`; server-set `user_id` | EXISTS |
| Honesty (no fabricated verdict) | `analysis_unavailable` / `anti_virality_gated` block states | EXISTS in `PredictionResult` — view-model MUST surface these |

---

## New vs Modified (explicit, for the roadmapper)

**NEW:**
- `lib/reading/` — view-model (`toReadingBlocks`), block types, stage→block extension. **(ENG-06 D-12 / F43 — the crux.)**
- `lib/thread/`, `lib/tools/` (registry + competitor runner wrapping `ScrapingProvider`).
- `POST /api/analyze/[id]/tool/[name]` route.
- `components/reading/` — ReadingThread, ThroneSlot, ~10 block components, Composer, ToolChip.
- Home list UI + per-video thread route (`(app)/` route group).
- PWA share-target (manifest + landing handler).
- Migration: extend `analysis_chats` with `kind` + `payload` + `'tool'` role.
- Ground-up design-token system (vision §6 — locked there, out of research scope).

**MODIFIED:**
- `panel-mapping.ts` — remap/extend `STAGE_TO_PANEL` to Numen block ids; verdict→`aggregator` (forms last).
- `verdict-derive.ts` — lift band+why into `lib/reading/verdict.ts` (band-only, number demoted).
- `components/board/` — gated to desktop instrument breakpoint (demoted, not deleted).

**UNTOUCHED:**
- Entire `lib/engine/` (pipeline, aggregator, qwen, Apollo) — `ENGINE_VERSION 3.19.0`.
- `events.ts` `StageEvent` union (the seam).
- SSE transport in `/api/analyze` + `/[id]/stream` + `/[id]/chat`.
- `ScrapingProvider` / Apify (consumed, not changed).

---

## Build Order (respects vision preconditions)

1. **View-model + block types FIRST (ENG-06 D-12 / F43)** — pure `lib/reading/` against *persisted-row fixtures*. No UI, no live engine. Defines the ~10 blocks and the field prune. (Vision: data-contract before block composition.)
2. **SMOKE GATE (hard precondition)** — one real-video E2E; confirm the consumed fields are real + honest (F46/F47/F22/F23), capture ENG-03 latency, watch DashScope 429. *Gates all live-output consumption.*
3. **Mobile Reading thread (stage-reveal + throne)** — `useReadingStream` over the existing SSE; blocks materialize; verdict forms last. Replay path shares `toReadingBlocks`.
4. **Home list + ingestion** — `/analysis/history` list UI; upload/paste; share-target.
5. **Follow-ups: instant (`/chat`, exists) then agentic tool route** (+ `analysis_chats` kind/payload migration). Monetization = an oracle-initiated tool turn.
6. **Desktop instrument layer LAST** — same thread widened; the demoted board survives here. Mobile ships before desktop (vision §4/§8).

**Dependency invariants:** (1 → 2) view-model must exist to know *what to smoke-test*; (2 → 3) no Reading-against-real-output before the gate; (3 → 6) mobile before desktop. Steps 4/5 can parallelize once 3 lands.

---

## Sources

- `src/lib/engine/events.ts` — `StageEvent` discriminated union (HIGH, the seam). [verified]
- `src/lib/engine/panel-mapping.ts` — `STAGE_TO_PANEL` + `panelReadyFromStages` (HIGH, existing view-model precedent). [verified]
- `src/app/api/analyze/route.ts` — SSE `ReadableStream`, `send(event,data)`, placeholder-row UPSERT, cache short-circuit, `maxDuration=300` (HIGH). [verified]
- `src/app/api/analyze/[id]/stream/route.ts` — resume/replay route (HIGH). [verified]
- `src/app/api/analyze/[id]/chat/route.ts` + `supabase/migrations/20260607000000_analysis_chats.sql` — thread turn log, RLS, Qwen-grounded follow-ups (HIGH). [verified]
- `src/lib/engine/types.ts` — `HeroBlock`, `confidence_label`, `anti_virality_gated`, `analysis_unavailable`, `verbatim`, `heatmap`, `counterfactuals` (HIGH, the ~40 field surface). [verified]
- `src/components/board/verdict/verdict-derive.ts` — `bandLabel`/`confidenceRange`/`comparativeLine` (HIGH, band+why precedent). [verified]
- `src/lib/scraping/apify-provider.ts` + PROJECT.md "ScrapingProvider abstraction" decision (HIGH, agentic tool backend). [verified]
- `src/app/api/analysis/history/route.ts` — home-list data (HIGH). [verified]
- Migrations `20260526100000_add_projects`, `..._add_mode/parent_id`, `..._add_heatmap`, `..._persist_engine_emitted/verbatim` — persistence already covers replay (HIGH). [verified]
- `.planning/NUMEN-SURFACE-VISION.md` §4/§7/§7a/§7b, `.planning/ENGINE-MAP.md` (HIGH, milestone intent). [verified]
