# 06-SCOUT.md — REMIX-01 Reuse Scout

**Mandate:** REMIX-01 ("revive, don't rebuild") requires a confirmed reuse scout before any remix build proceeds. This document is the gate 06-04 builds against.

**Verified against:** live code in `src/lib/engine/remix/` (2026-06-18).

---

## 1. D-05a Verdict: GREEN

**Claim:** The decode pipeline (`resolveAndRehost → analyzeVideoWithOmni → omniOutputToStructuralInput → runDecode`) is read-only over the protected SIM-1 Max path. It does NOT call `runPredictionPipeline`, `aggregateScores`, or `usage_tracking`, and `DecodeResult` keeps `overall_score: null` (signaled by `variants.remix != null`, D-10).

### Evidence from live code

**decode.ts header (lines 1–18):**
```
Key invariants:
  D-10: DecodeResult is variants.remix.decode payload shape; overall_score null on rows
Model: QWEN_DECODE_MODEL (env-overridable, defaults to QWEN_REASONING_MODEL)
```
- No import of `runPredictionPipeline`, `aggregateScores`, `usage_tracking`, or `ENGINE_VERSION` anywhere in `decode.ts`.
- `QWEN_DECODE_MODEL` defaults to `QWEN_REASONING_MODEL` — Qwen3.6-plus only, not the SIM-1 Max video scorer.

**decode.ts imports (lines 19–28):** Only imports Sentry, logger, cost calculator, Qwen client constants, strip utility, decode-types schemas/prompts, and OmniAnalysisOutput type. Zero engine-scoring imports.

**adapt.ts header (lines 1–11):**
```
Does NOT touch runPredictionPipeline, usage_tracking, or DAILY_LIMITS (D-04 lightweight path).
```
- `adapt.ts` imports: Sentry, logger, Qwen client, stripModelOutput, zod, KNOWLEDGE_CORE, AdaptInput/AdaptConcept. No engine scorer.

**decode-types.ts D-01 comment (line 19):**
```
D-01: Adapt draws ONLY from the repeatable lane; luck is never mapped into AdaptInput
```
- `decodeResultToAdaptInput` (lines 210–222): maps `beats[].body` + `repeatable[]` + `niche` only. `luck` field intentionally never mapped.

**ENGINE_VERSION:** Not referenced anywhere in `decode.ts`, `adapt.ts`, or `decode-types.ts` (grep confirmed). No bump risk from decode/adapt usage.

**VERDICT: D-05a GREEN.** The decode/adapt path is disjoint from the protected SIM-1 Max scoring pipeline. No `runPredictionPipeline` call, no `aggregateScores`, no `usage_tracking`, no `ENGINE_VERSION` mutation. Regression gate in 06-05 will assert this continues to hold.

---

## 2. Reuse Surface — Exact Signatures

These are the functions 06-04 imports as-is (no rebuild needed):

### `resolveAndRehost(tiktokUrl, requestId)` — `src/lib/engine/remix/resolve-and-rehost.ts`
```typescript
export async function resolveAndRehost(
  tiktokUrl: string,
  requestId: string,
): Promise<ResolveAndRehostResult>
// Returns: { signedUrl: string, cleanup: () => Promise<void> }
// cleanup MUST be called in finally (T-03-02 derive-and-drop).
// signedUrl: Supabase signed URL, no Apify token (T-03-01).
```

### `omniOutputToStructuralInput(omni)` — `src/lib/engine/remix/decode.ts`
```typescript
export function omniOutputToStructuralInput(
  omni: OmniAnalysisOutput,
): OmniStructuralInput | null
// Maps geminiResult.analysis.* → flat OmniStructuralInput.
// Returns null if geminiResult is null or hook_decomposition missing.
```

### `runDecode(omni)` — `src/lib/engine/remix/decode.ts`
```typescript
export async function runDecode(
  omni: OmniStructuralInput,
): Promise<DecodeResult | null>
// Returns DecodeResult with exactly 4 beats (D-06), luck.length >= 1 (D-04).
// Returns null on final failure (Sentry S7).
// PER_CALL_TIMEOUT_MS = 90s; single retry (pattern: stage11).
```

### `decodeResultToAdaptInput(decode, niche)` — `src/lib/engine/remix/decode-types.ts`
```typescript
export function decodeResultToAdaptInput(
  decode: DecodeResult,
  niche: string,
): AdaptInput
// Maps beats[id].body → flat AdaptInput fields.
// luck intentionally NEVER mapped (D-01 compile-time guard).
```

### `generateAdaptConcepts(input)` — `src/lib/engine/remix/adapt.ts`
```typescript
export async function generateAdaptConcepts(
  input: AdaptInput,
): Promise<AdaptConcept[] | null>
// Returns exactly 3 AdaptConcept[] or null on graceful failure.
// Qwen-only (QWEN_REASONING_MODEL). TIMEOUT_MS = 90s. MAX_RETRIES = 1.
```

