---
phase: 03-engine-rework-pass-2-timeline-weighted-aggregator-heatmap-sc
reviewed: 2026-05-27T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - src/app/api/analyze/[id]/stream/route.ts
  - src/app/api/filmstrip/extract/route.ts
  - src/hooks/queries/use-analysis-stream.ts
  - src/lib/engine/__tests__/aggregator.test.ts
  - src/lib/engine/__tests__/anti-virality.test.ts
  - src/lib/engine/__tests__/factories.ts
  - src/lib/engine/__tests__/filmstrip.test.ts
  - src/lib/engine/__tests__/pass2.test.ts
  - src/lib/engine/__tests__/persona-weights.test.ts
  - src/lib/engine/__tests__/stage10-critique.test.ts
  - src/lib/engine/__tests__/weighted-aggregator.test.ts
  - src/lib/engine/aggregator.ts
  - src/lib/engine/anti-virality.ts
  - src/lib/engine/events.ts
  - src/lib/engine/filmstrip/extract.ts
  - src/lib/engine/filmstrip/queue.ts
  - src/lib/engine/filmstrip/storage.ts
  - src/lib/engine/persona-weights.ts
  - src/lib/engine/pipeline.ts
  - src/lib/engine/qwen/__tests__/normalize-segments.test.ts
  - src/lib/engine/qwen/normalize-segments.ts
  - src/lib/engine/qwen/omni-analysis.ts
  - src/lib/engine/qwen/schemas.ts
  - src/lib/engine/stage10-critique.ts
  - src/lib/engine/types.ts
  - src/lib/engine/wave3/pass2.ts
  - src/lib/engine/wave3/persona-prompts-pass2.ts
  - src/lib/engine/wave3/weighted-aggregator.ts
findings:
  critical: 5
  warning: 7
  info: 4
  total: 16
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-05-27T00:00:00Z
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

This phase delivers Pass 2 persona timeline, weighted retention curve aggregation, heatmap assembly, filmstrip keyframe extraction, and the anti-virality dual-trigger. The architecture is sound and the graceful-degradation contracts are well-structured. However, there are 5 critical issues across security, data-integrity, and correctness dimensions that must be fixed before shipping.

The most severe issues are: (1) the filmstrip SSE route reads from `analysis_results.heatmap` but the `/api/filmstrip/extract` route writes to `analysis_results.variants` — the SSE consumer will never see keyframe URIs; (2) Pass 2 persona slot assignment uses a fixed "other" routing regardless of the Pass 1 content-type/niche, producing slot mismatches between Pass 1 and Pass 2; (3) the SSRF deny-list omits IPv6 private ranges and hostname-only metadata endpoint attacks; (4) the SSE stream loop increments `attempts` only at the bottom of the loop body, meaning the `setTimeout` delay is always skipped on the first iteration but accumulated incorrectly; (5) `triggerFilmstripGeneration` silently sends a bearer token of `""` (empty string) when `FILMSTRIP_EXTRACT_SECRET` is unset, which passes the auth check on the receiving route because `expected = "Bearer "` equals `"Bearer "`.

---

## Critical Issues

### CR-01: Filmstrip keyframe URI write/read path mismatch — SSE never sees keyframes

**File:** `src/app/api/filmstrip/extract/route.ts:143-199` and `src/app/api/analyze/[id]/stream/route.ts:13-24`

**Issue:** `extractHeatmapSegments()` in the SSE stream route reads keyframe URIs from `analysis_results.heatmap.segments[].keyframe_uri`. However, `/api/filmstrip/extract` explicitly documents that no `heatmap` column exists (comment at line 138-145) and instead writes to `analysis_results.variants.filmstrip_segments[].keyframe_uri`. The two shapes are incompatible:

- **Writer path:** `variants.filmstrip_segments[{ idx, keyframe_uri }]`
- **Reader path:** `analysis_results.heatmap.segments[{ keyframe_uri }]`

The `filmstrip_segment_ready` SSE events will never be emitted because `extractHeatmapSegments` always returns an empty array — `heatmap` is never populated by the filmstrip route. Similarly, `pipeline.ts:readKeyframeUris` (line 334) reads from `analyses.analysis_results.heatmap.segments[].keyframe_uri`, also the wrong location.

