# Phase 1: Engine & Thread Foundation - Research

**Researched:** 2026-06-17
**Domain:** Next.js 16 App Router + Supabase (Postgres/RLS) + Qwen/DashScope engine — text-mode persona simulation, generalized thread/message persistence, typed-block renderer registry, universal composer
**Confidence:** HIGH (this is an in-repo extension phase; nearly every claim is grounded in code read this session, not external docs)

## Summary

Phase 1 is almost entirely an **internal-architecture** phase: there are **no new external packages to install**. The stack it needs — `zod@^4.3.6`, `@supabase/supabase-js@^2.93.1`, the OpenAI-compatible Qwen client, `react-markdown@^10` + `rehype-sanitize@^6`, the existing `src/components/reading/` renderer set — is already present and battle-tested in the repo. The work is composing these into four new seams: a **text-mode engine branch**, a **tool-runner contract**, a **renderer registry (SSOT)**, and **threads/messages persistence**, fronted by **composer tool chips**.

The single most important architectural fact: the existing video engine (`pipeline.ts` → `aggregator.ts` → `runFold`) is a **10-stage orchestrator whose `runFold` step already does exactly the persona simulation Phase 1 needs** — one bounded Qwen call returns all 10 archetypes with per-persona behavioral intents (`watch_through_pct`, `share_intent`, `scroll_past_second`, …). The text-mode Flash path is **not a rewrite of the engine**: it is a *new thin caller* that invokes a fold-style persona prompt with TEXT input (no video, no segments), reuses `persona-registry.ts` archetype definitions, and aggregates the per-persona stop/scroll verdicts into a band + audience-fraction. The protected SIM-1 Max path (`runPredictionPipeline` / `aggregateScores`) must be left byte-untouched; `ENGINE_VERSION` (`3.19.0`) must NOT be bumped because text-mode adds a *parallel* function, not a change to video scoring.

The thread/message model mirrors the proven `analysis_chats` migration (RLS pattern: `user_id = auth.uid()`, server never trusts body `user_id`) and the `analysis_results` JSONB-on-the-row grain. The renderer registry is a `Record<blockType, {component, schema}>` SSOT validated with zod at BOTH the tool-runner output boundary and on message rehydration — unknown/invalid blocks degrade to a static placeholder, never executed. This is the structural enforcement of "no model-generated UI."

**Primary recommendation:** Build text-mode as a **standalone `runFlashTextMode()` function** in a new `src/lib/engine/flash/` module that reuses `persona-registry.ts` + a fold-shaped Zod schema, returns a renderer-ready `{band, audienceFraction, personas[]}` payload, and NEVER imports into `pipeline.ts`/`aggregator.ts`. Model the `threads`/`messages` tables on `analysis_chats` RLS verbatim. Author the renderer registry as one TS module exporting `BLOCK_REGISTRY` consumed by both the tool-runner validator and the message renderer.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Text-mode Flash output (ENGINE-01)**
- **D-01:** Output is **aggregate-forward** — lead with one band headline + a 1-line verdict; the 10 persona reactions live behind a tap/expand (reuses `persona-cloud`). Chosen so ranked lists in P3/P4 stay scannable.
- **D-02:** The pull-score is **banded + relative** — `Strong / Mixed / Weak pull` — with a supporting **audience-fraction** ("4/10 stop"). NO fabricated 0-100 number (honesty spine: text discrimination is coarse). The band maps to the existing `score-gauge` renderer (distinct styling from Max — see D-09).
- **D-03:** Each persona (behind the expand) returns a **stop/scroll verdict + a one-line first-person voice quote** ("seen this myth-bust 100x, scrolling"). The verdict drives the aggregate band math; the quote is the audience texture that sells the moat. This is also the exact data shape custom personas will emit later.
- **D-04:** **Mode framing (Hook / Idea / chat) is a tool-runner parameter**, not a separate engine function. The caller passes the framing; it swaps the persona *question* and the band *verbiage*, not the personas themselves. One engine path. Rides the THREAD-06 contract so Scripts/Remix framings slot in later without new functions.
- **D-05 (forward constraint):** Architect the text-mode path so **personas are data-driven / swappable (config rows), NOT hardcoded** — so user-creatable custom audiences (v6.1+) drop in without an engine rewrite.

**Composer & routing (THREAD-02)**
- **D-06:** **Explicit tool selection — NOT auto-detect.** Creators must know which tool/skill they're invoking because it consumes credits. Auto-routing a prompt to a credit-spending tool is a trust violation.
- **D-07:** Selection via **tool chips on the composer** (Test · Idea · Hooks · Chat). Active tool is always visible; selecting one updates the placeholder + send action; a **cost slot** is reserved on the chip. URL/upload may hard-route to Test as a convenience, but the active tool stays shown.
- **D-08:** **Phase-1 chip scope:** ship the chip component + routing contract with **only Test wired live** (the existing Reading, via URL/upload). Ideas/Hooks/Chat chips render **disabled / "coming soon."** Each later phase flips its own chip live. No half-built tool ships in P1.

**Honesty spine (ENGINE-03)**
- **D-09:** Flash-vs-Max distinction is carried at the **composer's active-model field** (model-selector pattern) — the tool chip drives the model: **Test → SIM-1 Max, Ideas/Hooks → SIM-1 Flash**. The creator sees which engine judges *before* firing.
- **D-10:** Each persisted output block carries a **lightweight model tag** (`SIM-1 Flash` / `SIM-1 Max`). Composer field = intent (before); block tag = provenance (after). Flash and Max use **distinct band styling**.
- **D-11:** **Flash claims are qualitative ONLY** — the band, the audience-fraction, and the "worth shooting?" verdict. **NO** predicted views, engagement %, reach tiers, or niche percentiles.

