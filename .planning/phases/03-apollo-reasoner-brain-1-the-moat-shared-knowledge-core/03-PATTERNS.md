# Phase 3: Apollo Reasoner (Brain 1) — THE MOAT + shared knowledge core - Pattern Map

**Mapped:** 2026-06-05
**Files analyzed:** 8 (1 new, 6 modified, 1 content-only)
**Analogs found:** 8 / 8 (every target reshapes or mirrors an in-tree file — ~90% reuse phase)

> This is a BACKEND/ENGINE phase. No UI. All targets live in `src/lib/engine/` + one route. The dominant insight: `deepseek.ts` IS already the Apollo call pattern (one Qwen call, stable system prefix + volatile user message, temp0+seed, circuit breaker, Zod-validated JSON). P3 swaps content (the core) + extends the schema (additive) + rewires one blend term. Resist rebuilding infra.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/engine/apollo-core.ts` (NEW) | config / constant | transform (build-embed) | `src/lib/engine/creator-rules.ts` (BYTE-STABILITY CONTRACT) + `deepseek.ts` STABLE_SYSTEM_PROMPT | exact (pattern, not file) |
| `src/lib/engine/deepseek.ts` (MODIFY) | service (reasoner) | request-response (single LLM call) | itself (reframe in place) | exact |
| `src/lib/engine/types.ts` (MODIFY) | model / schema | transform (Zod) | `DeepSeekResponseSchema` + sibling schemas in same file | exact |
| `src/lib/engine/aggregator.ts` (MODIFY) | service (score blend) | transform (pure TS math) | itself — `SCORE_WEIGHTS` / `selectWeights` / `raw_overall_score` | exact |
| `src/lib/engine/remix/decode-prompts.ts` (MODIFY) | config (prompt) | request-response | itself — `DECODE_SYSTEM_PROMPT` | exact |
| `src/lib/engine/remix/adapt.ts` (MODIFY) | service + prompt | request-response | itself — `ADAPT_SYSTEM_PROMPT` + `generateAdaptConcepts` | exact |
| `src/lib/engine/creator-rules.ts` (DORMANT) | config (constant) | n/a (move to `_dormant/`) | `_dormant/` convention (P1/P2) | role-match |
| `.planning/corpus/KNOWLEDGE-CORE.md` (MODIFY) | content (SSOT) | n/a (port one number) | n/a — content task | n/a |
| `src/app/api/analyze/route.ts` (MODIFY) | route (persist) | CRUD (Supabase write) | `buildInsertRow` + craft/decode `variants` read-merge-write | exact |
| `src/lib/engine/version.ts` (MODIFY) | config | n/a (bump const) | itself | exact |
| `src/lib/engine/__tests__/deepseek.test.ts` + `aggregator.test.ts` (EXTEND) | test | n/a | existing test files | exact |

---

## Pattern Assignments

### `src/lib/engine/apollo-core.ts` (NEW — config/constant, byte-stable transform)

**Analog:** `src/lib/engine/creator-rules.ts` (BYTE-STABILITY CONTRACT header) + `deepseek.ts:30-109` (STABLE_SYSTEM_PROMPT shape).

**Byte-stability contract header to copy** (`creator-rules.ts:1-17`):
```typescript
/**
 * BYTE-STABILITY CONTRACT: every export here is a build-time constant string with
 * NO interpolation of Date.now()/Math.random()/per-request data. It is safe to
 * embed via template literal in a cache-stable prefix — the result stays
 * byte-identical across requests, preserving Qwen automatic input-cache hits.
 *
 * When `creator-intelligence.md` changes, update these constants in lockstep.
 */
