# Phase 3: Pipeline Infrastructure - Research

**Researched:** 2026-05-17
**Domain:** Pipeline orchestration / SSE streaming / database provenance / multi-tier caching / DeepSeek prompt cache
**Confidence:** HIGH (codebase facts verified; Vercel + DeepSeek docs cited from official sources via Context7 and WebFetch)

## Summary

Phase 3 is the largest plumbing milestone of Engine Foundation. It does three load-bearing things at once: (1) wires fine-grained `StageEvent` emission through `runPredictionPipeline()` into `/api/analyze`'s existing SSE stream so M2 can build a live signal dashboard; (2) tags every prediction with `engine_version` + a new `signal_availability JSONB` column and relocates `ENGINE_VERSION` to its own module so Phase 12 can flip `"3.0.0-dev"` → `"3.0.0"` in a one-line commit; (3) introduces a two-tier prediction cache (in-memory L1 reusing `createCache`, Supabase L2 query against `analysis_results`) keyed by `(content_hash, engine_version, user_id)`, plus four no-op stubs (Wave 0, Wave 3, Stage 10, Stage 11) that future phases will fill.

The 203-test claim in CONTEXT.md does not match the current codebase — there are **465 test cases across 35 `*.test.ts` files** [VERIFIED via `grep -rE "^\s*(it|test)\(" src --include="*.test.ts"`]. The acceptance contract should read "all existing tests pass without modification," not anchor to the stale 203 number. Either way, the pipeline's signature is currently `runPredictionPipeline(input, opts?: { requestId?: string })` and only seven call sites consume it — all already pass either nothing or a `{ requestId }`-only options bag, so adding `onStageEvent` + `bypassCache` to that bag preserves every existing caller.

**Primary recommendation:** Adopt an options-bag pattern — `runPredictionPipeline(input, { requestId, onStageEvent, bypassCache })` — refactor `timed()` to accept the emit callback (or wrap it in a higher-order helper), persist `signal_availability` by surfacing it on `PredictionResult`, and let the route handler do both the cache check (before pipeline call) and the `Accept`-header content negotiation (SSE vs JSON). Use Node.js `crypto.createHash('sha256')` for content hashing — natively fast on modern CPUs and zero new deps. DeepSeek input cache is **automatic** (no header, no opt-in) — Phase 3's job is to verify hits via `usage.prompt_cache_hit_tokens` and structure the prompt so the rubric prefix is byte-identical across calls.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Stage event emission | API / Backend (`src/lib/engine/pipeline.ts`) | — | Pipeline owns its `timed()` boundaries; route handler is a passive forwarder |
| SSE response stream | API / Backend (`src/app/api/analyze/route.ts`) | Browser / Client (`use-analyze.ts` reader) | Route owns content-negotiation + SSE encoding; client consumes via `ReadableStream.getReader()` (already in place) |
| Engine versioning | API / Backend (`src/lib/engine/version.ts` new file) | Database (`analysis_results.engine_version` column) | Constant is server-side single-source-of-truth; DB stores per-row for time-travel queries |
| Provenance (`signal_availability`) | Database (`analysis_results.signal_availability JSONB` new column) | API / Backend (`aggregator.ts` computes; route persists) | Computed in aggregator; stored as JSONB so future phases append keys without migrations |
| Content-hash cache (L1) | API / Backend (`src/lib/engine/cache/prediction-cache.ts` new file) | — | Module-init in-memory `Map` via existing `createCache` factory |
| Content-hash cache (L2) | Database (Supabase `analysis_results` SELECT) | API / Backend (route handler issues query) | Reuses existing table; new `content_hash` column + index |
| DeepSeek input cache | External Service (DeepSeek disk cache, automatic) | API / Backend (`src/lib/engine/deepseek.ts` prompt structuring + `usage` field logging) | Cache lives server-side at DeepSeek; we only ensure prefix stability + emit telemetry |
| Niche taxonomy cache | API / Backend (`src/lib/niches/taxonomy.ts` per Phase 2 D-10) | — | Node module-init = implicit cache; CACHE-04 satisfied upstream, no Phase 3 work |
| Wave 0 / Wave 3 / Stage 10 / Stage 11 stubs | API / Backend (4 new files in `src/lib/engine/`) | — | Each stub is a no-op now; later phases swap the body without changing the call site in `pipeline.ts` |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:crypto` (built-in) | Node 20+ | SHA-256 content hashing | Native, hardware-accelerated on modern CPUs, zero new dep [VERIFIED: Daniel Lemire benchmark, Node.js docs] |
| `@supabase/supabase-js` | 2.93.1 | L2 cache SELECT against `analysis_results` | Already used everywhere in the pipeline; service client bypasses RLS [VERIFIED: package.json] |
| `openai` | 6.22.0 | DeepSeek OpenAI-compatible client | Already used in `src/lib/engine/deepseek.ts:147-157` [VERIFIED: code read] |
| `zod` | 4.3.6 | StageEvent discriminated-union type | Already used for all engine schemas [VERIFIED: package.json] |
| `vitest` | 4.0.18 | Unit + integration tests | 80% threshold already enforced on `src/lib/engine/**/*.ts` [VERIFIED: vitest.config.ts] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `nanoid` | 5.1.6 | `requestId` generation | Already used; do not change |
| `@sentry/nextjs` | 10.39.0 | Error tracking on pipeline boundaries | Add breadcrumbs at new stage boundaries for parity |
| `@/lib/cache` (`createCache<T>(ttlMs)`) | local | L1 in-memory TTL store | Reuse for prediction cache exactly as `creator.ts:27`, `calibration.ts:310`, `rules.ts:43`, `trends.ts:22-25` do |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:crypto` SHA-256 | `sha256-uint8array` npm pkg | Faster in microbenchmarks but adds a dep + bundle size; native is fast enough at video sizes [CITED: lemire.me/2025/01/11] |
| In-memory L1 + Supabase L2 | Vercel KV / Upstash Redis | Persistent across cold starts; CONTEXT D-11 explicitly rejects this (no new infra) |
| `Cache-Control` header on DeepSeek call | Automatic caching | DeepSeek caching is **automatic** — no header exists; we just emit prompt with stable prefix [VERIFIED: api-docs.deepseek.com/guides/kv_cache] |
| Custom EventEmitter | Callback function | Callback is simpler, matches existing `timed()` shape, supports `undefined` for default-no-op (CONTEXT D-04) |

**Installation:** No new dependencies required. All capability is available from the existing stack.

**Version verification:**
- `@supabase/supabase-js@2.93.1` — listed in package.json, current major matches docs
- `openai@6.22.0` — listed in package.json; library reads `usage.prompt_cache_hit_tokens` from DeepSeek response transparently
- `nanoid@5.1.6` — already in use

## Architecture Patterns

### System Architecture Diagram

