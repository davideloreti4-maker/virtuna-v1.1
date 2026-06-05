---
phase: 03-apollo-reasoner-brain-1-the-moat-shared-knowledge-core
reviewed: 2026-06-05T12:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/lib/engine/deepseek.ts
  - src/lib/engine/aggregator.ts
  - src/lib/engine/types.ts
  - src/lib/engine/pipeline.ts
  - src/app/api/analyze/route.ts
  - src/lib/engine/version.ts
  - src/lib/engine/remix/adapt.ts
  - src/lib/engine/remix/decode-prompts.ts
  - src/lib/engine/apollo-core.ts
  - src/components/app/simulation/impact-score.tsx
findings:
  critical: 3
  warning: 4
  info: 3
  total: 10
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-06-05T12:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 03 delivers the Apollo Reasoner (knowledge-core embedding, deepseek.ts reframe, aggregator blend rewire behavioral+apollo, variants.apollo persist, remix re-grounding). The architecture is sound and the threat-model mitigations (T-03-09 clobber, T-03-10 user_id scoping) are correctly implemented in `persistApolloToVariants`. Three blockers surfaced: a double-`recordFailure` on timeout that prematurely trips the circuit breaker, missing user_id scope on the sibling `persistDecodeToVariants` function (elevation-of-privilege gap in the remix path), and `adapt.ts` now prepends ~30 KB KNOWLEDGE_CORE to every call without `max_tokens`/`thinking_budget` bounds — the same unbounded-CoT timeout that was fixed for deepseek.ts (Bug 2 in the checkpoint) but not propagated to adapt. Warnings cover backstop logic that logs-but-continues on malformed output, a wrong score source in the UI component, and the `selectWeights` fallback that creates a subtle availability mismatch.

---

## Critical Issues

### CR-01: Double `recordFailure()` on timeout path prematurely opens circuit breaker

**File:** `src/lib/engine/deepseek.ts:432-453`

**Issue:** When `AbortError` fires (timeout), the code calls `recordFailure()` at line 433 and then `break`s out of the retry loop. Execution falls through to the unconditional `recordFailure()` at line 453. This records **two** failures for a single timeout event. With `FAILURE_THRESHOLD = 3`, a single timeout on the first call sets `consecutiveFailures = 2` — meaning one additional failure of any kind triggers the circuit breaker open instead of three. Two consecutive timeouts (first two retries) will increment to 4, opening the breaker one call early and locking out Apollo (and by extension the entire behavioral+apollo blend, since they share the same deepseek source).

```typescript
// deepseek.ts:432-453 — current (BROKEN)
if (lastError.name === "AbortError") {
  recordFailure();   // <-- first increment
  log.warn("...");
  break;
}
// ... loop ends ...
recordFailure();     // <-- second increment (unconditional)
```

**Fix:** Either remove the early `recordFailure()` inside the `AbortError` branch (let the loop-exit unconditional call handle it), or `return null` immediately after the unconditional call so the double-increment path never executes:

```typescript
// Option A — remove early call, let unconditional handle it
if (lastError.name === "AbortError") {
  log.warn("DeepSeek request timed out", { timeout_ms: TIMEOUT_MS, attempt });
  break; // unconditional recordFailure() at :453 fires
}

// Option B — return early from the post-loop block on timeout
// ... break from AbortError ...
// after loop:
recordFailure();
if (lastError?.name === "AbortError") {
  // only one failure already recorded in the AbortError branch
  // → don't double-count; do NOT call recordFailure() a second time
}
```

Option A is simpler. The same issue exists for API errors that match `.includes("timeout")` at line 439-444 when `attempt === MAX_RETRIES` — those hit both the conditional `recordFailure()` at line 444 AND the unconditional at line 453.

---

### CR-02: `persistDecodeToVariants` missing `.eq("user_id")` on both SELECT and UPDATE — privilege escalation in remix path

**File:** `src/app/api/analyze/route.ts:218-249`