**Thread / Reading data model (THREAD-01, THREAD-04, THREAD-07)**
- **D-12:** **Reading stays the artifact; the thread WRAPS it.** `analysis_results` is left untouched. Add a new **`threads`** table: `type` discriminator (`grounded` | `open`) + **nullable `reading_id` → analysis_results**.
- **D-13:** **Persistence shape:** a **`messages`** table (`thread_id`, `role`, `created_at`); the body is a **typed-blocks JSON array** — each block `{type, props}`. Markdown is just a `markdown` block type. One atomic row per message (mirrors `analysis_results` JSONB).
- **D-14:** **Fixed renderer registry is the SSOT** (`type → component`). Every block validated against its renderer's schema **at the tool-runner boundary AND on rehydration**. Unknown type / invalid props → **skip or render a tiny "unsupported block" placeholder, never executed.** Same registry the THREAD-06 tool-runner `outputSchema` validates against.
- **D-15:** Existing Readings get their wrapping grounded thread **lazily on first open** (idempotent on the unique `reading_id`). No bulk backfill.

### Claude's Discretion
- Exact `threads` / `messages` column lists, indexes, and RLS policies (follow `analysis_chats` RLS — user owns thread, server never trusts `user_id` from body).
- The internal tool-runner type signature for `{promptTemplate, knowledgeBundle, outputSchema, renderer}` — shape locked by THREAD-06; field types are the planner's call.
- Placeholder copy/visual for disabled "coming soon" chips and "unsupported block."

### Deferred Ideas (OUT OF SCOPE)
- **User-creatable / customizable personas** — v6.1+. P1 constraint: keep personas data-driven/swappable (D-05).
- **Persona-system quality redo** — the 10-archetype set isn't the end-state; a dedicated rework, not Phase 1.
- **Credit-metering system** — P1 only *reserves the chip cost affordance* (D-07); the live ledger is its own phase.
- **Early open-chat** — sequenced LAST (THREAD-03, Phase 5). Stays out of P1.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENGINE-01 | SIM-1 Flash text-mode — 10 archetypes react to TEXT, per-persona reactions + aggregate pull score, mode-specific framing | `runFold`/`fold-prompts.ts` is the proven persona-sim shape to fork (no video); `persona-registry.ts` ARCHETYPE_DEFINITIONS reused; aggregation pattern in `wave3/aggregator.ts`. See §Architecture Pattern 1 + §Code Examples. |
| ENGINE-03 | Honest Flash/Max framing — concept ceiling vs realized result; never a fabricated score/view promise | Band-only output (`Strong/Mixed/Weak` + N/10 fraction); reuse `score-gauge` band word path but suppress the 0-100 number for Flash; model tag per block (D-10). See §Pattern 1 + §Common Pitfalls #1. |
| THREAD-01 | Generalized thread model — nullable `reading_id` + `type` discriminator; migration + types | `threads` table modeled on `analysis_chats` RLS; `reading_id` FK **must be UUID** (analysis_results.id is UUID) with `ON DELETE SET NULL` (parent_id precedent). See §Persistence + §Pitfall #4. |
| THREAD-02 | Composer = universal door — routes URL/upload → Test vs prompt → generator/chat | `composer.tsx` already does the URL/upload→Test loop; add tool-chip state + active-model field. Only Test wired (D-08). See §Pattern 5. |
| THREAD-04 | Typed-block rendering — markdown OR typed blocks via fixed renderer library; no model-generated UI | Renderer registry SSOT (`Record<type,{component,schema}>`) validated with zod v4; placeholder fallback. See §Pattern 3. |
| THREAD-06 | Tool-runner — `{promptTemplate, knowledgeBundle, outputSchema, renderer}`; structured→typed renderer, no schema→markdown | TS contract in §Pattern 2; `outputSchema` keys off the same registry as THREAD-04. |
| THREAD-07 | Message/block persistence — messages + typed blocks persist & re-hydrate on reload | `messages.body` JSONB array (one row/message); re-validate blocks on hydration (D-14). SSE replay pattern from `useExpertChat.loadHistory`. See §Persistence. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SIM-1 Flash text-mode persona sim | API / Backend (engine lib) | — | Qwen/DashScope key + cost is server-only; never client-side. New `src/lib/engine/flash/`. |
| Aggregate band + audience-fraction math | API / Backend (engine lib) | — | Deterministic pure function over persona verdicts; lives beside the sim. |
| Tool-runner contract + dispatch | API / Backend (route + lib) | Frontend (chip selects tool id) | Runner executes prompt + validates output server-side; chip only carries intent. |
| Renderer registry SSOT | Shared (lib) | Frontend (components) | Schema half is server-validatable; component half is client. One module, two consumers. |
| Typed-block rendering | Frontend (client components) | — | `'use client'` Reading renderer set. |
| threads/messages persistence + RLS | Database / Storage | API (server inserts, never trusts body user_id) | Postgres RLS is the trust boundary; route is the writer. |
| Composer tool chips + active-model field | Frontend (client) | API (routing target) | `composer.tsx` is client; chip drives placeholder/model label + which endpoint fires. |
| Lazy grounded-thread creation | API / Backend | Database (unique constraint = idempotency) | First-open creates the wrapping thread; `UNIQUE(reading_id)` makes it idempotent. |

## Standard Stack

**No new packages required.** Every dependency this phase needs is already installed and in active use. The "stack" below is the *in-repo* set the plan should build on, not a list to `npm install`.