```
                 POST /api/analyze (Vercel serverless, Node runtime)
                                │
                                ▼
        ┌─────────────────────────────────────────────────┐
        │  Route handler validates body + auth + tier      │
        │  Reads `Accept` header (D-03)                    │
        └─────────────────────────────────────────────────┘
                                │
                                ▼
        ┌─────────────────────────────────────────────────┐
        │  Compute content_hash (SHA-256 of buffer | url | text)│
        └─────────────────────────────────────────────────┘
                                │
                                ▼
        ┌─────────────────────────────────────────────────┐
        │  L1 lookup (in-memory cache)                     │
        │    key = (content_hash, ENGINE_VERSION, user_id) │
        └─────────────────────────────────────────────────┘
                  │ miss                  │ hit
                  ▼                        ▼
        ┌─────────────────┐       ┌────────────────────────┐
        │ L2 lookup       │       │ Return cached          │
        │ Supabase SELECT │       │ PredictionResult       │
        │ analysis_results│       │ (<2s SC#4)             │
        └─────────────────┘       └────────────────────────┘
              │ miss      │ hit         │
              ▼           ▼             │
        ┌────────────────────────┐      │
        │ runPredictionPipeline()│      │
        │   onStageEvent callback│──────┼──→ SSE stream emits
        │   bypassCache option   │      │    event: stage
        │                        │      │    event: phase (legacy)
        │   Wave 0 (no-op stub)  │      │    event: complete
        │   Wave 1 (parallel):   │      │
        │     gemini_*           │      │
        │     audio              │      │
        │     creator            │      │
        │     rules              │      │
        │   Wave 2 (parallel):   │      │
        │     deepseek           │      │
        │     trends             │      │
        │   Wave 3 (no-op stub)  │      │
        │   aggregateScores()    │      │
        │   Stage 10 (no-op)     │      │
        │   Stage 11 (no-op)     │      │
        └────────────────────────┘      │
                  │                     │
                  ▼                     │
        ┌────────────────────────┐      │
        │ INSERT analysis_results│      │
        │  + engine_version      │      │
        │  + signal_availability │      │
        │  + content_hash        │      │
        └────────────────────────┘      │
                  │                     │
                  ▼                     │
        ┌────────────────────────┐      │
        │ Hydrate L1, return     │◄─────┘
        │ via SSE | JSON         │
        │ based on Accept header │
        └────────────────────────┘
```

Reader trace: a request enters via POST, gets validated and auth'd, computes a content hash, attempts L1 then L2 cache lookup. On cache hit, the cached `PredictionResult` returns directly via the same response shape (SSE or JSON). On miss, the pipeline runs through Wave 0 (stub) → Wave 1 → Wave 2 → Wave 3 (stub) → aggregator → Stage 10/11 (stubs). Each `timed()` boundary calls `onStageEvent` which the route forwards through its existing SSE writer. After completion, the row is INSERTed to `analysis_results` with the new provenance columns, L1 is hydrated, and the response is closed.

### Recommended Project Structure

```
src/lib/engine/
├── pipeline.ts                       # Existing; add onStageEvent + bypassCache + stub calls
├── aggregator.ts                     # Existing; re-export ENGINE_VERSION from version.ts
├── deepseek.ts                       # Existing; verify prefix stability + log cache_hit_tokens
├── version.ts                        # NEW — single source of ENGINE_VERSION = "3.0.0-dev"
├── events.ts                         # NEW — StageEvent type + emit helper (planner picks: file vs inline)
├── wave0.ts                          # NEW — no-op stub for Phase 4 content_type + niche detection
├── wave3.ts                          # NEW — no-op stub for Phase 7 persona simulation
├── stage10-critique.ts               # NEW — no-op stub for Phase 9 self-critique
├── stage11-counterfactuals.ts        # NEW — no-op stub for Phase 9 counterfactuals
├── cache/
│   └── prediction-cache.ts           # NEW — L1 (createCache) + L2 (Supabase SELECT) wrapper
└── __tests__/
    ├── pipeline.test.ts              # Existing; ensure backwards compat (undefined onStageEvent path)
    ├── events.test.ts                # NEW — emission ordering tests
    ├── version.test.ts               # NEW — constant + re-export tests
    ├── prediction-cache.test.ts      # NEW — key composition, TTL, bypass tests
    └── stubs.test.ts                 # NEW — wave0/wave3/stage10/stage11 return shapes + event emission

src/app/api/analyze/
└── route.ts                          # Existing; add Accept-header branching + cache check + onStageEvent

supabase/migrations/
└── 20260517<N>_phase3_pipeline_columns.sql   # NEW — content_hash + signal_availability + index
```

### Pattern 1: Options-bag with optional callback

**What:** Extend `runPredictionPipeline` second arg from `{ requestId?: string }` to `{ requestId?, onStageEvent?, bypassCache? }`. All three fields optional — default behavior identical to today.

**When to use:** Any pipeline-orchestrator extension where existing callers must remain byte-identical (CONTEXT D-04).

**Example:**
```typescript
// src/lib/engine/events.ts — NEW
export type StageEvent =
  | { type: "stage_start"; stage: string; wave: 0 | 1 | 2 | 3 | "aggregator" | "post"; timestamp_ms: number }
  | { type: "stage_end"; stage: string; wave: 0 | 1 | 2 | 3 | "aggregator" | "post"; duration_ms: number; cost_cents: number; ok: boolean; warning?: string }
  | { type: "pipeline_warning"; message: string; stage?: string };

export type StageEventCallback = (event: StageEvent) => void;

// src/lib/engine/pipeline.ts — EDITED
export interface PipelineOptions {
  requestId?: string;
  onStageEvent?: StageEventCallback;
  bypassCache?: boolean;
}

export async function runPredictionPipeline(
  input: AnalysisInput,
  opts?: PipelineOptions
): Promise<PipelineResult> {
  // ...existing body...
}

// Internal helper — extend `timed` to also emit start+end events when callback present
async function timed<T>(
  name: string,
  wave: StageEvent["wave"] extends infer W ? W : never,
  timings: StageTiming[],
  onEvent: StageEventCallback | undefined,
  fn: () => Promise<T>,
  costCents: number = 0
): Promise<T> {
  onEvent?.({ type: "stage_start", stage: name, wave, timestamp_ms: performance.now() });
  const start = performance.now();
  let ok = true;
  let warning: string | undefined;
  try {
    const result = await fn();
    timings.push({ stage: name, duration_ms: Math.round(performance.now() - start) });
    return result;
  } catch (e) {
    ok = false;
    warning = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    onEvent?.({
      type: "stage_end",
      stage: name,
      wave,
      duration_ms: Math.round(performance.now() - start),
      cost_cents: costCents,
      ok,
      warning,
    });
  }
}
```
Source: synthesized from existing `pipeline.ts:59-71` + CONTEXT.md D-02 event shape lock.

### Pattern 2: Two-tier cache (L1 + L2) with deterministic key

**What:** Reuse the existing `createCache<T>(ttlMs)` factory for L1; fall back to a single Supabase SELECT for L2 on miss.

**When to use:** Any read-heavy lookup where in-memory survives normal traffic but cold starts need a durable backstop. Pattern already used by `creator.ts:27` (platform averages, 24h TTL) and `calibration.ts:310` (Platt params, 24h TTL).

