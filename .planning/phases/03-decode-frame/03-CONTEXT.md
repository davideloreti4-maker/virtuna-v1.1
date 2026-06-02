# Phase 3: Decode Frame - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

<domain>
## Phase Boundary

For a remix-mode video, the **Decode frame** renders a **structural teardown** (hook pattern, structure/pacing, the turn, emotional beat) plus an **explicit repeatable-vs-luck split** — generated on a **dedicated lightweight Qwen path** (Omni segment signal → one Qwen decode call), **NOT** `runPredictionPipeline`, never touching `usage_tracking`/`DAILY_LIMITS`. Output persists to `variants.remix.decode`. Copy is honest "why it worked" analysis — **never** framing the video as something to "fix."

**Delivers:** DECODE-01 (structural teardown on the lightweight path), DECODE-02 (repeatable-vs-luck split, never "fix this" framing).

**Explicitly NOT this phase:**
- **Decode in isolation** (scope decision below). Phase 3 builds ONLY the Decode frame body + its lightweight Omni→Qwen path + `variants.remix.decode` persistence. It does **not** own what the shared Audience/Content Craft frames show in remix mode — that is already-wired or a separate concern.
- Adapt frame content + niche (Phase 4 — ADAPT-01/02). Adapt **consumes** Decode's repeatable lane, but is built in Phase 4.
- Develop & predict / lineage / `parent_id` (Phase 5).
- Full-pipeline scoring of the remix source: a remix/decode row has **no `overall_score`** (null) and is **not** scored through the 332s engine. That row is decode-only.

</domain>

<decisions>
## Implementation Decisions

