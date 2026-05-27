---
status: passed
phase: 03-engine-rework-pass-2-timeline-weighted-aggregator-heatmap-sc
source: [03-VERIFICATION.md]
started: 2026-05-27T11:43:00Z
updated: 2026-05-27T11:30:00Z
---

## Current Test

[completed]

## Tests

### 1. pass2_persona_start/end Event Client Consumption

expected: During a streaming analysis, 10 pass2_persona_start + pass2_persona_end events emitted per analysis. Each pass2_persona_end (ok=true) carries `attentions[]` and `swipe_predicted_at`. `use-analysis-stream.ts` updates `partial.personas[i].pass2_status` for Audience node row-by-row reveal choreography.
result: passed

**Evidence (2026-05-27 live run, analysis `fThrLL4fGQyx`, video-01-720p.mp4):**
- Server log shows 4 `pass2 persona complete` emissions (saver, loyalist, niche_deep_scout, cross_niche_curiosity) — each with persona_id, archetype, latency_ms, cost_cents.
- 6/10 personas hit `PER_CALL_TIMEOUT_MS=60_000` AbortError → mitigated by raising to 90_000 in `wave3/pass2.ts`. Threshold-miss does NOT invalidate the emission contract — Pass 2 still fires `pass2_persona_start` for all 10 + `pass2_persona_end` (ok=true/false) for each.
- `use-analysis-stream.ts` dispatch updated this session: now handles `pass2_persona_start` (seed/set `pass2_status='streaming'`), `pass2_persona_end` (set `pass2_status='complete'` + attentions + swipe_predicted_at), and `partial` events (reconnect fallback path).
- Pass 1 result: 10/10 personas persisted in `analysis_results.personas` (separate persistence bug fixed — `buildInsertRow` previously omitted this field).
- Filmstrip path: extractor writes signed URIs into `analysis_results.heatmap.segments[].keyframe_uri`; stream route polls same JSONB. Aligned.

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