### Core (already present — verify, do not install)
| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | `^4.3.6` `[VERIFIED: package.json + 13 imports in src/lib/engine]` | Block-schema validation at tool-runner boundary + rehydration; fold response validation | Already the engine's model-boundary validator (`FoldResponseSchema`, `AnalysisInputSchema`). zod v4 `.safeParse` is the exact pattern D-14 needs. |
| `@supabase/supabase-js` | `^2.93.1` `[VERIFIED: package.json]` | threads/messages CRUD + RLS-enforced reads | The whole persistence layer (`analysis_chats`, `analysis_results`) runs on it. |
| `openai` (Qwen/DashScope OpenAI-compatible client) | via `getQwenClient()` `[VERIFIED: src/lib/engine/qwen/client.ts]` | Flash text-mode LLM call; `response_format: {type:"json_object"}` | The proven engine transport; `runFold` + chat route both use it. Qwen-only constraint satisfied by reusing this client. |
| `react-markdown` | `^10.1.0` `[VERIFIED: package.json]` | The `markdown` block type renderer | Already renders assistant turns in `reading-chat.tsx`. |
| `rehype-sanitize` | `^6.0.0` `[VERIFIED: package.json]` | XSS-safe markdown rendering | Already paired with react-markdown in `reading-chat.tsx`. |
| `next` | `16.1.5` `[VERIFIED: package.json]` | App Router routes; `params: Promise<{id}>` async-params convention | The chat route already uses Next 16 async `params`. |
| `nanoid` | (in use) `[VERIFIED: imports in pipeline.ts, composer.tsx]` | request/temp ids | Engine + composer both use it. |

### Supporting (in-repo modules to reuse, not import as packages)
| Module | Path | Purpose | When to Use |
|---------|------|---------|-------------|
| `persona-registry.ts` | `src/lib/engine/wave3/` | 10 `ARCHETYPES`, `ARCHETYPE_DEFINITIONS`, `ARCHETYPE_TRIGGERS` (scroll_past/stop) | Source of persona data for text-mode (D-05: keep data-driven). |
| fold prompt/schema | `src/lib/engine/wave3/fold-prompts.ts` | `FoldResponseSchema`, `coerceFoldResponse`, `STABLE_FOLD_SYSTEM_PROMPT`, `buildFoldUserContent` | The exact "10 personas, one call, JSON-validated, small-model coercion" pattern to fork for text. |
| persona aggregator | `src/lib/engine/wave3/aggregator.ts` | `aggregatePersonaResults` (top-3-weighted intents, ≥7 threshold) | Reference for band/fraction aggregation; text-mode needs a *simpler* stop/scroll-fraction roll-up. |
| `ScoreGauge`, `PersonaCloud` | `src/components/reading/` | band gauge + expanded persona cloud renderers | D-01/D-02: the Flash output's typed blocks. |
| `useExpertChat` | `src/hooks/queries/use-expert-chat.ts` | SSE consumer + `loadHistory` replay | Reference for streaming + rehydration; generalize for thread messages. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Forking `runFold`'s prompt for text | Reusing `runFold` directly with `videoUrl=null` + empty segments | `runFold` is segment-shaped (requires `segments[]`, emits `segment_reactions` per segment); for TEXT there are no segments. A text fork avoids dead segment plumbing and emits the cleaner `{verdict, quote}` shape D-03 wants. **Recommended: fork the prompt, keep the call envelope.** |
| zod for block schemas | JSON Schema + ajv | Repo already standardizes on zod; introducing ajv duplicates the validation stack. **Use zod.** |
| One row per block (join table) | `messages.body` JSONB array (one row/message) | D-13 explicitly mandates the JSONB-array-on-the-row grain (mirrors `analysis_results`). Join table = fan-out + N+1. **Use JSONB array.** |
| New SSE infra for Flash | Return whole (non-streamed) Flash result | Flash is a single bounded JSON call (~8–17s on flash models), not token-prose. See §Pitfall #6 / §Open Q. **Recommend return-whole for P1.** |

**Installation:** None. Confirm presence only:
```bash
npm ls zod @supabase/supabase-js react-markdown rehype-sanitize next nanoid
```

**Version verification (run before planning finalizes):**
```bash
npm view zod version          # confirm ^4.x still current
npm view react-markdown version
```
Installed versions read directly from `package.json` this session — no registry round-trip was needed because nothing new is added.

## Package Legitimacy Audit

> **N/A — this phase installs ZERO external packages.** All dependencies are already in `package.json` and in active production use. No SLOP/SUS surface exists.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none) | — | No new installs in Phase 1 |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
   creator input          │             COMPOSER (client)               │
  (URL / upload / prompt) │  tool chips: [Test*] [Idea·soon] [Hooks·soon]│
        │                 │              [Chat·soon]                     │
        │                 │  active-model field: chip → "SIM-1 Max/Flash"│
        ▼                 └───────────────┬─────────────────────────────┘
                                          │ explicit tool id (D-06)
        ┌─────────────────────────────────┼──────────────────────────────┐
        │ Test (URL/upload)                │ Idea/Hooks/Chat (P1: disabled)│
        ▼                                  ▼  (wired in P3/P4/P5)
 ┌──────────────────┐            ┌────────────────────────────┐
 │ EXISTING analyze │            │   TOOL-RUNNER (server)      │
 │ /api/analyze     │            │ {promptTemplate,            │
 │ runPredictionPipe│            │  knowledgeBundle,           │
 │  → aggregateScores│           │  outputSchema, renderer}    │
 │  → SIM-1 MAX      │            │                            │
 │  (PROTECTED,      │            │  ┌─ outputSchema present ─┐ │
 │   ENGINE_VERSION  │            │  │ runFlashTextMode()     │ │
 │   frozen)         │            │  │ (NEW src/lib/engine/   │ │
 └────────┬─────────┘            │  │  flash/) — fork of fold│ │
          │                       │  │  prompt, TEXT input,   │ │
          │                       │  │  reuse persona-registry│ │
          │                       │  └────────┬───────────────┘ │
          │                       │           │ {band,fraction, │
          │                       │           │  personas[]}    │
          │                       │  validate blocks vs REGISTRY │
          │                       └───────────┼──────────────────┘
          │                                   │ typed blocks {type,props}
          ▼                                   ▼
 ┌─────────────────────────────────────────────────────────────┐
 │  PERSISTENCE (Postgres + RLS)                                 │
 │  threads(type, reading_id?→analysis_results, user_id)        │
 │  messages(thread_id, role, body JSONB=[{type,props},…])      │
 │  RLS: user_id = auth.uid(); server never trusts body user_id │
 └───────────────────────────┬─────────────────────────────────┘
                             │ on reload: loadHistory()
                             ▼  re-VALIDATE each block vs REGISTRY (D-14)
 ┌─────────────────────────────────────────────────────────────┐
 │  RENDERER REGISTRY (SSOT)  Record<type,{component,schema}>   │
 │   markdown → react-markdown   band → ScoreGauge(Flash style) │
 │   personas → PersonaCloud     <unknown> → <UnsupportedBlock> │
 └─────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/lib/engine/flash/         # NEW — text-mode, isolated from pipeline.ts/aggregator.ts
