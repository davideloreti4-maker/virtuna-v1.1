# Phase 2: Omni Verbatim — Discussion Log

**Date:** 2026-06-04
**Mode:** discuss (default), advisor off

> Human-reference record of the discussion. NOT consumed by downstream agents — see `02-CONTEXT.md` for the decisions that flow into research/planning.

## Areas discussed

### 1. Judgment-field drop sequencing
- **Options presented:** (a) Additive-only now, drop in P3 [recommended]; (b) Drop redundant judgments now; (c) Drop only the truly-unused subset.
- **Selected:** (a) Additive-only now, drop in P3.
- **Rationale surfaced:** P1-era score still blends `behavioral + gemini` off the Omni judgment fields; Apollo (the replacement scorer) lands P3/P5. Dropping in P2 would regress the live score and break the "zero-regret / independently shippable" property. → D-01.

### 2. Empty / silent verbatim contract
- **Options presented:** (a) Honest null when absent [recommended]; (b) Empty string sentinel; (c) Placeholder marker.
- **Selected:** (a) Honest null when absent.
- **Rationale surfaced:** Milestone honesty ethos forbids fabricating words; `null` distinguishes "nothing to transcribe" from a real line. R1 "non-empty" applies only to speech-bearing video. → D-02.

### 3. Verbatim shape & on-screen scope
- **Options presented:** (a) Dedicated `hook_verbatim` + per-segment text [recommended]; (b) Segment-only (derive hook from segment[0]); (c) Hook-only.
- **Selected:** (a) Dedicated `hook_verbatim` + per-segment text; on-screen = all overlays verbatim per segment.
- **Rationale surfaced:** R2 rewrites need a clean hook `original` target; R3 Audience-Sim needs per-segment transcript. → D-03.

### 4. Transcription fidelity rules (multi-select)
- **Options presented:** Keep original language; Mark uncertain audio; Preserve casing & punctuation; Cap field length.
- **Selected:** ALL FOUR + user asked for a thought-through recommendation.
- **Claude's recommendation given:** caps = hook 280 / per-segment 500 (matches schema idiom); `[inaudible]` for present-but-unclear speech only, kept distinct from D-02's `null`; preserve casing/punct/emoji; no translation. → D-04.

## Deferred ideas captured
- Drop ~15 judgment fields → P3.
- Apollo rewrites quoting verbatim → P3 (incl. guarding `[inaudible]`/`null` from leaking as a quotable line).
- Audience-Sim fed per-segment transcript → P4.
- Remix decode/adapt grounded on verbatim → P3 (R12); P2 verifies no regression only.
- Foreign-language translation → out of milestone.

## Claude's discretion delegated to planner
- Persistence target (DB column vs JSON blob); exact cap values; emit-vs-derive `hook_verbatim`; whether to add a transcription example to the prompt; threading mechanics (follow emotion_arc precedent, prove persistence on a real run).
