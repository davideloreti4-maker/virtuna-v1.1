# Phase 3: Apollo Reasoner (Brain 1) — THE MOAT + shared knowledge core - Research

**Researched:** 2026-06-05
**Domain:** LLM reasoning reframe (Qwen via DashScope), cached-system-prompt knowledge grounding, structured-output extension, score-blend rewire
**Confidence:** HIGH (all claims grounded in the repo + the in-tree validated core/harness; no external library risk — phase reuses the existing Qwen SDK call structure)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `KNOWLEDGE-CORE` is the single brain SSOT. Dormant `creator-rules.ts`'s prompt-injection constants (`CREATOR_RULES_BLOCK`, `CREATOR_RULES_NUMERIC`, etc.). Do NOT inject both (no dual knowledge base).
- **D-02 (guard):** BEFORE dormanting `creator-rules.ts`, verify the core's §2.0a calibration anchors carry the key hard numbers (hook ≈80% of performance, outlier = ≥5× follower count, platform length targets). If any anchor is missing, **port it into the core first**, then dormant. No silent loss of a calibration number.
- **D-03:** The deterministic UI checker `creator-rulebook.ts` (`deriveCreatorRulebook()` → `CreatorRulebookCard` / `ContentAnalysisFrame`) is a separate board-signal layer, NOT Apollo's prompt — leave it fully untouched this phase.
- **D-04:** When Apollo comes online, it **replaces the gemini/visual (~35) half** of the live blend. Live blend becomes **`behavioral 40 + Apollo`** (renormalized). Unblocks the deferred gemini-judgment drop.
- **D-05:** Full Apollo + Audience-Sim score rederivation is **deferred to P5**. Do NOT make Apollo own the entire 0–100 in P3. Behavioral (wave3 personas) stays its own term until P4 folds it into Audience-Sim.
- **D-06:** Apollo emits the core **§4 output contract as-is**: 6 dimensions — Hook · Retention · Clarity · Share-pull · Substance/originality · Credibility(bonus) — each graded Strong/Mid/Weak with the §2 lever named + sensor signal quoted; one holistic, hook-weighted composite 0–100 (≈80% hook weight); no per-dimension numeric sub-scores; composite is a judgment not an arithmetic sum.
- **D-07 (guard):** Verify the 6 dimensions are the right/complete high-leverage set against A/B evidence + best practice. Default is adopt §4 as-is.
- **D-08:** Rewrites scope = **the verbatim hook line only**. Emit 2–3 directional variants, each fixing a different §2 lever per §6, quote-grounded, honoring §1 voice. Satisfies R2 verify. Per-segment rewrites deferred.
- **D-09:** P3 rewrites are **craft-grounded only**. Audience-aware rewrites = P5.
- **D-10:** **Single Apollo call, temp0 + seed for everything** (score + critique + rewrites in one deterministic call). Do NOT split rewrites into a separate temp>0 call. (Revisit temp bump only if variety inadequate — YAGNI now.)
- **D-11:** Re-ground the knowledge, preserve the output contracts. Swap `decode.ts`'s framework → core §5 decode lens; swap `adapt.ts`'s `ADAPT_SYSTEM_PROMPT` → core §6 + §2. Their system prompts must reference the shared core (R12 verify).
- **D-12:** Keep the existing Zod output schemas intact — decode's `luck[]` + 4 beats, adapt's `concepts` — so `/api/remix/adapt` and the Remix board do NOT break. No output-contract refactor this phase.
- **D-13 (guard):** Verify §5's 4 beats map cleanly onto decode's existing output fields; if a bespoke decode field has no core grounding, add it to the core or keep minimal bespoke glue.

### Claude's Discretion
- **Core delivery form:** how the ~29KB KNOWLEDGE-CORE.md becomes the byte-stable cached system prompt (inline TS constant vs build-time/runtime file read). Mirror the existing `STABLE_SYSTEM_PROMPT` byte-stability contract.
- **Confidence indicator derivation:** per §4, confidence scopes to signal coverage. Implementation detail for planning.
- **Keep infra:** circuit breaker, retries, cache split in `deepseek.ts` are retained.

### Deferred Ideas (OUT OF SCOPE)
- Per-segment rewrites.
- Audience-aware rewrites + `Omni → Audience-Sim → Apollo` wiring → P5.
- Full Apollo + Audience-Sim score rederivation + grounded engagement estimate (R11) → P5.
- temp>0 rewrite pass — only if temp0 rewrites prove too samey.
- Remix output-contract refactor — only if a contract genuinely conflicts with the core.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **R2** | A single Qwen reasoning call grounded in a distilled Chase Hughes/craft knowledge core (stable, cached system prompt) produces: directional read, critique, and **rewrites that quote the creator's actual line and offer 2–3 drop-in variants.** Absorbs platform-fit (incl. watermark cross-post warning). *Verify: output contains a rewrite whose `original` matches the verbatim hook.* | §4 (delivery form), §5 (single-call output schema extension), §6 (verbatim feed trace), §11 (validation) — all below |
| **R5 (partial)** | Apollo half of the honest expert score + confidence. Score = Apollo's expert assessment (chess-engine position eval), NOT empirical. | §3 (composite wiring D-04/D-05), §7 (confidence derivation) |
| **R12** | Remix's `decode` + `adapt` grounded in the **same** core — system prompts reference the shared core, no divergent knowledge base. *Verify: decode/adapt prompts reference the shared core; no divergent knowledge base.* | §6 (D-13 beat mapping), §4 (shared core delivery), §11 (grep assertion) |
</phase_requirements>