├── run-flash-text-mode.ts    # runFlashTextMode(input, framing) → FlashResult
├── flash-prompts.ts          # fork of fold-prompts: TEXT system prompt + framing param (D-04)
├── flash-schema.ts           # Zod: per-persona {verdict, quote}; aggregate {band, fraction}
└── flash-aggregate.ts        # pure: persona verdicts → band + N/10 fraction (no 0-100, D-11)

src/lib/tools/                # NEW — tool-runner contract (THREAD-06)
├── tool-runner.ts            # ToolRunner type + execute(); outputSchema-present→typed, absent→markdown
├── block-registry.ts         # SSOT Record<type,{component,schema}> (D-14)
└── blocks.ts                 # Zod schemas + TS types for each block {type, props}

src/lib/threads/              # NEW — persistence helpers
├── threads.ts                # createGroundedThreadLazy(readingId) idempotent; getOpenThread
└── messages.ts               # insertMessage(threadId, role, blocks); loadMessages → re-validate

supabase/migrations/
└── 2026XXXX_threads_messages.sql   # NEW — threads + messages tables + RLS (analysis_chats pattern)

src/components/thread/        # NEW — block renderer host
├── message-blocks.tsx        # maps body[] → registry component; <UnsupportedBlock> fallback
└── unsupported-block.tsx     # static placeholder (never executes props)

src/components/app/home/
└── composer.tsx              # EXTEND — add tool-chip row + active-model field (D-07/D-09)
```

### Pattern 1: Text-mode persona sim as a *fork*, not a branch inside the engine

**What:** A new `runFlashTextMode(content_text, framing)` that fires ONE Qwen `json_object` call (reusing `getQwenClient()` + `STABLE_FOLD_SYSTEM_PROMPT`-style cache-stable system prefix) producing all 10 archetypes, each returning a **stop/scroll verdict + one first-person quote** (D-03). It reuses `ARCHETYPE_DEFINITIONS`/`ARCHETYPE_TRIGGERS` from `persona-registry.ts` (D-05). It does NOT touch `pipeline.ts` or `aggregator.ts`.

**When to use:** ENGINE-01 / every Flash call. The `framing` arg (`'hook' | 'idea' | 'chat'`) swaps only the persona *question* + band *verbiage* (D-04), never the personas.

**Why a fork, not a `runFold` reuse:** `runFold` is segment-shaped — it requires `segments: SegmentGrid[]`, emits `segment_reactions` per segment, and runs an omni model that *watches video*. TEXT input has no segments and no video. Forking the prompt (keeping the bounded-call envelope: `AbortController` + `temperature:0` + `seed: QWEN_SEED` + `coerce…safeParse`) gives a clean `{verdict, quote}` output shape and zero dead video plumbing.

**Example (call envelope to mirror — verbatim from the proven fold):**
```typescript
// Source: src/lib/engine/wave3/fold.ts L326-348 (the bounded-call pattern to reuse)
const callParams = {
  model: FOLD_MODEL,                       // Flash → use QWEN_FAST_MODEL or a flash omni
  messages: [
    { role: "system", content: STABLE_SYSTEM_PROMPT }, // byte-stable cache prefix
    { role: "user", content: buildUserContent(...) },
  ],
  response_format: { type: "json_object" as const },
};
// @ts-expect-error DashScope extensions (determinism — R8)
callParams.temperature = 0;
// @ts-expect-error
callParams.seed = QWEN_SEED;               // QWEN_SEED = 7
// then: stripModelOutput(raw) → coerce → FlashSchema.safeParse (model-boundary validation)
```

### Pattern 2: Tool-runner contract (THREAD-06)

**What:** A single typed contract every tool flows through. `outputSchema` present → validate output and render typed blocks; absent → render markdown.

```typescript
// Source: derived from REQUIREMENTS THREAD-06 + D-14 (registry is the SSOT)
import type { z } from "zod";
import type { BlockType } from "@/lib/tools/block-registry";

export interface ToolRunner<TOut = unknown> {
  id: "test" | "idea" | "hooks" | "chat";        // explicit selection (D-06)
  model: "sim1-max" | "sim1-flash";               // drives the composer model field (D-09)
  promptTemplate: (input: ToolInput) => string;   // or OpenAI content array
  knowledgeBundle: KnowledgeBundle | null;        // P1: null/profile-thin; Phase 2 fills it (GROUND-*)
  /** present → structured-output path → typed renderer; absent → markdown block. */
  outputSchema: z.ZodType<TOut> | null;
  /** which block types this tool is allowed to emit; MUST be ⊆ BLOCK_REGISTRY keys. */
  renderer: BlockType[];
}

