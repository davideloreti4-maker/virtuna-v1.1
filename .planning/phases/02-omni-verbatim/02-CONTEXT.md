# Phase 2: Omni Verbatim - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Repurpose Omni from **eyes-and-judge** into **observer/transcriber** by making it emit the actual words. Add `hook_verbatim` (spoken_words + on_screen_text for the first ~3s) and per-segment `spoken_text` + `on_screen_text` (verbatim transcription, never paraphrase). Thread the new fields through `aggregator.ts` → `PredictionResult` so they persist. Delivers **R1** and is the **zero-regret precondition** for P3 (Apollo rewrites quote the real line) and P4 (Audience-Sim knows what viewers heard where).

**Honesty principle (carried from P1):** verbatim = the real words or honest absence. Never fabricate, paraphrase, or invent a line. This is the literal sensor for everything downstream — its job is fidelity, not opinion.

**In scope:**
- Extend `qwen/schemas.ts` `OmniAnalysisZodSchema`: add top-level `hook_verbatim { spoken_words, on_screen_text }` + add `spoken_text`/`on_screen_text` to the per-segment schema. All new fields `.optional()` (backward-compat, emotion_arc precedent).
- Extend `qwen/omni-analysis.ts` `buildSystemPrompt`: instruct verbatim emission + the fidelity rules (D-04) + the empty/absence contract (D-02).
- Thread verbatim through `omni-analysis.ts` assembly → `aggregator.ts` pluck → `PredictionResult` (mirror the emotion_arc pattern: rides the `as` cast, plucked in aggregator, null-degrades).
- Persist verbatim (planner picks column vs blob — see Discretion).
- Bump the engine cache key (Omni output changes → stale cached results would otherwise serve).

**Out of scope (deferred / untouched):**
- **Dropping the ~15 0–10 judgment fields** — DEFERRED to **P3** (D-01). P2 is **additive-only**.
- **Apollo reasoner / rewrites consuming verbatim** — P3 (R2).
- **Audience-Sim consuming per-segment transcript** — P4 (R3).
- **Score rederivation** — unchanged this phase; stays on `behavioral + gemini` (P1 decision).
- **Translation of foreign-language verbatim** — out (keep original language; D-04).
- **Remix `decode`/`adapt`** — not edited; verbatim helps decode too but that wiring is P3 (R12). Verify only that the Omni change doesn't regress the remix path.

</domain>

<decisions>
## Implementation Decisions

### D-01 — Additive-only; defer the judgment-field drop to P3
- **D-01.1:** P2 **ADDS** verbatim and **KEEPS** all existing 0–10 judgment fields (`factors`, `hook_decomposition`, `video_signals`, `cta_segment`, `audio_signals`, etc.). The score keeps deriving exactly as it does today (`behavioral + gemini` blend off these fields). This makes P2 a **true zero-regret precondition** and independently shippable to `main` (no downstream dependency, no live-product regression).
- **D-01.2:** The ROADMAP/ENGINE-MAP "drop the ~15 0–10 judgments" cut happens in **P3**, when Apollo owns scoring and the fields become genuinely redundant. Dropping them in P2 would orphan the gemini half of the live blend before its replacement exists — rejected.
- **D-01.3:** Consequence for the planner: do NOT remove or repoint any score-blend inputs in P2. Edits are purely additive to the Omni schema + prompt + the threading path.

### D-02 — Empty/absence contract: honest `null`, never fabricate
- **D-02.1:** When content genuinely has no speech or no on-screen text (silent, slideshow, music-only), the corresponding verbatim field is **`null` / absent** — never a paraphrase, never a description (NOT `"[upbeat music plays]"`). Absence is honest; invention is not (P1 honesty-by-deletion, applied to the sensor).
- **D-02.2:** R1's "non-empty verbatim" verify applies to videos that **do** contain speech/text. A legitimately-silent video yielding `null` is a **pass**, not a regression. The verification harness must assert: speech-bearing video → non-empty; silent video → `null` (and specifically **not** the `[inaudible]` marker — see D-04.2).
- **D-02.3:** Fields are `.optional()` on the Zod schema so existing/silent responses validate (mirrors `emotion_arc` backward-compat, schema A3).

