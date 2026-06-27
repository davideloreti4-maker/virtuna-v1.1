---
phase: 04-input-adapter
reviewed: 2026-06-27T20:30:03Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/lib/engine/stimulus/types.ts
  - src/lib/engine/stimulus/tier.ts
  - src/lib/engine/stimulus/ingest.ts
  - src/lib/engine/stimulus/vision.ts
  - src/lib/engine/stimulus/normalize.ts
  - src/lib/engine/domain-pack.ts
  - src/lib/engine/stimulus/__tests__/tier.test.ts
  - src/lib/engine/stimulus/__tests__/ingest.test.ts
  - src/lib/engine/stimulus/__tests__/vision.test.ts
  - src/lib/engine/stimulus/__tests__/normalize.test.ts
  - src/lib/engine/stimulus/__tests__/socials-untouched.smoke.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-06-27T20:30:03Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the new additive `src/lib/engine/stimulus/` input adapter plus the `DomainPack` contract type. The security surfaces the phase calls out are sound: `ingest.validateUpload` correctly allowlists extension AND MIME and caps size before any read; `vision.readImageWithVision` validates MIME/size before base64-encoding, isolates untrusted image bytes in the user content array (not the system prompt), uses the reasoning model (never omni), and wraps the model call in try/catch with strip→parse→Zod. The D-02 additive guarantee holds — no Socials schema is imported or mutated, and `source.filename` is consistently kept display-only.

No BLOCKER-level defects found. Three WARNING-level issues: (1) the `DomainPack` contract hardcodes `"socials"` literal types, defeating the file's own stated reuse goal; (2) the `text` stimulus kind has no length/size cap, an inconsistency with the carefully-capped file/image paths; (3) `storagePath` is accepted with zero validation despite being documented as "the only safe path." Three INFO items round out the report.

## Warnings

### WR-01: `DomainPack` contract hardcodes `"socials"` literals — defeats its own multi-pack reuse goal

**File:** `src/lib/engine/domain-pack.ts:131`, `:74`, `:107`
**Issue:** The file's docblock states its single purpose explicitly: define the contract NOW "so that P3 (General) / P6 (Predict) packs mount the SAME contract without a mid-milestone re-cut (D-05: the contract is the expensive, hard-to-re-cut part — get it precise once)." But the contract is pinned to socials by literal types:
- `DomainPack.id: "socials"` (line 131)
- `PopulationsSpec.kind: "socials"` (line 74)
- `CalibrationSpec.kind: "socials"` (line 107)

A future `GENERAL_PACK` with `id: "general"` cannot satisfy `DomainPack` — it would fail `satisfies DomainPack`. This is confirmed downstream: `resolvePack(mode: DomainPack["id"])` in `packs/index.ts:24` narrows `mode` to the single literal `"socials"`, making its `default:` branch (commented "future packs register here") statically unreachable dead code. The contract as written guarantees the exact mid-milestone re-cut D-05 set out to avoid.
**Fix:** Widen the domain axis to a union (or generic) so additional packs mount the same shape:
```ts
export type PackId = "socials" | "general" | "predict";
export interface DomainPack {
  id: PackId;
  populations: PopulationsSpec; // PopulationsSpec.kind: PackId
  calibration: CalibrationSpec; // CalibrationSpec.kind: PackId
  // ...
}
```
If only Socials is implementable this phase, keep `SOCIALS_PACK.id` as the narrow literal at the value site (`satisfies DomainPack`) while the interface stays wide — that preserves the "precise once" intent.

### WR-02: `text` stimulus kind has no size/length cap — DoS gap inconsistent with file/image paths (V5)

**File:** `src/lib/engine/stimulus/normalize.ts:56-63`
**Issue:** `ingest.ts` caps text files at `MAX_TEXT_BYTES` (1 MB) and `vision.ts` caps images at `MAX_IMG_BYTES` (10 MB), both explicitly citing V5/DoS. But the `text` kind passes `input.text` straight into `Stimulus.content` with no length check, and the boundary `StimulusSchema.parse` validates only `content: z.string()` (no `.max()`). A caller can submit an arbitrarily large in-memory string via `{ kind: "text" }` and bypass the very cap the sibling paths enforce — and it is forwarded unbounded to P5 (where it does reach the model). This is the same V5 protection the rest of the module advertises, missing on the one path with no upstream file-size gate.
**Fix:** Add a content cap on the text path (and/or in the schema), mirroring the file cap:
```ts
const MAX_TEXT_CONTENT = 1 * 1024 * 1024;
case "text": {
  if (input.text.length > MAX_TEXT_CONTENT) {
    throw new Error(`Text too large (${input.text.length} chars). Max ${MAX_TEXT_CONTENT}.`);
  }
  // ...
}
```
or `content: z.string().max(MAX_TEXT_CONTENT)` in `StimulusSchema`.