// dispatch:
//  if (runner.outputSchema) { const blocks = runner.outputSchema.parse(modelJson);
//                             assertBlocksInRegistry(blocks, runner.renderer); }
//  else { blocks = [{ type: "markdown", props: { text: modelText } }]; }
```
**Key:** the runner's `outputSchema` validates against the **same `BLOCK_REGISTRY`** the message renderer uses (D-14) — author the schemas once in `blocks.ts`, reference from both.

### Pattern 3: Renderer registry SSOT (D-14, THREAD-04)

**What:** One module maps `blockType → {component, schema}`. Validation runs **twice**: (1) at the tool-runner output boundary, (2) on message rehydration. Invalid/unknown → `<UnsupportedBlock>` (static, never executes model-supplied props as code).

```typescript
// Source: D-14 + zod v4 (already the engine's validator)
import { z } from "zod";
import { ScoreGauge } from "@/components/reading/score-gauge";
import { PersonaCloud } from "@/components/reading/persona-cloud";
import ReactMarkdown from "react-markdown";

const MarkdownBlock = z.object({ type: z.literal("markdown"), props: z.object({ text: z.string() }) });
const BandBlock     = z.object({ type: z.literal("band"),
  props: z.object({ band: z.enum(["Strong","Mixed","Weak"]), fraction: z.string(), model: z.enum(["sim1-flash","sim1-max"]) }) });
const PersonasBlock = z.object({ type: z.literal("personas"),
  props: z.object({ personas: z.array(z.object({ archetype: z.string(), verdict: z.enum(["stop","scroll"]), quote: z.string() })) }) });

export const BLOCK_REGISTRY = {
  markdown: { component: MarkdownRenderer, schema: MarkdownBlock },
  band:     { component: BandRenderer,     schema: BandBlock },     // wraps ScoreGauge, Flash styling
  personas: { component: PersonasRenderer, schema: PersonasBlock }, // wraps PersonaCloud / expand
} as const;
export type BlockType = keyof typeof BLOCK_REGISTRY;

export function validateBlock(raw: unknown):
  | { ok: true; block: { type: BlockType; props: unknown } }
  | { ok: false } {
  const type = (raw as { type?: string })?.type;
  const entry = type && (BLOCK_REGISTRY as Record<string, { schema: z.ZodType }>)[type];
  if (!entry) return { ok: false };                 // unknown type → placeholder
  const parsed = entry.schema.safeParse(raw);
  return parsed.success ? { ok: true, block: parsed.data as never } : { ok: false };
}
```
Rendering: `body.map(b => validateBlock(b).ok ? <Registry…/> : <UnsupportedBlock/>)`.

### Pattern 4: lazy idempotent grounded-thread creation (D-15)

**What:** On first open of an existing Reading, create its wrapping `grounded` thread if absent. Idempotency via `UNIQUE(reading_id)` — concurrent first-opens collide on the constraint, not on a race.

```typescript
// upsert-on-unique idempotency (no bulk backfill — D-15)
await supabase.from("threads")
  .upsert({ type: "grounded", reading_id: readingId, user_id: user.id },
          { onConflict: "reading_id", ignoreDuplicates: true });