## Summary

This phase is a **knowledge-reframe + structured-output-extension** of an existing, working Qwen reasoning call — not new infrastructure. `src/lib/engine/deepseek.ts` already is the exact pattern Apollo needs: one reasoning call, stable cached system prefix + volatile user message, `temp:0 + seed`, circuit breaker, retries, cost tracking, Zod-validated structured JSON output. P3 swaps the generic 5-step `STABLE_SYSTEM_PROMPT` for the distilled `KNOWLEDGE-CORE.md` (4,490 words / ~29.7KB / ~7.4k tokens — comfortably inside the HOW-TO-BUILD ~3–8k target, under the 10–15k soft ceiling), feeds the P2 verbatim payload in the user message, and extends the output schema with a composite score + dimension grades + hook rewrites. The same core string also re-grounds the two Remix surfaces (`decode.ts`, `adapt.ts`) per R12, preserving their existing Zod output contracts (D-12).

The validated harness `scripts/apollo-core-smoke.ts` already proves the core + Omni signals produce a coherent §4 assessment (scores 26–86 across 4 videos), and its `APOLLO_INSTRUCTION` is a ready-made template for the production system-prompt suffix. The single biggest technical decision is the **core delivery form** for byte-stable caching — recommendation: a **build-time-embedded TS constant** generated from the markdown file (keeps the file editable, guarantees byte-identity, no runtime FS read in the hot path).

Two CONTEXT guards were checked concretely. **D-02 (calibration diff):** the core's §2.0a carries 8 of 9 video-scoreable hard numbers; **one is missing — "outlier = ≥5× follower count" (Ava, Numeric row #1)** — it must be ported into §2.0a before `creator-rules.ts` is dormanted. The other unmatched creator-rules numbers are all channel/business-strategy rows that §8 explicitly parks by design (idea funnel, cadence, ad math, momentum timelines) — correctly excluded. **D-13 (beat mapping):** §5's 4 beats map 1:1 onto decode's `BeatId` enum (`hook_pattern / structure_pacing / the_turn / emotional_beat`) — exact string match, zero schema drift. Decode's `luck[]` taxonomy is also fully grounded in §5's "repeatable vs luck" paragraph. No bespoke decode field is ungrounded.

**Primary recommendation:** Reframe `deepseek.ts` in place — embed the core as a build-generated byte-stable constant, extend `DeepSeekResponseSchema` with `composite_score` + `dimensions[]` + `rewrites[]` + `confidence_scope`, thread `verbatim` into the user message only, rewire `aggregator.ts` to blend `behavioral 40 + Apollo` (renorm), and point `decode.ts`/`adapt.ts` system prompts at the same core constant. Port the one missing §2.0a number first.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Knowledge core (Chase Hughes/craft brain) | Backend / engine lib (`src/lib/engine`) | — | Cached system prompt; pure server-side, never client |
| Apollo reasoning call (score + critique + rewrites) | Backend / engine (`deepseek.ts`) | DashScope (external LLM) | One deterministic reasoning call; sensor signals in, structured JSON out |
| Verbatim feed | Backend (P2 `VerbatimPayload` → user message) | — | Dynamic per-request data; must stay OUT of cached prefix |
| Composite score blend | Backend (`aggregator.ts`) | — | Pure TS math over LLM outputs; no LLM call |
| Remix decode/adapt re-grounding | Backend (`remix/decode.ts`, `remix/adapt.ts`) | DashScope | Same core constant, mode-specific output contracts |
| Persistence of Apollo output | Backend (route `buildInsertRow` + SSE UPDATE) → Supabase | Supabase (`analysis_results` JSONB) | Rewrites/composite thread into existing persist sites |
| Rendering dimension bands / rewrites | **OUT OF SCOPE (P5 UI)** | — | All UI deferred to P5 per phase boundary |

## Standard Stack

No new packages. This phase reuses the in-tree stack exclusively.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` SDK (DashScope-compatible) | in tree, via `getQwenClient()` | Chat completions w/ `response_format: json_object`, `seed`, `temperature` | Already the engine's only LLM client; `deepseek.ts`/`decode.ts`/`adapt.ts` all use it |
| `zod` | `^3.x` (in tree) | Structured-output validation + safe-parse-then-backstop pattern | Engine-wide contract validator; `DeepSeekResponseSchema`, `DecodeResultZodSchema` |
| `@sentry/nextjs` | in tree | Failure capture on the reasoning stage | Existing pattern in all three call sites |
| `vitest` | `^4.0.18` [VERIFIED: package.json] | Test runner for Wave-0 + regression | Project standard (`npm test` = `vitest run`) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tsx` | in tree | Run `apollo-core-smoke.ts` / `measure-pipeline.ts` against real videos | Manual/CI validation of core grounding + latency |
| `ffmpeg` (system) | external CLI | Transcode non-mp4 in the smoke harness | Only the smoke script; not the production path |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Cached system prompt (whole core every call) | pgvector RAG (top-K chunks) | HOW-TO-BUILD §"Cached vs RAG" rules this out for v1: core distills to ~7.4k tokens, fits the cache, RAG is NOT cacheable (kills the latency win) and adds infra. Dormant retrieval plumbing exists if hybrid is ever needed. |
| Single deterministic call (D-10) | Separate temp>0 rewrite call | D-10 forbids it: a 4th call breaks the ~3-call architecture; rewrite quality comes from §6 templates + verbatim grounding, not sampling temperature. |

**Installation:** None — no `npm install` this phase.