```
→ For apollo-core.ts, retitle the source-of-truth note to `.planning/corpus/KNOWLEDGE-CORE.md` + the regen command (RESEARCH "Code Examples" recommends `pnpm gen:core` + CI check that the generated constant matches the markdown).

**Constant composition pattern** (`creator-rules.ts:111-117` composed block; RESEARCH:325-328 target form):
```typescript
export const KNOWLEDGE_CORE = `# Apollo Knowledge Core — v1.1 ...`; // full core, build-embedded
export const APOLLO_INSTRUCTION = `You are Apollo ... Follow the §4 OUTPUT CONTRACT exactly ...`;
// module-level const → byte-identical every call:
export const APOLLO_SYSTEM_PROMPT = `${KNOWLEDGE_CORE}\n\n---\n\n${APOLLO_INSTRUCTION}`;
```
- `APOLLO_INSTRUCTION` seed = `scripts/apollo-core-smoke.ts` `APOLLO_INSTRUCTION` (validated A/B, 26–86). Lift it as the production suffix.
- **Anti-pattern (RESEARCH:187):** ZERO interpolation in any export here. No verbatim, no creator context, no platform name, no Date.now(). That all lives in the user message.

---

### `src/lib/engine/deepseek.ts` (MODIFY — service/reasoner, single LLM call)

**Analog:** itself — reframe in place. Keep the entire infra spine.

**The call structure to KEEP verbatim** (`deepseek.ts:479-491`):
```typescript
const response = await ai.chat.completions.create(
  {
    model: DEEPSEEK_MODEL,                          // = QWEN_REASONING_MODEL (qwen3.6-plus)
    messages: [
      { role: "system", content: STABLE_SYSTEM_PROMPT }, // SWAP → APOLLO_SYSTEM_PROMPT (apollo-core.ts)
      { role: "user",   content: userMessage },          // verbatim + sensor signals here ONLY
    ],
    response_format: { type: "json_object" },
    temperature: 0,         // D-10: deterministic — score + critique + rewrites one call
    seed: QWEN_SEED,
  },
  { signal: controller.signal }
);
```

**Retry-nudge-on-USER-message (preserve — Pattern 3, RESEARCH:182-184)** (`deepseek.ts:471-474`):
```typescript
const userMessage =
  attempt === 0
    ? baseUserMessage
    : `Your previous response was not valid JSON. Return ONLY the JSON object...\n\n${baseUserMessage}`;
