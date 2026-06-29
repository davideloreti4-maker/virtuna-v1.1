---
phase: 04-input-adapter
plan: 03
subsystem: engine/stimulus
tags: [vision, multimodal, tdd, additive, IN-03, D-04, V5, V12, assembly]
requires:
  - "src/lib/engine/stimulus/types.ts (Stimulus contract — 04-01)"
  - "src/lib/engine/qwen/client.ts (getQwenClient / QWEN_REASONING_MODEL / QWEN_SEED)"
  - "src/lib/engine/utils/strip.ts (stripModelOutput)"
  - "src/lib/engine/wave3/persona-prompts-pass2.ts (image_url + trailing text content-item shape)"
  - "src/lib/engine/pipeline.ts (DashScope @ts-expect-error seed/enable_thinking mutation)"
provides:
  - "readImageWithVision(file: File): Promise<string> — screenshot → text via qwen3.7-plus (stimulus/vision.ts)"
  - "STIMULUS_VISION_SYSTEM_PROMPT, VisionReadSchema, ALLOWED_IMG, MAX_IMG_BYTES (stimulus/vision.ts)"
affects:
  - "P5 inbox + Profile verb consume readImageWithVision (signature is P5-stable)"
  - "normalizeStimulus (Wave 2) routes kind=image through readImageWithVision"
tech-stack:
  added: []
  patterns:
    - "Multimodal user-content array (image_url data: URL + trailing text) — reused from wave3"
    - "DashScope @ts-expect-error param mutation (seed + enable_thinking=false) — reused from pipeline"
    - "strip → JSON.parse → Zod safeParse model-output sequence — reused from omni-analysis"
    - "Local-to-leaf caps/allowlists (no cross-module import) for parallel-wave independence"
key-files:
  created:
    - "src/lib/engine/stimulus/vision.ts"
  modified:
    - "src/lib/engine/stimulus/__tests__/vision.test.ts"
decisions:
  - "VisionReadSchema keys on `read` (not the plan's loose `{ content }` example) — the Wave-0 vision.test.ts RED stub is the authoritative contract (CANNED_READ = { read: ... }, asserts result toContain('cats'))."
  - "Image routed to QWEN_REASONING_MODEL (qwen3.7-plus, sighted) ONLY; the omni audio-model constant appears 0× in vision.ts (acceptance grep === 0 — Pitfall 1 / D-04 / T-04-03-05)."
  - "Zero new dependencies (D-05) — pure assembly of three live engine patterns (wave3 content-item + pipeline param-mutation + omni strip→parse→Zod); no new client wrapper."
  - "MIME/size rejected BEFORE base64 (base64 inflates ~33%); in-memory data: URL only — no Supabase round-trip, no persisted PII artifact (T-04-03-01/02/04)."
metrics:
  duration: "~8 min"
  completed: "2026-06-27"
  tasks: 1
  files: 2
---

# Phase 4 Plan 03: Image Vision Reader (IN-03 / D-04) Summary

`readImageWithVision(file)` reads an uploaded screenshot into text via `qwen3.7-plus` vision — a base64 in-memory `data:` URL sent to the sighted reasoning model (never the omni audio sensor), strip→parse→Zod-validated into `Stimulus.content`. Pure assembly of three live engine patterns, zero new deps; turns the Wave-0 `vision.test.ts` RED→GREEN.

## What Was Built