### Frame Anatomy (DECODE-01)
- **D-01:** The teardown renders as **stacked labeled beats** in the Decode hero (Verdict's exact right-column bounds, D-07 from Phase 2): **4 short labeled blocks** — `Hook pattern` / `Structure & pacing` / `The turn` / `Emotional beat` — each 1–2 honest lines. Chosen over a timeline (would duplicate the Content Craft filmstrip) and over a single "lead insight" (would force a single-cause story when virality is multi-factor). Cleanest in a narrow column, predictable schema, ages well.
- **D-02:** **All 4 beat slots always render** (stable layout). When a beat is genuinely weak/absent, the block **names the absence honestly** rather than hiding or fabricating — e.g. "No distinct turn — it rides one continuous bit." The Qwen decode prompt MUST permit an explicit "absent / weak" verdict per beat. Mirrors the Score frame's honest-number ethos; directly guards against the turn/emotional-beat hallucination risk.

### Repeatable-vs-Luck Split (DECODE-02)
- **D-03:** The split renders as **two stacked labeled lanes below the beats** (not a side-by-side table — too cramped in the tall narrow hero and harder on the mobile card-stack): a **"What you can repeat"** lane (bulleted structural moves) then a **"What was luck / timing"** lane (bulleted). The repeatable lane is a **clean extractable list** because Phase 4 Adapt draws its concepts from exactly this lane.
- **D-04:** The **luck lane is always non-empty** (SC#3 — never collapse everything into "repeatable"). The decode prompt must surface ≥1 luck factor.
- **D-05:** Luck attribution uses a **fixed taxonomy** the Qwen decode picks from: `timing / trend-moment`, `creator's existing audience / reach`, `algorithmic outlier (unrepeatable spike)`, `topic / zeitgeist`. Only genuinely-applicable categories render. Fixed (not free-form) keeps it honest and prevents hand-wavy "it just hit" filler; matches the spec's timing/existing-audience/outlier wording.

### Voice & Framing (DECODE-02, SC#4)
- **D-06:** Register is **analytical & declarative** — states what the video does, plainly and confidently, **no hype, no advice verbs** (fix/improve/should/try). E.g. "The hook front-loads the payoff in the first 0.5s — result before setup." Mirrors the Score frame's factual honest-number voice; "never fix this" is structurally easiest to hold when copy *describes structure* rather than *dispenses advice*.
- **D-07:** Decode stays **neutral / third-person about the source video** ("the hook / this structure / the video"). Second-person "you" is **reserved for Adapt (Phase 4)**, which personalizes to the user's niche. Clean conceptual boundary: **Decode = objective analysis, Adapt = personalization.** Reinforces "why it worked," not "what you should do."

### Trigger & In-Flight UX (DECODE-01)
- **D-08:** Decode **auto-runs on remix submit** — the decode IS the headline payoff of remix mode; a separate click adds friction to the core "paste a viral video → see why it worked" value. It fills the frame as it returns (~60–90s on the lightweight Omni→Qwen path).
- **D-09:** In-flight, the frame shows an **honest streaming state reusing the board's existing pending/streaming treatment** (same as Engine/Audience while they compute): a quiet "Decoding structure…" status with subtle motion, **no fabricated content / no fake skeleton-of-content**. Phase 2's no-skeleton rule (D-10/D-11) governed the *idle placeholder*; an *actively generating* decode genuinely is loading, so honest progress feedback is correct here. Rejected: beat-by-beat reveal (Qwen returns one structured blob, not a token stream — would need extra plumbing) and a static dead placeholder (60–90s with no feedback reads as broken).

### Persistence
- **D-10:** Decode output persists to **`variants.remix.decode`** (the JSON `variants` column on `analysis_results`). A remix/decode row has **`overall_score = null`**; the row's completion/hydration marker is `variants.remix != null` (NOT `overall_score`), per Phase 5 pitfall m3 — relevant here because Phase 3 is the first phase to actually write a populated remix row.

### Claude's Discretion
- The exact Qwen decode **prompt schema** and the **mapping of Omni fields → the 4 beats** (e.g. `hook_decomposition` + `factors` → Hook pattern; `segments` + `video_signals.pacing_score`/`transition_quality` → Structure & pacing; `emotion_arc` → Emotional beat; segment/scene-boundary shifts → The turn). Ground this in the **real Omni output documented in the Phase 1 spike** (see research flag).
- Whether the lightweight decode path **reuses the Omni output already produced by remix ingestion (Phase 1)** or makes its own Omni call — a latency/cost optimization for research/planning to resolve. SC#2 says "Omni segment call → one Qwen decode call"; reuse is the obvious win if the ingestion Omni result is in scope/available.
- Exact decode copy strings, beat labels' final wording, lane headers' final wording, and the TypeScript shape of `variants.remix.decode`.
- Mobile card-stack rendering of the beats + lanes (must mirror desktop content; follows the Phase 2 BoardMobile swap pattern).
- Decode result caching keyed on the existing remix `content_hash` (mode already folded in — Phase 2 D-14).
- All styling per Raycast design language (6% borders, Inter, 12px card radius, no glow/tint).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — DECODE-01, DECODE-02 acceptance; Out of Scope ("redo this video"/content-copying framing rejected → always "why it worked"; derive-and-drop IP boundary; Qwen-only).
- `.planning/ROADMAP.md` §"Phase 3: Decode Frame" — goal + 5 success criteria + the research flag (write the decode prompt schema only after inspecting real Omni output).
- `.planning/milestones/viral-remix-SPEC.md` — locked seed req 2 (Decode).

### Phase 1 (dependency — INGEST-01, complete; the Omni signal Decode consumes)
- `.planning/phases/01-ingestion-build-hard-gate/01-INGESTION-SPIKE.md` §6 (Omni fidelity sample), §7 (C1 differential) — **the documented real Omni output shape**; this is the ROADMAP research flag's source-of-truth. ASR is NOT required (§6 verdict — `hook_decomposition.first_words_speech_score` + `content_summary` carry real speech fidelity).
- `src/lib/engine/pipeline.ts` — the `tiktok_url` Omni branch + derive-and-drop (the remix ingestion path that produces the signal Decode reads).
- `src/lib/engine/qwen/omni-analysis.ts` — `analyzeVideoWithOmni` (signed-URL Omni call).
- `src/lib/engine/qwen/schemas.ts` — `OmniAnalysisZodSchema`: the available structural fields (`segments`, `hook_decomposition`, 5 `factors`, `emotion_arc`, `video_signals` pacing/transition, `content_summary`, `content_type`/niche). Decode maps these → the 4 beats.

### Phase 2 (dependency — REMIX-01/02, complete; the shell Decode fills)
- `.planning/phases/02-remix-mode-one-board-two-config/02-CONTEXT.md` — D-07 (Decode takes Verdict's exact hero bounds), D-10/D-11 (the idle shell rules this phase supersedes for active state), D-14 (mode folded into content hash).
- `src/components/board/decode/DecodeShellNode.tsx` — the current titled shell + muted descriptor; Phase 3 replaces the body with the teardown + lane content.
- `src/components/board/board-constants.ts` — `resolveBoardLayout(mode)`, verdict→decode bounds (D-07/D-08); Decode hero geometry.
- `src/components/board/Board.tsx` (desktop Konva wiring) + `src/components/board/BoardMobile.tsx` (mobile card-stack order) — where the Decode frame mounts in both layouts.
- `src/components/board/_kit/FrameHero.tsx` — shared frame chrome (basis for the beats/lanes layout).
- `src/components/board/verdict/VerdictNode.tsx` — the swapped-out hero; reference for honest-number voice + frame structure to mirror.

### Data & Streaming
- `src/types/database.types.ts` — `analysis_results.variants` (`Json | null`); Decode writes `variants.remix.decode`. Row has `mode` (Phase 2); `overall_score` is null on decode rows.
- `src/hooks/queries/use-analysis-stream.ts` — SSE/streaming the board uses; the in-flight "Decoding…" state (D-09) reuses this pending treatment.
- `src/lib/engine/cache/prediction-cache.ts` — content-hash (mode already folded, D-14); decode result caching keys here.

### Design language
- `CLAUDE.md` §"Raycast Design Language Rules" + `BRAND-BIBLE.md` — beats/lanes/in-flight styling must conform (6% borders, Inter, 12px radius, no glow/tint).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`DecodeShellNode.tsx`** — the titled shell already exists in Verdict's hero bounds; Phase 3 swaps its body (currently one muted descriptor line) for the 4 beats + 2 lanes.
- **Omni structural signal** is already computed by the Phase 1 remix-ingestion path — `segments`, `hook_decomposition`, `factors`, `emotion_arc`, `video_signals` give real per-video structure to map onto the 4 beats (no new capture needed; reuse-vs-refetch is the open optimization).
- **`VerdictNode` honest-number copy** — the analytical, non-prescriptive register to mirror (D-06).
- **Board streaming/pending treatment** (`use-analysis-stream` + frame pending states) — reuse for D-09's honest in-flight state.
- **`resolveBoardLayout(mode)` + decode bounds** — geometry already wired by Phase 2; Phase 3 only fills content.

### Established Patterns
- **Qwen-only model calls** — the decode call MUST be Qwen (Numen/Virtuna pipeline is Qwen-only; no Gemini/DeepSeek). New call lives in `src/lib/engine/remix/decode.ts` (new dir — does not exist yet).
- **Lightweight path, NOT `runPredictionPipeline`** — decode does NOT enter the 332s pipeline and does NOT touch `usage_tracking`/`DAILY_LIMITS` (SC#2, pitfall C2). It is a standalone Omni→Qwen hop.
- **`variants` JSON column** for non-scalar per-analysis payloads (Content Craft already uses `variants.craft`) — `variants.remix.decode` follows the same additive, no-migration pattern.
- **Server components by default, client only when interactive** — the board/frame is already client/Konva + DOM overlay.

### Integration Points
- Remix submit → lightweight decode path (Omni signal → `engine/remix/decode.ts` Qwen call) → persist `variants.remix.decode` → stream to the Decode frame.
- `DecodeShellNode` body ← decode payload (4 beats + repeatable/luck lanes); in-flight ← board pending state.
- Decode repeatable lane → (Phase 4) Adapt concept generation.

</code_context>

<specifics>
## Specific Ideas

- **"Why it worked, never fix this"** is the non-negotiable framing line (SC#4) — every beat and lane reads as honest teardown of a video that already succeeded.
- **Honest-number ethos parity** — Decode should feel like the Score frame's sibling: factual, precise, no hype. Same brand voice, applied to structure instead of a number.
- **Decode = analysis / Adapt = personalization** — the third-person-source vs second-person-creator split (D-07) is the clean conceptual seam between Phase 3 and Phase 4.
- **Name the absence** over fabricating a beat (D-02) — directly applies the "don't invent signal" discipline the milestone's C1 guard established for ingestion.

</specifics>

<deferred>
## Deferred Ideas

- **Adapt frame content + niche prompt** — Phase 4 (ADAPT-01/02). Consumes the Decode repeatable lane (D-03).
- **Develop & predict + lineage (`parent_id`, "remixed from" chip)** — Phase 5 (DEVELOP-01/02).
- **Shared-frame behavior in remix mode** (what Audience / Content Craft render for an un-scored remix source) — out of scope for Phase 3 (scope decision: Decode in isolation). Either already-wired or a later concern.
- **Qwen ASR transcript for hook-line fidelity** — gated/deferred per Phase 1 spike §6 (Omni speech fidelity sufficient). Revisit only if decode prompt design surfaces a concrete spoken-hook gap.
- **Beat-by-beat streamed reveal** — deferred (D-09); Qwen returns one structured blob.

</deferred>

---

*Phase: 03-decode-frame*
*Context gathered: 2026-06-02*