**Issue:** `persistDecodeToVariants` (the remix decode persist, lines 218-249) does **not** scope its SELECT or UPDATE by `user_id`. Any `id` can be read and overwritten regardless of ownership. Compare directly with `persistApolloToVariants` (lines 170-207) which correctly adds `.eq("user_id", userId)` to both the SELECT (line 186) and UPDATE (line 197). The decode path is called at line 288 without a `userId` argument because the function signature never accepts one:

```typescript
// CURRENT — no user_id scope
async function persistDecodeToVariants(
  service: ServiceClient,
  id: string,            // <-- no userId parameter
  decode: DecodeResult,
  log: Logger,
): Promise<void> {
  ...
  .select("variants")
  .eq("id", id)          // <-- no .eq("user_id", ...)
  .single();
  ...
  .update({ variants: ... })
  .eq("id", id);         // <-- no .eq("user_id", ...)
```

If an attacker can control the `analysisId` on the remix path (e.g., via request forgery or a bug in the ID derivation), they can overwrite the `variants` JSONB of any row. The service client is a privileged service-role client (bypasses RLS), so RLS policies don't catch this.

**Fix:** Mirror `persistApolloToVariants` exactly:

```typescript
async function persistDecodeToVariants(
  service: ServiceClient,
  id: string,
  userId: string,        // add parameter
  decode: DecodeResult,
  log: Logger,
): Promise<void> {
  ...
  .select("variants")
  .eq("id", id)
  .eq("user_id", userId) // T-03-10 parity
  .single();
  ...
  .update({ variants: ... })
  .eq("id", id)
  .eq("user_id", userId); // T-03-10 parity on write
```

Then pass `userId` at the call site (line 288) — the `user.id` is in scope on the remix path.

---

### CR-03: `adapt.ts` prepends full ~30 KB KNOWLEDGE_CORE without `max_tokens`/`thinking_budget` — unbounded CoT timeout

**File:** `src/lib/engine/remix/adapt.ts:134-145`