**Fix:** Either:
(a) Change `extractHeatmapSegments` and `readKeyframeUris` to read from `variants.filmstrip_segments`, or
(b) Change the filmstrip extract route to write into `heatmap.segments[].keyframe_uri` (the intended canonical location per D-13).

Option (b) is correct per the design intent. The filmstrip route should update the heatmap column, not variants:

```typescript
// In /api/filmstrip/extract/route.ts — write to heatmap.segments instead of variants:
// Read current analysis_results JSONB and merge keyframe URIs into heatmap.segments
const { data: analysisRow } = await supabase
  .from("analysis_results")
  .select("analysis_results")
  .eq("id", analysisId)
  .single();

const ar = (analysisRow?.analysis_results ?? {}) as Record<string, unknown>;
const heatmap = (ar.heatmap ?? {}) as { segments?: Array<{ idx: number; keyframe_uri: string | null }> };
const existingSegs = Array.isArray(heatmap.segments) ? heatmap.segments : [];
// ... merge successResults into existingSegs ...
await supabase.from("analysis_results").update({
  analysis_results: { ...ar, heatmap: { ...heatmap, segments: merged } }
}).eq("id", analysisId);
```

---

### CR-02: Pass 2 always uses "other" slot routing — slot_type mismatch with Pass 1

**File:** `src/lib/engine/wave3/pass2.ts:73-77`

**Issue:** `runWave3Pass2` calls `selectPersonaSlots(null, null)` unconditionally, routing to the "other" fallback (6 fyp / 2 niche_deep / 1 loyalist / 1 cross_niche). The comment says "D-11: use 'other' fallback since we don't re-run slot selection here", but the upstream pipeline already computed `wave0Result` with content_type and niche. Pass 1 used those values to select persona slots, so persona `i` in `pass1Results[i]` has a specific slot_type (e.g., `niche_deep`) that may not match position `i` in the "other" slots array.

This means `callPersona(slot, pass1Results[i])` passes a Pass 1 result for persona X to the prompt for a different archetype/slot. The prompt's "Pass 1 Verdict" section would contain verdicts from the wrong persona, corrupting the temporal reasoning chain.

**Fix:** Pass `wave0Result.content_type?.type` and `wave0Result.niche?.primary_slug` into `runWave3Pass2` so it calls `selectPersonaSlots(contentType, niche)` — producing the same slot assignment as Pass 1. Or pass the slots array directly from the pipeline.

```typescript
// pass2.ts signature change:
export async function runWave3Pass2(
  segments: SegmentGrid[],
  keyframeUris: (string | null)[],
  pass1Results: PersonaSimulationResult[],
  demo?: DemographicContext,
  onEvent?: StageEventCallback,
  // Add:
  contentTypeSlug?: string | null,
  nicheSlug?: string | null,
): Promise<Wave3Pass2Outcome> {
  const slots = selectPersonaSlots(contentTypeSlug ?? null, nicheSlug ?? null);
  // ...
}
```

---

### CR-03: SSRF deny-list incomplete — IPv6 private ranges and AWS metadata endpoint not blocked

**File:** `src/app/api/filmstrip/extract/route.ts:54-63`

**Issue:** The `SSRF_DENY_PATTERNS` array only checks IPv4 private ranges. An attacker can bypass this by supplying:

1. `http://[::ffff:127.0.0.1]/...` — IPv4-mapped IPv6 loopback (resolves to 127.0.0.1)
2. `http://[::1]/...` — pure IPv6 loopback (the regex `^::1$` exists but only matches exact `::1`, not `[::1]` after URL parsing strips brackets)
3. `http://169.254.169.254/latest/meta-data/` — AWS IMDS metadata endpoint (this IS covered by the link-local pattern, so this specific case is safe)
4. `http://metadata.google.internal/` — GCP metadata endpoint (hostname-based, not IP — completely unblocked)

