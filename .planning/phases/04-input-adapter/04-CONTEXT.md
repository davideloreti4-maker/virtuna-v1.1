# Phase 4: Input Adapter - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the **input-adapter layer** (the pipeline's Box 1, VISION §14.1): one door that ingests **text / file (`.txt`/`.md`) / image (screenshot)** alongside today's **video/URL**, normalizes every input into a new `Stimulus` object, and **auto-selects the SIM-1 tier** (Flash/Max) from the input. Requirements: **IN-01, IN-02, IN-03**.

This phase ships the **adapter + the `Stimulus` type + the tier rule + the ingestion mechanics** as a clean lib/service. It does **NOT** ship a new visible inbox surface — the "drop a chat/screenshot" UI lands in **P5** (with the Simulate verb that consumes the `Stimulus`) and **P7** (front-door picker). P4 depends only on **P1**; its consumer is **P5**.

**Carry-forward (locked, not re-asked):**
- **Creator (Socials) video/URL path byte-identical** (SC#4 + VISION §15.2 + P1 D-08). Satisfied by construction here: the `Stimulus` is **additive** (D-02) — the Socials `AnalysisInput`/`ContentPayload` path is untouched. Creator-unchanged check is a **light structural smoke**, not a byte-golden rig (P1 D-02/D-03 — creator I/O is throwaway-soon).
- **SIM-1 tier is auto, never a user choice** — a visible badge only (IN-02 + VISION §13 + REQUIREMENTS Out-of-Scope "SIM-1 as a user-selectable model").
- **`Stimulus` = the adapter's normalized output** (VISION §14.1 naming).
- **Cut the contract precisely once** (P1 D-05) — design `Stimulus` so P5's Profile/Simulate/profiler verbs consume it with **no re-cut**.

</domain>

<decisions>
## Implementation Decisions

### Surface scope (the phase-boundary lock)
- **D-01: Adapter layer only — no new composer UI in P4.** Build `Stimulus` normalization + file/image→text ingestion + tier auto-select as a clean, test-covered lib/service with a thin internal harness. The visible "drop a chat / screenshot" inbox lands in **P5** (where the Simulate verb actually consumes the `Stimulus`) and **P7** (front-door promotion). Matches the founder's own phase summary ("P4 = capability, P5 = the drop-a-chat moment") + the sequencing (P4 depends on P1; P5 depends on P3+P4). **SC#1 "the composer inbox accepts…" is satisfied at the ADAPTER level** (the door exists + works end-to-end); the visible surface ships with its consumer. Rejected: minimal-affordance-wired-now (a dead-end until P5's verb exists to run the Stimulus); full-General-inbox-now (pulls P5/P7 forward, breaks sequencing, risks the locked creator composer).

### `Stimulus` shape vs the Socials path
- **D-02: Additive, alongside — Socials path UNTOUCHED.** `Stimulus` is a **NEW** normalized General-path type carrying: normalized **content** (text) + **modality/kind** + **source** + a **subject/goal tag** (profiler-ready, D-06) + the **resolved SIM-1 tier** (D-03). The Socials `AnalysisInput`/`ContentPayload` path is left **as-is**. Mirrors P1's wrap-don't-refactor; the creator I/O is explicitly slated for rework next milestone (P1 D-02), so unifying now is wasted effort. The two converge later (**P7**) if ever. Rejected: generalize-Socials-through-`Stimulus` (touches the locked creator path now = regression risk; front-loads a unification the roadmap defers to P7).