**Version verification:** Confirmed `vitest@^4.0.18` and Qwen client constants (`QWEN_REASONING_MODEL` default `qwen3.6-plus`, `QWEN_SEED = 7`) in tree. No registry packages added.

## Package Legitimacy Audit

> Not applicable — this phase installs **no external packages**. It reframes existing engine modules and reuses the in-tree `openai`/`zod`/`@sentry/nextjs`/`vitest` stack already vetted in P1/P2. slopcheck gate skipped: zero new dependencies.

## Architecture Patterns

### System Architecture Diagram

```
SCORE MODE (R2 + R5-partial)
                                                  ┌─────────────────────────────┐
  video ──► Omni (sensor) ──► verbatim{hook,segs} │  CACHED SYSTEM PREFIX        │
            (P2, persisted)   + signals/segments   │  = KNOWLEDGE-CORE.md         │
                                   │                │    (§1 voice, §2 frameworks, │
                                   │                │     §2.0a anchors, §3 anti,  │
                                   ▼                │     §4 rubric) byte-stable   │
                    ┌──────────────────────────┐   └─────────────┬───────────────┘
                    │ buildApolloUserMessage()  │                 │ (prefix cache hit)
                    │  VOLATILE per request:    │                 ▼
                    │  verbatim hook+segments,  │   ┌─────────────────────────────┐
                    │  Omni sensor signals,     │──►│ Apollo call (deepseek.ts)    │
                    │  creator context,         │   │  temp:0 + seed, json_object  │
                    │  platform target          │   │  ONE call → all three:       │
                    └──────────────────────────┘   │   • dimensions[] Strong/Mid/Weak
                                                    │   • composite 0–100 (judgment)
                                                    │   • rewrites[] (orig=verbatim hook)
                                                    │   • confidence_scope             │
                                                    └─────────────┬───────────────┘
                                                                  ▼
                                          aggregator.ts: overall = behavioral 40 + Apollo
                                                         (renorm; gemini term retired D-04)
                                                                  ▼
                                          route persist: buildInsertRow (~598) + SSE UPDATE (~928)
                                                         ENGINE_VERSION bump → cache invalidation

REMIX MODE (R12)  — SAME cached core prefix, different lens + output
  Omni ──► decode.ts  (system = core §5 decode lens) ──► DecodeResult{4 beats, repeatable, luck} (UNCHANGED Zod)
              │
              └──► adapt.ts (system = core §6 + §2)   ──► {concepts[3]} (UNCHANGED Zod)
```

### Recommended Module Touch-Map (no new dirs)
```
src/lib/engine/
├── deepseek.ts            # SWAP STABLE_SYSTEM_PROMPT→core; extend output schema; thread verbatim
├── apollo-core.ts         # NEW: byte-stable core constant (build-embedded) + APOLLO_INSTRUCTION suffix
├── types.ts               # EXTEND DeepSeekResponseSchema (additive: composite/dimensions/rewrites/confidence_scope)
├── aggregator.ts          # REWIRE blend: behavioral + Apollo (retire gemini term per D-04)
├── creator-rules.ts       # DORMANT after D-02 port (move to _dormant/ per P1/P2 convention)
└── remix/
    ├── decode-prompts.ts   # DECODE_SYSTEM_PROMPT → references core §5 (keep buildDecodeContext)
    └── adapt.ts            # ADAPT_SYSTEM_PROMPT → references core §6+§2 (keep schemas + builder)
```

### Pattern 1: Stable-prefix / volatile-user split (the caching contract)
**What:** System message = byte-identical core on every call (cache-hit discount). User message = all per-request dynamic content. Already enforced in `deepseek.ts` and documented in `creator-rules.ts` BYTE-STABILITY CONTRACT.
**When to use:** Every Apollo call, every remix call.
**Example:**
```typescript
// Source: src/lib/engine/deepseek.ts:479-491 (existing pattern — reuse verbatim)
const response = await ai.chat.completions.create({
  model: DEEPSEEK_MODEL,                       // QWEN_REASONING_MODEL = qwen3.6-plus
  messages: [
    { role: "system", content: APOLLO_SYSTEM_PROMPT },   // NEW: core + APOLLO_INSTRUCTION, byte-stable
    { role: "user",   content: buildApolloUserMessage(ctx) }, // verbatim + sensor signals here
  ],
  response_format: { type: "json_object" },
  temperature: 0,
  seed: QWEN_SEED,
}, { signal: controller.signal });
```

### Pattern 2: Zod safe-parse + pure-TS backstop (output-contract guard)
**What:** `safeParse` the model JSON; on failure, one retry with a user-message nudge (keep system prefix stable); after parse, defensively backstop required invariants.
**When to use:** The extended Apollo output (e.g. assert `rewrites.length >= 2`, assert each `rewrite.original` non-empty; assert composite in 0–100).
**Example:**
```typescript
// Source: src/lib/engine/remix/decode.ts:95-125 (existing backstop pattern)
const parsed = ApolloResponseSchema.safeParse(JSON.parse(text));
if (!parsed.success) { /* retry attempt 0→1 with extraInstruction on USER msg only */ }
// post-parse backstop: ensure invariants R2 verify depends on
```

### Pattern 3: Retry nudge on the USER message, never the system prefix
**What:** On a parse-retry, append the "return only JSON" instruction to the **user** content (`decode.ts:67`, `adapt.ts:119`), so the cached system prefix stays byte-identical and the cache prefix is preserved across the retry.
**Anti-pattern it prevents:** `deepseek.ts:472-474` currently does this correctly — preserve that behavior when extending.