### D-03 — Shape & granularity: dedicated hook field + per-segment text
- **D-03.1:** Add a **top-level `hook_verbatim { spoken_words, on_screen_text }`** covering the first ~3s — gives R2's rewrites a clean `original` target to match against.
- **D-03.2:** Add **`spoken_text` + `on_screen_text` to each segment** in the segment schema — gives R3 Audience-Sim what viewers heard at each point (per-segment, not just the hook).
- **D-03.3:** `on_screen_text` captures **all overlay text** verbatim per segment (not just hook-zone). The hook zone additionally gets its dedicated `hook_verbatim` field.
- **D-03.4:** The hook-zone segment's text and `hook_verbatim` may overlap by design — `hook_verbatim` is the canonical hook target; segment text is the timeline. Planner decides whether to derive one from the other or emit both (prompt likely emits both; cheap).

### D-04 — Transcription fidelity rules (lock as prompt constraints — all four)
- **D-04.1 Original language:** transcribe in the spoken language; **do NOT translate**. Apollo/rewrites operate on the real words. Translation, if ever wanted, is a separate downstream concern.
- **D-04.2 Mark uncertain audio:** present-but-unclear speech → inline **`[inaudible]`** marker rather than guessing words. **Distinct from D-02's `null`:** `null` = nothing to hear; `[inaudible]` = speech exists but is unintelligible. These two states must not collide, and a planner must ensure `[inaudible]` cannot leak as a quotable `original` into Apollo rewrites (P3 concern, flag it now).
- **D-04.3 Preserve casing & punctuation:** transcribe as-spoken / as-shown — keep ALL-CAPS overlays, punctuation, emoji in `on_screen_text`. Hook energy lives in `"WAIT."` vs `"wait"`; fidelity is the point.
- **D-04.4 Cap field length:** `z.string().max(N)` ceilings — **hook fields ~280**, per-segment `spoken_text`/`on_screen_text` **~500** each. Matches existing schema idiom (`audio_description` max 280, `rationale` 300–400). Bounds long-video output tokens (latency budget) without truncating real transcripts. Cap is a safety ceiling, not an expected length.

### Claude's Discretion (planner decides)
- **Persistence target:** dedicated DB column(s) for verbatim vs riding inside the existing analysis JSON blob. `emotion_arc` has its own `Json` column (`analyze/route.ts:594`) — verbatim may follow that or live in the blob. R1's "persists non-empty verbatim fields" must be queryable enough to verify either way; if a migration is added, keep it minimal.
- **Exact cap values** (280/500 are recommendations) and whether `hook_verbatim` is emitted independently vs derived from the hook-zone segment (D-03.4).
- **Whether to add a short transcription example** to the prompt to anchor the model (likely helpful for fidelity, non-blocking).
- **Threading mechanics** — follow the emotion_arc precedent exactly (the `as GeminiVideoAnalysis` cast + aggregator pluck + `as unknown as { ... }` read). The emotion_arc bug (field silently dropped on assembly, 26/26 null rows) is the cautionary precedent: **prove the new fields actually persist on a real run**, don't assume the plumbing works.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope (SSOT)
- `.planning/ENGINE-MAP.md` §"S5 — Omni call" (lines ~106–113) — the KEEP-narrow-job verdict; "never emits the actual words" critical gap; add `hook_verbatim` + per-segment `spoken_text`/`on_screen_text`, drop judgments (judgment-drop deferred to P3 per D-01)
- `.planning/ROADMAP.md` §"Phase 2: Omni Verbatim" — phase scope, success criterion (R1), independently-mergeable note
- `.planning/REQUIREMENTS.md` — **R1** (senses emit words — the phase target), R8 (determinism — temp0+seed preserved), R12 (one brain across modes — verbatim feeds remix decode too, P3)
- `.planning/STATE.md` §"Decisions locked" — keep-the-score + don't-break-live-product context