```
→ Never append the nudge to the system prefix (would break the byte-stable cache prefix across the retry).

**Parse + Zod safeParse + throw pattern (Pattern 2)** (`deepseek.ts:284-299`):
```typescript
function stripFences(text: string): string { /* matches ```json fences */ }
function parseDeepSeekResponse(raw: string): DeepSeekReasoning {
  const cleaned = stripFences(raw);
  const parsed = JSON.parse(cleaned);
  const result = DeepSeekResponseSchema.safeParse(parsed); // → extend schema (types.ts)
  if (!result.success) throw new Error(`...validation failed: ${result.error.message}`);
  return result.data;
}
```
→ Add the **post-parse backstop** (Pattern 2, RESEARCH:266): assert `rewrites.length >= 2`, normalize-whitespace-compare each `rewrite.original` to the fed verbatim hook (Pitfall 4 — if mismatch, set `original` from the fed verbatim in TS, not the model), clamp `composite_score` to 0–100, assert exactly 6 dimensions.

**KEEP (roadmap "Does", RESEARCH:283-285):** circuit breaker (`deepseek.ts:111-282` — status/backoff/half-open + HARD-04 probe mutex), `MAX_RETRIES=2` + exponential backoff (`544-546`), `calculateCost` + soft-cap warn (`501-508`), Sentry capture (`555`), `TIMEOUT_MS=90_000` (`27`).

**Verbatim threading (R2 load-bearing — RESEARCH:268-274):**
- Extend `DeepSeekInput` interface (`deepseek.ts:436-442`) with `verbatim?: VerbatimPayload | null`.
- Emit it in `buildDeepSeekUserMessage` (`deepseek.ts:383-434`), the VOLATILE user message only — NEVER the system prefix.
- `rewrite.original` fills from `verbatim.hook.spoken_words` (fallback `on_screen_text`).

**REMOVE (cleanup, RESEARCH:285):** `loadCalibrationData()` (`deepseek.ts:312-335`), the `DeepSeekCalibrationData`/Schema/FALLBACK blocks (`133-226`), and the viral-differentiators + duration-sweet-spot block in `buildDeepSeekUserMessage` (`387-431`) — score-machinery percentile scaffolding the core's §2.0a/§4.1 supersedes. `calibration-baseline.json` no longer read.

---

### `src/lib/engine/types.ts` (MODIFY — model/schema, additive Zod extension)

**Analog:** the existing schema cluster in the SAME file — copy its idioms.

**Existing schema to extend** (`types.ts:726-732`):
```typescript
export const DeepSeekResponseSchema = z.object({
  behavioral_predictions: BehavioralPredictionsSchema,  // KEEP (behavioral term, D-05) — see Open Q3
  component_scores: ComponentScoresSchema,              // KEEP (feeds behavioral_score blend)
  suggestions: z.array(SuggestionSchema).min(1),
  warnings: z.array(z.string()).default([]),
  confidence: z.enum(["high", "medium", "low"]),       // already present (D-06 confidence)
});
```

**Additive extension to write** (RESEARCH:243-265 — mirror local `z.object`/`z.enum`/`.min().max()` style, e.g. `ComponentScoresSchema:714-722`):
```typescript
const ApolloDimensionSchema = z.object({
  name: z.enum(["hook","retention","clarity","share_pull","substance","credibility"]),
  band: z.enum(["strong","mid","weak"]),
  lever: z.string().min(1),      // §2 lever named
  evidence: z.string().min(1),   // quoted sensor signal
});
const ApolloRewriteSchema = z.object({
  original: z.string().min(1),   // MUST equal verbatim hook (R2 verify) — backstop in deepseek.ts
  variant: z.string().min(1),
  lever_fixed: z.string().min(1),// DIFFERENT §2 lever per variant (D-08)
});
// extend DeepSeekResponseSchema additively:
//   dimensions: z.array(ApolloDimensionSchema).length(6),  (D-06)
//   composite_score: z.number().min(0).max(100),           (the "Apollo term" — D-04)
//   ceiling_capper: z.string().min(1),
//   confidence_scope: z.string().min(1),
//   rewrites: z.array(ApolloRewriteSchema).min(2).max(3),   (D-08)
//   platform_note: z.string().optional(),                   (S12 watermark/cross-post)
```
→ **Additive only** — keep `behavioral_predictions`/`component_scores` required during transition (Open Q3 flag: confirm whether Apollo still emits the 7 component scores or behavioral now sources only from wave3 personas).

**Reuse:** `VerbatimPayload` already defined (`types.ts:29-36`) — thread it through, do NOT redefine.

---

### `src/lib/engine/aggregator.ts` (MODIFY — service/blend, pure TS transform)

**Analog:** itself — `SCORE_WEIGHTS` + `selectWeights` + `raw_overall_score`. The D-04 rewire keeps the math STRUCTURALLY unchanged (preserves STATE.md determinism band).

**Weights config to rewire** (`aggregator.ts:71-80`):
```typescript
export const SCORE_WEIGHTS = {
  behavioral: 0.40,
  gemini:     0.35,   // → rename term to `apollo: 0.35` (KEEP the 0.35 value — RESEARCH:230)
} as const;
export const SCORE_WEIGHT_KEYS = ["behavioral", "gemini"] as const; // → ["behavioral","apollo"]
```
→ Keeping the 0.35 weight on the Apollo term preserves the 53.3/46.7 renorm split → satisfies STATE.md "derivation structurally unchanged."

**Renorm helper (keep structure, rename key)** (`aggregator.ts:157-181`):
```typescript
export function selectWeights(availability: SignalAvailability): { behavioral: number; gemini: number } {
  // both present → normalize 0.40/0.35 → 0.533/0.467
  // one missing → full weight to the available source
}
```
→ Rename `gemini`→`apollo` key throughout; keep `gemini` as a provenance-only flag (like `ml`/`rules`/`trends`).

**Blend math to rewire** (`aggregator.ts:683-757`):
```typescript
const behavioral_score = Math.round(behavioralAvg * 10);   // KEEP (D-05 — behavioral stays its own term)
const gemini_score = Math.round(geminiAvg * 10);           // KEEP computed + surfaced (back-compat) ...
// ... but DROP from raw_overall_score. New apollo term:
//   const apollo_score = deepseekResult.reasoning.composite_score; (new 0-100 field)
const raw_overall_score = Math.min(100, Math.max(0, Math.round(
  behavioral_score * weights.behavioral +
    apollo_score * weights.apollo            // was: ctaPenaltyApplied_gemini_score * weights.gemini
)));
```

**CTA penalty fate (Open Q2, RESEARCH:374-377):** `applyCtaPenalty` (`aggregator.ts:131-141`, fired at `722`) modifies `gemini_score` before the blend. With gemini retired from the blend, recommend DROPPING the separate penalty math; surface CTA via Apollo's §2.4 critique evidence. Confirm with planner.

**Confidence derivation (Claude's discretion, RESEARCH:276-281):** reuse `calculateConfidence` (`aggregator.ts:194`) signal-availability component; replace the gemini-vs-behavioral agreement check with Apollo-composite-vs-behavioral direction agreement; keep HARD-03 LOW-floor on dual failure.

**Verbatim pluck already exists** (`aggregator.ts:534-551`): `verbatim.hook` sourced from `geminiResult.analysis.hook_verbatim`; per-segment derived after `:866`. Thread this `verbatim` into the new `DeepSeekInput.verbatim`.

---

### `src/lib/engine/remix/decode-prompts.ts` (MODIFY — config/prompt, R12 re-ground)

**Analog:** itself — `DECODE_SYSTEM_PROMPT`. D-11: swap the *framework*, keep the *contract* (D-12).

**Re-ground pattern (RESEARCH:332-339):** prepend the shared core, keep the voice contract + JSON schema unchanged:
```typescript
import { KNOWLEDGE_CORE } from "../apollo-core";
export const DECODE_SYSTEM_PROMPT = `${KNOWLEDGE_CORE}\n\n---\n\n` +
  `Apply the §5 Decode Lens. Separate repeatable craft from unrepeatable luck. ` +
  `Return EXACTLY 4 beats (hook_pattern §2.1 · structure_pacing §2.2 · the_turn §2.2 head-fake · emotional_beat §2.3) ` +
  `[existing voice contract + JSON schema from decode-prompts.ts:29-81 UNCHANGED]`;
