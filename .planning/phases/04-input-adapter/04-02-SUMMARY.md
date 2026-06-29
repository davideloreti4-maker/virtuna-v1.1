---
phase: 04-input-adapter
plan: 02
subsystem: engine/stimulus
tags: [tdd, leaf-modules, tier, ingest, D-03, D-05, V5, V12, IN-01, IN-02]
requires:
  - "src/lib/engine/stimulus/types.ts (Stimulus contract from 04-01)"
  - "src/lib/engine/qwen/client.ts (QWEN_OMNI_MODEL / QWEN_REASONING_MODEL constants)"
provides:
  - "resolveSim1Tier(kind) + SIM1_MODEL_BY_TIER (stimulus/tier.ts)"
  - "readTextFile(file) + validateUpload(file) + MAX_TEXT_BYTES / TEXT_EXT / ALLOWED_TEXT (stimulus/ingest.ts)"
affects:
  - "Wave 2 normalize.ts consumes resolveSim1Tier + readTextFile"
  - "P5 engine badge reads the resolved tier; P5 inbox feeds readTextFile"
tech-stack:
  added: []
  patterns:
    - "Pure rule as a single exhaustive function (tier discriminator)"
    - "Validate-then-read at the untrusted-bytes boundary (allowlist ext AND MIME, size cap before decode)"
    - "Tier→model mapping centralized once (no inlined model ids downstream)"
key-files:
  created:
    - "src/lib/engine/stimulus/tier.ts"
    - "src/lib/engine/stimulus/ingest.ts"
  modified: []
decisions:
  - "Tier→model mapping (SIM1_MODEL_BY_TIER) lives ONLY in tier.ts; vision/normalize import it rather than inline model ids (Pitfall 1: never route non-video to QWEN_OMNI_MODEL)."
  - "Validation factored into a standalone exported validateUpload(file) (consumed by readTextFile) — the ingest.test.ts contract calls it directly to assert boundary rejection without a read."
  - "Caps/allowlists kept local to ingest.ts (no cross-module sharing) so Plan 03 vision stays independent for parallel execution."
  - "Empty MIME ('') tolerated in ALLOWED_TEXT because browsers often omit a MIME for .md; the extension allowlist still gates it (V12: ext AND MIME)."
metrics:
  duration: "~3 min"
  completed: "2026-06-27"
  tasks: 2
  files: 2
---

# Phase 4 Plan 02: SIM-1 Tier Rule + Text-File Ingest Summary

The two model-I/O-free leaf modules of the General input adapter: the pure SIM-1 tier discriminator (IN-02 / D-03) and the `.txt`/`.md` validate-then-read boundary (IN-01 / V5 / V12). Both Wave-0 RED stubs from 04-01 turned GREEN.

## What Was Built

**Task 1 — `tier.ts` (`c81e8bbe`):**
- `resolveSim1Tier(kind: StimulusKind): Sim1Tier` — `kind === "video" ? "max" : "flash"`. Video carries audio → Max (omni sensor); text/file_text/image → Flash (qwen3.7-plus, vision-capable). Exhaustive, pure, never reads user state.
- `SIM1_MODEL_BY_TIER: Record<Sim1Tier, string>` — `{ max: QWEN_OMNI_MODEL, flash: QWEN_REASONING_MODEL }`, imported from `../qwen/client`. The tier→model mapping is encoded ONCE here so no model id is inlined in vision/normalize.
- Header comment documents the audio-presence discriminator and the omni-**flash** (model) ≠ SIM-1-**Flash** (tier) naming collision (Pitfall 1).

**Task 2 — `ingest.ts` (`a9ab6700`):**
- `validateUpload(file: File): void` — rejects, in order, before any read: extension not in `TEXT_EXT` (`.txt`/`.md`), a truthy `file.type` not in `ALLOWED_TEXT` (V12: allowlist ext AND MIME), and `file.size > MAX_TEXT_BYTES` (1 MB, V5 DoS).
- `readTextFile(file: File): Promise<string>` — `validateUpload(file)` then `(await file.text()).trim()`. Zero parser deps (D-05), read fully in-memory.
- Named caps exported: `MAX_TEXT_BYTES`, `TEXT_EXT`, `ALLOWED_TEXT` — local to this leaf module (no cross-module sharing, keeps Plan 03 independent).
- `file.name` used ONLY for extension extraction (`lastIndexOf(".")`/`slice`), never as a path (Pitfall 3 / T-04-02-01). No storage path on this surface.

## Verification

- `node ./node_modules/vitest/vitest.mjs run …/tier.test.ts` → **4 passed, exit 0** (GREEN).
- `node ./node_modules/vitest/vitest.mjs run …/ingest.test.ts` → **5 passed, exit 0** (GREEN; incl. bad-ext / bad-MIME / oversize rejection cases).
- `grep -c QWEN_OMNI_MODEL src/lib/engine/stimulus/tier.ts` → **4** (≥1; mapping centralized, not inlined).
- `grep -c 'storage\.upload(' …/ingest.ts` → **0**; the only `path`-near-`file.name` grep hit is the comment "never used as a path" — no filename-as-path code.
- `npx tsc --noEmit` → **no errors** on `tier.ts` / `ingest.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exported a standalone `validateUpload(file)` from `ingest.ts`**
- **Found during:** Task 2 (running ingest.test.ts).
- **Issue:** The plan `<action>` describes the rejection checks living inside `readTextFile`, but the RED stub (`ingest.test.ts`, authored in 04-01) imports and calls `validateUpload(file)` directly to assert boundary rejection (bad-ext / wrong-MIME / oversize) without performing a read. Without exporting it the test could not compile.
- **Fix:** Factored the checks into an exported `validateUpload(file): void`; `readTextFile` calls it first, then reads. Same check order and caps the plan specified — no behavior change, just the entry point the test contract requires.
- **Files modified:** `src/lib/engine/stimulus/ingest.ts`
- **Commit:** `a9ab6700`

## Threat Surface

The `upload → lib` trust boundary (T-04-02-01/02/03) is now mitigated as planned: `file.name` is never a path (in-memory read, no storage); oversize rejected before `file.text()` (1 MB cap); disguised files rejected via ext AND MIME allowlist. Zero new packages (D-05) — no install surface (T-04-02-SC accept). No new surface beyond the registered threat model.

## Self-Check: PASSED

- `src/lib/engine/stimulus/tier.ts` — FOUND
- `src/lib/engine/stimulus/ingest.ts` — FOUND
- Commit `c81e8bbe` (Task 1) — FOUND
- Commit `a9ab6700` (Task 2) — FOUND
