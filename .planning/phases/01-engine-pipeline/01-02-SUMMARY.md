# Plan 01-02 — Read substrate robustness — SUMMARY

> Executed 2026-06-11. Re-scoped from the original flash-vs-plus A/B (D-10 CLOSED — keep
> flash, models locked) to the read-failure hardening set: F47 + F46 + F16 + F9. D-R1
> (Read→pure sensor) DEFERRED to its own coordinated atomic change (Davide: option A).

## Co-review decisions (Task 1 checkpoint, D-00)
- **D-R1 sequencing → A (defer, coordinated commit).** Dropping factors/overall_impression/
  content_summary from the Read is MUST-COORDINATE: it fails the Read's OWN Zod parse, crashes
  `gemini.factors.reduce` (aggregator.ts:784), kills gemini_score, blanks Apollo's
  formatGeminiSignals, breaks 2 creator rules + decode (returns null) + stage10, and won't
  compile (decode-types.ts requires the fields). Shipping it in 01-02 alone = build+tests RED
  across plans. → D-R1 lands as ONE atomic commit across read+schema+aggregator+Apollo+decode at
  the 01-03 boundary. See the consumer map in 01-02-PLAN.md <interfaces>.
- **F47 → OMNI_MAX_TOKENS default 8000, NO version bump.** It only rescues reads that were
  *failing* (truncating to SyntaxError); doesn't shift scores on already-working videos → no
  cache invalidation warranted.
- **F46/F9/F16 → approved as proposed.**

## What shipped (Tasks 2-4)

### F46 — no-speech / no-audio read robustness (schemas.ts + gemini/schemas.ts)
- `hook_decomposition.first_words_speech_score` + `audio_hook_quality` → `ScoreSchema.nullable()`.
  Legit null on b-roll/music-only/ASMR; a required-NUMBER field was rejecting the WHOLE read
  (Ashton Hall 79s clip silent total failure). Mirrors D-A2's audio nulling.
- `weakest_modality` derive transform now reduces only over NON-null modalities (skips absent
  ones; visual_stop_power + text_overlay_score are never null so it stays a required field).
- **Mirrored in BOTH schemas:** qwen/schemas.ts (live read path) AND gemini/schemas.ts (the TYPE
  surface the app consumes via types.ts). They must stay field-compatible.
- Downstream null-safety added: `meanHookScore`/`strongestModality` (content-analysis-derive.ts)
  average/compare only present modalities; creator-rulebook Three-Hook-Stack treats null audio
  hook as absent (`?? 0`).

### F16 — audio_description min(10) → min(1) (schemas.ts)
- A terse legit audio ("music", 5 chars) no longer fails the whole parse on the length edge.
  Empty string still rejected.

### F47 — OMNI_MAX_TOKENS default 8000 (omni-analysis.ts)
- Was 0 (uncapped) → DashScope's low default truncated long/dense videos' output mid-JSON →
  SyntaxError → silent read failure. Now bounded; env-overridable. TIMEOUT_MS untouched (PITFALL 2).

### F9/D-11 — critical-field bounded retry + read_drift telemetry (omni-analysis.ts)
- New `detectCriticalFieldDrift()`: after a SUCCESSFUL parse, flags empty emotion_arc (gated out
  for slideshow/b_roll) + null hook_verbatim.spoken_words on a SPEECH video (gated by F46's
  speech-presence signal so no-speech videos don't false-trigger). weakest_modality NOT checked
  (F46 makes it always derivable).
- On drift with retries left → ONE bounded retry: re-sends the volatile user message, appends a
  field-specific nudge to the END of system content (cached prefix stays byte-stable).
- On persistent drift after retry → accepts the read gracefully (no thrown frame) AND emits a
  `read_drift` log naming the drifted fields — no longer a silent drop.
- Retry-hint plumbing (`retryHint`) also tightened: malformed-JSON / Zod-fail / parse-throw all
  nudge toward clean JSON; attempt-0 stays cache-warm (empty extraInstruction).

## Verification
- New tests: omni-analysis-nospeech.test.ts (6) + omni-analysis-critical-field-retry.test.ts (5) — green.
- Regression: emotion-arc (15) + verbatim (25) + aggregator/rulebook suites (165) + content-analysis (51) — all green.
- `tsc --noEmit`: 0 new errors (12 pre-existing test-fixture errors unrelated to this change:
  prediction-result fixture, flop-warning/stage10 `views`, fold-adapter/diversity/schema — all
  EngagementRange/PersonaSlot drift, untouched here).
- eslint: 0 errors on changed files (1 pre-existing `_opts` warning).
- **NOT committed** (per D-02: batch live verification with plan 01's fixes; testing menu offered to Davide).

## Hand-offs
- **D-R1** → coordinated atomic commit at 01-03 boundary (read prompt drop + OmniAnalysisZodSchema/
  GeminiResponseSchema optional + aggregator factors/gemini_score fallbacks + deepseek
  formatGeminiSignals + decode-types + version bump). Consumer map in 01-02-PLAN.md.
- **No version bump** this plan (F46/F16/F9 widen acceptance / add resilience; F47 rescues failures
  — none change output shape for already-working videos). D-R1's commit owns the next bump.
- **Live repro for UAT:** Ashton Hall 79s no-speech clip exercises F46 + F47 together.
