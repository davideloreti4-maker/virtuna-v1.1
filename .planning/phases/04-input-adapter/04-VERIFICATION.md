---
phase: 04-input-adapter
verified: 2026-06-27T20:33:55Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run the gated A2 live vision smoke against the real model: RUN_VISION_LIVE_SMOKE=1 DASHSCOPE_API_KEY=<valid> node ./node_modules/vitest/vitest.mjs run src/lib/engine/stimulus/__tests__/vision.test.ts"
    expected: "qwen3.7-plus accepts a base64 data: URL image and returns a parseable { read: ... } JSON (HTTP 200). If rejected, trigger the documented Storage→signed-URL fallback (signature unchanged)."
    why_human: "External service (DashScope) integration + paid network call requiring explicit human spend approval. Unit tests mock getQwenClient; the live base64 data:-URL acceptance (Assumption A2) is the one behavioral surface not provable by automation. The proven live wave3 pattern uses URL-based images (keyframeUris), not base64 data: URLs, so A2 is not transitively confirmed."
---

# Phase 4: Input Adapter Verification Report

**Phase Goal:** One inbox door accepts text/file/image, normalizes to a `Stimulus`, auto-selects the SIM-1 tier.
**Verified:** 2026-06-27T20:33:55Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

**Scope note (D-01):** This phase deliberately ships the *adapter layer only* — no new composer UI. `04-CONTEXT.md` D-01 states explicitly: "SC#1 'the composer inbox accepts…' is satisfied at the ADAPTER level (the door exists + works end-to-end); the visible surface ships with its consumer" (P5/P7). `REQUIREMENTS.md` corroborates: IN-01/IN-03 inbox UI wiring = P5. The "inbox door" of the phase goal = the `normalizeStimulus` primitive, which is the verification target for SC#1/SC#2. This is a documented, approved scope decision — not a gap.

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Composer inbox accepts text + `.txt`/`.md` file uploads and normalizes each into a `Stimulus` (adapter level, D-01) | ✓ VERIFIED | `normalizeStimulus` (normalize.ts:50) handles `kind:"text"` (→ raw content) and `kind:"file_text"` (→ `readTextFile`); `ingest.ts:65` reads `.txt`/`.md` in-memory with zero parser deps (D-05); `normalize.test.ts` GREEN |
| 2 | Inbox accepts screenshot/image uploads, vision-extracted into the `Stimulus` (adapter level, D-01) | ✓ VERIFIED | `readImageWithVision` (vision.ts:113) → base64 data URL → `QWEN_REASONING_MODEL` → strip→parse→Zod; `normalizeStimulus` image branch (normalize.ts:81) wires it; `vision.test.ts` 5 passed (live A2 smoke skipped — see human item) |
| 3 | SIM-1 tier auto-selects (Flash text / Max video) from input type, never a user choice | ✓ VERIFIED | `resolveSim1Tier` (tier.ts:39) pure `kind === "video" ? "max" : "flash"`; recomputed in EVERY `normalizeStimulus` branch (never read from input); `tier.test.ts` 4 passed |
| 4 | Creator (Socials) video/URL path through the inbox is unchanged (D-02) | ✓ VERIFIED | `socials-untouched.smoke.test.ts` 2 passed; `packs/socials.ts:74` byte-unchanged (`["text","tiktok_url","video_upload"]`); coupling greps in `normalize.ts` (`../normalize`/`AnalysisInputSchema`/`ContentPayload`) === 0; full suite previously 2808 passed (per 04-04 SUMMARY) |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/lib/engine/stimulus/types.ts` | Stimulus/StimulusKind/Sim1Tier/StimulusSchema/StimulusInput | ✓ VERIFIED | All exported (lines 35,42,71,88,106); additive — no Socials schema import |
| `src/lib/engine/domain-pack.ts` | widened StimulusType (+file_text +image) | ✓ VERIFIED | Line 51: `"text" \| "tiktok_url" \| "video_upload" \| "file_text" \| "image"`; input_mode branching not collapsed; socials.ts:74 untouched |
| `src/lib/engine/stimulus/tier.ts` | resolveSim1Tier + SIM1_MODEL_BY_TIER | ✓ VERIFIED | Pure exhaustive rule; mapping centralized. Note: `SIM1_MODEL_BY_TIER` currently unused (IN-01 info, P5 dispatch) |
| `src/lib/engine/stimulus/ingest.ts` | readTextFile + caps (V5/V12) | ✓ VERIFIED | `validateUpload` allowlists ext AND MIME, caps size before read; `file.name` never a path |
| `src/lib/engine/stimulus/vision.ts` | readImageWithVision via qwen3.7-plus | ✓ VERIFIED | `QWEN_OMNI_MODEL` count === 0; user-array isolation; strip→parse→Zod; Sentry on failure |
| `src/lib/engine/stimulus/normalize.ts` | normalizeStimulus adapter entry | ✓ VERIFIED | Exhaustive switch + `never` guard; `StimulusSchema.parse` at boundary; tier recomputed every branch |
| 5 Wave-0 test files | tier/ingest/vision/normalize + socials smoke | ✓ VERIFIED | All present and collected; 5 files / 20 passed / 1 skipped |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| normalize.ts | tier/ingest/vision.ts | orchestrates resolveSim1Tier + readTextFile + readImageWithVision | ✓ WIRED | All three imported and called in the kind switch |
| tier.ts | qwen/client.ts | SIM1_MODEL_BY_TIER ← QWEN_OMNI/REASONING_MODEL | ✓ WIRED | Imported; mapping built. (Mapping not yet consumed — vision imports QWEN_REASONING_MODEL directly; latent until P5) |
| vision.ts | qwen/client.ts | getQwenClient().chat.completions.create({ model: QWEN_REASONING_MODEL }) | ✓ WIRED | Correct model; omni count 0 |
| types.ts | domain-pack.ts | StimulusKind literals mirror widened StimulusType | ✓ WIRED | file_text + image present in both |

### Data-Flow Trace (Level 4)

Adapter is a lib primitive (no rendered UI this phase — D-01). The one external data source is the DashScope vision call in `vision.ts`: in automation it is mocked (`vi.mock` of getQwenClient). The live data path (real model returning a parseable read from a base64 data URL) is gated behind `RUN_VISION_LIVE_SMOKE` and is the human-verification item below. The model+content-array shape is proven live in `wave3/persona-prompts-pass2.ts`/`fold.ts` (QWEN_REASONING_MODEL + image_url array) — but those use URL-based images, not base64 data URLs, so A2 is not transitively confirmed.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full stimulus suite GREEN | `node ./node_modules/vitest/vitest.mjs run src/lib/engine/stimulus` | 5 files passed, 20 passed / 1 skipped | ✓ PASS |
| D-02 Socials-untouched smoke | `node ./node_modules/vitest/vitest.mjs run .../socials-untouched.smoke.test.ts` | 2 passed, exit 0 | ✓ PASS |
| vision never routes to omni | `grep -c QWEN_OMNI_MODEL .../vision.ts` | 0 | ✓ PASS |
| socials pack byte-unchanged | `grep socials.ts:74` | `["text","tiktok_url","video_upload"]` | ✓ PASS |
| live qwen3.7-plus base64 vision read (A2) | gated, requires API key + spend approval | SKIPPED | ? SKIP → human |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| IN-01 | 04-01,02,04 | Inbox accepts text + file, normalizes to Stimulus | ✓ SATISFIED | `normalizeStimulus` text + file_text branches + `readTextFile`; REQUIREMENTS.md:54 marks inbox UI wiring = P5 (deliberate) |
| IN-02 | 04-01,02,04 | SIM-1 tier auto-selects from input type | ✓ SATISFIED | `resolveSim1Tier` pure, never user choice; tier.test.ts GREEN |
| IN-03 | 04-01,03,04 | Inbox accepts screenshot/image, OCR-extracted into Stimulus | ✓ SATISFIED (code) / live integration → human | `readImageWithVision` assembled correctly; mocked unit GREEN; live base64 read gated (see human item); REQUIREMENTS.md:56 inbox UI wiring = P5 |

All three declared requirement IDs (IN-01/IN-02/IN-03) are accounted for and present in REQUIREMENTS.md (lines 54-56, 124-126, all marked Complete). No orphaned IDs.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers in any stimulus source | ℹ️ Info | Clean — no unresolved debt markers |
| normalize.ts | text branch | `text` kind has no length cap (WR-02 from 04-REVIEW) | ⚠️ Warning | DoS gap latent until P5 wires it to a model; file/image paths are capped. Not a phase-goal blocker |
| normalize.ts | 105 | `storagePath` accepted without traversal validation (WR-03 from 04-REVIEW) | ⚠️ Warning | Latent in P4 (not dereferenced here); the value boundary is P5. Documented as caller-must-pass-server-key |
| tier.ts | 27 | `SIM1_MODEL_BY_TIER` exported but unused (IN-01 from 04-REVIEW) | ℹ️ Info | Dead until P5 dispatch; docblock claim slightly ahead of wiring |

These mirror 04-REVIEW.md (0 blockers, 3 warnings) — all latent-until-P5 forward concerns, none block the P4 adapter goal.

### Human Verification Required

#### 1. Live qwen3.7-plus base64 vision read (Assumption A2)

**Test:** `RUN_VISION_LIVE_SMOKE=1 DASHSCOPE_API_KEY=<valid> node ./node_modules/vitest/vitest.mjs run src/lib/engine/stimulus/__tests__/vision.test.ts`
**Expected:** The model accepts a 1×1 base64 `data:image/png;base64,...` URL and returns a parseable `{ read: ... }` JSON (HTTP 200). If the model rejects base64 data URLs, trigger the documented Storage→signed-URL fallback — the `readImageWithVision(file): Promise<string>` signature stays unchanged.
**Why human:** External DashScope integration + paid network call requiring explicit human spend approval (project convention: live/paid probes are human-gated). Unit tests mock the client; the live wave3 image pattern uses URL-based images (keyframeUris), not base64 data URLs, so A2's base64 acceptance is the one behavioral surface not provable by automation.

### Gaps Summary

No gaps. All four ROADMAP success criteria are verified at the adapter level — the deliberate D-01 scope (adapter only, visible inbox UI = P5/P7). The `Stimulus` contract is additive (D-02 holds: Socials path byte-unchanged, coupling greps 0, smoke GREEN), the tier rule auto-resolves and is never a user choice (IN-02/D-03), text/file ingestion is V5/V12-hardened (IN-01), and image vision is correctly assembled to never touch the omni model (IN-03/D-04). The full stimulus suite is GREEN and the engine-wide suite showed no Socials regression.

The single open item is the live DashScope base64 vision read (A2) — gated behind an explicit opt-in flag and human spend approval, with a documented fallback. The phase code is complete and correct; only the external-service round-trip awaits human-approved execution.

---

_Verified: 2026-06-27T20:33:55Z_
_Verifier: Claude (gsd-verifier)_