**Example:**
```typescript
// src/lib/engine/cache/prediction-cache.ts — NEW
import { createCache } from "@/lib/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { ENGINE_VERSION } from "@/lib/engine/version";
import type { PredictionResult } from "@/lib/engine/types";

const L1_TTL_MS = 24 * 60 * 60 * 1000;
const L1 = createCache<PredictionResult>(L1_TTL_MS);

function cacheKey(contentHash: string, userId: string): string {
  return `${contentHash}::${ENGINE_VERSION}::${userId}`;
}

export async function lookupPredictionCache(
  contentHash: string,
  userId: string,
): Promise<PredictionResult | null> {
  // L1
  const l1 = L1.get(cacheKey(contentHash, userId));
  if (l1) return l1;

  // L2 — Supabase analysis_results
  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - L1_TTL_MS).toISOString();
  const { data, error } = await supabase
    .from("analysis_results")
    .select("*")  // hydrate full PredictionResult from row columns
    .eq("content_hash", contentHash)
    .eq("engine_version", ENGINE_VERSION)
    .eq("user_id", userId)
    .gt("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const result = rowToPredictionResult(data);
  L1.set(cacheKey(contentHash, userId), result);
  return result;
}

export function populatePredictionCache(
  contentHash: string,
  userId: string,
  result: PredictionResult,
): void {
  L1.set(cacheKey(contentHash, userId), result);
}
```
Source: pattern lifted directly from existing `src/lib/engine/creator.ts:27` + `src/lib/engine/calibration.ts:310`.

### Pattern 3: SSE content negotiation via Accept header

**What:** Read the `Accept` request header at route entry. If it does not include `text/event-stream`, return `Response.json(result)`. Otherwise, return the existing SSE stream.

**When to use:** Any route that needs to serve both streaming and one-shot clients (CONTEXT D-03).

**Example:**
```typescript
// src/app/api/analyze/route.ts — EDITED
export const runtime = "nodejs"; // SSE on edge cannot maintain long-lived connections [VERIFIED: Vercel docs]
export const dynamic = "force-dynamic"; // Required to prevent Vercel route-caching of streamed responses
export const maxDuration = 300; // 5 min default with Fluid Compute; up to 800s on Pro [CITED: vercel.com/docs/functions/configuring-functions/duration]

export async function POST(request: Request) {
  const acceptHeader = request.headers.get("accept") ?? "";
  const wantsSSE = acceptHeader.includes("text/event-stream");

  // ...auth, validation, cache check...

  if (wantsSSE) {
    // existing ReadableStream + SSE writer path
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        Vary: "Accept", // signal cache layers that response depends on Accept
      },
    });
  } else {
    // run pipeline + aggregate inline, return JSON
    const pipelineResult = await runPredictionPipeline(validated, { requestId });
    const result = await aggregateScores(pipelineResult);
    // ...persist + insert...
    return Response.json(result);
  }
}
```
Source: synthesized from CONTEXT D-03 + Next.js streaming guide [CITED: github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/streaming.mdx] + content-negotiation guide [CITED: vercel/next.js Backend for Frontend docs].

### Pattern 4: DeepSeek input-cache verification

**What:** DeepSeek's caching is **automatic and disk-based** — there is no opt-in header. The job is to (a) structure the prompt so the cacheable prefix is byte-identical across calls, and (b) verify hits by reading `response.usage.prompt_cache_hit_tokens` and `prompt_cache_miss_tokens`.

**When to use:** Any DeepSeek call that shares stable preamble (system message + creator context + rules + scoring rubric). For Phase 3, just `wave_2`'s single call.

**Example:**
```typescript
// src/lib/engine/deepseek.ts — EDITED
const response = await ai.chat.completions.create(
  {
    model: DEEPSEEK_MODEL,
    messages: [
      // KEY: stable prefix portion FIRST. DeepSeek's cache matches token-prefixes
      // starting from position 0 [VERIFIED: api-docs.deepseek.com/guides/kv_cache].
      // System message contains the unchanging rubric + percentile baselines.
      { role: "system", content: STABLE_SYSTEM_PROMPT },
      // Per-request volatile content LAST
      { role: "user", content: userMessage },
    ],
    response_format: { type: "json_object" },
  },
  { signal: controller.signal }
);

const cacheHitTokens = response.usage?.prompt_cache_hit_tokens ?? 0;
const cacheMissTokens = response.usage?.prompt_cache_miss_tokens ?? 0;
log.info("DeepSeek cache telemetry", {
  cache_hit_tokens: cacheHitTokens,
  cache_miss_tokens: cacheMissTokens,
  cache_hit_rate: cacheHitTokens / Math.max(1, cacheHitTokens + cacheMissTokens),
});

// Cost calculation now uses cache-hit vs miss prices
// Cache hit: $0.0028/M tokens; Cache miss: $0.14/M tokens; Output: $0.28/M [CITED: chat-deep.ai/pricing/]
const CACHE_HIT_PRICE_PER_TOKEN = 0.0028 / 1_000_000;
const CACHE_MISS_PRICE_PER_TOKEN = 0.14 / 1_000_000;
const cost_cents =
  (cacheHitTokens * CACHE_HIT_PRICE_PER_TOKEN +
    cacheMissTokens * CACHE_MISS_PRICE_PER_TOKEN +
    completionTokens * OUTPUT_PRICE_PER_TOKEN) * 100;
```
Source: DeepSeek API docs verified via Context7 + WebFetch [VERIFIED: api-docs.deepseek.com/guides/kv_cache].

### Anti-Patterns to Avoid

- **Mutating `timed()` call sites' arguments** — CONTEXT explicitly preserves them (`code_context` § "NO changes to"). Wrap or extend, do not refactor.
- **Computing content_hash inside the pipeline normalize step** — pipeline expects already-validated input; the route owns the upload buffer for the video_upload mode. Compute in the route handler before calling the pipeline.
- **Storing PredictionResult as a single JSONB blob in a new `prediction_cache` table** — CONTEXT D-11 rejects this. The existing `analysis_results` row IS the cache.
- **Adding a vendor-specific `Cache-Control` header to DeepSeek call** — there isn't one; cache is automatic [VERIFIED: docs]. Adding a phantom header is a wasted plan-step.
- **Calling pipeline twice on cache hit** — the route must short-circuit BEFORE `runPredictionPipeline`, not after.
- **Forgetting `Vary: Accept` header** — without it, a downstream cache (Vercel edge cache, browser cache, CDN) could serve a JSON response to an SSE client or vice versa.
- **Using `Date.now()` for `duration_ms`** — `performance.now()` is already what `timed()` uses (pipeline.ts:64). Mix the two and you get drift. Lock to `performance.now()` for everything.
- **Returning hot reference of cached PredictionResult** — L1 returns the SAME object each lookup. If the route mutates it (e.g., to inject pipeline warnings), all subsequent hits inherit the mutation. Return a structural clone or have the cache deep-freeze on insert.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| In-memory TTL cache | Custom Map + setInterval | Existing `createCache<T>(ttlMs)` from `src/lib/cache.ts` | Already battle-tested, lazy eviction on get (no setInterval overhead), 5 existing callers prove the pattern |
| SHA-256 hashing | Pure-JS hash port | `node:crypto` `createHash('sha256').update(buf).digest('hex')` | Hardware-accelerated, zero deps, < 1ms per 100MB on M2 [CITED: lemire.me/2025/01/11] |
| Discriminated-union runtime parsing | Custom validator | Zod (already in dep tree) or pure TS type | StageEvent is server-internal; TS type narrows enough. No runtime parsing needed unless serializing back from SSE on a client |
| SSE encoding | Stringify each message manually | Existing `send(event, data)` helper in `route.ts:157-161` | Already encodes `event: <name>\ndata: <json>\n\n` correctly |
| Engine version constant | Multiple consts in different files | Single `export const ENGINE_VERSION` in `src/lib/engine/version.ts`, re-exported from `aggregator.ts` for backwards-compat | Phase 12's gate is a one-line edit; tests can mock by overriding the version module |
| Cache key serialization | JSON.stringify of object | `${contentHash}::${engine_version}::${user_id}` string template | Deterministic, no key-ordering risks, debuggable in logs |

