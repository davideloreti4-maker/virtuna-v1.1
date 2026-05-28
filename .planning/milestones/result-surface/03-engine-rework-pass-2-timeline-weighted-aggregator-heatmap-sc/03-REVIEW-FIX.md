---
phase: 03-engine-rework-pass-2-timeline-weighted-aggregator-heatmap-sc
fixed_at: 2026-05-27T12:07:00Z
review_path: .planning/phases/03-engine-rework-pass-2-timeline-weighted-aggregator-heatmap-sc/03-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 11
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-05-27T12:07:00Z
**Source review:** `.planning/phases/03-engine-rework-pass-2-timeline-weighted-aggregator-heatmap-sc/03-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 11 (5 Critical, 6 Warning; WR-06 downgraded to INFO by reviewer)
- Fixed: 11
- Skipped: 0

**Post-fix verification:**
- `pnpm tsc --noEmit` — zero errors
- vitest suite (pipeline, aggregator, anti-virality, pass2, events) — 117/117 passed

## Fixed Issues

### CR-01: Filmstrip keyframe URI write/read path mismatch

**Files modified:** `src/app/api/filmstrip/extract/route.ts`
**Commit:** `61067d1`
**Applied fix:** Changed the filmstrip extract route to read `analysis_results` JSONB and
write keyframe URIs into `analysis_results.heatmap.segments[].keyframe_uri` (the canonical
D-13 location). Previously written to `variants.filmstrip_segments` which no consumer read.

---

### CR-02: Pass 2 always uses "other" slot routing — slot_type mismatch with Pass 1

**Files modified:** `src/lib/engine/wave3/pass2.ts`, `src/lib/engine/pipeline.ts`
**Commit:** `bc5f0de`
**Applied fix:** Added `contentTypeSlug?: string | null` and `nicheSlug?: string | null`
optional params to `runWave3Pass2` signature. Now calls
`selectPersonaSlots(contentTypeSlug ?? null, nicheSlug ?? null)`. Pipeline.ts call site
updated to pass `wave0Result.content_type?.type` and `wave0Result.niche?.primary_slug`.
**Note:** Requires human verification — slot-assignment matching logic (Pass 1 vs Pass 2
alignment) is behavioral and not covered by existing unit tests.

---

### CR-03: SSRF deny-list incomplete — IPv6 private ranges and GCP metadata not blocked

**Files modified:** `src/app/api/filmstrip/extract/route.ts`
**Commit:** `e142c5d`
**Applied fix:** Added four new patterns to `SSRF_DENY_PATTERNS`:
`/^::ffff:/i` (IPv4-mapped IPv6), `/^fc00:/i` (unique-local fc00::/7),
`/^fd[0-9a-f]{2}:/i` (unique-local fd00::/8), `/^fe80:/i` (link-local),
`/^metadata\.google\.internal$/i` (GCP IMDS hostname).

---

### CR-04: Empty-secret bearer token bypass

**Files modified:** `src/lib/engine/filmstrip/queue.ts`
**Commit:** `6d2cf4c`
**Applied fix:** Added early-return guard at the top of `triggerFilmstripGeneration`
when `FILMSTRIP_EXTRACT_SECRET` is not set. Logs `log.error` with the analysisId
so the misconfiguration is observable. The `fetch` call now uses the validated
`secret` variable (not the env var directly) so TypeScript understands it is non-null.

---

### CR-05: isTimelinePatternTriggered uses t_end <= 5 — excludes cross-boundary segments

**Files modified:** `src/lib/engine/anti-virality.ts`
**Commit:** `0ff81f6`
**Applied fix:** Changed filter from `s.t_end <= 5` to `s.t_start < 5` to include all
segments that begin within the first 5 seconds. Segments like `[4, 7]` that span the
5s boundary are now correctly included in the hook-drop detection window.

---

### WR-01: SSE poll loop — up to 2s extra wait after client disconnect

**Files modified:** `src/app/api/analyze/[id]/stream/route.ts`
**Commit:** `637064b`
**Applied fix:** Replaced `await new Promise((r) => setTimeout(r, INTERVAL))` with a
version that clears the timeout immediately if `aborted.value` is already true when
the sleep begins, plus an explicit `if (aborted.value) break` after the sleep resolves.
This limits post-disconnect wait to near-zero.

---

### WR-02: buildWeightedCurve double-called — normalizeOverSurvivors redundant

**Files modified:** `src/lib/engine/wave3/weighted-aggregator.ts`
**Commit:** `07fc501`
**Applied fix:** Added `normalizedWeights: PersonaWeights` to the `buildWeightedCurve`
return type. `assembleHeatmapPayload` now destructures `normalizedWeights` from
`buildWeightedCurve` result instead of calling `normalizeOverSurvivors` separately.
The two values are guaranteed to be identical; future divergence is now impossible.

---

### WR-03: SSE parse loop doesn't handle id: prefixed lines

**Files modified:** `src/hooks/queries/use-analysis-stream.ts`
**Commit:** `9483275`
**Applied fix:** Replaced the two-line `event:` + `data:` assumption with a proper
SSE frame accumulator. Buffer is split on `"\n\n"` (SSE frame boundaries), then
`event:` and `data:` fields extracted from each frame independently. `id:` lines
are ignored (browser native EventSource manages Last-Event-ID). The `complete`
event's data payload is now correctly parsed.

---

### WR-04: Pass2ResponseSchema reason max 400 chars but prompt says 200

**Files modified:** `src/lib/engine/wave3/persona-prompts-pass2.ts`
**Commit:** `f47bc7c`
**Applied fix:** Changed `z.string().max(400).optional()` to `z.string().max(200).optional()`
to align the Zod schema with the `STABLE_PASS2_SYSTEM_PROMPT` constraint of 200 characters.

---

### WR-05: normalizeOverSurvivors can produce NaN for niche_deep slot_type

**Files modified:** `src/lib/engine/wave3/weighted-aggregator.ts`
**Commit:** `9389f01`
**Applied fix:** Updated `getPersonaWeight` to map `"niche_deep"` → `"niche"` weight
bucket with a `?? 0` fallback for any unknown slot_type. Prior code returned
`w["niche_deep"]` which is `undefined` at runtime (not a key on `PersonaWeights`),
causing NaN to propagate through all weighted sums.

---

### WR-07: assembleHeatmapPayload calls buildWeightedCurve internally — double computation from aggregator

**Files modified:** `src/lib/engine/wave3/weighted-aggregator.ts`, `src/lib/engine/aggregator.ts`
**Commit:** `9cb7f60`
**Applied fix:** Added optional `preComputedCurve` param to `assembleHeatmapPayload`.
When provided, it is used directly instead of calling `buildWeightedCurve` again.
`aggregator.ts` now passes its existing `curveResult` so the second full iteration
over all persona segment_reactions is eliminated.

---

## Skipped Issues

None — all 11 in-scope findings were successfully fixed.

---

_Fixed: 2026-05-27T12:07:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