// then select the (now-guaranteed) row by reading_id.
```

### Pattern 5: Composer tool chips, Test-only live (D-07/D-08)

**What:** Add a chip row above the existing input + an active-model label. Chip state drives placeholder + model field + (later) which endpoint fires. In P1 only Test is enabled; Idea/Hooks/Chat render `disabled` with a "coming soon" affordance and a reserved cost slot. The existing URL/upload→`/api/analyze` loop in `composer.tsx` is the Test path — **leave it unchanged** (D-08); URL/upload may hard-route to Test while the active chip stays shown.

### Anti-Patterns to Avoid
- **Touching `pipeline.ts`/`aggregator.ts` for text-mode** — that risks the protected Max score-identity and would force an `ENGINE_VERSION` bump. Text-mode is additive and isolated.
- **Bumping `ENGINE_VERSION`** — only on a *deliberate video-scoring change*. Phase 1 makes none. (See §Common Pitfalls #2.)
- **Letting the model choose components / emit raw HTML** — only registered block `type`s render; everything else → placeholder. This is THREAD-04's whole point.
- **Trusting `user_id` from the request body** — set it server-side from `auth.getUser()`; RLS `WITH CHECK (user_id = auth.uid())` is the backstop (mirrors `analysis_chats`).
- **A 0-100 number on the Flash band** — `score-gauge` shows a big number by default; for Flash, render the **band word only** + the audience-fraction (D-02/D-11).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Validating model JSON output | A hand-rolled type guard | `zod .safeParse` + `coerce…` pattern from `fold-prompts.ts` | Small models (flash) emit type-sloppy JSON / bare arrays / fences. The repo already has `coerceFoldResponse` + `stripModelOutput` salvage logic — copy the approach. |
| Block→component dispatch | A `switch (block.type)` scattered across files | One `BLOCK_REGISTRY` SSOT | D-14 mandates a single source; a switch duplicates the contract and lets unknown types slip through. |
| Thread/message RLS | Custom ownership checks in every route | Postgres RLS policies (the `analysis_chats` pattern) | RLS is the trust boundary; route-level checks alone are bypass-prone. |
| SSE message streaming/replay | A new EventSource loop | Generalize `useExpertChat` (already does POST-body SSE + `loadHistory` replay) | Battle-tested; handles abort, optimistic turns, malformed-frame skip. |
| Persona archetype data | A new hardcoded persona list | `persona-registry.ts` ARCHETYPE_DEFINITIONS/TRIGGERS | D-05: keep personas data-driven so v6.1 custom audiences drop in. |
| The band gauge / persona cloud UI | New components | `ScoreGauge` / `PersonaCloud` from `src/components/reading/` | D-01/D-02: these are the fixed renderers; both already accept props (Phase-4 stream-ready). |

**Key insight:** Phase 1's risk is not "can we build it" — every piece exists. The risk is **re-implementing** a validation/persona/RLS/SSE pattern that already lives in the repo, and thereby drifting from the proven behavior (or worse, touching the protected engine). The plan should be phrased as "reuse X from path Y," not "build a new Z."

## Runtime State Inventory

> Phase 1 is **additive greenfield** (new tables, new lib modules, new components) wrapping an untouched artifact. The only "rename/migration"-adjacent concern is the lazy grounded-thread creation over existing Readings. Inventory below for completeness.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `analysis_results` rows (existing Readings) — UUID `id`, never modified by this phase (D-12). | None to the artifact. New `threads.reading_id` (UUID FK) links lazily on first open (D-15); **no bulk backfill** — rows fill in as used. |
| Live service config | None — no external service has thread/message state yet (this phase creates it). | None. |
| OS-registered state | None — no schedulers/daemons involved. | None. |
| Secrets/env vars | Reuses existing `QWEN_*` / DashScope env + Supabase keys (`getQwenClient`, `createServiceClient`). No new secret. Optional `FOLD_*`-style env tunables could be mirrored for flash (e.g. `FLASH_MODEL`) — code default, no secret. | None — reuse existing config. |
| Build artifacts / installed packages | None — no package renames, no egg-info/binary equivalents. New migration file only. | Run the new migration; regenerate Supabase types if the repo generates them. |

**Verified explicitly:** the protected engine modules (`pipeline.ts`, `aggregator.ts`, `version.ts`, `__tests__/`) are NOT edited by this phase — confirmed by the isolated-fork architecture (Pattern 1).

## Common Pitfalls

### Pitfall 1: A fabricated number leaks into the Flash output
**What goes wrong:** `ScoreGauge` renders a dominant 0-100 number by default; reusing it naively prints a precise score the Flash path cannot back (violates D-02/D-11/ENGINE-03).
**Why it happens:** The gauge's `shown` value + band word are coupled in one component; the band is derived *from* the number.
**How to avoid:** For Flash, drive a **band-first** variant — render the band word (`Strong/Mixed/Weak`) + the audience-fraction string ("4/10 stop"), and **suppress the numeric centerpiece**. Either pass a flag/wrapper that hides the number, or render the band via a thin `BandRenderer` that reuses the gauge's *zone color + band word* but not its number. Keep Flash band styling visually distinct from Max (D-10).
**Warning signs:** Any `0-100` or `%` or "views/reach/percentile" string in a Flash block.

### Pitfall 2: Accidental `ENGINE_VERSION` bump or cache cross-contamination
**What goes wrong:** Editing anything in the Max scoring path (or bumping `version.ts`) invalidates the prediction cache and breaks same-video score-identity — a regression-gate failure.
**Why it happens:** `ENGINE_VERSION` (`3.19.0`) keys the prediction cache (`prediction-cache.ts`); a bump auto-invalidates all rows. The engine suite asserts same-video identity.
**How to avoid:** Build text-mode as an isolated module that **never imports into `pipeline.ts`/`aggregator.ts`** and reuses persona *data*, not the scoring path. Do NOT touch `version.ts`. Run the engine suite (`src/lib/engine/__tests__/`) as a phase gate to prove green + identity preserved.
**Warning signs:** A diff that touches `pipeline.ts`, `aggregator.ts`, `version.ts`, or any `wave3/fold*.ts` used by the video path.

### Pitfall 3: `reading_id` FK type mismatch (UUID vs text)
**What goes wrong:** `analysis_results.id` is **`UUID`**, but `analysis_chats.analysis_id` is declared **`text`** referencing it. If `threads.reading_id` is typed `text` to copy the chat table, the FK still works (Postgres casts at the boundary) but type-gen + joins get inconsistent.
**Why it happens:** The two precedent tables disagree on the FK column type.
**How to avoid:** Type `threads.reading_id` as **`UUID NULL REFERENCES analysis_results(id) ON DELETE SET NULL`** — match the *referenced* column's true type (UUID), and follow the `parent_id` precedent (`ON DELETE SET NULL`, nullable, no backfill). Do not copy `analysis_chats`'s `text` choice for this FK.
**Warning signs:** Supabase type-gen emitting `string` where a UUID is expected; join planner casts.

### Pitfall 4: Block validation skipped on rehydration
**What goes wrong:** Blocks are validated when written but trusted blindly on reload → a persisted block whose shape predates a schema change (or was hand-edited in DB) crashes the renderer or, worse, renders unexpected props.
**Why it happens:** It's tempting to validate only at the write boundary.
**How to avoid:** D-14 is explicit — validate at **both** the tool-runner boundary **and on rehydration**. `loadMessages` must run every block through `validateBlock()` before render; failures → `<UnsupportedBlock>`.
**Warning signs:** A renderer reading `block.props.foo` without a prior `safeParse`.

### Pitfall 5: Composer hydration-id navigation regression
**What goes wrong:** `composer.tsx` already guards against a hydration-sourced `analysisId` triggering navigation (the `pendingNavRef` arming pattern, WR-05). Adding tool-chip state carelessly can re-introduce the bug.
**Why it happens:** `useAnalysisStream` sets `analysisId` from the URL on hydration; only a *user-initiated* submit should navigate.
**How to avoid:** Preserve the `pendingNavRef.current = true` arming inside the submit handlers; chip selection must not arm navigation. Keep the existing Test loop intact (D-08).
**Warning signs:** Navigating to `/analyze/[id]` on page load without a submit.

### Pitfall 6: Streaming a JSON tool output token-by-token
**What goes wrong:** Trying to stream the Flash `json_object` result like prose produces partial, unparseable JSON frames.
**Why it happens:** `useExpertChat` streams free-text tokens; a structured Flash result is one validated JSON blob.
**How to avoid:** For P1, return the Flash result **whole** (single validated payload) — it's a ~8–17s bounded call, not long prose. Reserve token-streaming for markdown/chat (Phase 5) and the "content-first, score-streams" pattern for Ideas/Hooks (Phase 3/IDEAS-02). See §Open Questions.

## Code Examples

### Mirroring the analysis_chats RLS pattern for `messages`
```sql
-- Source: supabase/migrations/20260607000000_analysis_chats.sql (the pattern to mirror)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY messages_select_own ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.threads
             WHERE threads.id = messages.thread_id
               AND threads.user_id = auth.uid())
  );