```
- **KEEP unchanged (D-12):** the Voice Contract (`decode-prompts.ts:29-34`), Beat Requirements (`37-46`), Luck taxonomy (`52-62`), the JSON Output Schema block (`66-79`), and `buildDecodeContext` (`97-174`).
- **R12 verify:** `DECODE_SYSTEM_PROMPT` must reference `KNOWLEDGE_CORE` (grep assertion).
- **D-13 (VERIFIED):** §5's 4 beats map 1:1 onto `BEAT_IDS` (`decode-types.ts:27,29`) — exact string match `hook_pattern / structure_pacing / the_turn / emotional_beat`. Zero schema drift; `luck[]` taxonomy fully grounded in §5.

---

### `src/lib/engine/remix/adapt.ts` (MODIFY — service+prompt, R12 re-ground)

**Analog:** itself — `ADAPT_SYSTEM_PROMPT` + `generateAdaptConcepts`. D-11 re-ground core §6+§2, D-12 keep `concepts` contract.

**Re-ground pattern** — prepend core to the framework, keep the RULES + OUTPUT shape (`adapt.ts:30-50`):
```typescript
import { KNOWLEDGE_CORE } from "@/lib/engine/apollo-core";
export const ADAPT_SYSTEM_PROMPT = `${KNOWLEDGE_CORE}\n\n---\n\n` +
  `Apply the §6 Rewrite Lens + §2 frameworks for FORMAT adaptation. ` +
  `[existing RULES + OUTPUT JSON shape from adapt.ts:33-50 UNCHANGED]`;