### Tier + model auto-select (IN-02 / IN-03) — the discriminator is AUDIO
- **D-03: Audio presence (not "text vs video") picks the tier.** Grounded verbatim in `src/lib/engine/qwen/client.ts` (the two-model stack):
  - **SIM-1 Max = `qwen3.5-omni-flash`** (the omni audio-visual **sensor**) ⟺ **video with audio** (omni's unique value = audio).
  - **SIM-1 Flash = `qwen3.7-plus`** (full multimodal incl. **vision**, but **deaf** — client.ts L51 "3.7-plus is deaf (no audio)") ⟺ **everything else**: text, `.txt`/`.md`, **image/screenshot** (3.7-plus vision), and silent/visual-only video.
  - **Never a user choice.** P4 **computes + carries** the resolved tier on the `Stimulus`; the **visible SIM-1 badge renders in P5** (no new P4 UI, per D-01).

### Image read (IN-03)
- **D-04: Screenshots → `qwen3.7-plus` vision.** Reuse the reasoning model's multimodal image input — semantic (understands a chat-bubble screenshot, not raw glyphs), **no new dependency**, and it fits the profiler "read this person from a screenshot" need. Rejected: Tesseract.js (dumb glyph OCR, new dep, weak on chat-bubble layouts); cloud OCR API (new vendor + cost + key). **(Founder correction: omni is reserved for audio-bearing video — do NOT route images through omni.)**

### File-type breadth (IN-01)
- **D-05: `.txt` + `.md` only this phase.** Plain-text read, **zero parser dependencies**, minimal failure modes. Covers the P5 wow AND the profiler use case (chat exports = `.txt`; WhatsApp/iMessage export as `.txt`). Defer `.docx`/`.pdf` (parser deps `mammoth`/`pdf-parse` + scanned-PDF/layout failure modes) until a real use case demands. Rejected: +`.docx`/`.pdf` now (deps/risk not needed for the wow); `.txt`-only (under-delivers vs IN-01's ".txt / doc").

### Profiler reframe — Stimulus-ready in P4, BUILT in P5
- **D-06: The "CIA-profiler" forensic READ is the Profile verb's richer deliverable — built in P5, not P4.** The founder reframed Profile: the high-value deliverable is not just "build a reusable persona," it's an **expert behavioral/forensic read of a specific person, scoped to the user's goal** — e.g. *"narcissistic tendencies because…"* / *"at 0:42 the micro-expression + shoulder shift → high deception likelihood."* — from a chat OR **a video of someone**. This is the existing **Apollo / Chase-Hughes behavioral knowledge core** generalized from "why content works" → "who this person is / what they're doing" (same engine spine §14.1; new reaction-frame + grounding). **It is built in P5**, grounded in `.planning/corpus/KNOWLEDGE-CORE.md` (+ the parked `feat/chat-ethics-gate` behavioral work as a starting asset). **P4's only obligation:** make the `Stimulus` **profiler-ready** — (a) accept **person-video as a profiled SUBJECT** (reuses existing omni video ingestion; tier = Max), and (b) carry the **subject + goal tag** so P5 consumes it without re-cutting the adapter. **No scope balloon** — person-video ingestion already exists; only the tag is new. **Add a roadmap note to P5.**

### Claude's Discretion
- Exact `Stimulus` type shape + field names (content / modality-kind / source / subject-goal tag / tier) — researcher/planner. The lock is: **additive, profiler-ready (person-video + subject/goal), carries the resolved tier.**
- Where the adapter lives (module layout — e.g. `src/lib/engine/` or a new `src/lib/stimulus/`) and how it widens `DomainPack.stimulusTypes` (currently `["text","tiktok_url","video_upload"]`) — **widen the descriptor; do NOT move the pipeline's `input_mode` branching** (domain-pack.ts L45–51 anti-pattern: "collapsing input_mode into the pack key").
- Ingestion mechanics: `.txt`/`.md` read, the `qwen3.7-plus` image-vision call shape, where the thin internal test harness lives.
- **Untrusted-input hardening at the boundary** (file size/type validation, path-traversal sanitization on uploads, vision/text prompt-injection isolation) — planner must handle (project rule: validate at boundaries). NOTE: the *user-authored-text → scorer-prompt* injection (P3 review finding "IN-02", **distinct** from requirement IN-02) is carried to **P5** per ROADMAP §Phase-5 security carry-forward — the first place user text hits a model prompt is `simulate()`.
- Test runner: `node ./node_modules/vitest/vitest.mjs run` (`npm test`/`npx vitest` print fake PASS(0)/FAIL(0)).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone vision & requirements
- `.planning/NUMEN-GSI-VISION.md` — §14.1 (the six-box pipeline; **Box 1 = the input adapter this phase builds**), §13 (SIM-1 = Flash/Max auto, never a user choice), §15.3 (two views, one composer — the **General view is P7**, not P4), §16.2 (run resolution: step 4 input→`Stimulus`→tier), §14.2/§14.3 (Profile verb + build list — the **profiler-read deliverable lands P5**). EXPLORATORY — walk the section; a brief wins where it conflicts.
- `.planning/ROADMAP.md` §"Phase 4: Input Adapter" — goal + 4 success criteria. NOTE: **SC#1 "composer inbox accepts…" is satisfied at the ADAPTER level per D-01** (visible surface = P5).
- `.planning/REQUIREMENTS.md` **IN-01, IN-02, IN-03** — the requirements this phase covers.

### Prior-phase context (carry-forward)
- `.planning/phases/01-engine-pack-seam/01-CONTEXT.md` — D-05 (cut the contract precisely once), D-02/D-03 (creator I/O is throwaway-soon → light smoke not byte-golden; don't gold-plate Socials I/O), D-08 (pure additive, reviewable diff). The wrap-don't-refactor posture D-02 inherits.
- `.planning/phases/03-general-population-honesty-layer/03-CONTEXT.md` — the General audience the `Stimulus` eventually runs against; `success_criterion` + `custom_context` already on the audience (the goal the profiler-read scopes to).

### Engine input path (the seam this phase widens — D-02 leaves Socials side UNTOUCHED)
- `src/lib/engine/types.ts` — `AnalysisInputSchema` (`input_mode` text|tiktok_url|video_upload + conditional required fields, L154–199) + `ContentPayload` (L205). The Socials input contract; `Stimulus` sits **alongside** it.
- `src/lib/engine/normalize.ts` — `normalizeInput(AnalysisInput) → ContentPayload`. The Socials normalizer; the new `Stimulus` normalizer is its additive General sibling.
- `src/lib/engine/pipeline.ts` — `runPredictionPipeline`; text/tiktok_url → `QWEN_REASONING_MODEL` (L612–616), video_upload → omni (L415/452/556). Where tier is **implicitly** selected today; D-03 surfaces it as a named SIM-1 tier on the `Stimulus`.
- `src/lib/engine/domain-pack.ts` — `StimulusType` (`"text"|"tiktok_url"|"video_upload"`, L51) + `DomainPack.stimulusTypes` descriptor (L136). **Widen the descriptor; do NOT move the pipeline `input_mode` branching** (L45–51).
- `src/lib/engine/packs/socials.ts` L74 — `stimulusTypes: ["text","tiktok_url","video_upload"]`.

### Model routing (IN-02 / IN-03 — the tier rule)
- `src/lib/engine/qwen/client.ts` — **the canonical statement.** `QWEN_OMNI_MODEL=qwen3.5-omni-flash` (audio sensor → Max), `QWEN_REASONING_MODEL=qwen3.7-plus` (deaf, vision-capable, everything else → Flash). L42–52 = the two-model-stack doc.
- `docs/MODEL-POLICY.md` — the two-model-stack policy (omni sensor + 3.7-plus everything). Confirm before wiring tier→model.

### Profiler grounding (P5 build — REFERENCED, not built in P4)
- `.planning/corpus/KNOWLEDGE-CORE.md` — the Apollo behavioral/scoring knowledge core; the profiler-read's grounding, generalized from content → person.
- branch `feat/chat-ethics-gate` (PARKED, unmerged) — behavioral engine + chat ethics gate; a starting asset for the P5 profiler-read (A/B inconclusive + cost flag — re-evaluate at P5). **Do NOT merge in P4.**

### Composer (the surface P4 does NOT touch — D-01)
- `src/components/app/home/composer.tsx` — the deliberately-slim creator composer (TikTok-only client check, video upload). P4 adds **NO** new UI here; the General inbox surface is P5/P7.

### Test runner
- Use `node ./node_modules/vitest/vitest.mjs run` — `npm test`/`npx vitest` emit fake PASS(0)/FAIL(0).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `normalizeInput` (normalize.ts) — the Socials normalizer; the `Stimulus` normalizer is its **additive** General sibling (same idea, new type, Socials path untouched).
- **Omni video ingestion** (pipeline.ts `video_upload` branch) — already watches video; **person-video for the profiler path REUSES it** (tier = Max). No new video infra in P4.
- **`qwen3.7-plus`** (`QWEN_REASONING_MODEL`) — already the text/reasoning model; its **vision** capability is the IN-03 image reader (no new dep) and the **Flash** tier engine.
- `DomainPack.stimulusTypes` — the descriptor to widen for the new input kinds (declarative; does NOT move pipeline branching).

### Established Patterns
- **`input_mode` = stimulus axis, orthogonal to the pack/domain key** (P1 D-08, domain-pack.ts L45–51). The `Stimulus` normalization rides the `input_mode` axis; widen it, don't collapse it into the pack key.
- **Additive, wrap-don't-refactor** (P1 D-01/D-06) — `Stimulus` is additive; the Socials path is untouched (D-02).
- **Two-model stack** (qwen/client.ts) — omni only for audio; 3.7-plus for everything else. The tier rule (D-03) is this stack surfaced.
- **Light smoke, not byte-golden** (P1 D-02/D-03) — the creator-unchanged check (SC#4) is a structural smoke, not an exact-byte rig.
- Test-runner quirk: `node ./node_modules/vitest/vitest.mjs run`.

### Integration Points
- New `Stimulus` normalizer ← text / `.txt` / `.md` (read), image (3.7-plus vision), video (existing omni ingestion) → `Stimulus` `{ content, kind, source, subject/goal tag, tier }`.
- `Stimulus` → consumed by P5's `simulate(audience, stimulus)` + the Profile/profiler verbs (**NOT wired in P4** — additive type only).
- Tier field on `Stimulus` ← **audio-presence** discriminator → omni (Max) | 3.7-plus (Flash).
- Untrusted boundary: file upload (size/type/path) + image/text → model prompt (injection isolation) — planner hardens.

</code_context>

<specifics>
## Specific Ideas

- **Founder reframed Profile.** The high-value deliverable is the **forensic profiler READ** (CIA-profiler: *"narcissistic tendencies because…"*, *"at 0:42 the micro-expression + shoulder shift → high deception likelihood"*), goal-scoped, from a chat OR **a video of someone** — not just "build a reusable persona." Built in **P5**; P4 makes the `Stimulus` carry it (person-video + subject/goal tag).
- **Founder engine fact (locked):** **omni is only for audio-bearing video**; `qwen3.7-plus` does everything else incl. vision — it's **"deaf, not blind."** The tier discriminator is **audio**, not video.
- Founder wants **decisive, grounded recommendations** — every gray area resolved by accepting the recommended option (matches P3).
- **Keep P4 small:** it's the door + the normalizer + the tier rule. The visible inbox + the verbs that consume the `Stimulus` are P5.

</specifics>

<deferred>
## Deferred Ideas

- **Profiler forensic READ** (behavioral / deception / personality analysis, goal-scoped, from chat OR person-video) → **Phase 5** as the Profile verb's richer deliverable, grounded in the Apollo/Chase-Hughes core. P4 only makes the `Stimulus` profiler-ready. **→ add roadmap note to P5.**
- **Visible General inbox surface** ("drop a chat / screenshot" two-view composer) → **P5** (with the consuming verb) + **P7** (front-door picker promotion). P4 ships no new composer UI.
- **`.docx` / `.pdf` ingestion** → deferred until a real use case demands (parser deps). P4 = `.txt` + `.md`.
- **SIM-1 Flash/Max visible badge** → renders in **P5** with the result card (P4 computes + carries the tier; no new P4 UI).
- **Unifying Socials `AnalysisInput` into `Stimulus`** → **P7** (or later) if ever; P4 keeps them additive/alongside.
- **User-authored-text → scorer-prompt injection hardening** (P3 review finding "IN-02", distinct from requirement IN-02) → **P5** per ROADMAP §Phase-5 security carry-forward (first place user text hits a model prompt is `simulate()`).

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 4-input-adapter*
*Context gathered: 2026-06-27*