**Key insight:** The pipeline file is 435 lines and graceful-degrades at every stage. Phase 3 must NOT touch the degradation logic or `aggregator.ts` scoring math. Every change is additive: new options field, new column, new file. If a plan step says "rewrite" or "refactor", flag it for review.

## Runtime State Inventory

Phase 3 is NOT a rename/refactor/migration phase in the strict sense — it adds capabilities. The closest "runtime state" concern is: **what existing predictions become uncacheable after Phase 3 ships?**

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | All existing `analysis_results` rows have `engine_version` set to whatever the current code emits (currently `"2.1.0"` per `aggregator.ts:17` [VERIFIED]). When Phase 3 bumps to `"3.0.0-dev"`, no row will match the cache lookup's `engine_version` filter — so no stale-result risk from old data. Implicit invalidation per D-14. | None — confirmed correct by-design |
| Live service config | DeepSeek caching is server-side at DeepSeek; their cache survives our deploys. After Phase 3 changes prompt prefix (if any), DeepSeek's cache for the OLD prefix becomes stale for ~hours-to-days [VERIFIED: api-docs.deepseek.com cache TTL]. Acceptable: cost-only impact, not correctness. | None — DeepSeek auto-clears |
| OS-registered state | Vercel Cron jobs (`vercel.json`) call cron routes — none of those routes use the prediction pipeline. Phase 3 doesn't touch cron. | None |
| Secrets/env vars | `DEEPSEEK_MODEL` env var currently defaults to `"deepseek-reasoner"` (`deepseek.ts:19` [VERIFIED]). No new env vars needed for Phase 3. | None — verify in plan no new env reqs sneak in |
| Build artifacts | `src/types/database.types.ts` is Supabase-generated. After the Phase 3 migration adds `content_hash` + `signal_availability` columns, this file must be regenerated via `npx supabase gen types typescript --local > src/types/database.types.ts` (or equivalent) — otherwise route.ts's `insert({ content_hash: ..., signal_availability: ... })` won't type-check. | Regenerate types after migration; planner must include this step |

**The canonical question:** *After every code file is updated, what runtime systems still have the old behavior cached?*
- L1 cache: empty on every fresh process (in-memory only) — no carry-over.
- L2 cache: keyed on `engine_version`. Old `"2.1.0"` rows ignored automatically.
- DeepSeek's cache: their problem; auto-expires.

## Common Pitfalls

### Pitfall 1: Vercel route caching breaks SSE silently

**What goes wrong:** Without `export const dynamic = 'force-dynamic'`, Vercel may statically optimize the route or apply edge-layer caching; the SSE response then arrives as one buffered chunk at the end of the function instead of as it's written.

**Why it happens:** Next.js Route Handlers default to opportunistic caching when there's no dynamic API used.

**How to avoid:** Set `export const dynamic = 'force-dynamic'` at the top of `route.ts`. The current `route.ts` doesn't have this — Phase 3 MUST add it.

**Warning signs:** Browser receives all events at once at request end; latency = pipeline total instead of per-stage. [CITED: medium.com/@oyetoketoby80 — Fixing Slow SSE Streaming in Next.js]

### Pitfall 2: `Connection: keep-alive` is not enough — also need `X-Accel-Buffering: no`

**What goes wrong:** Vercel's edge proxy or any NGINX-style frontend may still buffer responses unless you explicitly disable it.

**Why it happens:** Default proxy config favors throughput over real-time delivery.

**How to avoid:** Add `'X-Accel-Buffering': 'no'` to SSE response headers. The current route.ts doesn't set it. [CITED: vercel/next.js#48427 community consensus]

**Warning signs:** Events fire in batches with multi-second delays despite the code calling `controller.enqueue()` correctly.

### Pitfall 3: DeepSeek cache prefix invalidated by dynamic content in the system prompt

**What goes wrong:** The current `buildDeepSeekPrompt()` (`deepseek.ts:305-436`) interpolates calibration percentile values (`shareP.p50`, etc.) into the prompt. If the calibration JSON ever changes, every DeepSeek call's prefix changes too — cache hit rate drops to 0%.

**Why it happens:** Cache prefix matching is byte-identical from position 0. ANY change to the early portion of the prompt invalidates.

**How to avoid:** Move the calibration-derived percentiles to AFTER the static rubric. The rubric (`## 5-Step Reasoning Framework` section) should be the first thing — and 100% literal. Dynamic content (creator context, content text, calibration values) goes AFTER.

**Warning signs:** `prompt_cache_hit_tokens` stays at 0 across calls that should have benefited.

### Pitfall 4: Content hash of `tiktok_url` vs `video_upload` are different objects entirely

**What goes wrong:** If two users analyze the same TikTok URL — one by pasting the URL, one by uploading the downloaded video — they have different `content_hash` values. Cache misses both ways.

**Why it happens:** SHA-256(url string) ≠ SHA-256(video bytes).

**How to avoid:** Accept this for Phase 3 (CONTEXT D-10 already documents the fallback hash strategy). Mark for future: optional reconciliation when Apify resolves a URL to a buffer.

**Warning signs:** Heavy users complain re-uploads don't get fast results. (User-scoped key means cross-user issue is privacy-correct anyway.)

### Pitfall 5: `signal_availability` JSONB read-back via Supabase JS client returns `unknown`

**What goes wrong:** Supabase-generated types treat `JSONB` columns as `Json` (≈ unknown). Without a Zod parser or type cast, you can't safely access `data.signal_availability.behavioral`.

**Why it happens:** Auto-generated types can't infer JSONB schemas.

**How to avoid:** Define a Zod schema `SignalAvailabilitySchema` in `types.ts`, parse on read in `prediction-cache.ts` L2 hydration path.

**Warning signs:** TypeScript errors on cache hydration; runtime crashes on `null.behavioral` access.

### Pitfall 6: `bypassCache: true` from eval harness doesn't prevent L1 hydration

**What goes wrong:** Plan reads "bypassCache means skip cache lookup," but if the eval harness still calls `populatePredictionCache` after the pipeline runs, subsequent harness runs hit a stale L1.

**Why it happens:** Bypass and populate are independent decisions.

**How to avoid:** `bypassCache: true` should mean BOTH skip-read AND skip-write. Document in plan; cover with test in `prediction-cache.test.ts`.

**Warning signs:** Second eval run in same process is suspiciously fast; cost_cents = 0.

### Pitfall 7: Stage events fire BEFORE wave parallelism resolves