### Anti-Patterns to Avoid
- **Interpolating any dynamic value into the cached prefix** — Date.now(), creator context, verbatim, platform name. Kills the DashScope prefix-cache hit (the latency win). The core constant must contain ZERO interpolation.
- **Dual knowledge base (D-01)** — injecting `CREATOR_RULES_BLOCK` AND the core. Pick the core; dormant creator-rules.
- **Making Apollo own the whole 0–100 (D-05)** — only replaces the gemini term; behavioral stays separate until P4/P5.
- **A 4th LLM call for rewrites (D-10)** — everything in one call.
- **Refactoring decode/adapt output schemas (D-12)** — re-ground the *knowledge*, keep the *contracts*.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured LLM JSON parsing | Custom regex extraction | `response_format: json_object` + `stripModelOutput` + Zod safeParse | Already battle-tested across 3 call sites; handles `<think>` + fences |
| Reasoning-call resilience | New retry/circuit logic | Existing `deepseek.ts` circuit breaker + backoff + half-open mutex | Lines 111-282 already handle thundering-herd, backoff, reset |
| Cache-key invalidation on engine change | Ad-hoc cache busting | Bump `ENGINE_VERSION` (`version.ts`) | `prediction-cache.ts` keys on it; P2 set the precedent (3.1.0→3.2.0) |
| Core grounding validation | New eval rig | `scripts/apollo-core-smoke.ts` (already validated 26–86) | Its `APOLLO_INSTRUCTION` is the production prompt-suffix seed |
| Decode↔Adapt seam | New adapter | `decodeResultToAdaptInput()` (decode-types.ts:210) | Already maps beats→AdaptInput, excludes luck (D-01 guard) |

**Key insight:** P3 is ~90% reuse. The novel work is content (the core, already built + validated) + an additive output-schema extension + one blend-math rewire. Resist rebuilding any infra.

## Runtime State Inventory

> This phase reframes a string-named module (`deepseek.ts` stays named "deepseek" by deliberate decision) and dormants `creator-rules.ts`. Not a rename, but it touches stored state via the cache and persisted output. Inventory below.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `analysis_results` rows persist `suggestions`/`warnings`/`factors`/`reasoning` JSONB. New Apollo fields (composite/dimensions/rewrites) thread through `variants` JSONB or a new structured field. Cached predictions (L1 in-mem + L2 Supabase) keyed on `ENGINE_VERSION`. | **ENGINE_VERSION bump** (e.g. 3.2.0 → 3.3.0) auto-invalidates stale rows. Decide persist target for rewrites (recommend `variants` JSONB — no migration, mirrors craft/remix). |
| Live service config | None — no external service config embeds engine string state. | None — verified no UI/DB-only config references the reasoner stage name. |
| OS-registered state | None. | None. |
| Secrets/env vars | `QWEN_REASONING_MODEL`, `QWEN_DECODE_MODEL`, `QWEN_SEED`, DashScope API key — all unchanged; code reads them by name, no rename. | None. |
| Build artifacts | If core delivered as build-embedded constant: a generated `apollo-core.ts` (or `.generated.ts`) must be produced from `KNOWLEDGE-CORE.md` at build/commit time. Stale generated file = stale core in prod. | Add a generation step (script + check) OR inline once and document the source-of-truth link. Recommend committing the generated constant with a header noting its source + regen command. |

**Canonical question — after every file is updated, what runtime systems still cache the old prompt?** The prediction cache (L1/L2) — handled by the `ENGINE_VERSION` bump. DashScope's prefix cache self-heals (new prefix bytes = new cache entry, old entry evicts). No manual cache purge needed beyond the version bump.

## Composite Score Wiring (D-04 / D-05) — concrete map

**Current blend** (`aggregator.ts:71-80, 681-762`):
- `SCORE_WEIGHTS = { behavioral: 0.40, gemini: 0.35 }` (the only two live keys post-P1 strip).
- `behavioral_score` (line 698) = avg of DeepSeek's 7 `component_scores` × 10.
- `gemini_score` (line 707) = avg of Omni/gemini `factors[]` × 10, then `applyCtaPenalty` (line 722).
- `raw_overall_score` (line 748-757) = `behavioral_score × weights.behavioral + ctaPenaltyApplied_gemini_score × weights.gemini`.
- `selectWeights` (line 157-181) renormalizes 0.40/0.35 → ≈0.533/0.467 when both present.