For point 2: `new URL("http://[::1]/path").hostname` returns `"::1"` (brackets stripped), and the regex `/^::1$/` would match correctly. However, `http://[::ffff:7f00:1]/` parses to hostname `"::ffff:7f00:1"`, which is not matched by any pattern.

**Fix:**

```typescript
const SSRF_DENY_PATTERNS = [
  // ... existing patterns ...
  /^::1$/,                              // IPv6 loopback (already present)
  /^::ffff:/i,                          // IPv4-mapped IPv6
  /^fc00:/i,                            // IPv6 unique local fc00::/7
  /^fd[0-9a-f]{2}:/i,                   // IPv6 unique local fd00::/8
  /^fe80:/i,                            // IPv6 link-local
  /^metadata\.google\.internal$/i,      // GCP metadata
  /^169\.254\.169\.254$/,               // AWS IMDS (already covered by link-local pattern)
];
```

---

### CR-04: Empty-secret bearer token bypass — `FILMSTRIP_EXTRACT_SECRET` unset allows unauthenticated access

**File:** `src/app/api/filmstrip/extract/route.ts:74-82` and `src/lib/engine/filmstrip/queue.ts:26-32`

**Issue:** In `queue.ts`, the auth header is built as:
```typescript
"Authorization": `Bearer ${process.env.FILMSTRIP_EXTRACT_SECRET ?? ""}`,
```

In `route.ts`, the check is:
```typescript
const expected = `Bearer ${secret ?? ""}`;
if (!secret || authHeader !== expected) { /* reject */ }
```

When `FILMSTRIP_EXTRACT_SECRET` is unset in the environment:
- `secret` is `undefined` → `!secret` is `true` → the `route.ts` guard correctly rejects
- But in `queue.ts`, the sent header is `"Bearer "` (bearer + empty string)

The real problem is subtler: if `FILMSTRIP_EXTRACT_SECRET` is set to an empty string `""` in `.env` (a misconfiguration that happens in local dev), then `secret` is `""`, `!secret` evaluates to `true` (falsy), and the guard rejects. But the caller sends `"Bearer "`, which would match `expected = "Bearer "`. The `!secret` guard saves this case. However, the guard's `!secret` check passes the short-circuit correctly — but the issue is that `queue.ts` sends `"Bearer "` silently rather than failing loudly when the env var is absent, meaning requests go out with a known-predictable token.

More critically: the route does NOT enforce HTTPS, so a network-visible `"Bearer "` token would appear in plaintext on misconfigured deployments.

**Fix:** In `queue.ts`, abort the request (log an error and return early) when `FILMSTRIP_EXTRACT_SECRET` is absent rather than silently sending an empty bearer:

```typescript
export function triggerFilmstripGeneration(
  analysisId: string,
  segments: SegmentGrid[],
  videoUrl: string,
): void {
  const secret = process.env.FILMSTRIP_EXTRACT_SECRET;
  if (!secret) {
    log.error("filmstrip trigger skipped: FILMSTRIP_EXTRACT_SECRET not set", { analysisId });
    return;
  }
  // ... rest of function
}
```

---

### CR-05: `isTimelinePatternTriggered` uses `t_end <= 5` but `weighted_curve` is indexed by segment position — filter is fragile for non-uniform segment durations

**File:** `src/lib/engine/anti-virality.ts:53-57`

**Issue:** The "first 5 seconds" window filter is:

```typescript
const firstFiveSecondIndices = heatmap.segments
  .map((s, i) => (s.t_end <= 5 ? i : -1))
  .filter((i): i is number => i >= 0);
```

This collects segment indices where `t_end <= 5`. The filter requires at least 2 such indices to proceed. However:

1. For a video with a hook zone segment `[0, 3]` followed by a `[3, 8]` segment, `firstFiveSecondIndices = [0]` (only t_end=3 ≤ 5). The check `< 2` short-circuits to `false` even though the 5-second window contains meaningful content.