### Prior phase (conventions carry forward)
- `.planning/phases/01-strip-to-senses/01-CONTEXT.md` — honesty-by-deletion principle (delete fabrication, never fake); `.optional()` backward-compat field pattern; emotion_arc threading precedent; cache-key-bump-on-output-change rule (reverify #13)

### Codebase maps (orientation)
- `.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md`, `STACK.md`, `INTEGRATIONS.md`

### Engine — files to edit (additive)
- `src/lib/engine/qwen/schemas.ts` — `OmniAnalysisZodSchema` (l.120) + `SegmentSchema` (l.67) / inline segment shape (l.157): add `hook_verbatim` + per-segment text fields, all `.optional()`
- `src/lib/engine/qwen/omni-analysis.ts` — `buildSystemPrompt` (l.54–147): add verbatim instructions + fidelity rules + empty contract; assembly block (l.236–271): thread verbatim onto the result (emotion_arc pattern, l.249–257)
- `src/lib/engine/aggregator.ts` — emotion_arc pluck (l.518–530) is the template for the verbatim pluck; thread onto the assembled result (l.925 area)
- `src/lib/engine/types.ts` — `PredictionResult` / `GeminiVideoAnalysis`: add verbatim fields (Omni-only extension, rides `as` cast like emotion_arc)
- `src/app/api/analyze/route.ts` — persistence (emotion_arc precedent l.594, l.921; insert l.638/694); add verbatim to the insert row

### Verification / determinism
- `scripts/measure-pipeline.ts` — E2E harness; confirm latency stays under cap with the extra output tokens (R6 headroom)
- `src/lib/engine/qwen/client.ts` — `QWEN_SEED` + temp 0 (determinism preserved across the prompt change — R8)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`emotion_arc` end-to-end path** — the exact precedent for verbatim: `.optional()` Zod field (schemas.ts:152) → threaded onto `analysis` via the `as GeminiVideoAnalysis` cast (omni-analysis.ts:257) → plucked in aggregator via `as unknown as { emotion_arc? }` (aggregator.ts:518–530) → persisted as `Json` (analyze/route.ts:594). Copy this shape exactly for `hook_verbatim` + segment text.
- **`normalizeSegments`** (omni-analysis.ts:221) — server-side segment post-processing already runs after Zod parse; per-segment verbatim rides through it untouched (or gets normalized alongside if needed).
- **Schema string-cap idiom** — `audio_description` max 280, `rationale` max 300–400 — the precedent for D-04.4 caps.

### Established Patterns
- **temp 0 + seed determinism** (omni-analysis.ts:195–196) — preserved; the prompt change must not break R8.
- **`.optional()` backward-compat** (emotion_arc, segments) — new fields optional so existing/silent responses still validate (D-02.3).
- **MAX_RETRIES=1, 60s timeout** (omni-analysis.ts:25–26) — verbatim adds a few hundred output tokens; confirm it stays inside the timeout + latency cap.
- **Stable-system + volatile-user prompt** — the system prompt is cached; verbatim instructions live in the system prompt (stable across runs).

### Integration Points
- `omni-analysis.ts` assembly → `aggregator.ts` pluck → `PredictionResult` → `analyze/route.ts` insert — the verbatim must survive all four hops (the emotion_arc bug lived in hop 1→2). **Prove persistence on a real run** (R1 verify).
- **Remix path** (`mode:'remix'`, `decode.ts`) shares `analyzeVideoWithOmni` — verbatim flows to it for free, but P2 only verifies no regression; decode consuming verbatim is P3 (R12).
- **Cache key** — Omni output schema changes → bump the engine version/cache key so stale pre-verbatim cached results don't serve (carried from P1 reverify #13).

</code_context>

<specifics>
## Specific Ideas

- The whole point: Omni currently **scores the hook but never quotes it** (ENGINE-MAP S5: `visual_event`/`audio_event` are paraphrases). Verbatim is the #1 raw material for Chase Hughes–grade rewrites — without it, P3 rewrites are impossible.
- Honesty example (user, carried from P1): never fabricate. A silent video's `spoken_words` is `null`, not `"[music plays]"`. The `[inaudible]` marker is the ONE allowed bracketed token, and only for genuinely-unintelligible *present* speech — distinct from absence.
- Fidelity is the deliverable: `"WAIT."` ≠ `"wait"`. Preserve casing, punctuation, emoji, original language.

</specifics>

<deferred>
## Deferred Ideas

- **Drop the ~15 0–10 judgment fields** → **P3** (when Apollo owns scoring and they become redundant). D-01.
- **Apollo rewrites quoting verbatim `original` + 2–3 variants** → **P3** (R2). Includes guarding against `[inaudible]`/`null` leaking as a quotable line.
- **Audience-Sim fed per-segment transcript** → **P4** (R3).
- **Remix `decode`/`adapt` grounded on verbatim + shared core** → **P3** (R12). P2 only verifies no remix regression.
- **Translation of foreign-language verbatim** → out of milestone (keep original language; revisit only if a downstream surface needs it).

</deferred>

---

*Phase: 2-omni-verbatim*
*Context gathered: 2026-06-04*