### WR-03: `storagePath` accepted with zero validation despite being documented as "the only safe path"

**File:** `src/lib/engine/stimulus/normalize.ts:105`; `src/lib/engine/stimulus/types.ts:46-48`
**Issue:** Throughout the module, `storagePath` is documented as "the ONLY safe path interpolation" (types.ts:47, normalize.ts:104) in contrast to the display-only `filename`. But `normalizeStimulus` assigns `storagePath: input.storagePath` verbatim and `StimulusSchema` validates it only as `z.string().optional()` — no sanitization, no prefix/format check, no rejection of `..` or absolute paths. The "safe" designation is asserted, not enforced. Since the value is consumed as an actual storage path in P5, an attacker-influenced `storagePath` reaching this boundary is forwarded as trusted. The repo CLAUDE.md mandates "Always sanitize file paths to prevent directory traversal" — this boundary does not. The exploit is latent in P4 (not dereferenced here) but the trust boundary is this function.
**Fix:** Validate the storage key shape at this boundary before trusting it:
```ts
const STORAGE_KEY = /^[\w-]+\/[\w.-]+$/; // expected video_upload key shape
if (!STORAGE_KEY.test(input.storagePath)) {
  throw new Error("Invalid storagePath.");
}
```
or document explicitly that callers MUST pass only a server-generated key and add `.regex(...)` to the schema field.

## Info

### IN-01: `SIM1_MODEL_BY_TIER` is exported but unused; vision.ts contradicts the tier.ts docblock

**File:** `src/lib/engine/stimulus/tier.ts:27`; `src/lib/engine/stimulus/vision.ts:126`
**Issue:** `tier.ts` claims the tier→model mapping is "encoded ONCE here (`SIM1_MODEL_BY_TIER`) so no model id is ever inlined in vision.ts / normalize.ts." A grep confirms `SIM1_MODEL_BY_TIER` has zero consumers outside its own definition/docstring. `vision.ts:126` selects the model by importing `QWEN_REASONING_MODEL` directly, not via `SIM1_MODEL_BY_TIER`. The export is dead in this phase and the docblock's claim about its role is currently inaccurate.
**Fix:** Either route vision/P5 model selection through `SIM1_MODEL_BY_TIER` (matching the stated intent), or soften the docblock to note it is the mapping for P5's badge/dispatch and not yet wired here.

### IN-02: redundant `""` entry in `ALLOWED_TEXT` is unreachable

**File:** `src/lib/engine/stimulus/ingest.ts:29`, `:47`
**Issue:** `ALLOWED_TEXT` includes `""` to tolerate empty MIME for `.md`, but the guard at line 47 is `if (file.type && !ALLOWED_TEXT.has(file.type))` — the `file.type &&` short-circuit already skips the check entirely when `file.type` is `""`. The `""` set member is never consulted. Harmless, but misleading (it implies the empty MIME is allowlisted when it is actually unconditionally skipped).
**Fix:** Drop `""` from `ALLOWED_TEXT` and keep the short-circuit, or drop the short-circuit and rely on the set membership — pick one mechanism.

### IN-03: empty/whitespace content silently accepted across all kinds

**File:** `src/lib/engine/stimulus/normalize.ts:127`; `src/lib/engine/stimulus/types.ts:108`
**Issue:** `StimulusSchema.content` is `z.string()` with no `.min(1)`. A whitespace-only `.txt` (`readTextFile` trims to `""`), an empty text input, or a vision read of `{ read: "" }` all produce a valid `Stimulus` with `content: ""`. (Empty `content` is intentional for `video`, but not for the other three kinds.) Downstream P5 receives a content-less stimulus with no signal that input was effectively empty.
**Fix:** Consider a non-empty guard for the non-video kinds, e.g. throw when the read/text trims to empty, or validate `content.length > 0` for `kind !== "video"`.

---

_Reviewed: 2026-06-27T20:30:03Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