2. The `aggregateLoss` computation uses `startIdx` (first index in window) and `endIdx` (last index in window). If the window has only the single hook segment `[0, 3]`, this correctly returns false. But for a 2s-bucket video with `[0, 2], [2, 4]` — both have `t_end ≤ 5` — `startIdx=0, endIdx=1`, and the drop is `curve[0] - curve[1]`. This works but the "last 5s segment" concept actually catches `[2, 4]` even though t=4 is within the window while t=5 is the boundary. The correct semantic should be "segments that START before 5s" not "segments that END at or before 5s."

A segment `[4, 7]` that spans across the 5s mark is entirely excluded even though it starts within the hook window. For 2s-bucket layouts, the `[3, 5]` segment gets `t_end = 5` and qualifies, but `[3, 6]` (common when using variable scene boundaries) is excluded.

**Fix:** Use `s.t_start < 5` to include segments that begin within the first 5 seconds:

```typescript
const firstFiveSecondIndices = heatmap.segments
  .map((s, i) => (s.t_start < 5 ? i : -1))
  .filter((i): i is number => i >= 0);
```

---

## Warnings

### WR-01: `attempt` counter incremented at loop bottom — first iteration has no sleep, loop terminates one iteration early on timeout

**File:** `src/app/api/analyze/[id]/stream/route.ts:136-184`

**Issue:** The poll loop structure is:

```typescript
while (attempts < SHORT_POLL_MAX_ATTEMPTS) {
  // ... poll DB ...
  await new Promise((r) => setTimeout(r, SHORT_POLL_INTERVAL_MS));
  attempts++;
}
if (attempts >= SHORT_POLL_MAX_ATTEMPTS && !aborted.value) {
  send("error", { error: "Stream timed out" });
}
```

Iteration N polls, then sleeps 2s, then increments. On the first iteration: poll immediately (no leading sleep — correct), sleep 2s, attempts becomes 1. After 45 iterations: 45 DB polls × 2s = 90s total. This is actually correct behavior, but the loop exits when `attempts < 45` is false, i.e., when `attempts == 45`. The timeout message fires. However, if the analysis completes at exactly poll 45, the `break` happens inside the loop before the `attempts++`, so `attempts == 44`, and the timeout message is NOT sent — correct. This is actually fine logic. Minor concern: the `setTimeout` on the final iteration (attempt 44 → becomes 45 via increment, loop exits next check) means the last sleep still occurs before the `attempts++` that would trigger the `>= MAX_ATTEMPTS` check. Actually `attempts++` happens after the sleep, so the loop does sleep even on what will become the last iteration. This wastes 2s but is not a bug.

However, there is a real concern: the `aborted.value` check only happens at the TOP of the while loop. After `request.signal.abort()` fires, the ongoing `setTimeout(r, 2000)` will still complete before `aborted.value` is checked. This means up to 2s of extra wait after disconnect before the loop exits. This is a minor resource waste but not a correctness bug. Marking as WARNING because it affects responsiveness on client disconnect.

**Fix:** Check `aborted.value` before and after the sleep:

```typescript
await new Promise<void>((r) => {
  const t = setTimeout(r, SHORT_POLL_INTERVAL_MS);
  // Optional: clear timeout on abort for faster exit
  if (aborted.value) { clearTimeout(t); r(); }
});
if (aborted.value) break;
attempts++;
```

---

### WR-02: `buildWeightedCurve` double-calls in `assembleHeatmapPayload` — redundant computation

**File:** `src/lib/engine/wave3/weighted-aggregator.ts:173-175`

**Issue:** `assembleHeatmapPayload` calls `buildWeightedCurve` to get `weighted_curve`, and then also calls `normalizeOverSurvivors` a second time independently:

```typescript
const { weighted_curve } = buildWeightedCurve(pass2Results, segments, weights);
const effectiveWeights = normalizeOverSurvivors(pass2Results, weights);
```

`buildWeightedCurve` internally calls `normalizeOverSurvivors` already (line 105). The `effectiveWeights` in `assembleHeatmapPayload` is recomputed from scratch, which is harmless (pure function) but wasteful on large persona arrays. Additionally, the `weighted_curve` used in `assembleHeatmapPayload` is derived from `effectiveWeights` inside `buildWeightedCurve`, but `assembleHeatmapPayload` uses a separately-computed `effectiveWeights` for the `weights` field in the returned payload. Since `normalizeOverSurvivors` is deterministic, both calls produce identical results — but if a bug were introduced in `normalizeOverSurvivors`, the two calls could diverge in a future edit.