**What goes wrong:** With `Promise.all([geminiPromise, audioPromise, creatorPromise, rulePromise])`, the parent `await timed("wave_1", ...)` start-event fires at wave kickoff and end-event after ALL siblings resolve. But each sibling's own start-event fires AT KICKOFF (synchronously). The user-facing UX wants per-sibling progress.

**Why it happens:** `Promise.all` is synchronous in scheduling but async in resolution. Each sibling's `start` event hits the client at ~time 0; each sibling's `end` event fires individually.

**How to avoid:** This is actually correct behavior — and what CONTEXT D-01 wants. Plan to assert in tests that the SSE stream contains, for the Wave 1 example, 4 start events at ~the same time and 4 end events at varying times.

**Warning signs:** Test expects sequential start-end pairs and gets parallel start, parallel end — adjust the test, not the code.

### Pitfall 8: `engine_version` re-export from aggregator.ts creates circular import

**What goes wrong:** If `version.ts` imports from `aggregator.ts` (or vice versa transitively), you get a "Cannot access X before initialization" error.

**Why it happens:** `version.ts` is meant to be a leaf module. Aggregator currently imports nothing from a hypothetical version.ts.

**How to avoid:** `version.ts` imports ONLY built-ins. `aggregator.ts` imports `{ ENGINE_VERSION } from "./version"` and re-exports it. Pipeline imports from `./version` directly. No circle.

**Warning signs:** Build errors on first import; vite/vitest module resolution warnings.

## Code Examples

Verified patterns from existing codebase + cited docs:

### Stable DeepSeek prompt with cache-friendly prefix

```typescript
// Source: synthesized from deepseek.ts:305 + api-docs.deepseek.com/guides/kv_cache
// Phase 3 target: keep `STABLE_SYSTEM_PROMPT` byte-identical across calls so the
// 5-step rubric portion benefits from input cache (90% discount on prefix tokens).

const STABLE_SYSTEM_PROMPT = `You are an expert TikTok content strategist. Analyze content using the 5-step framework. Your reasoning is INTERNAL — the user only sees your final JSON output.

## 5-Step Reasoning Framework

### Step 1: Completion Analysis
[full unchanging rubric...]

### Step 2: Engagement Prediction
[full unchanging rubric...]

### Step 3: Pattern Match
[full unchanging rubric...]

### Step 4: Fatal Flaw Check
[full unchanging rubric...]

### Step 5: Final Scores & Predictions
[full unchanging rubric...]

## Output Format

[full unchanging JSON schema spec...]`;

// volatile per-request content goes in the user message
const userMessage = `## Content to Analyze
Content type: ${context.input.content_type}
Content: ${context.input.content_text}
---
${geminiSignals}
---
## Rule Matches
${matchedRuleNames}
## Trend Context
${context.trend_enrichment.trend_context}
${context.creator_context}
---
## Reference Benchmarks
Share rate: p50=${(shareP.p50 * 100).toFixed(2)}%, p75=${(shareP.p75 * 100).toFixed(2)}%, p90=${(shareP.p90 * 100).toFixed(2)}%
[etc...]`;
```

### Content hash computation

```typescript
// Source: node:crypto built-in; pattern matches existing usage in scripts/
import { createHash } from "node:crypto";

export function computeContentHash(input: AnalysisInput, videoBuffer?: Buffer): string {
  if (input.input_mode === "video_upload" && videoBuffer) {
    return createHash("sha256").update(videoBuffer).digest("hex");
  }
  if (input.input_mode === "tiktok_url" && input.tiktok_url) {
    return createHash("sha256").update(input.tiktok_url).digest("hex");
  }
  // text mode — hash trimmed content_text
  return createHash("sha256").update((input.content_text ?? "").trim()).digest("hex");
}
```

### Stub function template

```typescript
// src/lib/engine/wave0.ts — NEW
import type { ContentPayload } from "./types";
import type { StageEventCallback } from "./events";

export interface Wave0Result {
  content_type: string | null;     // Phase 4 fills
  niche: { primary: string; sub: string; micro: string } | null;  // Phase 4 fills
}

export async function runWave0(
  payload: ContentPayload,
  onEvent?: StageEventCallback,
): Promise<Wave0Result> {
  const start = performance.now();
  onEvent?.({ type: "stage_start", stage: "wave_0_content_type", wave: 0, timestamp_ms: start });
  onEvent?.({ type: "stage_start", stage: "wave_0_niche_detector", wave: 0, timestamp_ms: start });

  // No-op — Phase 4 swaps with real V3 calls
  const result: Wave0Result = { content_type: null, niche: null };

  const end = performance.now();
  onEvent?.({
    type: "stage_end",
    stage: "wave_0_content_type",
    wave: 0,
    duration_ms: Math.round(end - start),
    cost_cents: 0,
    ok: true,
  });
  onEvent?.({
    type: "stage_end",
    stage: "wave_0_niche_detector",
    wave: 0,
    duration_ms: Math.round(end - start),
    cost_cents: 0,
    ok: true,
  });

  return result;
}
```

### Phase 3 migration SQL

```sql
-- supabase/migrations/<timestamp>_phase3_pipeline_columns.sql
-- Phase 3: signal availability provenance + content-hash cache columns.

-- signal_availability JSONB: which signals fired during this prediction.
-- Shape: { behavioral: bool, gemini: bool, ml: bool, rules: bool, trends: bool, ...future keys }
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS signal_availability JSONB DEFAULT '{}';

-- content_hash TEXT: SHA-256 hex digest of the input (buffer/url/text).
-- Cache key component along with engine_version + user_id.
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Compound index supporting the L2 cache SELECT:
--   WHERE content_hash = ? AND engine_version = ? AND user_id = ? AND created_at > ?
-- Ordering by created_at DESC for LIMIT 1.
CREATE INDEX IF NOT EXISTS idx_analysis_results_cache_lookup
  ON analysis_results(user_id, content_hash, engine_version, created_at DESC)
  WHERE deleted_at IS NULL;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Cache-Control: max-age=...` on LLM requests | Automatic disk caching with `prompt_cache_hit_tokens` telemetry [VERIFIED: DeepSeek docs] | DeepSeek 2024-08 announcement | No header needed; the only API surface is the response usage field |
