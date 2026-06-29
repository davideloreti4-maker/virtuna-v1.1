# Phase 4: Input Adapter - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-27
**Phase:** 4-input-adapter
**Areas discussed:** Profiler concept, Surface scope, File-type breadth, Image OCR / tier-model rule, Stimulus shape

---

## Profiler concept (founder-raised reframe)

| Option | Description | Selected |
|--------|-------------|----------|
| Stimulus-ready, build in P5 | P4 makes the Stimulus profiler-ready (person-video + subject/goal tag); the forensic READ is built in P5 as the Profile verb's richer deliverable, grounded in the Apollo/Chase-Hughes behavioral core. Roadmap note on P5. | ✓ |
| Formally split Profile verb | Edit the roadmap now to split P5 'Profile' into build-an-Audience vs profiler-read. | |
| Pure deferred idea | Note only; don't bias the P4 Stimulus. | |

**User's choice:** Stimulus-ready, build in P5
**Notes:** Founder surfaced a misconception about "profiling": the high-value deliverable is a CIA-profiler-style forensic READ of a specific person, scoped to the user's goal (traits, narcissist tendencies, deception likelihood from body language / facial micro-expressions in a video, etc.) — not just building a reusable persona to simulate against. Resolved as the Profile verb's richer P5 deliverable; P4's only obligation is a profiler-ready Stimulus (person-video + subject/goal tag). Roadmap note added to P5 (D-06).

---

## Surface scope

| Option | Description | Selected |
|--------|-------------|----------|
| Adapter layer, no new composer UI | Build Stimulus normalization + ingestion + tier auto-select as a lib/service; visible inbox lands in P5 with its consumer verb. | ✓ |
| Minimal affordance wired now | Also wire a basic upload/paste affordance into the composer, General-gated. | |
| Full General inbox surface now | Build the visible General two-view inbox in P4. | |

**User's choice:** Adapter layer, no new composer UI
**Notes:** Matches the founder's own phase summary ("P4 = capability, P5 = the drop-a-chat moment") and the locked creator-composer-unchanged constraint. SC#1 satisfied at the adapter level.

---

## File-type breadth

| Option | Description | Selected |
|--------|-------------|----------|
| `.txt` + `.md` | Plain-text only; zero parser deps. Covers the wow + profiler (chat exports = .txt). | ✓ |
| + `.docx` + `.pdf` | Full doc support; adds parser deps + failure modes. | |
| `.txt` only | Leanest; under-delivers vs IN-01 ".txt / doc". | |

**User's choice:** `.txt` + `.md`
**Notes:** `.docx`/`.pdf` deferred until a real use case demands.

---

## Image OCR / tier-model rule

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Qwen omni vision | Feed images to the omni model already watching video. | (corrected) |
| Tesseract.js | Dedicated offline OCR; dumb glyphs, new dep. | |
| Cloud OCR API | New vendor + cost. | |
| **`qwen3.7-plus` vision (founder correction)** | omni is needed ONLY for audio-bearing video; 3.7-plus has all capabilities + input methods incl. vision, just no audio → use it for images and everything non-audio. | ✓ |

**User's choice:** `qwen3.7-plus` vision — corrected my omni recommendation.
**Notes:** Verified in `src/lib/engine/qwen/client.ts`: `QWEN_OMNI_MODEL=qwen3.5-omni-flash` (audio sensor), `QWEN_REASONING_MODEL=qwen3.7-plus` ("deaf (no audio)" but full multimodal incl. vision). Locks the tier rule (D-03): **audio presence** is the discriminator — video-with-audio → omni/Max; text/file/image/silent-video → 3.7-plus/Flash. Image read = 3.7-plus vision (D-04).

---

## Stimulus shape

| Option | Description | Selected |
|--------|-------------|----------|
| Additive, alongside | `Stimulus` is a new General-path type; Socials `AnalysisInput`/`ContentPayload` untouched. Carries content + kind + source + subject/goal tag + resolved tier. | ✓ |
| Generalize Socials through Stimulus | Refactor Socials into a flavor of the unified Stimulus. | |

**User's choice:** Additive, alongside
**Notes:** Lowest risk to the locked creator path; mirrors P1 wrap-don't-refactor; creator I/O is slated for rework next milestone so unifying now is wasted. Converge at P7 if ever.

---

## Claude's Discretion

- Exact `Stimulus` type shape + field names (lock: additive, profiler-ready, carries resolved tier).
- Adapter module layout + how `DomainPack.stimulusTypes` widens (widen descriptor, don't move `input_mode` branching).
- Ingestion mechanics (`.txt`/`.md` read, 3.7-plus image-vision call shape, internal test harness location).
- Untrusted-input hardening at the boundary (file size/type/path, vision/text prompt-injection isolation). User-text→scorer-prompt injection carried to P5.
- Test runner: `node ./node_modules/vitest/vitest.mjs run`.

## Deferred Ideas

- Profiler forensic READ → P5 (Profile verb's richer deliverable).
- Visible General inbox surface → P5 (consumer verb) + P7 (front-door).
- `.docx` / `.pdf` ingestion → until a real use case demands.
- SIM-1 Flash/Max visible badge → P5 (renders with the result card).
- Unifying Socials `AnalysisInput` into `Stimulus` → P7 or later.
- User-authored-text → scorer-prompt injection hardening → P5 (ROADMAP §Phase-5 security carry-forward).