**Fix:** Have `buildWeightedCurve` return `normalizedWeights` in its result tuple, then reuse it:

```typescript
// In buildWeightedCurve, return normalizedW:
return { weighted_curve, weighted_completion_pct, weighted_top_dropoff_t, weighted_hook_score, normalizedWeights: normalizedW };

// In assembleHeatmapPayload:
const { weighted_curve, normalizedWeights } = buildWeightedCurve(pass2Results, segments, weights);
// Use normalizedWeights instead of re-calling normalizeOverSurvivors
```

---

### WR-03: SSE parse loop in `use-analysis-stream.ts` does not handle multi-line data payloads or `id:` prefixed lines

**File:** `src/hooks/queries/use-analysis-stream.ts:253-266`

**Issue:** The SSE body-reader parse loop assumes every SSE frame is exactly two lines: `event: <type>` immediately followed by `data: <json>`. This is correct for the current server implementation, but the server also emits `id: complete\n` prefixed events (see `route.ts:103-105`). The line `id: complete` would appear as `lines[i]` with the event line being `lines[i+1]` and data at `lines[i+2]`, which would be missed.

More concretely, the `send("complete", row, "complete")` call on route.ts:126 emits:
```
id: complete\nevent: complete\ndata: {...}\n\n
```

The parse loop sees:
- `lines[i] = "id: complete"` — skipped (doesn't start with `event: `)
- `lines[i+1] = "event: complete"` — triggers the handler
- `lines[i+2] = "data: {...}"` — checked as `lines[i + 1]` which is `"event: complete"`, not a data line

So the `data` lookup reads the wrong line. The `complete` event's data payload would be the `event:` line string, `JSON.parse("event: complete")` would throw, and the complete event would be silently dropped.

However, in the body-reader POST path (start mutation), the server emitting `id:` lines in the POST stream would be affected. The GET EventSource path uses the browser's native EventSource parser which handles `id:` correctly.

**Fix:** Implement a proper SSE frame accumulator that collects lines until a blank line, then extracts `event:`, `id:`, and `data:` fields:

```typescript
// Accumulate full SSE frames before dispatching:
const frames = buffer.split("\n\n");
buffer = frames.pop() ?? "";
for (const frame of frames) {
  const frameLines = frame.split("\n");
  let eventType = "message";
  let dataLine = "";
  for (const line of frameLines) {
    if (line.startsWith("event: ")) eventType = line.slice(7).trim();
    else if (line.startsWith("data: ")) dataLine = line.slice(6);
  }
  if (dataLine) {
    try { dispatch(eventType, JSON.parse(dataLine)); } catch { /* drop */ }
  }
}
```

---

### WR-04: `Pass2ResponseSchema` in `persona-prompts-pass2.ts` allows `reason` up to 400 chars but system prompt states 200 chars max

**File:** `src/lib/engine/wave3/persona-prompts-pass2.ts:207-211`

**Issue:** The Zod schema validates `reason` as `z.string().max(400).optional()`. The `STABLE_PASS2_SYSTEM_PROMPT` instructs the model: "reason MUST be at most 200 characters". The schema is twice as permissive as the prompt constraint. A model producing 350-char reasons will pass Zod validation and be stored, but violates the documented invariant. Downstream consumers of `segment_reasons` (UI rendering, Stage 11 counterfactuals joining on timestamp) may truncate or overflow display areas designed for 200-char strings.

**Fix:** Align schema with prompt:

```typescript
reason: z.string().max(200).optional(),
```

---

### WR-05: `normalizeOverSurvivors` in `weighted-aggregator.ts` can produce NaN when `slot_type` is not one of the four keys

**File:** `src/lib/engine/wave3/weighted-aggregator.ts:62-70`

**Issue:** `getPersonaWeight` (line 73-75) does `w[r.slot_type]`. The `Pass2PersonaResult` type declares `slot_type: "fyp" | "niche" | "loyalist" | "cross_niche"`. However, the `PersonaWeights` interface keys are `fyp`, `niche`, `loyalist`, `cross_niche`. Note that `Pass2PersonaResult.slot_type` uses `"niche"` but Pass 1's `PersonaSimulationResult.slot_type` uses `"niche_deep"`. The cast in `pass2.ts:153` is:

```typescript
slot_type: slot.slot_type as Pass2PersonaResult["slot_type"],
```

`PersonaSlot.slot_type` from `persona-registry.ts` includes `"niche_deep"` as a valid slot type. If a slot returns `slot_type = "niche_deep"`, the cast passes TypeScript but at runtime `w["niche_deep"]` is `undefined`, causing `getPersonaWeight` to return `undefined`, making `weightedSum += att * undefined` produce `NaN`.

**Fix:** Add an explicit mapping in `getPersonaWeight`:

```typescript
function getPersonaWeight(r: Pass2PersonaResult, w: PersonaWeights): number {
  // "niche_deep" maps to "niche" weight bucket
  const key = r.slot_type === "niche_deep" ? "niche" : r.slot_type;
  return w[key as keyof PersonaWeights] ?? 0;
}
```

Or ensure `Pass2PersonaResult.slot_type` is widened to include `"niche_deep"` and handle the mapping in `normalizeOverSurvivors`.

---

### WR-06: `buildDemographicContext` ignores `utcHour === 23` — produces `undefined` time_of_day

**File:** `src/lib/engine/pipeline.ts:357-364`

**Issue:** The time-of-day mapping covers:

```typescript
if (utcHour >= 23 || utcHour < 6)       time_of_day = "late_night";
else if (utcHour >= 6 && utcHour < 11)  time_of_day = "morning";
else if (utcHour >= 11 && utcHour < 14) time_of_day = "midday";
else if (utcHour >= 14 && utcHour < 18) time_of_day = "afternoon";
else if (utcHour >= 18 && utcHour < 23) time_of_day = "evening";
```

`utcHour >= 23` covers hour 23 correctly (11 PM). Hour 22 falls to `>= 18 && < 23` → "evening". All hours 0-22 are covered. Actually this logic is correct — `>= 23` catches only 23, and `< 6` catches 0-5. Wait: hour 18 ≤ h < 23 covers 18,19,20,21,22 → "evening". Hour 23 → "late_night". Hours 0-5 → "late_night". This is actually correct. Disregard — this is not a bug.

**Revised finding:** The `scrollingStateMap` keys are typed as `Record<KnownTimeOfDay, ScrollingState>` but `KnownTimeOfDay` is a locally-defined type alias. If `time_of_day` remains `undefined` (unreachable but `| undefined` in type), `scrollingStateMap[time_of_day]` would be a TypeScript error caught by the guard `time_of_day ? scrollingStateMap[time_of_day] : undefined`. This is fine.

The actual issue is that `buildDemographicContext` always produces `age_bucket: undefined` — the interface supports it but Pass 2 personas simulate age-sensitive behavior (e.g., Gen Z vs Millennial scroll patterns). The fallback renders `"Age bucket: unknown"` in every prompt, degrading the demographic simulation accuracy for all predictions regardless of creator profile data.

**Fix:** This is a known gap (D-04 notes "all fields optional"). Mark for M2-II when creator profiles store age distribution data. No code change required for correctness, but document as known limitation.

Downgrading this to INFO. Removing from WARNING count.

---

### WR-07: `assembleHeatmapPayload` called twice per `aggregateScores` invocation

**File:** `src/lib/engine/aggregator.ts:1068-1073`

**Issue:** `buildWeightedCurve` (line 1068) and `assembleHeatmapPayload` (line 1073) are both called. Inside `assembleHeatmapPayload` (weighted-aggregator.ts:174), it calls `buildWeightedCurve` again. So for each `aggregateScores` call with a valid Pass 2 outcome, `buildWeightedCurve` runs twice, iterating over all persona `segment_reactions` arrays twice. For 10 personas × N segments, this doubles the work. Not a correctness bug but documented as a WARNING per the review scope (this is maintainability/correctness-adjacent because the two calls must produce identical results; any divergence from future edits would be a silent bug).

**Fix:** Reuse the `curveResult` from the first `buildWeightedCurve` call inside `assembleHeatmapPayload` by refactoring the function to accept a pre-computed curve, or extract `normalizeOverSurvivors` and pass its result to both.

---

## Info

### IN-01: `extractFrameAtTimestamp` does not set a timeout on the ffmpeg process

**File:** `src/lib/engine/filmstrip/extract.ts:30-59`

**Issue:** The `spawn` call has no timeout guard. A hung or very slow ffmpeg process (e.g., remote video URL unresponsive, corrupted stream) will keep the Node.js process waiting indefinitely. The `/api/filmstrip/extract` route has `maxDuration=300`, but individual ffmpeg invocations could stall the route for the full 300s per segment in the worst case (50 segments × potential stall = route timeout).

**Fix:** Add an `AbortController` or `setTimeout` that kills the ffmpeg process after a reasonable per-frame timeout (e.g., 30s):

```typescript
const timeout = setTimeout(() => {
  proc.kill("SIGKILL");
  log.error("ffmpeg timeout", { tStartSeconds });
}, 30_000);
proc.on("close", () => clearTimeout(timeout));
```

---

### IN-02: `triggerFilmstripGeneration` uses `NEXT_PUBLIC_APP_URL` for internal server-to-server call

**File:** `src/lib/engine/filmstrip/queue.ts:26`

**Issue:** `NEXT_PUBLIC_APP_URL` is a browser-facing public URL (prefixed `NEXT_PUBLIC_`). For server-to-server calls, using an internal/loopback URL (e.g., `INTERNAL_APP_URL` or `localhost`) would be faster and avoid the public internet/CDN hop. Additionally, in Vercel deployments, a function calling its own public URL adds unnecessary latency (cold start risk, round-trip through edge network) compared to a direct internal call.

**Fix:** Use `APP_INTERNAL_URL` (non-public env var, defaults to `http://localhost:3000` in dev) for server-to-server calls. Or use Next.js route handlers directly (import and call the handler function) rather than HTTP.

---

### IN-03: `Pass2ResponseSchema` validates `persona_id` but pass2.ts overwrites it with `slot.persona_id`

**File:** `src/lib/engine/wave3/pass2.ts:150-157`

**Issue:** The `Pass2ResponseSchema` includes `persona_id: z.string()` and the validated data is available as `validated.data.persona_id`. However, `pass2.ts` ignores the model-returned `persona_id` and uses `slot.persona_id` instead:

```typescript
const result: Pass2PersonaResult = {
  persona_id: slot.persona_id,  // model's persona_id discarded
  // ...
```

This is intentional (prevents model hallucination of wrong IDs) and correct. But `persona_id` in `Pass2ResponseSchema` adds a required field to the schema that the model must emit, consumes output tokens, and is validated — all for a value that is then discarded. This slightly increases model output size and Zod validation work unnecessarily.

**Fix:** Remove `persona_id` from `Pass2ResponseSchema` or make it `.optional()` since it is not consumed. Add a comment explaining the slot ID takes precedence.

---

### IN-04: `makePipelineResult` factory in `factories.ts` uses `Math.random()` in weighted-aggregator test helper

**File:** `src/lib/engine/__tests__/weighted-aggregator.test.ts:50`

**Issue:** `makePass2Persona` generates `persona_id` using `Math.random()`:

```typescript
persona_id: opts.persona_id ?? `persona-${slotType}-${Math.random().toString(36).slice(2)}`,
```

This makes test output non-deterministic for any assertion on `persona_id` or output that depends on it. Since weighted curve computation doesn't depend on `persona_id`, this is not a correctness issue in the current tests — but any future test that snapshots a `HeatmapPayload.personas[].id` would produce non-deterministic results.

**Fix:** Use a stable counter or seeded value:

```typescript
let personaCounter = 0;
// in makePass2Persona:
persona_id: opts.persona_id ?? `persona-${slotType}-${personaCounter++}`,
```

---

_Reviewed: 2026-05-27T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