| Hobby-tier 10s / Pro-tier 60s timeouts | Fluid Compute default 300s, Pro max 800s [CITED: vercel.com/docs/functions/configuring-functions/duration] | Vercel April 2025 | `maxDuration = 300` is the new default ceiling for SSE; can bump higher on Pro |
| Manual `cache_hit ?` cost branching for OpenAI | OpenAI returns `cached_tokens` natively in `usage.prompt_tokens_details.cached_tokens`; DeepSeek mirrors with `prompt_cache_hit_tokens` | 2024 across providers | Always read the provider's usage field rather than guessing |
| Edge runtime for SSE on Vercel | Nodejs runtime required for long-lived SSE [CITED: vercel/next.js#48427] | Persistent | Phase 3's route handler must explicitly `export const runtime = "nodejs"` |

**Deprecated/outdated in CONTEXT:**
- The phrase "DeepSeek input cache header" (in CONTEXT.md D-12 + Q4 discretion list) is technically a misnomer — no such header exists. DeepSeek caching is automatic and the lever is prompt-prefix stability + reading `usage.prompt_cache_hit_tokens` for verification. [VERIFIED: api-docs.deepseek.com/guides/kv_cache]
- The "203 tests" anchor (CONTEXT.md success criteria #6) does not match current state — there are 465 test cases across 35 files [VERIFIED: grep + wc]. The acceptance contract should read "all existing tests pass without modification," with the actual count noted in the plan as a reference checkpoint.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | DeepSeek's cache hit price is $0.0028/M tokens and miss price is $0.14/M (deepseek-v4-flash / deepseek-chat) | Pattern 4 + cost math | Cost telemetry would over/underreport; verify against actual `usage` in plan execution |
| A2 | DeepSeek caches the system+user prefix from position 0 (not the whole messages array as a unit) | Pitfall 3, Code Example 1 | If wrong, the prompt restructure has no cache impact; but docs explicitly say "starting from the 0th token" so this is high-confidence |
| A3 | The current Vercel deployment is on Fluid Compute (so 300s default, 800s max on Pro) | maxDuration recommendation | If on a legacy deployment, the old 15s/300s Pro limits apply — plan must verify before setting `maxDuration = 300` |
| A4 | The 203-test number in CONTEXT.md is stale and the actual count is what matters; tests-passing semantics carry forward | Summary, State of the Art | If the user genuinely wants to lock at 203 specifically, the plan must add tests to reach exactly that number (unlikely intent) |
| A5 | `src/types/database.types.ts` is generated via the Supabase CLI and can be regenerated via `npx supabase gen types typescript` | Runtime State Inventory | If types are hand-maintained, the planner needs to add manual type-edit steps |
| A6 | `analysis_results` has a `user_id` column that's safe to filter cache lookups by (i.e., RLS won't prevent service-role from cross-user reads, but the WHERE clause keeps it user-scoped) | Pattern 2 | If user_id RLS is too strict via service-role, the L2 query needs adjustment |
| A7 | Phase 1's eval harness (`corpus/eval-runner.ts`) is the ONLY caller that needs `bypassCache: true`. Other current callers (`scripts/benchmark.ts`, `pipeline.test.ts`) either don't use the cache path or run in test mocks | D-15 + Pitfall 6 | If benchmark.ts or other scripts also need bypass, plan needs to expand the bypass surface |
| A8 | The "existing 203 tests" success criterion really means "no existing tests modified, every existing test still passes." If the planner adds NEW tests that test new behavior, that's still SC#6-compliant | Summary | If user wants literal 203 invariant, plan must enforce additive-only test set |

**If this table is empty:** This table is NOT empty. The planner and discuss-phase should confirm with the user, in particular A1 (pricing) and A4 (203 vs 465 test count) before locking the plan.

## Open Questions

1. **DeepSeek pricing accuracy at execution time.**
   - What we know: Current docs list $0.0028/M cache-hit + $0.14/M cache-miss + $0.28/M output for `deepseek-chat` / `deepseek-v4-flash`. Codebase currently uses $0.28/M input + $0.42/M output (deepseek.ts:24-25) which is the V3.2-reasoning price.
   - What's unclear: Which model the project is calling — `DEEPSEEK_MODEL` defaults to `"deepseek-reasoner"` (deepseek.ts:19) but the env may override. The MILESTONE.md mentions "DeepSeek V4 Flash" for personas; this Phase 3 call is the existing single-DeepSeek path (reasoner).
   - Recommendation: Plan adds a step to confirm the model + verify current pricing against `api-docs.deepseek.com/quick_start/pricing` at execution time; update the cost constants in `deepseek.ts` accordingly. Until verified, mark as [ASSUMED] in the plan.

2. **PredictionResult ⟷ DB row mapping for L2 hydration.**
   - What we know: The route handler currently INSERTs ~22 columns of `PredictionResult`. The L2 cache lookup needs to reverse this — query the row and rebuild a `PredictionResult` object.
   - What's unclear: Some fields (`predicted_engagement`, `feature_vector`, `factors`, `suggestions`) are JSONB; type-narrowing needed. Some fields (`gemini_model`, `deepseek_model`) may not be in `signal_availability` shape.
   - Recommendation: Plan creates a `rowToPredictionResult(row)` helper in `prediction-cache.ts` with explicit field-by-field mapping + Zod parsing for JSONB fields. Test covers a round-trip (predict → insert → SELECT → cache hydrate → identical to original).

3. **Should `signal_availability` include `audio` key from Phase 3?**
   - What we know: CONTEXT D-07 says shape stays as `{ behavioral, gemini, ml, rules, trends }` for Phase 3. But the existing `aggregator.ts:35-41` already includes those 5 fields. Phase 6 will add `audio`.
   - What's unclear: Should Phase 3's stored shape match the 5-key today, or pre-allocate `audio: false` for forward-compat?
   - Recommendation: Lock to the 5-key shape Phase 3. Document that future phases add their own keys; consumers null-check. Matches CONTEXT D-07 verbatim.

4. **Where does the route handler get `user_id` from for cache lookup?**
   - What we know: Auth gives `user.id` (route.ts:40). Pass directly into cache lookup.
   - What's unclear: For anonymous mode (does it exist?), what's the user_id fallback?
   - Recommendation: Check `route.ts:39-44` — currently returns 401 if unauthenticated. So `user_id` is always present at cache lookup time. No fallback needed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Pipeline runtime, crypto, SSE | ✓ | 20+ (per STACK.md) | — |
| `@supabase/supabase-js` | L2 cache + analysis_results CRUD | ✓ | 2.93.1 | — |
| `openai` (DeepSeek client) | DeepSeek input-cache verification | ✓ | 6.22.0 | — |
| `node:crypto` | SHA-256 content hashing | ✓ | built-in | — |
| Supabase CLI | Migration application + types regen | likely ✓ | 2.74.5 | Manual SQL apply via dashboard |
| `@sentry/nextjs` | Breadcrumbs at stage boundaries | ✓ | 10.39.0 | — |
| `vitest` | Test framework | ✓ | 4.0.18 | — |
| Vercel Fluid Compute | 300s default maxDuration | likely ✓ | 2025+ projects | Drop to 60s and accept timeout risk on heavy videos |
| DeepSeek API | Cache verification call | ✓ | live service | The pipeline already gracefully degrades to Gemini fallback (deepseek.ts:557) |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** Fluid Compute — confirm at execution time; if legacy project, planner adds the Fluid Compute migration step to the plan.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (node environment) |
| Config file | `vitest.config.ts` (80% coverage threshold on `src/lib/engine/**`) |
| Quick run command | `npm test -- src/lib/engine/__tests__/pipeline.test.ts` (single file) |
| Full suite command | `npm test` (all 465 tests across 35 files) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| PIPE-01 | `onStageEvent` is optional; existing `runPredictionPipeline(input)` and `runPredictionPipeline(input, { requestId })` calls behave byte-identically | unit | `npm test -- src/lib/engine/__tests__/pipeline.test.ts` | ✅ existing — Phase 3 adds backwards-compat case |
| PIPE-02 | StageEvent shape matches discriminated union from D-02 (stage_start, stage_end, pipeline_warning) | unit | `npm test -- src/lib/engine/__tests__/events.test.ts` | ❌ Wave 0 |
| PIPE-03 | Each `timed()` boundary emits start + end pair when callback provided | unit | `npm test -- src/lib/engine/__tests__/events.test.ts` | ❌ Wave 0 |
| PIPE-04 | `/api/analyze` route emits `event: stage` lines with valid JSON payload; `Accept: application/json` returns JSON instead | integration | `npm test -- src/app/api/analyze/__tests__/route.test.ts` | ❌ Wave 0 (route has no test file today) |
| PIPE-05 | Every inserted `analysis_results` row has `engine_version = "3.0.0-dev"` | unit | `npm test -- src/lib/engine/__tests__/version.test.ts` | ❌ Wave 0 |
| PIPE-06 | `signal_availability` column populated with the aggregator's computed availability object | unit | `npm test -- src/lib/engine/__tests__/aggregator.test.ts` (extend) | ✅ existing (`aggregator.test.ts`) — Phase 3 extends |
| PIPE-07 | `wave0()` stub called before Wave 1; returns typed empty result; emits 2 start + 2 end events | unit | `npm test -- src/lib/engine/__tests__/stubs.test.ts` | ❌ Wave 0 |
| PIPE-08 | `wave3()` stub called after Wave 2; returns `[]`; emits start + end events | unit | `npm test -- src/lib/engine/__tests__/stubs.test.ts` | ❌ Wave 0 |
| PIPE-09 | `stage10_critique` + `stage11_counterfactuals` stubs called after aggregator; each emits events; both return null | unit | `npm test -- src/lib/engine/__tests__/stubs.test.ts` | ❌ Wave 0 |
| CACHE-01 | `computeContentHash()` returns deterministic SHA-256 hex for video buffer, URL, and text input modes | unit | `npm test -- src/lib/engine/__tests__/prediction-cache.test.ts` | ❌ Wave 0 |
| CACHE-02 | Cache hit returns cached `PredictionResult` in <2s; L1 hit faster than L2 | unit (timing assertions) | `npm test -- src/lib/engine/__tests__/prediction-cache.test.ts` | ❌ Wave 0 |
| CACHE-03 | DeepSeek call records `prompt_cache_hit_tokens` from `usage` response field; second identical call has >0 hits when running against live API (mocked in unit) | unit + manual smoke | `npm test -- src/lib/engine/__tests__/deepseek.test.ts` (extend) + manual: `curl` twice | ✅ existing — Phase 3 extends |
| CACHE-04 | Niche taxonomy is a TS module, no runtime DB roundtrip | (NO-OP — satisfied by Phase 2 D-10) | n/a | ✅ documented satisfied |
| CACHE-05 | Cache key contains `engine_version`; bumping the constant produces a miss for prior-version row | unit | `npm test -- src/lib/engine/__tests__/prediction-cache.test.ts` | ❌ Wave 0 |
| CACHE-06 | Cache invalidation on engine version bump is automatic via key; no explicit clear() needed | unit | `npm test -- src/lib/engine/__tests__/prediction-cache.test.ts` | ❌ Wave 0 |
| SC#6 | All existing 465 tests pass without modification | smoke | `npm test` (full suite) | ✅ existing — verified pre-Phase-3 |

### Sampling Rate
- **Per task commit:** `npm test -- <task-touched-test-file>` (single file, ~5-15s typical for engine tests)
- **Per wave merge:** `npm test -- src/lib/engine` (subdirectory scope, ~30-60s)
- **Phase gate:** `npm test` full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/engine/__tests__/events.test.ts` — covers PIPE-02, PIPE-03
- [ ] `src/lib/engine/__tests__/version.test.ts` — covers PIPE-05 + version-module re-export wiring
- [ ] `src/lib/engine/__tests__/stubs.test.ts` — covers PIPE-07, PIPE-08, PIPE-09
- [ ] `src/lib/engine/__tests__/prediction-cache.test.ts` — covers CACHE-01, CACHE-02, CACHE-05, CACHE-06 (mocked Supabase L2)
- [ ] `src/app/api/analyze/__tests__/route.test.ts` — covers PIPE-04 (mocked pipeline; assert SSE event sequence + Accept-header branching). Note: no test file for this route exists today.
- [ ] (Optional) `src/lib/engine/__tests__/deepseek-cache.test.ts` — extends existing `deepseek.test.ts` with prompt_cache_hit_tokens reading

*(If no gaps: "None — existing test infrastructure covers all phase requirements")*

## Security Domain

> Phase 3 touches the prediction pipeline, an authenticated API route, and adds new DB columns. The security posture is largely inherited from Phase 1/2 (no new auth surface).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (inherited) | Existing Supabase Auth via `createClient()`; no Phase 3 change |
| V3 Session Management | yes (inherited) | Supabase SSR cookie flow; no Phase 3 change |
| V4 Access Control | **yes (new)** | Cache key MUST include `user_id` to prevent cross-user prediction leakage (CONTEXT D-10 explicitly rejects cross-user sharing). RLS on `analysis_results` is user-scoped (`content_intelligence.sql:225-227`); service-role lookups must explicitly filter by user_id. |
| V5 Input Validation | yes (inherited) | Existing Zod `AnalysisInputSchema` validates the input. Content hash uses already-validated input. |
| V6 Cryptography | yes (Phase 3 new) | `node:crypto` SHA-256 for content hashing — NEVER hand-roll. SHA-256 is collision-resistant for our purposes; even an adversarial 1-byte change in the video produces a different hash so the cache cannot serve another user's result. |

### Known Threat Patterns for Next.js + Supabase + Cache stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user cache poisoning (user A's prediction served to user B) | Information Disclosure | `user_id` in cache key (D-10) + service-role filtered WHERE clause in L2 |
| Cache stuffing (force store of bogus prediction to skew future hits) | Tampering | Cache writes only from successful pipeline runs (no client-driven cache population); engine_version in key auto-invalidates on version bump |
| Hash collision attempt | Tampering | SHA-256 collision probability is negligible; if found, the L2 query still scopes by user_id so a colliding upload from a different user wouldn't match |
| SSE event injection via crafted Accept header | Tampering | Accept-header value is read-only (used for branching, never echoed); validate by `.includes("text/event-stream")` not by reflecting back |
| DoS via SSE keepalive bypass | Denial of Service | `maxDuration = 300` caps any one connection; Vercel rate limits + existing tier-limit (route.ts:138-149) prevent flood |
| Service-role bypass via cache-hit path | Elevation of Privilege | The L2 query uses service-role client BUT explicitly filters by user_id from the authenticated session. Service-role does not skip the WHERE clause. |
| Prompt cache leakage (DeepSeek's cache returning another tenant's prefix) | Information Disclosure | DeepSeek's cache is per-API-key — our key is constant per process. No cross-tenant leakage. Cache content is tokens from OUR prompts; safe. |
| TOCTOU on cache check (cache hit verification race) | Tampering | Single Supabase SELECT is atomic; no two-step check. L1 hydration after L2 is a write-once-then-read pattern (no read-modify-write). |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PIPE-01 | `onStageEvent` callback parameter added to `runPredictionPipeline()` (optional, backward-compatible) | Pattern 1 (options-bag) — confirmed all 7 existing call sites pass either nothing or `{ requestId }`-only, so adding optional fields is byte-compat |
| PIPE-02 | Pipeline event schema defined (stage start/end, per-signal results, persona reactions, costs) | Pattern 1 — `StageEvent` discriminated union per CONTEXT D-02 (locked) |
| PIPE-03 | Stage events emitted at each `timed()` boundary | Pattern 1 — extend `timed()` to accept an `onEvent` callback (or wrap with a higher-order helper); 10 existing `timed()` call sites become emission points |
| PIPE-04 | SSE infrastructure in `/api/analyze` route (Vercel-compatible streaming) | Pattern 3 + Pitfalls 1/2 — Node runtime + force-dynamic + X-Accel-Buffering: no + Vary: Accept; route already uses `ReadableStream` correctly |
| PIPE-05 | Engine version tagged on every prediction (`engine_version` field; v3.0.0 after this milestone) | "Recommended project structure" + Pitfall 8 — create `src/lib/engine/version.ts` with `ENGINE_VERSION = "3.0.0-dev"`; re-export from aggregator for backwards compat; Phase 12 edits this file's single line to flip `-dev` off |
| PIPE-06 | Prediction provenance — which signals fired, which degraded, signal availability flags persisted | "Phase 3 migration SQL" code example + Pitfall 5 — new `signal_availability JSONB` column; aggregator already computes the shape internally (aggregator.ts:288-302); Phase 3 surfaces it on PredictionResult and persists |
| PIPE-07 | Wave 0 stage support (V3 calls before Wave 1) | "Stub function template" code example — `wave0()` no-op returning `{ content_type: null, niche: null }` emitting 2 stage_start + 2 stage_end events |
| PIPE-08 | Wave 3 stage support (parallel persona simulation after Wave 2) | Stub pattern repeats for `wave3()` no-op returning `[]` |
| PIPE-09 | Stage 10 (self-critique) and Stage 11 (counterfactuals) added post-aggregator | Stub pattern repeats for `stage10_critique()` and `stage11_counterfactuals()` no-ops returning null |
| CACHE-01 | Content hash computed on video upload (SHA-256 of buffer) | "Content hash computation" code example — `node:crypto` createHash; fallback hashing for url + text modes per CONTEXT D-10 |
| CACHE-02 | Cache lookup by content hash before pipeline runs; return cached result if hit | Pattern 2 (two-tier L1+L2) — L1 in-memory via `createCache`, L2 Supabase SELECT; route handler short-circuits before pipeline call on hit |
| CACHE-03 | Persona prompt caching via DeepSeek input cache (80% input discount) | Pattern 4 (DeepSeek auto-cache verification) + Pitfall 3 — caching is AUTOMATIC (no header); structure prompt with stable prefix and read `prompt_cache_hit_tokens` from `usage` field; Phase 3 ships the one-call proving ground, Phase 7 benefits at scale |
| CACHE-04 | Niche taxonomy cached in-memory (no DB roundtrip per analysis) | Satisfied by Phase 2 D-10 — no Phase 3 work needed (CONTEXT D-13) |
| CACHE-05 | Cache TTL policy (24h for full predictions, 7d for niche taxonomy, persistent for persona prompts) | Pattern 2 — L1 24h TTL via `createCache(24 * 60 * 60 * 1000)`; L2 24h via `created_at > now() - interval '24 hours'`; niche taxonomy = no TTL (module-init); DeepSeek = DeepSeek-managed |
| CACHE-06 | Cache invalidation triggers on engine version bump | Pattern 2 + CONTEXT D-14 — engine_version is part of the cache key, so version bump auto-invalidates (no explicit clear()) |

## Sources

### Primary (HIGH confidence)
- Context7 `/websites/api-docs_deepseek` — DeepSeek context caching guide, usage response schema, pricing
- Context7 `/vercel/next.js` — Route handler streaming, route segment config (runtime, dynamic, maxDuration), content negotiation
- Codebase reads (verified):
  - `src/lib/engine/pipeline.ts` (435 lines) — current `runPredictionPipeline` signature + 10 `timed()` boundaries
  - `src/lib/engine/aggregator.ts` (492 lines) — `ENGINE_VERSION` constant, `SignalAvailability` interface, `selectWeights()` redistribution
  - `src/app/api/analyze/route.ts` (282 lines) — current SSE writer, INSERT path, auth + tier checks
  - `src/lib/engine/deepseek.ts` (640 lines) — current DeepSeek call, prompt builder, cost calculation
  - `src/lib/cache.ts` — `createCache<T>(ttlMs)` factory used by 5 existing modules
  - `supabase/migrations/20260213000000_content_intelligence.sql` — base `analysis_results` schema
  - `supabase/migrations/20260216000000_v2_schema_expansion.sql` — additive ALTER TABLE patterns
  - `supabase/migrations/20260512000100_benchmark_results.sql` — Phase 1's `engine_version TEXT NOT NULL` column shape
  - `src/lib/engine/__tests__/pipeline.test.ts` — existing integration tests (Vitest mocks)

### Secondary (MEDIUM confidence — WebFetch from official docs)
- `https://api-docs.deepseek.com/guides/kv_cache` — verified cache prefix matching, usage fields, automatic behavior
- `https://api-docs.deepseek.com/quick_start/pricing` — current per-token pricing (cache hit / miss / output)
- `https://api-docs.deepseek.com/news/news0802` — original context cache announcement (Aug 2024)
- `https://vercel.com/docs/functions/configuring-functions/duration` — verified Fluid Compute defaults + Pro max
- `https://github.com/vercel/next.js/discussions/48427` — community consensus on Vercel SSE patterns (nodejs runtime, force-dynamic, X-Accel-Buffering)
- `https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/streaming.mdx` — ReadableStream usage in Route Handlers
- `https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/backend-for-frontend.mdx` — Accept-header content negotiation pattern

### Tertiary (LOW confidence — community blog posts, single-source)
- `medium.com/@oyetoketoby80/fixing-slow-sse-server-sent-events-streaming-in-next-js-and-vercel-99f42fbdb996` — practical SSE buffering fix tips (corroborates Pitfall 1/2 but is a blog post; verified against official Next.js docs above)
- `lemire.me/blog/2025/01/11/javascript-hashing-speed-comparison-md5-versus-sha-256/` — SHA-256 native crypto performance characteristics
- `chat-deep.ai/pricing/` — DeepSeek pricing aggregator (used to corroborate official docs; treat aggregator as secondary source only)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in `package.json`; codebase patterns verified by reading source files
- Architecture: HIGH — every integration point is an additive extension of code that already exists in the repo
- Pitfalls: HIGH — pitfalls 1-3 corroborated by both official Next.js docs and community sources; pitfalls 4-8 derive from direct code reading
- Pricing (DeepSeek): MEDIUM — flagged in Assumptions Log; needs execution-time verification
- Existing test count (203 vs 465): HIGH (465 verified by grep); CONTEXT's "203" is stale

**Research date:** 2026-05-17
**Valid until:** 2026-06-16 (30 days for stack stability; DeepSeek pricing may shift post-2026-05-31 promo end — see CACHE-03 plan should re-verify at execution time)