### `AdaptConcept` shape — `src/lib/engine/remix/decode-types.ts` (lines 184–193)
```typescript
export interface AdaptConcept {
  hook: string;           // bold adapted headline → UI: adaptedHook headline (D-09)
  angle: string;          // structural angle borrowed → UI: muted sub-row
  who_its_for: string;    // target audience in niche → UI: muted sub-row
  format_borrowed: string; // format pattern borrowed → UI: "Borrowed:" chip
}
```

---

## 3. Revive-Don't-Rebuild Boundary

**Dead UI:** `src/components/board/adapt/` (AdaptConceptCard, RemixedFromChip) — these are pre-numen-rework v4.x board components. The numen-rework (v5.0) removed the board canvas entirely. These files exist in the `milestone/viral-remix` worktree history but are **not present in the current `milestone/numen-tools` worktree**.

**Decision (D-06):** The old adapt board components are dead UI — they serve as reference for the `AdaptConcept` prop shape only. They are NOT imported or reused. The new thread `remix-card` block is built fresh in the typed-renderer library (THREAD-04 pattern), cloning `hook-card-block.tsx` as the template.

**Revive surface (reused as-is):**
- `resolveAndRehost`, `omniOutputToStructuralInput`, `runDecode`, `decodeResultToAdaptInput`, `generateAdaptConcepts` — all reused via direct import in 06-04.
- `AdaptConcept`, `DecodeResult`, `AdaptInput` types — reused as the contract types for the new `remix-card` block props.

---

## 4. Route Decision (D-06 / A1)

**Options considered:**
- A) Reuse `POST /api/remix/adapt` — existing route
- B) New `POST /api/tools/remix/run` SSE route (recommended)

**Existing route analysis (`src/app/api/remix/adapt/route.ts`):**
- Non-SSE (JSON response only)
- Persists adapt concepts into `variants.remix.adapt` on an `analysis_results` row (a Reading row, not an open thread message)
- Requires `analysis_id` (reading ownership check) — wrong shape for the open thread flow (no reading_id in the open thread context)
- Controls present: auth-first 401, Content-Type 415, cross-origin 403, Zod validation 400, ownership 404, `maxDuration=300`

**Decision: New SSE route `POST /api/tools/remix/run`** (06-04 implements this).

Rationale: The open-thread tool flow (P3/P4/P5 pattern) requires SSE streaming + persists to `messages` (not `analysis_results`). The existing adapt route is a Reading-scoped endpoint with the wrong ownership model for the studio tool flow.

**Controls to copy verbatim from the existing route:**
1. Auth-first 401 (`getUser()` before any LLM/DB work — T-04-03)
2. Content-Type 415 guard (T-04-07)
3. Cross-origin 403 guard (T-04-07)
4. Zod body validation 400 (T-04-06) — with `niche .max(200)` (same cap)
5. `maxDuration = 300` (adapt alone measures ~65s; with resolveAndRehost + omni the budget is tight)
6. `cleanup()` in `finally` block (T-03-02 — derive-and-drop invariant)

**NOT copied:** `analysis_id` ownership check (not applicable — thread ownership replaces it), `variants.remix.adapt` write path (new route writes a `remix-card` block to the thread message).

---

## 5. Cardinality Decision (A3 — Area 6 Discretion)

**Options:**
- A) Emit all 3 adapt concepts → 3 remix-card blocks (ranked set)
- B) Pick 1 adapt concept → 1 remix-card block (studio one-card feel)

**Decision: 1 card.** The route (06-04) picks `concepts[0]` (first concept returned by `generateAdaptConcepts`) and persists ONE `remix-card` block to the open thread. The studio aesthetic (P4 hooks pattern: one hook-card per hook, rendered inline) calls for individual cards, not a ranked-set panel. Concept selection: Qwen produces concepts[0] as the primary adapted hook; the 3-concept generation is an internal overgenerate-then-select pattern (same as `ideas` seed-hook extraction from batch).

**Rationale:** The plan allows 06-05 to optionally surface all 3 as a ranked set in a future iteration (similar to how hooks generates N cards). For v1, the studio feel is one confident card, not a choice burden. Creator can re-run for variety.

---

## Verification

- D-05a: GREEN (decode/adapt never calls runPredictionPipeline/aggregateScores/usage_tracking/ENGINE_VERSION)
- Reuse surface: 5 functions confirmed importable as-is
- Dead UI boundary: board/adapt/* not present in worktree; concept shape is reference-only
- Route decision: new SSE route with 5 controls copied from existing adapt route
- Cardinality: 1 card (concepts[0])