```
- **KEEP unchanged (D-12):** `AdaptConceptZodSchema` (`adapt.ts:56-61`), `AdaptConceptsZodSchema.length(3)` (`63-65`), `buildAdaptUserContent` (`77-98`), the whole `generateAdaptConcepts` call structure (`110-170`).
- The call already mirrors the Apollo pattern: temp0+seed, json_object, retry-nudge-on-extraInstruction (`adapt.ts:119-127`), Sentry on final failure (`167`).
- **R12 verify:** `ADAPT_SYSTEM_PROMPT` references `KNOWLEDGE_CORE` (grep assertion).
- **Caveat:** the nudge is concatenated onto the SYSTEM message here (`adapt.ts:127`), not the user message like decode/deepseek. With the core now in the prefix, move the nudge to the USER message to preserve byte-stable prefix caching (align with `decode.ts:67` + `deepseek.ts:471`).

---

### `src/lib/engine/creator-rules.ts` (DORMANT after D-02 port)

**Analog:** the `_dormant/` move convention (P1/P2; dir exists at `src/lib/engine/_dormant/`).

- **D-01:** dormant `CREATOR_RULES_BLOCK`/`CREATOR_RULES_NUMERIC`/`CREATOR_RULES_CONSENSUS`/etc. — no dual knowledge base.
- **D-02 GUARD (gating — VERIFIED missing):** before the move, port **"outlier = ≥5× follower count in views (Ava)"** (`creator-rules.ts:65`, Numeric row #1) into KNOWLEDGE-CORE.md §2.0a. The other 8 of 9 video-scoreable numbers already carry; the rest are channel/business-strategy rows §8 parks by design. NO silent number loss.
- **D-03:** `creator-rulebook.ts` is UNTOUCHED (separate deterministic UI checker).

---

### `.planning/corpus/KNOWLEDGE-CORE.md` (MODIFY — content task, gates the dormant)

Port the one missing hard number into §2.0a (or §5's luck lens where "algorithmic outlier" already lives): **"outlier = ≥5× follower count in views (Ava)"**. Content-only task; no code analog. This GATES `creator-rules.ts` dormanting (D-02).

---

### `src/app/api/analyze/route.ts` (MODIFY — route/persist, CRUD)

**Analog:** `buildInsertRow` + the craft/decode `variants` read-merge-write helpers in the SAME file.

**Persist row builder to extend** (`route.ts:512-540`):
```typescript
const buildInsertRow = (finalResult, _ruleContributions) => ({
  user_id: user.id,
  overall_score: finalResult.overall_score,       // = new behavioral+apollo blend
  reasoning: finalResult.reasoning,               // Apollo's extended output threads here
  engine_version: finalResult.engine_version,     // bumped (version.ts)
  // ... rewrites/composite recommended into variants.apollo (Open Q1, RESEARCH:369-372)
});
```
Used by BOTH persist branches: JSON INSERT (`route.ts:642`) + SSE UPSERT (`route.ts:863-865`, `onConflict: "id"`).

**variants read-merge-write pattern to copy** for `variants.apollo` (`route.ts:176-190`, the decode persist):
```typescript
const { data: row } = await service.from(...).select("variants")...;        // read
const current = (row.variants ?? {}) as Record<string, unknown>;             // preserve siblings
await service.from(...).update({ variants: { ...current, apollo } as unknown as Json })...; // merge-write
```
→ Recommendation (RESEARCH:369-372): rewrites/composite → `variants.apollo` (no migration; mirrors P2 craft). Composite surfaces via existing `overall_score`. **V4 access control:** preserve `.eq("user_id", user.id)` on persist (`route.ts:936`).

---

### `src/lib/engine/version.ts` (MODIFY — config bump)

**Analog:** itself. Bump `ENGINE_VERSION = "3.2.0"` → `"3.3.0"` (`version.ts:11`). Cache keys on it (`prediction-cache.ts`); P2 set the 3.1.0→3.2.0 precedent. Pitfall 3: skip the bump → stale pre-Apollo scores served. Update the doc-comment lineage block (`version.ts:1-10`).

---

## Shared Patterns

### Byte-stable system prefix / volatile user split (the caching contract)
**Source:** `creator-rules.ts:11-17` (contract header) + `deepseek.ts:30-39, 479-491`.
**Apply to:** apollo-core.ts, deepseek.ts, decode-prompts.ts, adapt.ts.
**Rule:** system message = byte-identical core every call (cache-hit). User message = ALL per-request dynamic content (verbatim, sensor signals, niche). ZERO interpolation in the prefix.
```typescript
messages: [
  { role: "system", content: APOLLO_SYSTEM_PROMPT },     // byte-stable module const
  { role: "user",   content: buildApolloUserMessage(ctx) }, // verbatim + signals ONLY here
],
```

### Zod safeParse + pure-TS backstop (output-contract guard)
**Source:** `decode.ts:95-125` (safeParse → retry → post-parse backstop).
**Apply to:** deepseek.ts (Apollo output), and preserved as-is in decode.ts/adapt.ts.
```typescript
parsed = DecodeResultZodSchema.safeParse(JSON.parse(text));
if (!parsed.success) { /* attempt 0→1 retry with extraInstruction on USER msg */ }
// AFTER parse: defensively backstop required invariants (luck.length, beats===4, etc.)
```
For Apollo: assert `rewrites[*].original` matches fed verbatim hook (normalize whitespace; fill from TS on mismatch — Pitfall 4), `dimensions.length===6`, clamp composite 0–100.

### Retry-nudge on the USER message, never the system prefix
**Source:** `deepseek.ts:471-474`, `decode.ts:67`. (`adapt.ts:127` puts it on system — fix when core lands.)
**Apply to:** every re-grounded call. Preserves the byte-stable cache prefix across the retry.

### Single deterministic Qwen call (temp0 + seed)
**Source:** `deepseek.ts:487-488`, `decode.ts:80-81`, `adapt.ts:131-132`.
**Apply to:** Apollo (D-10 — one call for score+critique+rewrites), decode, adapt.
```typescript
response_format: { type: "json_object" }, temperature: 0, seed: QWEN_SEED, // QWEN_SEED = 7
```

### Graceful-degrade resilience (circuit breaker / Sentry / null-return)
**Source:** `deepseek.ts:111-282` (full breaker), `decode.ts:148-154` + `adapt.ts:167-169` (Sentry-on-final-failure → return null).
**Apply to:** Apollo keeps the full breaker; remix calls keep their lighter Sentry+null pattern (DON'T add a breaker to remix).

### variants read-merge-write persistence
**Source:** `route.ts:131-147` (craft), `route.ts:176-190` (decode).
**Apply to:** persisting Apollo rewrites/composite → `variants.apollo` (read current, spread, write — avoids clobbering concurrent craft/remix writers).

### ENGINE_VERSION bump on engine change
**Source:** `version.ts:11` + P2 precedent.
**Apply to:** the blend-rewire plan. 3.2.0 → 3.3.0.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | Every target reshapes or directly mirrors an in-tree file. This is a ~90%-reuse reframe phase — `deepseek.ts` is already the exact Apollo call pattern; the only novel artifact is `apollo-core.ts`, and even it copies the `creator-rules.ts` byte-stability contract + `deepseek.ts` STABLE prompt shape. |

> The genuinely NEW work is **content** (the core — already built + A/B-validated) + an **additive schema extension** + **one blend-term rewire**. No new infrastructure.

---

## Metadata

**Analog search scope:** `src/lib/engine/`, `src/lib/engine/remix/`, `src/lib/engine/__tests__/`, `src/app/api/analyze/route.ts`
**Files read in full or targeted:** deepseek.ts, creator-rules.ts, version.ts, remix/decode-prompts.ts, remix/decode.ts, remix/adapt.ts (full); aggregator.ts (60-189, 680-764); types.ts (25-39, 626-745); route.ts (510-569 + grep persist sites); decode-types.ts (grep BEAT_IDS)
**Skills checked:** none present (`.claude/skills` / `.agents/skills` absent)
**Pattern extraction date:** 2026-06-05

---

## PATTERN MAPPING COMPLETE

**Phase:** 3 - Apollo Reasoner (Brain 1) — THE MOAT + shared knowledge core
**Files classified:** 11 (1 new, 6 source modifies, 1 content, 1 route, 1 version, 2 test extends)
**Analogs found:** 8 / 8 targets (every code target has an exact in-tree analog)

### Coverage
- Files with exact analog: 7
- Files with role-match analog: 1 (creator-rules dormant → `_dormant/` convention)
- Files with no analog: 0 (content-only KNOWLEDGE-CORE.md port excluded)

### Key Patterns Identified
- `deepseek.ts` IS the Apollo call — reframe in place: swap STABLE_SYSTEM_PROMPT → APOLLO_SYSTEM_PROMPT, extend `DeepSeekResponseSchema` additively, thread verbatim into the user message only; keep circuit breaker/retries/cost/Sentry.
- Byte-stability contract is the load-bearing caching pattern across all 4 LLM-call sites (apollo-core, deepseek, decode-prompts, adapt) — zero interpolation in the system prefix; all dynamic data in the user message.
- Score blend rewire is structurally unchanged: rename `gemini` weight key → `apollo` (keep 0.35 value), point the term at `composite_score`, retire gemini from `raw_overall_score` — preserves the 53.3/46.7 renorm + STATE.md determinism band.
- Two guards VERIFIED: D-13 §5 beats map 1:1 onto `BEAT_IDS` (exact string match, zero drift); D-02 one number missing — "outlier = ≥5× follower count" (`creator-rules.ts:65`) must port into core §2.0a BEFORE dormanting.
- Persist via `variants.apollo` read-merge-write (mirrors craft/decode helpers — no migration) + ENGINE_VERSION 3.2.0 → 3.3.0.

### File Created
`/Users/davideloreti/virtuna-engine-opt/.planning/phases/03-apollo-reasoner-brain-1-the-moat-shared-knowledge-core/03-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can reference exact analog files + line ranges in each plan's action section.