CREATE POLICY messages_insert_own ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.threads
             WHERE threads.id = messages.thread_id
               AND threads.user_id = auth.uid())
  );
-- user_id on threads is set server-side from the session, NEVER from the request body.
```

### Suggested `threads` / `messages` shape (Claude's Discretion — planner finalizes)
```sql
CREATE TABLE public.threads (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text        NOT NULL CHECK (type IN ('grounded','open')),
  -- UUID to match analysis_results.id's true type (Pitfall #3); SET NULL per parent_id precedent
  reading_id  uuid        NULL REFERENCES public.analysis_results(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
-- idempotent lazy grounded creation (D-15): one grounded thread per Reading
CREATE UNIQUE INDEX threads_reading_id_unique ON public.threads (reading_id)
  WHERE reading_id IS NOT NULL;

CREATE TABLE public.messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid        NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('user','assistant','tool')),
  body        jsonb       NOT NULL DEFAULT '[]',  -- array of {type, props} blocks (D-13)
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_thread_id_created_at_idx ON public.messages (thread_id, created_at);
```

### Per-persona Flash schema (D-03)
```typescript
// Source: derived from D-03 + fold-prompts.ts FoldArchetypeSchema shape
import { z } from "zod";
const FlashPersona = z.object({
  archetype: z.string(),                    // from persona-registry ARCHETYPES (data-driven, D-05)
  verdict: z.enum(["stop", "scroll"]),      // drives the aggregate band (D-03)
  quote: z.string().min(1).max(160),        // first-person voice line ("seen this 100x, scrolling")
});
export const FlashResultSchema = z.object({
  personas: z.array(FlashPersona).length(10),
});
// aggregate (pure, deterministic — NO fabricated number, D-11):
//   stops = personas.filter(p => p.verdict==="stop").length
//   band  = stops>=6 ? "Strong" : stops>=3 ? "Mixed" : "Weak"   (thresholds = Claude's discretion)
//   fraction = `${stops}/10 stop`
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 20-call persona wave (10× Pass1 + 10× Pass2) | Single bounded `runFold` call → all 10 archetypes | Phase 4 Plan 05 (engine history) | The proven "one call, 10 personas, Zod-validated, coerce small-model sloppiness" shape Phase 1 forks for text. |
| Platt calibration on scores | Raw uncalibrated score (calibration dropped) | 2026-05-24 | Reinforces D-02/D-11: text discrimination is coarse; don't manufacture precision. |
| Board (Konva) result surface | Flat-warm Reading thread (THEME-06) + fixed typed renderers | v5.0 | The renderer set Phase 1 assembles into the registry already exists in `src/components/reading/`. |
| `analysis_chats` per-analysis chat | Generalized `threads`/`messages` (this phase) | Phase 1 (v6.0) | `analysis_chats` is the RLS + SSE-replay precedent to generalize; it stays for the existing Reading chat in P1. |

**Deprecated/outdated:**
- `training-data.json` exemplars — explicitly a liability (REQUIREMENTS Out of Scope); do not ground Flash on it.
- Gemini/DeepSeek references in code (`DEEPSEEK_MODEL` is an alias for `QWEN_APOLLO_MODEL`) — the pipeline is **Qwen-only**; the names are historical. Flash must use `getQwenClient()`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Flash band thresholds (`stops≥6→Strong, ≥3→Mixed, else Weak`) | Pattern 1 / Code Examples | LOW — thresholds are Claude's-discretion calibration; ENGINE-01 says the *winning framing* is calibrated inside the phase. Planner should treat as a tuning task, not a locked rule. |
| A2 | Flash should use a *flash-tier* Qwen model (`QWEN_FAST_MODEL` / a flash omni) rather than the 3.7-plus reasoner | Standard Stack / Pattern 1 | MEDIUM — "Flash" is a product label (D-09), not necessarily a specific model id. The plan should pick the model during framing calibration; cost/latency favor a flash tier, but text discrimination quality may push to plus. **Confirm with owner during plan/discuss.** |
| A3 | Return-whole (no streaming) for the Flash result in P1 | Pattern/Pitfall #6, Open Q | LOW — P1 only wires Test live; Flash isn't user-facing until P3. Streaming is an IDEAS-02 concern. |
| A4 | `messages.role` includes a `'tool'`/assistant value for tool outputs | Code Examples (schema) | LOW — exact role vocabulary is Claude's discretion; `analysis_chats` uses `user|assistant`. |
| A5 | Reusing `ScoreGauge`/`PersonaCloud` directly satisfies D-01/D-02 without new renderers | Don't Hand-Roll / Pitfall #1 | MEDIUM — `PersonaCloud` consumes `HeatmapPayload`/`PersonaSimulationResult` (video-shaped), not the `{verdict, quote}` Flash shape. A thin adapter or a Flash-specific persona-expand renderer may be needed. **Planner should scope an adapter, not assume drop-in.** |

## Open Questions (RESOLVED)

> All three resolved during plan-phase (2026-06-17). Implementations exist in the plans; resolutions inlined below.

1. **Which concrete model is "SIM-1 Flash" for text-mode?** — **RESOLVED:** seam deferred-by-design. Plan 03 Task 2 implements a `FLASH_MODEL` env (mirroring `FOLD_MODEL`), defaulting to a flash tier (`QWEN_FAST_MODEL`); the concrete model is calibrated inside ENGINE-01's "winning framing" pass. Owner confirmation happens during in-phase calibration, not as a pre-plan gate (A2).
   - Context: chip→model mapping is `Test→Max, Ideas/Hooks→Flash` (D-09); repo exposes `QWEN_FAST_MODEL=qwen3.6-flash`, `QWEN_OMNI_MODEL=qwen3.5-omni-flash`, `QWEN_REASONING_MODEL=qwen3.7-plus`.

2. **Does the Flash persona output reuse `PersonaCloud` or need a Flash-specific expand renderer?** — **RESOLVED:** Plan 01 Task 2 builds a dedicated `personas-block.tsx` (Flash-specific persona expand reading `{archetype, verdict, quote}`), NOT routed through `PersonaCloud` (which consumes video-shaped `HeatmapPayload`). The recommended "thin adapter first, fall back to a new renderer" collapsed straight to the new renderer because the quote shape (D-03) doesn't fit the cloud (A5).

3. **Streaming vs whole for Flash in P1** — **RESOLVED:** return whole for P1 (A3). The tool-runner contract reserves an unused `stream?: boolean` (Plan 01 Task 3) so the IDEAS-02 "content-first, score-streams" pattern slots into Phase 3 without a contract change.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node + npm | build/test | ✓ (assumed dev env) | — | — |
| Qwen/DashScope API (`QWEN_*` env) | Flash text-mode LLM call | ✓ (engine in active use) | — | none needed — same transport as existing engine |
| Supabase (Postgres + RLS) | threads/messages persistence | ✓ (in active use) | `@supabase/supabase-js ^2.93.1` | — |
| `zod` | block + fold validation | ✓ | `^4.3.6` | — |
| `react-markdown`/`rehype-sanitize` | markdown block | ✓ | `^10.1.0` / `^6.0.0` | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — this phase adds no new external dependency.

## Sources

### Primary (HIGH confidence — read in this session)
- `src/lib/engine/wave3/fold.ts`, `fold-prompts.ts`, `aggregator.ts`, `persona-registry.ts` — the persona-sim pattern to fork (bounded call, Zod boundary, coercion, archetypes, aggregation).
- `src/lib/engine/pipeline.ts`, `aggregator.ts`, `version.ts` — the protected Max path + `ENGINE_VERSION 3.19.0` cache invariant.
- `supabase/migrations/20260607000000_analysis_chats.sql` — RLS pattern to mirror for `messages`.
- `supabase/migrations/20260602000000_add_parent_id_to_analysis_results.sql`, `…add_mode_to_analysis_results.sql`, `20260213000000_content_intelligence.sql` — FK precedents + `analysis_results.id` is **UUID**.
- `src/components/reading/score-gauge.tsx`, `persona-cloud.tsx`, `index.ts`, `reading.tsx` — fixed renderers for the registry.
- `src/app/(app)/home/page.tsx`, `src/components/app/home/composer.tsx`, `src/components/reading/reading-chat.tsx`, `src/hooks/queries/use-expert-chat.ts`, `src/app/api/analyze/[id]/chat/route.ts` — composer + SSE + chat persistence precedents.
- `src/lib/engine/qwen/client.ts`, `src/lib/engine/types.ts` — Qwen model constants, `QWEN_SEED`, input modes (`text|tiktok_url|video_upload`).
- `package.json` — installed versions (zod 4.3.6, supabase-js 2.93.1, next 16.1.5, react-markdown 10.1.0, rehype-sanitize 6.0.0).
- `.planning/config.json` — `nyquist_validation: false`, `security_enforcement: false`.

### Secondary / Tertiary
- None required — this phase is in-repo composition; no external doc lookup was load-bearing.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions read from `package.json`; nothing new installed.
- Architecture (fork + registry + persistence): HIGH — every pattern grounded in an existing in-repo precedent.
- Pitfalls: HIGH — derived from concrete code facts (UUID vs text FK, ENGINE_VERSION cache key, composer hydration guard, gauge number coupling).
- Model selection for "Flash": MEDIUM — product label vs concrete model id is a calibration decision (Open Q1 / A2).

**Project Constraints (from CLAUDE.md):**
- Next.js 15/16, TypeScript strict (no `any`), Tailwind v4, Supabase. (Note: `next@16.1.5` installed — the project CLAUDE.md says "15"; the route code already uses Next 16 async `params`.)
- Server components by default; client only when interactive (composer, renderers, chat are client).
- Commit format `type(phase): description`.
- Files under 500 lines; typed interfaces for public APIs; input validation at boundaries (zod).
- Tailwind v4 caveats: dark tokens as hex (not oklch); `backdrop-filter` via inline React style, not CSS class.
- NEVER save working files to root; new code under `/src`, migrations under `supabase/migrations/`.
- **Validation Architecture section: SKIPPED** — `workflow.nyquist_validation: false` in config.json.
- **Security Domain section: SKIPPED** — `security_enforcement: false` in config.json. (RLS + server-side `user_id` are still covered inline as Don't-Hand-Roll / Pitfalls per the `analysis_chats` precedent.)

**Research date:** 2026-06-17
**Valid until:** ~2026-07-17 (stable — in-repo architecture; the only volatility is Qwen model defaults, which are env-overridable).