**Issue:** After re-grounding on `KNOWLEDGE_CORE` (Plan 03-03 Task 2), `ADAPT_SYSTEM_PROMPT` is now ~30 KB (same size as Apollo's prefix). The Qwen reasoning model emits unbounded chain-of-thought over the full prefix. The checkpoint for Plan 03-04 documented exactly this bug for deepseek.ts (Bug 2: "the Apollo call had no `max_tokens`/`thinking_budget`, so the reasoning model emitted unbounded thinking...and timed out (>90s)") and fixed it by adding `max_tokens: 3000` + `thinking_budget: 3000`. That fix was NOT applied to `adapt.ts`, which uses `TIMEOUT_MS = 90_000` but no token bounds. Compare `decode.ts` which already has `max_tokens: 1200` + `thinking_budget: 2000`.

```typescript
// adapt.ts:134-145 — MISSING max_tokens + thinking_budget
const completion = await ai.chat.completions.create(
  {
    model:           QWEN_REASONING_MODEL,
    messages: [...],
    response_format: { type: "json_object" },
    temperature:     0,
    seed:            QWEN_SEED,
    // ← max_tokens and thinking_budget absent
  },
  { signal: controller.signal },
);
```

Without the bound, Remix Adapt calls will hit the 90s abort on the full KNOWLEDGE_CORE prefix exactly as Apollo did. Adapt is called on the Remix board path; failures here produce `null` (line 180), which the Remix board renders as an error frame — but the latency impact (90s hard timeout per attempt, 2 retries = 180s) can exceed Vercel's response limits.

**Fix:**

```typescript
const completion = await ai.chat.completions.create(
  {
    model:           QWEN_REASONING_MODEL,
    messages: [...],
    response_format: { type: "json_object" },
    temperature:     0,
    seed:            QWEN_SEED,
    max_tokens:      1500,        // adapt output is smaller than Apollo §4 JSON
    // @ts-expect-error — DashScope extension not in OpenAI SDK types
    enable_thinking: true,
    thinking_budget: 2000,        // matches decode.ts
  },
  { signal: controller.signal },
);
```

---

## Warnings

### WR-01: Backstop for `dimensions.length !== 6` and `rewrites.length < 2` only logs — does not repair or retry

**File:** `src/lib/engine/deepseek.ts:135-145`

**Issue:** The post-parse backstop for dimension count and rewrite count only emits `log.warn` and continues with the malformed data. Zod's `.length(6)` and `.min(2)` would have already thrown before reaching these lines — meaning these `if` blocks are logically unreachable on the normal parse path but also provide no defense on a hypothetical partial-success path. If somehow reached with a bad count, returning the malformed data to the caller (aggregator) produces a `composite_score` from a model that couldn't satisfy the schema, which then contaminates the live blend.

```typescript
// deepseek.ts:135-137 — warns but continues with bad data
if (data.dimensions.length !== 6) {
  log.warn("Apollo dimensions length mismatch post-parse", { count: data.dimensions.length });
}
// data still returned with wrong dimension count
```

**Fix:** Throw here to trigger a retry (or return null on final attempt), rather than letting malformed data propagate:

```typescript
if (data.dimensions.length !== 6) {
  throw new Error(`Apollo dimensions count invalid: ${data.dimensions.length} (expected 6)`);
}
if (data.rewrites.length < 2) {
  throw new Error(`Apollo rewrites count invalid: ${data.rewrites.length} (expected ≥2)`);
}
```

Since `parseDeepSeekResponse` is called inside the retry loop's `try` block, throwing here will be caught at line 429 and trigger the retry + repair nudge pattern already in place.

---

### WR-02: `impact-score.tsx` displays `gemini_score` as the "Apollo" breakdown bar — wrong data source

**File:** `src/components/app/simulation/impact-score.tsx:62-66`

**Issue:** The `scoreMap` for the Apollo breakdown bar is wired to `gemini_score` (the provenance-only Omni factor average), not to the actual Apollo composite score:

```typescript
const scoreMap = {
  behavioral: behavioral_score,
  apollo: gemini_score,  // ← shows Gemini average, not Apollo composite
  rules: rule_score,
  trends: trend_score,
};
```

`gemini_score` is the Omni multi-factor average (0-100), which after D-04 is **retired from the blend**. The actual Apollo composite that drives `raw_overall_score` is in `PredictionResult.apollo_reasoning?.composite_score`. The UI displays a misleading number to the user: the Apollo breakdown bar shows the old Gemini factor average rather than the Apollo expert composite that actually determines the score.

**Fix:** Add `apollo_score` (or `apollo_composite_score`) to `HeroScoreProps` and pass the real value:

```typescript
interface HeroScoreProps {
  ...
  apollo_composite_score: number; // real Apollo composite from PredictionResult.apollo_reasoning?.composite_score ?? 0
  ...
}

const scoreMap = {
  behavioral: behavioral_score,
  apollo: apollo_composite_score, // ← real value
  rules: rule_score,
  trends: trend_score,
};
```

Callers should pass `finalResult.apollo_reasoning?.composite_score ?? 0`.

---

### WR-03: `selectWeights` apollo fallback `?? availability.behavioral` creates silent co-sourcing behavior

**File:** `src/lib/engine/aggregator.ts:166`

**Issue:**

```typescript
const apolloOn = availability.apollo ?? availability.behavioral;
```

`availability.apollo` is always explicitly set at line 659 (`apollo: deepseekResult !== null`), so the `?? availability.behavioral` branch is unreachable on current code. However, `SignalAvailability.apollo` is declared `optional` in types.ts (line 428: `apollo?: boolean`), meaning any pre-Plan-04 caller that doesn't set it (e.g., legacy test fixtures, eval harness with old PredictionResult shapes) silently falls back to `behavioral`. This can produce an `apolloOn = true` state even when Apollo's composite_score is actually 0 (deepseek ran but Apollo composite wasn't produced), causing the blend to multiply 0 by a non-zero weight instead of redistributing fully to behavioral.

**Fix:** Make `SignalAvailability.apollo` required (remove `?`), or add a runtime guard:

```typescript
const apolloOn = availability.apollo === true; // never fall through to behavioral
```

This is safer because the fallback's intent (apollo co-sourced with behavioral) is already the steady-state — the fallback adds false coverage for a shape that shouldn't exist post-Plan-04.

---

### WR-04: `persistCraftToVariants` also missing `.eq("user_id")` scope on SELECT and UPDATE

**File:** `src/app/api/analyze/route.ts:109-152`

**Issue:** `persistCraftToVariants` (lines 109-152) has the same pattern as `persistDecodeToVariants`: no `user_id` filter on SELECT (line 130-133) or UPDATE (lines 139-142). While the craft path is score-mode only (not directly accessible from the remix path), the function accepts any `id` string. If the `jsonInsertId` or `analysisId` is ever manipulable, this writes craft signals across user boundaries. This function predates Plan 03-04 — the Apollo persist added `user_id` correctly but the two siblings (craft, decode) were not retroactively patched.

**Fix:** Same pattern as CR-02 — add `userId: string` parameter and `.eq("user_id", userId)` to both SELECT and UPDATE inside `persistCraftToVariants`.

---

## Info

### IN-01: `apollo-core.ts` has no build-time check that embedded KNOWLEDGE_CORE is in sync with the .md source

**File:** `src/lib/engine/apollo-core.ts` (header comment)

**Issue:** The header documents "When `.planning/corpus/KNOWLEDGE-CORE.md` changes, update KNOWLEDGE_CORE in lockstep." There is no automated enforcement — a developer editing the .md and forgetting the .ts will silently serve a stale brain. The Plan 01 acceptance criteria test (`grep "follower count" apollo-core.ts`) runs once at commit time but not on subsequent `.md` edits.

**Fix:** Add a `scripts/check-apollo-core-sync.ts` that hashes both files and fails CI if they diverge. Low effort; high drift-prevention value. Alternatively, a Vitest snapshot test that `KNOWLEDGE_CORE.length` equals the `.md` file's byte count would catch truncated embeds.

---

### IN-02: `formatGeminiSignals` in `deepseek.ts` emits static "assessed" strings for video signals

**File:** `src/lib/engine/deepseek.ts:194-202`

**Issue:**

```typescript
if (analysis.video_signals) {
  sections.push(`\n**Video Production Signals:**`);
  sections.push(`- Visual production quality: assessed`);
  sections.push(`- Hook visual impact: assessed`);
  sections.push(`- Pacing: assessed`);
  sections.push(`- Transition quality: assessed`);
}
```

When `video_signals` is present, the function signals to Apollo that video was assessed but strips ALL numeric values, replacing them with the literal string "assessed". Apollo's §4 evidence field then can only reference "assessed" rather than actual sensor readings. The intent (no anchoring) is correct per the comment, but "assessed" provides no differentiation between a 9.2 hook score and a 1.1 hook score — Apollo receives the same user message regardless of video quality, undermining the Omni→Apollo signal pipeline for video submissions.

**Fix:** Either pass qualitative bands ("strong" / "mid" / "weak" based on score thresholds) or the raw factor rationale strings (already stripped of scores in `formatGeminiSignals`'s factors loop). The factors loop correctly passes rationale/improvement_tip — the video_signals block should match that pattern.

---

### IN-03: `thinking_budget: 3000` equals `max_tokens: 3000` in deepseek.ts — leaves zero budget for output tokens

**File:** `src/lib/engine/deepseek.ts:387-390`

**Issue:** DashScope's `thinking_budget` counts toward `max_tokens`. Setting both to 3000 means the entire token budget can be consumed by chain-of-thought, leaving 0 tokens for the JSON output. In practice the model stops CoT before hitting the budget, but under adversarial content or long system prompts it can saturate CoT and produce an empty/truncated response that fails Zod parse, triggering the retry loop. `decode.ts` avoids this with `max_tokens: 1200` + `thinking_budget: 2000` (budget > output cap, giving headroom).

**Fix:** Increase `max_tokens` to at least `max_tokens: 4000` (or `5000`) while keeping `thinking_budget: 3000`, so there is always headroom for the §4 JSON output (~400-600 tokens for 6 dims + 3 rewrites):

```typescript
max_tokens: 5000,        // total budget: 3000 CoT + ~2000 for §4 JSON output
thinking_budget: 3000,   // CoT cap unchanged
```

---

_Reviewed: 2026-06-05T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
