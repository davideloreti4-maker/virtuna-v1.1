---
phase: 04-input-adapter
plan: 01
subsystem: engine/stimulus
tags: [contract, types, nyquist, tdd, additive, D-02, D-03, D-06]
requires:
  - "src/lib/engine/types.ts (AnalysisInput/ContentPayload — read-only analog)"
  - "src/lib/engine/qwen/client.ts (QWEN_REASONING_MODEL/QWEN_OMNI_MODEL constants)"
  - "src/lib/engine/packs/socials.ts (SOCIALS_PACK — D-02 smoke target)"
provides:
  - "Stimulus / StimulusKind / Sim1Tier / StimulusSource / StimulusSubject / StimulusInput / StimulusSchema (stimulus/types.ts)"
  - "widened StimulusType union (+file_text +image) in domain-pack.ts"
  - "Wave-0 Nyquist test scaffold (4 RED unit stubs + 1 GREEN Socials smoke + gated A2 live smoke)"
affects:
  - "Waves 1–2 (tier.ts / ingest.ts / vision.ts / normalize.ts) implement against this contract"
  - "P5 inbox + Profile verb consume Stimulus + subject tag"
tech-stack:
  added: []
  patterns:
    - "Zod-schema-at-boundary + exported TS interface (mirrors AnalysisInputSchema)"
    - "Discriminated input union for normalize entrypoint"
    - "partial vi.mock (importActual spread) to keep real model constants while faking getQwenClient"
key-files:
  created:
    - "src/lib/engine/stimulus/types.ts"
    - "src/lib/engine/stimulus/__tests__/tier.test.ts"
    - "src/lib/engine/stimulus/__tests__/ingest.test.ts"
    - "src/lib/engine/stimulus/__tests__/vision.test.ts"
    - "src/lib/engine/stimulus/__tests__/normalize.test.ts"
    - "src/lib/engine/stimulus/__tests__/socials-untouched.smoke.test.ts"
  modified:
    - "src/lib/engine/domain-pack.ts"
decisions:
  - "Stimulus is additive (D-02) — sits alongside, never replaces, the Socials AnalysisInput/ContentPayload; tiktok_url omitted from StimulusKind (URL ingestion stays the Socials path)."
  - "StimulusType union widened in place (+file_text +image); input_mode branching NOT collapsed into the pack key; packs/socials.ts:74 byte-unchanged (Socials does not gain the new kinds)."
  - "filename is display-only provenance, NEVER a path (Pitfall 3 / T-04-01-01); only source.storagePath is a safe path (video persistence)."
  - "Four unit stubs are EXPECTED-RED (module-not-found) until their Wave 1–2 implementations; the D-02 smoke + gated A2 skip are GREEN now."
metrics:
  duration: "~12 min"
  completed: "2026-06-27"
  tasks: 2
  files: 7
---

# Phase 4 Plan 01: Stimulus Contract + Nyquist Wave-0 Scaffold Summary

Additive `Stimulus` contract (the General input-adapter's normalized output) plus the full RED-first Wave-0 test scaffold — interface-first foundation every downstream P4 plan implements against, with a failing test waiting for each code task.

## What Was Built

**Task 1 — the contract (`42615adc`):**
- `src/lib/engine/stimulus/types.ts` (new, ~130 lines): exports `Stimulus`, `StimulusKind` (`"text"|"file_text"|"image"|"video"`), `Sim1Tier` (`"flash"|"max"`), `StimulusSource`, `StimulusSubject`, `StimulusInput` (discriminated union for `normalizeStimulus`), and `StimulusSchema` (Zod boundary validator mirroring `AnalysisInputSchema`). Header documents additive (D-02), profiler-ready (D-06), tier-carrying (D-03), and the filename-is-display-only rule (Pitfall 3).
- `src/lib/engine/domain-pack.ts`: `StimulusType` union widened in place → `+ "file_text" | "image"`. The surrounding anti-pattern comment, the `input_mode` branching, and `packs/socials.ts:74` are all untouched.

**Task 2 — the Nyquist scaffold (`cc87d0f2`):**
- 4 RED unit stubs (`tier`, `ingest`, `vision`, `normalize`) that import the sibling modules landing in Waves 1–2 — collected by vitest and failing with module-not-found by design.
- `vision.test.ts` partial-mocks `../../qwen/client` (keeps the real `QWEN_REASONING_MODEL`/`QWEN_OMNI_MODEL` constants via `importActual`, swaps `getQwenClient`); asserts `model === QWEN_REASONING_MODEL` (never `QWEN_OMNI_MODEL`, D-04), a base64 `data:image/...` `image_url` item + trailing text item, and strip→parse→Zod. Includes the `it.skip`-by-default A2 live base64 smoke gated on `DASHSCOPE_API_KEY` (uses a real OpenAI client to bypass the file-level mock; 1×1 PNG → assert parseable 200).
- `socials-untouched.smoke.test.ts` (GREEN now): asserts `normalizeInput` still returns a `ContentPayload`-shaped object and `SOCIALS_PACK.stimulusTypes` deep-equals `["text","tiktok_url","video_upload"]` (D-02 / T-04-01-02).

## Verification

- `node ./node_modules/vitest/vitest.mjs run …/socials-untouched.smoke.test.ts` → **2 passed, exit 0** (GREEN).
- The four unit stubs run → **4 files failed with `Cannot find module '../tier|../ingest|../vision|../normalize'`** (expected RED — impl lands Waves 1–2).
- `npx tsc --noEmit` → **no new errors** on `stimulus/types.ts` or `domain-pack.ts`.
- `packs/socials.ts:74` confirmed unchanged; `file_text` + `image` confirmed present in the widened union.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected a self-authored smoke assertion to match real `extractHashtags` output**
- **Found during:** Task 2 (running the Socials smoke).
- **Issue:** The smoke initially asserted `payload.hashtags` contains `"world"`; `extractHashtags` (normalize.ts:7) retains the `#` prefix and lowercases → returns `"#world"`.
- **Fix:** Changed the assertion to `toContain("#world")`. This is a test-authoring correction (the assertion was wrong, not the Socials code) — the Socials path itself is byte-untouched, consistent with D-02.
- **Files modified:** `src/lib/engine/stimulus/__tests__/socials-untouched.smoke.test.ts`
- **Commit:** `cc87d0f2`

## Threat Surface

No new trust boundary crossed (contracts + tests only). The `StimulusSchema` Zod object defined here is the boundary validator the Wave 1–2 ingest/vision implementations will consume. The D-02 smoke (T-04-01-02) and the type-doc filename-display-only rule (T-04-01-01) are both satisfied. Zero new packages (D-05) — no install surface.

## Self-Check: PASSED

- `src/lib/engine/stimulus/types.ts` — FOUND
- `src/lib/engine/stimulus/__tests__/{tier,ingest,vision,normalize,socials-untouched.smoke}.test.ts` — FOUND (5)
- `src/lib/engine/domain-pack.ts` widened union — FOUND
- Commit `42615adc` (Task 1) — FOUND
- Commit `cc87d0f2` (Task 2) — FOUND