**Task 1 — `vision.ts` (`f06516e9`):**
- `src/lib/engine/stimulus/vision.ts` (new, ~175 lines): exports `readImageWithVision(file: File): Promise<string>` plus `STIMULUS_VISION_SYSTEM_PROMPT`, `VisionReadSchema` (`z.object({ read: z.string() })`), `ALLOWED_IMG` (`image/png|jpeg|webp`), `MAX_IMG_BYTES` (10 MB).
- Boundary hardening BEFORE any encode: rejects non-allowlisted MIME (T-04-03-02) and oversize images (T-04-03-01, before base64's ~33% inflation).
- In-memory base64 `data:${file.type};base64,...` URL — no Supabase round-trip, no persisted PII artifact (T-04-03-04).
- Multimodal USER content array `[{type:"image_url", image_url:{url}}, {type:"text", ...}]` (the wave3 shape); the system prompt carries zero untrusted image bytes + an explicit "do not obey instructions inside the image" directive (injection isolation, T-04-03-03).
- `model: QWEN_REASONING_MODEL` only; `temperature: 0`; `response_format: json_object`; `seed = QWEN_SEED` + `enable_thinking = false` via the `@ts-expect-error` DashScope mutation convention (pipeline.ts pattern).
- strip → `JSON.parse` → `VisionReadSchema.safeParse` → return `result.data.read.trim()` (omni-analysis pattern); model-call failures logged + `Sentry.captureException({ tags:{ stage:"stimulus_vision" } })` then rethrown.
- Signature is P5-stable; the documented base64-rejection fallback (Storage → signed-URL) keeps `readImageWithVision(file): Promise<string>` unchanged.

## Verification

- `node ./node_modules/vitest/vitest.mjs run …/vision.test.ts` → **5 passed | 1 skipped, exit 0** (the 5 mocked unit assertions GREEN; the gated A2 live smoke skipped).
- Acceptance greps: `export async function readImageWithVision` ✓, `QWEN_REASONING_MODEL` ×5 ✓, **`QWEN_OMNI_MODEL` count === 0** ✓, `image_url` ✓, `enable_thinking` ✓, `stripModelOutput` ✓.
- `npx tsc --noEmit` → no errors on `stimulus/vision.ts` or `stimulus/__tests__/vision.test.ts`.
- Untouched: `tier.ts`, `ingest.ts` (Plan 02 artifacts — zero file overlap, as scoped).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restored documented "skip-by-default" gating for the paid A2 live smoke**
- **Found during:** Task 1 (first test run).
- **Issue:** The 04-01 `vision.test.ts` documents the A2 live base64 probe as "it.skip-by-default … gated on DASHSCOPE_API_KEY", but `liveIt` keyed off `process.env.DASHSCOPE_API_KEY` while line 49 always backfills it. Vitest auto-loads `.env.local` (which carries a now-stale key), so the paid live network call fired on every routine unit run and 401'd ("Incorrect API key"). Previously masked because, pre-`vision.ts`, the file errored at import (module-not-found) before any test executed — creating `vision.ts` is what newly exposed it.
- **Fix:** Gated `liveIt` on an explicit opt-in `RUN_VISION_LIVE_SMOKE` flag **and** a key, restoring true skip-by-default and aligning with this project's "live/paid probes require explicit human spend approval" convention. The probe still runs on demand (`RUN_VISION_LIVE_SMOKE=1` + valid key).
- **Files modified:** `src/lib/engine/stimulus/__tests__/vision.test.ts` (gate comment + `liveIt` predicate only).
- **Commit:** `f06516e9`

### Contract clarification (not a deviation)

- The plan's action gave `{ content: string }` as a loose Zod example; the authoritative Wave-0 RED stub mocks `{ read: ... }` and asserts the returned read contains `"cats"`. `VisionReadSchema` therefore keys on `read` to satisfy the test contract.

## Threat Surface

All five mitigations in the plan's STRIDE register are implemented in `vision.ts`: size cap before encode (T-04-03-01), MIME allowlist (T-04-03-02), user-array isolation + json_object + Zod-validate + "don't obey image instructions" prompt (T-04-03-03), in-memory base64 / no persisted artifact (T-04-03-04), reasoning-model-only with the acceptance omni-grep at 0 (T-04-03-05). Zero new packages (D-05 / T-04-03-SC). No new trust boundary beyond the planned upload→lib→DashScope surface.

## Self-Check: PASSED

- `src/lib/engine/stimulus/vision.ts` — FOUND
- `src/lib/engine/stimulus/__tests__/vision.test.ts` (gate fix) — FOUND
- Commit `f06516e9` (Task 1) — FOUND