**P3 target blend (D-04):** Apollo's §4 composite **replaces the gemini term**. New live blend = `behavioral 40 + Apollo`. Concretely:
1. Add an `apollo` term sourced from `deepseekResult.reasoning.composite_score` (the new 0–100 field).
2. Set `SCORE_WEIGHTS = { behavioral: 0.40, apollo: 0.35 }` (keep the gemini *weight value* on the Apollo term so the renormalization math + 53.3/46.7 split is structurally unchanged — this satisfies STATE.md's "derivation structurally unchanged" determinism guard).
3. Retire the `gemini_score` blend contribution: `gemini_score` stays computed + surfaced on `PredictionResult.gemini_score` (UI/back-compat) but **no longer feeds `raw_overall_score`**. The `applyCtaPenalty` term (D-06 of P5) folds into Apollo's pass (platform-fit absorption per ENGINE-MAP S12) OR is dropped — recommend dropping the separate CTA-penalty-on-gemini math since the gemini term leaves the blend; surface CTA as Apollo critique evidence instead.
4. `selectWeights` + `SignalAvailability` rename `gemini`→`apollo` weight key (keep `gemini` as a provenance-only flag like `ml`/`rules`/`trends`).

**This unblocks** the P2-deferred gemini-judgment drop: ENGINE-MAP S15 noted the blend was "effectively `behavioral + gemini` = two correlated LLM opinions"; D-04 retires the gemini opinion in favor of the knowledge-grounded Apollo composite.

**DO NOT (D-05):** make Apollo own 0–100. Behavioral (40) stays its own term. Full rederivation (Apollo + Audience-Sim) is P5.

## Single Deterministic Call + Output Schema Extension (D-10)

`deepseek.ts` already supports emitting all three in one call: `response_format: json_object`, `temperature: 0`, `seed: QWEN_SEED`, single `create()` call (lines 479-491). No structural change to the call needed — only the **schema** and **prompt** change.

**Output schema extension (additive to `DeepSeekResponseSchema`, types.ts:726):**
```typescript
// Additive — keep existing behavioral_predictions/component_scores for back-compat
// during the transition; the blend reads the new composite_score.
const ApolloDimensionSchema = z.object({
  name: z.enum(["hook","retention","clarity","share_pull","substance","credibility"]),
  band: z.enum(["strong","mid","weak"]),
  lever: z.string().min(1),      // §2 lever named
  evidence: z.string().min(1),   // quoted sensor signal
});
const ApolloRewriteSchema = z.object({
  original: z.string().min(1),   // MUST equal the verbatim hook line (R2 verify)
  variant: z.string().min(1),
  lever_fixed: z.string().min(1),// the DIFFERENT §2 lever each variant addresses (D-08)
});
// extend DeepSeekResponseSchema with:
//   dimensions: z.array(ApolloDimensionSchema).length(6),
//   composite_score: z.number().min(0).max(100),
//   ceiling_capper: z.string().min(1),           // the one sentence (§4 contract)
//   confidence_scope: z.string().min(1),         // what §2 signals were unobservable
//   confidence: z.enum(["high","medium","low"]), // already present
//   rewrites: z.array(ApolloRewriteSchema).min(2).max(3),  // D-08
//   platform_note: z.string().optional(),        // watermark/cross-post warning (S12 absorb)
```
**Backstop after parse (Pattern 2):** assert `rewrites[*].original` non-empty + matches the fed verbatim hook (normalize whitespace); assert exactly 6 dimensions; clamp composite to 0–100.

## Verbatim Feed Trace (R2 critical line)

The P2 `VerbatimPayload` (types.ts:29-36) = `{ hook?: {spoken_words, on_screen_text}, segments?: [{idx, spoken_text, on_screen_text}] }`, plucked in `aggregator.ts:539-554` (hook) + `:895-924` (segments) and persisted at route `:598` (INSERT) + `:928` (SSE UPDATE).

**Threading into Apollo:** `verbatim` reaches the aggregator on `geminiResult.analysis.hook_verbatim` + `pipelineResult.segments`. For Apollo, the cleanest path is to pass `verbatim` into `reasonWithDeepSeek`'s `DeepSeekInput` (extend the interface, line 436-442) and emit it **in `buildDeepSeekUserMessage` (the volatile user message, line 383)** — NEVER the system prefix. The rewrite's `original` field must be filled from `verbatim.hook.spoken_words` (or `on_screen_text` when spoken absent). This is the load-bearing line for R2's verify: `rewrite.original === verbatim.hook`.

**Caveat:** the smoke harness currently passes the full Omni bundle (incl. `analysis`, `segments`) as the user message but does NOT yet thread a dedicated `verbatim` block — production must add it explicitly so the model has the literal line to quote.

## Confidence Indicator Derivation (Claude's discretion)

§4 scopes confidence to **signal coverage**: transcript-only loses all visual signals (stimulation, 3-hook alignment, emulation, packaging, scroll-stop visual, mute-readability). Recommended derivation:
- **Model-emitted `confidence` + `confidence_scope`:** Apollo names which §2 multimodal levers it could not observe (the §4 contract already requires this; the smoke `APOLLO_INSTRUCTION` step 4 elicits it). Use as the qualitative scope string.
- **Deterministic numeric floor (aggregator):** reuse `calculateConfidence` (aggregator.ts:194) signal-availability component — `hasVideo` (+0.1), segment availability, model agreement. With the gemini term retired, replace the gemini-vs-behavioral agreement check with an Apollo-vs-behavioral direction agreement (composite vs behavioral_score). Keep HARD-03 LOW-floor on dual failure.
- **Honest reporting:** when video signals present → coverage high; transcript/text mode → cap at MEDIUM and surface the scope string. This matches R5's "confidence indicator" + §4.1's "confidence rises with signal coverage."

## Infra Preservation (roadmap "Does")

Confirmed retained in `deepseek.ts`: circuit breaker (lines 111-282, status/backoff/half-open mutex), `MAX_RETRIES=2` + exponential backoff (544-546), cost tracking (`calculateCost`, soft cap warn line 503), Sentry capture (555). **One cleanup:** `loadCalibrationData()` + `calibration-baseline.json` + the calibration block in `buildDeepSeekUserMessage` (lines 312-335, 387-431) are score-machinery percentile scaffolding — R5/R9 drop "top X%" framing. The viral-differentiators + duration-sweet-spot block (lines 391-431) is dynamic dataset noise the core supersedes; recommend removing it from the Apollo user message (the core's §2.0a + §4.1 carry the calibration knowledge). Keep the file load only if a non-percentile signal is still wanted (none identified — recommend drop).

## Common Pitfalls

### Pitfall 1: Core leaks into the volatile user message (or vice versa)
**What goes wrong:** Putting verbatim/creator-context in the system prefix, or putting the core in the user message. Either kills the prefix-cache hit (latency) or makes the cache match on per-request bytes.
**Why it happens:** Copy-paste from the smoke harness, which concatenates `core + APOLLO_INSTRUCTION` into system (correct) but also dumps the whole Omni bundle as user (correct) — the production split must keep verbatim strictly in user.
**How to avoid:** The core constant has zero interpolation. `buildApolloUserMessage` is the ONLY place dynamic data appears.
**Warning signs:** DashScope `usage.prompt_cache_hit_tokens` stays 0 across identical re-runs.

### Pitfall 2: D-02 silent number loss (the outlier definition)
**What goes wrong:** Dormanting `creator-rules.ts` drops "outlier = ≥5× follower count" which is NOT in the core.
**Why it happens:** §2.0a carries 8 of 9 video-scoreable numbers; the missing one is easy to overlook.
**How to avoid:** Port "outlier = ≥5× follower count in views (Ava)" into §2.0a (or §5's luck lens where "algorithmic outlier" already lives) BEFORE the dormant. (See D-02 diff below.)
**Warning signs:** No grep hit for `5×`/`follower count` in the core.

### Pitfall 3: ENGINE_VERSION not bumped → stale cached scores served
**What goes wrong:** Apollo ships but cached pre-Apollo rows serve the old behavioral+gemini score.
**Why it happens:** Cache keys on `ENGINE_VERSION`; forgetting the bump is silent.
**How to avoid:** Bump `version.ts` (3.2.0 → 3.3.0) as part of the blend-rewire plan. P2 set this exact precedent.
**Warning signs:** Re-analyzing a known video returns a pre-P3 composite.

### Pitfall 4: rewrite.original whitespace/case mismatch fails R2 verify
**What goes wrong:** Model paraphrases or re-cases the hook in `original`; `rewrite.original === verbatim.hook` assertion fails.
**Why it happens:** LLMs normalize quotes/casing.
**How to avoid:** Prompt: "copy the line VERBATIM into `original`"; backstop: normalize whitespace + compare; if mismatch, set `original` from the fed `verbatim.hook` directly (TS, not the model).
**Warning signs:** Verify test flaky across seeds.

### Pitfall 5: Determinism band, not byte-identity (STATE.md amendment)
**What goes wrong:** Expecting same-video-twice byte-identical composite under temp0+seed.
**Why it happens:** STATE.md (2026-06-04) found provider-level nondeterminism (`overall_score` 79 vs 78). R8 amended to "deterministic within provider noise band."
**How to avoid:** Validation asserts the composite lands within a ±1–2 band on re-run, structure unchanged — NOT byte-equal. (Apollo is a single call, less drift surface than the 10-call wave3, but still subject to provider noise.)

## Code Examples

### Byte-stable core delivery (recommended: build-embedded constant)
```typescript
// Source: pattern from src/lib/engine/creator-rules.ts BYTE-STABILITY CONTRACT (lines 12-17)
// apollo-core.ts — generated/committed from .planning/corpus/KNOWLEDGE-CORE.md
// Header documents source + regen command; NO interpolation anywhere.
export const KNOWLEDGE_CORE = `# Apollo Knowledge Core — v1.1 ...`; // full core, build-embedded
export const APOLLO_INSTRUCTION = `You are Apollo ... Follow the §4 OUTPUT CONTRACT exactly ...`;
export const APOLLO_SYSTEM_PROMPT = `${KNOWLEDGE_CORE}\n\n---\n\n${APOLLO_INSTRUCTION}`;
// APOLLO_SYSTEM_PROMPT is a module-level const string → byte-identical every call.
```
*Trade-offs:* build-embed = guaranteed byte-identity + no hot-path FS read; editing means regen (mitigate with a `pnpm gen:core` script + CI check that the generated file matches the markdown). A runtime `fs.readFile` (like the old `loadCalibrationData`) reads the live file but risks per-deploy whitespace drift and an async hop in the hot path — not recommended for the cached prefix.

### Re-grounding decode (D-11, preserve schema D-12)
```typescript
// Source: src/lib/engine/remix/decode-prompts.ts:27 — swap the framework, keep buildDecodeContext + DecodeResultZodSchema
export const DECODE_SYSTEM_PROMPT = `${KNOWLEDGE_CORE}\n\n---\n\n` +
  `Apply the §5 Decode Lens. Run this reference video through §2 to separate repeatable craft from unrepeatable luck. ` +
  `Return EXACTLY 4 beats (hook_pattern §2.1 · structure_pacing §2.2 · the_turn §2.2 head-fake · emotional_beat §2.3) ... ` +
  `[existing voice contract + JSON schema unchanged]`;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generic 5-step "TikTok strategist" framework in `STABLE_SYSTEM_PROMPT` | Distilled knowledge core (Kallaway + Hoyos/Hormozi/Ava), §2 frameworks as SSOT | This phase (P3) | The moat; grounded, framework-cited, auditable reasoning |
| `creator-rules.ts` injected into stages 10/11/wave4 | Single core SSOT; creator-rules dormant (D-01) | This phase | No dual knowledge base; §8 maps creator-rules substance into the core |
| Score = behavioral 40 + gemini 35 (two correlated LLM opinions) | Score = behavioral 40 + Apollo composite (knowledge-grounded) | This phase (D-04) | Retires the redundant gemini opinion; explainable composite |
| Rewrites attempted by stage11 (fed scores, never the words → null in prod) | Rewrites in Apollo, quote-grounded in verbatim hook | This phase (R2) | Rewrites finally see the literal line |
| Platt calibration / corpus-percentile "top X%" | Dropped (R5/R9); chess-engine position eval | P1/P2, completed in P3 prompt | Honest expert assessment, no fabricated rank |

**Deprecated/outdated:**
- `calibration-baseline.json` percentile block in the reasoner user message — score-machinery, supersede with §2.0a/§4.1. Recommend removing from the Apollo path.
- Generic 5-step framework — replaced by the core.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Core ~7.4k tokens (29.7KB / 4490 words ÷ ~4 chars/tok) fits cache + reasons well | Summary, delivery form | If real tokenization runs higher, still under the 10–15k soft ceiling; low risk |
| A2 | Persisting rewrites/composite into `variants` JSONB needs no migration (mirrors craft/remix) | Runtime State Inventory | If a typed column is preferred, a migration is added — small scope |
| A3 | Dropping the `calibration-baseline.json` user-message block loses no wanted signal | Infra Preservation | If a non-percentile signal was load-bearing, re-add; grep showed only percentile/duration use |
| A4 | DashScope prefix-cache self-heals on prefix change (no manual purge) | Pitfall 3 | If provider caches aggressively by hash only, no harm — new bytes = new entry |
| A5 | Keeping behavioral 0.40 + apollo 0.35 weights preserves STATE.md determinism band | Composite Score Wiring | If Apollo composite has different variance than gemini, band may shift; validate on a fixed video |

**Note:** The knowledge core's *content claims* (hard numbers, frameworks) are sourced [CITED: .planning/corpus/KNOWLEDGE-CORE.md §8] from the Kallaway corpus + 3-creator benchmark layer and were A/B-validated via the smoke harness — they are the user's curated SSOT, not assumptions of this research.

## Open Questions

1. **Persist target for Apollo rewrites/composite.**
   - What we know: route persists JSONB at `:598`/`:928`; `variants` already holds craft + remix sub-objects.
   - What's unclear: whether the planner wants a typed `apollo` column vs `variants.apollo`.
   - Recommendation: `variants.apollo` (no migration; mirrors P2 craft pattern). Surface composite via existing `overall_score` (the blend output).

2. **CTA-penalty fate when the gemini term leaves the blend (D-04).**
   - What we know: `applyCtaPenalty` modifies `gemini_score` before the blend (aggregator.ts:722).
   - What's unclear: with gemini retired, should the penalty disappear or fold into Apollo critique?
   - Recommendation: drop the separate penalty math; let Apollo's §2.4 CTA lens surface it as critique evidence (cleaner, grounded). Confirm with planner.

3. **Transition vs hard-cut of `behavioral_predictions`/`component_scores`.**
   - What we know: aggregator's `behavioral_score` reads DeepSeek's 7 `component_scores`; behavioral term stays (D-05).
   - What's unclear: does the SAME Apollo call still emit the 7 component scores (for the behavioral term) AND the new dimensions, or does behavioral now come only from wave3 personas?
   - Recommendation: per ENGINE-MAP, behavioral = wave3 personas (S13/S14) until P4. Apollo's component_scores were the *reasoner's* behavioral guess. Keep emitting them for the behavioral term in P3 (additive schema), OR confirm behavioral sources from personas already — **flag for the planner**, as it affects whether the old schema fields stay required.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| DashScope / Qwen API | Apollo + decode + adapt calls | ✓ (in tree, used in P1/P2) | `qwen3.6-plus` default | Circuit breaker → null → graceful degrade |
| `vitest` | Wave-0 + regression tests | ✓ | `^4.0.18` | — |
| `tsx` | smoke/measure scripts | ✓ | in tree | — |
| `ffmpeg` (system) | `apollo-core-smoke.ts` non-mp4 transcode | ✗ unverified | — | Use .mp4 inputs only; smoke is manual, not CI-blocking |
| Supabase (videos bucket + analysis_results) | smoke harness + persist | ✓ (P2 live) | — | — |

**Missing dependencies with no fallback:** None blocking — Apollo runs on the same Qwen path P1/P2 already use.
**Missing with fallback:** `ffmpeg` only affects the optional smoke harness on non-mp4 inputs.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.0.18` |
| Config file | `vitest` (package.json `test` = `vitest run`) |
| Quick run command | `npx vitest run src/lib/engine/__tests__/deepseek.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R2 | Apollo output contains a rewrite whose `original` matches the verbatim hook | unit (mocked Qwen) | `npx vitest run src/lib/engine/__tests__/deepseek.test.ts -t "rewrite original matches verbatim hook"` | ⚠️ extend `deepseek.test.ts` (exists, 17.1K) |
| R2 | Apollo emits 2–3 rewrites, each fixing a DIFFERENT §2 lever | unit | same file, new case | ❌ Wave 0 |
| R2 | Apollo output validates against extended schema (6 dims, composite 0–100, confidence_scope) | unit | `... -t "apollo schema validates"` | ❌ Wave 0 |
| R5 | composite + confidence present + derived (not from dead 7-source blend); no "top X%" string | unit | `npx vitest run src/lib/engine/__tests__/aggregator.test.ts -t "blend uses behavioral + apollo"` | ⚠️ extend `aggregator.test.ts` (44.3K) |
| R5 | blend = behavioral 40 + Apollo (renorm), gemini retired from raw_overall_score | unit | same | ❌ Wave 0 |
| R8 | same-video-twice composite within ±1–2 band (NOT byte-identity) | integration (real video, manual/CI-opt) | `pnpm tsx scripts/measure-pipeline.ts` 2× + diff | exists |
| R12 | decode.ts + adapt.ts system prompts reference the shared core; no divergent base | unit (grep/string assert) | `... -t "decode prompt references KNOWLEDGE_CORE"` | ❌ Wave 0 (new) |
| R12 | decode `DecodeResult` Zod contract unchanged (4 beats + luck≥1) | unit (regression) | existing decode-route + decode tests | ✓ `decode-route.test.ts` |
| R12 | adapt `concepts[3]` contract unchanged | unit (regression) | existing | ✓ pattern in adapt tests |
| D-13 | §5 beats map 1:1 onto `BEAT_IDS` | static assert | `... -t "beat ids match core §5"` | ❌ Wave 0 (cheap) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/engine/__tests__/deepseek.test.ts src/lib/engine/__tests__/aggregator.test.ts`
- **Per wave merge:** `npm test` (full suite — must stay green; remix tests guard D-12)
- **Phase gate:** Full suite green + one real-video `apollo-core-smoke.ts` run showing a verbatim-grounded rewrite, before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] Extend `src/lib/engine/__tests__/deepseek.test.ts` — Apollo schema validation + R2 rewrite-original-matches-verbatim + 2–3-distinct-levers cases
- [ ] Extend `src/lib/engine/__tests__/aggregator.test.ts` — behavioral+apollo blend, gemini retired, renorm math, determinism band
- [ ] New: decode/adapt "references shared core" grep assertion (R12 verify) — tiny new test file or add to existing remix test
- [ ] New: §5-beats ↔ `BEAT_IDS` 1:1 static assert (D-13)
- [ ] Port "outlier = ≥5× follower count" into core §2.0a (content task, gates the creator-rules dormant)

## Security Domain

> `security_enforcement` not set to false in config — included. This phase is server-side engine code with no new user-input surface.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Route auth unchanged (S0 pre-flight handles auth/sub/usage) |
| V3 Session Management | no | Unchanged |
| V4 Access Control | yes (existing) | Route already enforces user_id on persist (`.eq("user_id", user.id)` line 936) — preserve |
| V5 Input Validation | yes | Zod safeParse on ALL LLM output (existing pattern); verbatim is model-derived, not raw user input |
| V6 Cryptography | no | None hand-rolled; DashScope key via env |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via video transcript/verbatim into Apollo | Tampering | Verbatim is in the user message (data role), not system; core instructs "do not invent criteria outside it" (smoke `APOLLO_INSTRUCTION`); output Zod-validated. Low risk — output is structured JSON, not executed. |
| Malformed LLM JSON / oversized output | DoS | `TIMEOUT_MS` (90s) + `MAX_RETRIES` + circuit breaker (existing) |
| Secret leakage into persisted JSONB | Info disclosure | Core contains no secrets; verbatim is public video content; persist path unchanged |

## Sources

### Primary (HIGH confidence)
- `.planning/corpus/KNOWLEDGE-CORE.md` v1.1 — §1 voice, §2/§2.0a frameworks+anchors, §3 anti-patterns, §4 rubric/output-contract, §5 decode lens, §6 rewrite lens, §8 sources/supersede note
- `.planning/corpus/HOW-TO-BUILD.md` — cached-prompt sizing (~3–8k target, ~10–15k ceiling), cached vs RAG decision rule
- `src/lib/engine/deepseek.ts` — STABLE_SYSTEM_PROMPT swap target, 2-message structure, circuit breaker, retries, cost, calibration-load (to drop)
- `src/lib/engine/aggregator.ts` — SCORE_WEIGHTS, selectWeights, behavioral/gemini blend math (D-04 rewire site), verbatim pluck
- `src/lib/engine/remix/decode.ts` + `decode-types.ts` + `decode-prompts.ts` — BEAT_IDS, DecodeResultZodSchema, DECODE_SYSTEM_PROMPT (D-11/D-12/D-13)
- `src/lib/engine/remix/adapt.ts` — ADAPT_SYSTEM_PROMPT, AdaptConceptsZodSchema (D-11/D-12)
- `src/lib/engine/creator-rules.ts` — CREATOR_RULES_NUMERIC/CONSENSUS (D-02 diff source)
- `src/lib/engine/types.ts` — DeepSeekResponseSchema, VerbatimPayload, SuggestionSchema (schema extension target)
- `src/app/api/analyze/route.ts` — persist sites `:598` INSERT + `:928` SSE UPDATE, ENGINE_VERSION wiring
- `scripts/apollo-core-smoke.ts` — validated A/B harness (26–86), APOLLO_INSTRUCTION production-suffix seed
- `.planning/ENGINE-MAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — milestone SSOT, R2/R5/R12, determinism amendment

### Secondary (MEDIUM confidence)
- Tool-verified: core size `wc` (29742 bytes, 4490 words); `QWEN_SEED=7`, `QWEN_REASONING_MODEL=qwen3.6-plus` (client.ts); `vitest@^4.0.18` (package.json); D-02 grep diff (outlier number absent from core)

### Tertiary (LOW confidence)
- None — all claims grounded in the repo or its validated in-tree artifacts.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; reuses verified in-tree Qwen/Zod/Sentry/vitest stack
- Architecture: HIGH — `deepseek.ts` is already the exact target pattern; reframe + additive schema
- Pitfalls: HIGH — derived from concrete file reads + STATE.md determinism amendment + D-02 grep
- D-02 guard: HIGH — concrete diff run; one missing number identified (outlier ≥5× followers)
- D-13 guard: HIGH — exact string match of §5 beats ↔ BEAT_IDS enum

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (stable — internal codebase + curated core; no fast-moving external deps)

## RESEARCH COMPLETE
