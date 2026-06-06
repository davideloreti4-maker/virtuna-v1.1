# Phase 2: Omni Verbatim - Research

**Researched:** 2026-06-04
**Domain:** Qwen-Omni video-analysis schema/prompt extension + 4-hop threading + Supabase persistence (Next.js 15 / TS / Supabase)
**Confidence:** HIGH (every claim traced to current repo source, line numbers re-verified this session)

## Summary

P2 is a purely **additive** extension of the single Qwen-Omni call: add `hook_verbatim {spoken_words, on_screen_text}` (first ~3s) + per-segment `spoken_text`/`on_screen_text`, thread them through the exact `emotion_arc` precedent (4 hops: schema → omni-analysis assembly → aggregator pluck → analyze-route persist), bump the engine cache key, and prove persistence on a real run. All existing 0–10 judgment fields stay (drop is P3, D-01). The `emotion_arc` path is the line-by-line template — and it carries a documented cautionary bug: the field was once silently dropped at the assembly hop (hop 1→2), nulling 26/26 prod rows despite the prompt marking it REQUIRED. That hop is now fixed and the fix is annotated inline in `omni-analysis.ts:249–257`.

The cache mechanism is fully resolved and trivial: `ENGINE_VERSION` is a single constant in `src/lib/engine/version.ts` (currently `"3.1.0"`), and the prediction cache keys on it both in L1 (`cacheKey()` template) and L2 (`.eq("engine_version", ENGINE_VERSION)` Supabase filter). Bumping that one constant auto-invalidates every stale pre-verbatim cached row. The remix `decode` path consumes Omni via `omniOutputToStructuralInput`, which reads a **fixed allowlist** of fields — new verbatim fields are invisible to it, so additive P2 cannot regress `/api/remix/adapt`.

**Persistence recommendation:** ride verbatim inside the existing `analysis_results.variants` JSONB bag (the `variants.craft` pattern), NOT a dedicated column — UNLESS the planner wants a query-clean R1 proof, in which case mirror `emotion_arc` with one minimal `ADD COLUMN verbatim JSONB`. See §Persistence Decision for the tradeoff and my concrete recommendation.

**Primary recommendation:** Copy the `emotion_arc` shape verbatim across all 4 hops; add one `verbatim` JSONB column via a minimal migration (mirrors `20260531000000`); bump `ENGINE_VERSION` to `3.2.0`; clone `omni-analysis-emotion-arc.test.ts` into a `verbatim` regression test that asserts the assembly hop survives + the null/[inaudible] contract; verify with one real `analyze` run + a DB query.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 — Additive-only; defer judgment-field drop to P3.** P2 ADDS verbatim, KEEPS all existing 0–10 judgment fields (`factors`, `hook_decomposition`, `video_signals`, `cta_segment`, `audio_signals`, etc.). Score keeps deriving exactly as today (`behavioral + gemini` blend). Do NOT remove or repoint any score-blend inputs in P2. Edits are purely additive to Omni schema + prompt + threading path.
- **D-02 — Empty/absence contract: honest `null`, never fabricate.** No speech / no on-screen text → field is `null`/absent, never a paraphrase or description (NOT `"[upbeat music plays]"`). R1's "non-empty verbatim" verify applies only to speech/text-bearing videos; a silent video yielding `null` is a PASS. Fields `.optional()` on Zod (mirrors emotion_arc).
- **D-03 — Shape & granularity.** Top-level `hook_verbatim { spoken_words, on_screen_text }` for first ~3s (R2's clean `original` target) + `spoken_text` + `on_screen_text` on EACH segment (R3 per-segment). `on_screen_text` captures all overlay text verbatim per segment. Hook-zone segment text and `hook_verbatim` may overlap by design — `hook_verbatim` is canonical hook target; segment text is the timeline.
- **D-04 — Transcription fidelity rules (lock as prompt constraints — all four):**
  - D-04.1 Original language: transcribe in spoken language; do NOT translate.
  - D-04.2 Mark uncertain audio: present-but-unclear speech → inline `[inaudible]` marker, never guess. DISTINCT from D-02's `null`: `null` = nothing to hear; `[inaudible]` = speech exists but unintelligible. Must not collide; flag that `[inaudible]` must not leak as a quotable `original` into Apollo rewrites (P3 concern).
  - D-04.3 Preserve casing & punctuation: keep ALL-CAPS overlays, punctuation, emoji in `on_screen_text`.
  - D-04.4 Cap field length: `z.string().max(N)` — hook fields ~280, per-segment `spoken_text`/`on_screen_text` ~500 each. Cap = safety ceiling, not expected length.

### Claude's Discretion
- **Persistence target:** dedicated DB column(s) vs riding inside the existing analysis JSON blob. R1's "persists non-empty verbatim fields" must be queryable either way; if a migration is added, keep it minimal.
- **Exact cap values** (280/500 are recommendations).
- **Whether `hook_verbatim` is emitted independently vs derived from hook-zone segment** (D-03.4 — prompt likely emits both; cheap).
- **Whether to add a short transcription example** to the prompt to anchor the model (likely helpful for fidelity, non-blocking).
- **Threading mechanics** — follow the emotion_arc precedent exactly.

### Deferred Ideas (OUT OF SCOPE)
- Dropping the ~15 0–10 judgment fields → P3.
- Apollo rewrites quoting verbatim `original` + variants → P3 (R2). Includes guarding `[inaudible]`/`null` leak.
- Audience-Sim fed per-segment transcript → P4 (R3).
- Remix `decode`/`adapt` grounded on verbatim + shared core → P3 (R12). P2 only verifies NO remix regression.
- Translation of foreign-language verbatim → out of milestone.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R1 | Senses emit words — Omni returns `hook_verbatim` + per-segment `spoken_text`/`on_screen_text` (verbatim, not paraphrase). _Verify: a video run persists non-empty verbatim fields._ | 4-hop threading path traced line-by-line (§Architecture); persistence options + recommendation (§Persistence Decision); real-run DB-query proof (§Validation Architecture). |
| R8 | Determinism preserved — temp 0 + seed on every surviving call; same video → same output. | `temperature: 0` + `seed: QWEN_SEED` confirmed at `omni-analysis.ts:195–196`; `QWEN_SEED = 7` at `client.ts:28`. Determinism is a tolerance band (STATE.md), not byte-identity. Adding OUTPUT fields to the system prompt does not change the determinism contract. §Determinism. |
| R12 | One brain across modes — remix decode/adapt feed verbatim. P2 = no-regression verify ONLY; consumption is P3. | `omniOutputToStructuralInput` (decode.ts:176) reads a fixed allowlist; verbatim is invisible additive. §Remix No-Regression. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Verbatim transcription emission | API / Backend (Qwen-Omni call) | — | The model is the sensor; prompt + schema live server-side in `src/lib/engine/qwen/`. |
| Schema validation of new fields | API / Backend (Zod) | — | `OmniAnalysisZodSchema.safeParse` runs in `omni-analysis.ts` before assembly. |
| Threading verbatim onto result | API / Backend (assembly + aggregator) | — | Pure server data-flow; the documented bug-prone hop. |
| Verbatim persistence | Database / Storage (Supabase) | API (insert row) | `analysis_results` row; column-or-blob choice. |
| Cache invalidation | API / Backend (ENGINE_VERSION) | Database (L2 filter) | One constant gates both L1 template + L2 Supabase filter. |
| Determinism preservation | API / Backend (Qwen client) | — | temp0+seed set at call site. |

## Standard Stack

No new packages. This phase edits existing engine code only. Stack already in place:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | (in repo) | Schema validation of Omni output | Already used for `OmniAnalysisZodSchema`; `.optional()`/`.max()` idioms in place |
| `openai` | (in repo) | DashScope/Qwen client (`ai.chat.completions.create`) | Already the Omni transport (`client.ts`) |
| `@supabase/supabase-js` | (in repo) | `analysis_results` persistence | Already the DB layer |

**No `npm install`. No Package Legitimacy Audit needed — zero new external packages.**

## Persistence Decision (Claude's Discretion input)

Two viable targets, both already proven in this exact route:

### Option A — Dedicated JSONB column (the `emotion_arc` pattern)
- **Migration:** mirror `supabase/migrations/20260531000000_persist_engine_emitted_columns.sql` — `ALTER TABLE public.analysis_results ADD COLUMN IF NOT EXISTS verbatim JSONB;` + a `COMMENT ON COLUMN`.
- **Insert:** add `verbatim: (finalResult.verbatim ?? null) as unknown as Json` to **both** insert sites: `buildInsertRow` (route.ts ~594 cluster) AND the SSE safety-net UPDATE (route.ts ~921 cluster). [VERIFIED: route.ts:594 + 921 — emotion_arc is written in BOTH places; missing one leaves stale rows on the streaming path.]
- **DB types:** regenerate `src/types/database.types.ts` (or hand-add `verbatim?: Json | null` to the Row/Insert/Update — emotion_arc appears at lines 197/251/305).
- **R1 proof:** trivially queryable — `select id, verbatim from analysis_results where id = '<run>'`.
- **Cost:** one migration + types regen.

### Option B — Ride inside `variants` JSONB (the `variants.craft` pattern)
- **No migration.** Use `persistCraftToVariants`-style read-merge-write (route.ts:109–152): `variants: { ...current, verbatim } as unknown as Json`.
- **R1 proof:** queryable but nested — `select variants->'verbatim' from analysis_results where id = '<run>'`.
- **Caveat:** `variants` already has concurrent writers (`craft`, `filmstrip_segments`, `remix.decode`) that all use read-merge-write to avoid clobbering (T-03-04 note, route.ts:165). Adding a 4th writer means another read-merge-write site and another race surface. Verbatim is produced inline in the aggregator (like `emotion_arc`), so it can ride the SAME write as the row insert — it does NOT need a deferred merge like craft does.

### Recommendation: **Option A (dedicated `verbatim` JSONB column).**
Rationale: (1) verbatim is produced inline by the aggregator exactly like `emotion_arc` — so the dedicated-column path is a 1:1 copy of an already-working precedent, no new write-race surface; (2) R1's "persists non-empty verbatim fields" verify is cleaner against a top-level column than a nested `variants->'verbatim'`; (3) verbatim is a first-class downstream input for P3 (Apollo `original` target) and P4 (Audience-Sim) — a real column signals that and is index/query-friendly when those phases land; (4) the migration is genuinely minimal (one `ADD COLUMN IF NOT EXISTS`, no backfill — historical rows stay NULL, identical to the emotion_arc migration's stated policy). `variants` is the right home for ephemeral/board-only signals (craft); verbatim is core sensor data. **Leave the final call to the planner** per Discretion, but A is the lower-risk, higher-clarity path.

## Architecture Patterns

### The 4-Hop Threading Path (the emotion_arc precedent, line-by-line)

```
Qwen-Omni model output (JSON)
   │  (1) Zod parse — schemas.ts
   ▼
OmniAnalysisZodSchema.safeParse(parsed)   ← schemas.ts:206 call; field declared schemas.ts:152
   │  (2) ASSEMBLY — omni-analysis.ts  ← ⚠️ THE BUG-PRONE HOP
   ▼
const analysis = { ...factors, ..., emotion_arc: data.emotion_arc } as GeminiVideoAnalysis  ← omni-analysis.ts:236–258
   │     returned as geminiResult.analysis
   ▼
   │  (3) AGGREGATOR PLUCK — aggregator.ts
   ▼
const arcRaw = (geminiResult.analysis as unknown as { emotion_arc? }).emotion_arc  ← aggregator.ts:523–531
   ... threaded onto PredictionResult ............................. ← aggregator.ts:925
   │  (4) PERSIST — analyze/route.ts
   ▼
buildInsertRow: emotion_arc: (finalResult.emotion_arc ?? null) as unknown as Json  ← route.ts:594 (INSERT)
SSE safety-net UPDATE: emotion_arc: (finalResult.emotion_arc ?? null) as unknown as null  ← route.ts:921 (UPSERT)
```

**The documented bug (cautionary precedent):** Hop (2) once OMITTED `emotion_arc` from the assembled `analysis` object. Zod parsed it fine, but the assembly dropped it before the aggregator could pluck it → `emotion_arc` was null on 100% of persisted rows despite the prompt marking it REQUIRED (**26/26 prod rows null**, confirmed). The fix + a do-not-remove warning are annotated inline at `omni-analysis.ts:249–257`. **Verbatim must add itself to the SAME assembly object** (hop 2) or it will silently vanish the same way.

**Why the `as GeminiVideoAnalysis` cast:** `GeminiVideoAnalysis` (types.ts) does not declare `emotion_arc` — it's an Omni-only extension. The assembly casts the object so the extra field rides through; the aggregator reads it back with a matching `as unknown as { emotion_arc? }` narrow cast. Verbatim follows the identical "rides the cast" mechanism — no need to add it to the base `GeminiVideoAnalysis` interface (though adding `verbatim?` to `PredictionResult` in types.ts IS recommended, like `emotion_arc?` at types.ts:268, so the route reads it type-safely).

### Pattern: Schema extension (mirror schemas.ts:150–164)

```typescript
// Source: src/lib/engine/qwen/schemas.ts (emotion_arc + segments idiom)
// Top-level hook verbatim — .optional() backward-compat (D-02.3, A3 precedent)
hook_verbatim: z.object({
  spoken_words:   z.string().max(280).nullable().optional(),   // null = silence (D-02); [inaudible] allowed inline (D-04.2)
  on_screen_text: z.string().max(280).nullable().optional(),
}).optional(),

// Per-segment fields — add to the inline segment object at schemas.ts:157–163
// (note: OmniAnalysisZodSchema.segments uses an INLINE shape, NOT the exported SegmentSchema —
//  there are TWO segment shapes; extend the INLINE one at :157, which is what Omni actually emits)
segments: z.array(z.object({
  t_start: z.number().min(0),
  t_end:   z.number().min(0),
  visual_event: z.string().max(200),
  audio_event:  z.string().max(200),
  scene_boundary_reason: z.string().max(300).optional(),
  spoken_text:    z.string().max(500).nullable().optional(),   // D-04.4 cap ~500
  on_screen_text: z.string().max(500).nullable().optional(),
})).optional(),
```

**Schema gotcha (HIGH — verified):** `OmniAnalysisZodSchema.segments` uses an **inline `z.object({...})`** (schemas.ts:157–163), NOT the exported `SegmentSchema` (schemas.ts:67) and NOT `SegmentGrid`. The exported `SegmentSchema` is a separate type used elsewhere. Add per-segment verbatim to the **inline** shape at :157 — that is the one the Omni response is validated against. (Optionally mirror onto `SegmentSchema`/`SegmentGrid` if any consumer reads verbatim off a normalized segment, but P2 doesn't consume, so inline-only suffices.)

### Pattern: System prompt extension (mirror omni-analysis.ts:114–146)

Add the verbatim fields to the JSON template (after `emotion_arc`/`segments` blocks, ~line 117/127) and add a "Rules for verbatim" block mirroring the existing "Rules for segments" (omni-analysis.ts:141–146). Encode all four D-04 fidelity rules + the D-02 absence contract as explicit prompt rules:
- Transcribe in the spoken language; do NOT translate (D-04.1).
- Use `[inaudible]` ONLY for present-but-unintelligible speech; use `null` when there is no speech/text at all — never describe sound (D-02 / D-04.2).
- Preserve exact casing, punctuation, emoji in `on_screen_text` (D-04.3).
- (Optional, Discretion) one short anchoring example.

Verbatim instructions live in the **system prompt** (stable, cached across runs) — consistent with the existing stable-system / volatile-user split (CONTEXT §code_context).

### Anti-Patterns to Avoid
- **Dropping verbatim at the assembly hop (the emotion_arc bug):** every new field MUST appear in the `analysis` object literal at omni-analysis.ts:236–258. A Zod-valid field that isn't in that literal is silently nulled on every row.
- **Persisting on only ONE insert site:** route.ts persists emotion_arc at BOTH route.ts:594 (buildInsertRow INSERT) AND route.ts:921 (SSE safety-net UPDATE). The streaming path (default UI flow) uses the second. Add verbatim to BOTH or streamed runs lose it.
- **Translating / paraphrasing verbatim:** violates D-04.1 and the honesty principle. Verbatim is fidelity, not opinion.
- **Conflating `null` and `[inaudible]`:** they are distinct states (D-04.2). Don't normalize one into the other.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Threading a new Omni field to the DB | A new bespoke pluck/cast convention | The exact emotion_arc pattern (cast at assembly, `as unknown as {field?}` pluck, `?? null as Json` persist) | Already battle-tested incl. the bug fix; deviating reintroduces the drop |
| Cache invalidation on schema change | Custom cache-buster / TTL hack | Bump `ENGINE_VERSION` in `version.ts` | One constant gates L1 template + L2 Supabase filter; auto-invalidates |
| Backward-compat for silent/old responses | Conditional parse branches | `.optional()` + `.nullable()` Zod modifiers | emotion_arc precedent; existing/silent responses still validate (D-02.3) |
| Field-length safety | Manual truncation logic | `z.string().max(N)` (Zod rejects → MAX_RETRIES re-prompt) | Matches `audio_description max 280` / `rationale max 300` idiom |

**Key insight:** Everything verbatim needs already exists as a working precedent (emotion_arc). The risk is NOT building something new — it's failing to copy the precedent completely (all 4 hops + both insert sites).

## Cache Key / Engine Version Bump (research focus #3 — RESOLVED)

**Single source of truth:** `src/lib/engine/version.ts:9` → `export const ENGINE_VERSION = "3.1.0";`

It is consumed in exactly the places that matter:
- **L1 in-memory cache:** `cacheKey(contentHash, userId)` = `` `${contentHash}::${ENGINE_VERSION}::${userId}` `` (`prediction-cache.ts:20–21`).
- **L2 Supabase cache:** `lookupPredictionCache` filters `.eq("engine_version", ENGINE_VERSION)` (`prediction-cache.ts:88`).
- **Persisted on each row:** `engine_version: finalResult.engine_version` (route.ts:529), sourced from `ENGINE_VERSION` (aggregator.ts:959).

**There is NO separate Omni-level cache layer.** The Omni call has no independent cache — it runs inside `runPredictionPipeline`, whose result is cached by the prediction cache keyed on `ENGINE_VERSION`. So bumping the one constant is the complete fix.

**Action:** bump `version.ts` to `"3.2.0"` (P1 was the `3.0.0 → 3.1.0` bump per the version.ts comment + ROADMAP). The version.ts docstring already states the invariant: "prediction-cache.ts keys on ENGINE_VERSION; this flip auto-invalidates all `<old>` cached rows on next analyze-route call." Stale pre-verbatim cached results will not serve. [VERIFIED: version.ts:1–9 + prediction-cache.ts:20–21,88 — current repo source.]

## Determinism Preservation (R8 — research focus #4)

- **temp0 + seed location:** `omni-analysis.ts:195–196` → `temperature: 0, seed: QWEN_SEED`. `QWEN_SEED = 7` at `client.ts:28`. [VERIFIED: current source.]
- **Adding OUTPUT fields does not break the determinism contract.** Determinism here is governed by temp0+seed on the request; verbatim adds fields to the *response schema + system-prompt instructions*, not to the sampling parameters. The system prompt stays in the cached stable-system slot. STATE.md (2026-06-04) already amended R8 to **"deterministic within provider noise band"** (a tolerance band, not byte-identity) — provider-level nondeterminism already exists on the persona pass and is unrelated to this change.
- **Latency headroom (R6) — quantified estimate [ASSUMED on token math]:** verbatim adds output tokens. Worst case: hook (~2 fields × ≤280 chars ≈ ≤140 tokens) + per-segment (2 fields × ≤500 chars across, say, 8–12 segments ≈ ≤2,500–3,500 output tokens worst case, far less typical). Against `TIMEOUT_MS = 60_000` and `MAX_RETRIES = 1` (omni-analysis.ts:25–26) and the R6 ≤90s E2E target, a few thousand extra output tokens on ONE call adds seconds, not tens of seconds. The caps (D-04.4) are the explicit bound on this. **This is an estimate — verify empirically.**
- **Verify harness:** `scripts/measure-pipeline.ts` (run: `npx tsx scripts/measure-pipeline.ts "/path/to/video.mp4"`). It runs the REAL `runPredictionPipeline + aggregateScores` exactly as `/api/analyze` and reconstructs a wall-clock timeline from StageEvents — confirm E2E stays under the cap with verbatim live.

## Remix No-Regression Surface (R12 — research focus #5)

The remix path shares `analyzeVideoWithOmni`. The consumption boundary is `omniOutputToStructuralInput(omni)` in `src/lib/engine/remix/decode.ts:176–212`. It:
- Reads `omni.geminiResult?.analysis` and a **fixed allowlist** of fields via a narrow structural cast (`hook_decomposition`, `factors`, `video_signals`, `emotion_arc`, `content_summary`, `overall_impression`) plus `omni.segments` and `omni.wave0Result`.
- Returns `null` if `hook_decomposition || factors || video_signals` are missing.
- **Ignores any field it doesn't name** — verbatim is invisible to it.

**What the planner must verify (NO regression, NOT consumption):**
1. `omniOutputToStructuralInput` still returns a non-null mapping for a valid Omni output after verbatim is added (it will — verbatim isn't in its required set).
2. The existing remix tests stay green: `src/lib/engine/remix/__tests__/omni-to-structural.test.ts` + `decode.test.ts`. The fixture `makeOmniOutput()` mirrors the assembly shape — if you add verbatim to the assembly, the fixture does NOT need to (verbatim is optional), so existing remix tests should pass untouched.
3. `/api/remix/adapt` route test (`src/app/api/analyze/__tests__/decode-route.test.ts`) stays green.

Decode CONSUMING verbatim (grounding adapt on the real line) is **P3 (R12)** — out of scope here.

## Common Pitfalls

### Pitfall 1: Verbatim Zod-valid but dropped at assembly (the emotion_arc bug)
**What goes wrong:** field validates, but isn't added to the `analysis` object literal at omni-analysis.ts:236–258 → null on every persisted row.
**Why it happens:** the assembly is a hand-written object literal; a new schema field doesn't auto-flow into it.
**How to avoid:** explicitly add `hook_verbatim: data.hook_verbatim` (and let per-segment verbatim ride through `normalizeSegments` on `data.segments`) to the literal. Mirror omni-analysis.ts:257.
**Warning signs:** real run → `verbatim` null on a speech-bearing video. The emotion_arc fix added a log line (`emotion_arc_points` count, omni-analysis.ts:263) to distinguish "model emitted none" from "assembly dropped it" — add an analogous `verbatim_present` log signal.

### Pitfall 2: Persisting on INSERT but not the SSE UPSERT
**What goes wrong:** JSON-branch runs persist verbatim; streamed (default UI) runs don't.
**Why it happens:** two persistence sites — `buildInsertRow` (route.ts:594 cluster) and the SSE safety-net UPDATE (route.ts:919–921 cluster).
**How to avoid:** add verbatim to BOTH (emotion_arc is in both).
**Warning signs:** verbatim present in `/api/analyze` JSON response but null in DB after a streamed board run.

### Pitfall 3: `null` vs `[inaudible]` collision
**What goes wrong:** silent video gets `"[inaudible]"` (or `[music plays]`); or unintelligible speech gets `null`.
**Why it happens:** prompt doesn't draw the line sharply.
**How to avoid:** encode D-02/D-04.2 as explicit, contrasting prompt rules + assert both in the test (silent → `null`, present-unclear → `[inaudible]`).
**Warning signs:** silent test video yields a non-null, non-`[inaudible]` string.

### Pitfall 4: Wrong segment schema extended
**What goes wrong:** verbatim added to exported `SegmentSchema`/`SegmentGrid` but NOT the inline `segments` object in `OmniAnalysisZodSchema` (schemas.ts:157) → model output's per-segment verbatim is silently stripped at parse.
**How to avoid:** extend the **inline** object at schemas.ts:157–163 (that's what Omni output is validated against).
**Warning signs:** segment `spoken_text` undefined even when the model emitted it.

## Code Examples

### Aggregator pluck (mirror aggregator.ts:523–531 + :925)
```typescript
// Source: src/lib/engine/aggregator.ts:518–531 (emotion_arc pluck precedent)
let verbatim: VerbatimPayload | null = null;
try {
  const vRaw = (geminiResult.analysis as unknown as {
    hook_verbatim?: { spoken_words?: string | null; on_screen_text?: string | null };
  })?.hook_verbatim;
  // per-segment verbatim rides on normalizedSegments (already plucked elsewhere)
  if (vRaw) verbatim = { hook: vRaw /*, segments: ...*/ };
} catch {
  verbatim = null; // non-fatal
}
// ...then add `verbatim,` to the assembled PredictionResult near aggregator.ts:925
```

### Persistence (mirror route.ts:594 + 921 — BOTH sites)
```typescript
// Source: src/app/api/analyze/route.ts:594 (buildInsertRow INSERT)
verbatim: (finalResult.verbatim ?? null) as unknown as Json,
// Source: src/app/api/analyze/route.ts:921 (SSE safety-net UPDATE) — MUST also add
verbatim: (finalResult.verbatim ?? null) as unknown as null,
```

### Migration (mirror 20260531000000_persist_engine_emitted_columns.sql)
```sql
ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS verbatim JSONB;
COMMENT ON COLUMN public.analysis_results.verbatim IS
  'Omni verbatim transcription (P2/R1): { hook_verbatim {spoken_words,on_screen_text}, per-segment spoken_text/on_screen_text }. Null when no speech/text. [inaudible] marks present-but-unclear speech. No backfill — historical rows NULL.';
```

## Runtime State Inventory

> Rename/refactor concern — mostly N/A (additive feature), but cache + DB state matters.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `analysis_results` rows — historical rows will have NULL verbatim (no backfill; engine output not re-derivable). New rows populated by route insert. | None — NULL historical is the accepted policy (matches emotion_arc migration). |
| Live service config | None — verified: no external service holds verbatim schema state. | None. |
| OS-registered state | None — verified: no scheduler/cron references Omni schema. | None. |
| Secrets/env vars | None new. `DASHSCOPE_API_KEY` unchanged; `QWEN_SEED` unchanged. | None. |
| Build artifacts | `src/types/database.types.ts` is a generated artifact — STALE after a new column is added (Option A). | Regenerate (or hand-add `verbatim?: Json|null` to Row/Insert/Update, ~lines 197/251/305 pattern). |
| Cache (cross-cutting) | L1 in-memory + L2 Supabase prediction cache keyed on `ENGINE_VERSION` — pre-verbatim cached rows would serve stale. | Bump `ENGINE_VERSION` 3.1.0 → 3.2.0 (auto-invalidates). |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Omni paraphrases hook (`visual_event`/`audio_event` strings) | Omni emits verbatim words | P2 (this phase) | Enables P3 Apollo `original`-matching rewrites + P4 per-segment retention |
| Field dropped at assembly (emotion_arc bug) | Field explicitly threaded at assembly literal + logged | P1 (emotion_arc fix) | The template + cautionary tale P2 must follow |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Worst-case verbatim output ≈ ≤2.5–3.5k extra tokens; adds seconds not tens of seconds to E2E | Determinism / R6 | If long-video segment count × 500-char fields blows the token budget, E2E could near the cap — mitigated by D-04.4 caps + `measure-pipeline.ts` verify. LOW risk (caps bound it). |
| A2 | Recommended cap values 280 (hook) / 500 (segment) suffice for real transcripts without truncating | Schema | A genuinely long hook line could clip at 280. Discretion allows tuning. LOW. |
| A3 | DB types regen is the clean path for Option A (vs hand-edit) | Persistence | Hand-edit also works (3 spots). Negligible. |

*All other claims are [VERIFIED] against current repo source this session.*

## Open Questions

1. **Emit `hook_verbatim` independently vs derive from hook-zone segment? (D-03.4)**
   - What we know: prompt can cheaply emit both; segments already carry per-segment text after this change.
   - What's unclear: whether duplicate hook text (segment[0] vs hook_verbatim) is acceptable redundancy.
   - Recommendation: emit both (Discretion + D-03.4 lean) — `hook_verbatim` is the canonical P3 target; segment text is the timeline. Cheap, and decouples P3 from segment indexing.

2. **Cap exact values.** 280/500 are recommendations (D-04.4). Recommend keeping them aligned to the existing idiom (audio_description=280, rationale=300–400) unless a real transcript clips.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| DashScope/Qwen API (`DASHSCOPE_API_KEY`) | Omni call + measure-pipeline real run | (env-dependent) | — | Mock-based unit tests cover threading; real-run R1 proof needs the live key |
| Supabase (`videos` bucket + `analysis_results`) | measure-pipeline upload + DB-query proof | (env-dependent) | — | — |
| `npx tsx` | `scripts/measure-pipeline.ts` | ✓ (in repo toolchain) | — | — |

**Note:** Unit-level threading/schema verification needs NO external deps (vitest + mocked OpenAI — see emotion_arc test). The R1 "persists on a real run" proof requires live DashScope + Supabase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (in repo) |
| Config file | repo `vitest` config (existing) |
| Quick run command | `npx vitest run src/lib/engine/__tests__/<verbatim test>` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R1 | Schema ACCEPTS hook_verbatim + per-segment text (happy path) | unit | `npx vitest run .../verbatim` | ❌ Wave 0 (clone emotion_arc test) |
| R1 | Schema validates WITHOUT verbatim (backward compat, .optional) | unit | same | ❌ Wave 0 |
| R1 | System prompt contains literal "hook_verbatim"/"spoken_text" + fidelity rules | unit | same | ❌ Wave 0 |
| R1 | **Verbatim survives assembly hop** (geminiResult.analysis.hook_verbatim populated) — the bug regression | unit | same | ❌ Wave 0 (CRITICAL — mirrors emotion_arc assembly regression at test:170–184) |
| D-02 | Silent input → `null`, NOT `[inaudible]`, NOT a description | unit | same | ❌ Wave 0 |
| D-04.2 | Present-but-unclear → `[inaudible]` preserved through pipeline | unit | same | ❌ Wave 0 |
| D-04.4 | Over-cap string rejected by Zod | unit | same | ❌ Wave 0 |
| R8 | temp0+seed unchanged at call site | unit/grep | grep `temperature: 0` + `seed: QWEN_SEED` omni-analysis.ts | ✅ (assert unchanged) |
| R12 | Remix `omniOutputToStructuralInput` still non-null + tests green | unit | `npx vitest run src/lib/engine/remix/__tests__/` | ✅ (must stay green) |
| R1 | **Persists on a real run** — DB query after real analyze | manual/integration | `npx tsx scripts/measure-pipeline.ts <video>` then `select verbatim from analysis_results where id=...` | ✅ harness exists |
| R6 | E2E under cap with verbatim live | manual | `npx tsx scripts/measure-pipeline.ts <video>` | ✅ |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/engine/__tests__/<verbatim test> src/lib/engine/remix/__tests__/`
- **Per wave merge:** `npm test`
- **Phase gate:** full suite green + ONE real-run R1 proof (speech video → non-empty `verbatim`; silent video → `null` and specifically NOT `[inaudible]`) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `src/lib/engine/__tests__/omni-analysis-verbatim.test.ts` — clone `omni-analysis-emotion-arc.test.ts`; covers schema accept/reject, backward-compat, prompt literal, AND the assembly-hop regression (the bug). Add the null-vs-`[inaudible]` contract assertions.
- [ ] (Option A) confirm `database.types.ts` regen or hand-add `verbatim` to Row/Insert/Update.
- [ ] Real-run proof checklist (manual): one speech-bearing video (non-empty) + one silent video (`null`, not `[inaudible]`), each queried in `analysis_results`.

## Security Domain

> `security_enforcement` not explicitly false in config — minimal applicability for an additive schema/prompt change.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | unchanged — route auth already enforced |
| V3 Session Management | no | unchanged |
| V4 Access Control | no | unchanged — verbatim persisted on the user's own `analysis_results` row (RLS already governs) |
| V5 Input Validation | yes | Zod `.max()`/`.optional()`/`.nullable()` on all new fields (already the idiom) |
| V6 Cryptography | no | none |

### Known Threat Patterns for {Qwen-Omni schema extension}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Model emits oversized/garbage verbatim string | Tampering/DoS (token budget) | `z.string().max(N)` ceiling (D-04.4) → Zod rejects → MAX_RETRIES re-prompt |
| Verbatim leaks into a different user's row | Info disclosure | Persisted on the same row the existing pipeline already scopes by `user_id` + RLS; no new exposure surface |
| `[inaudible]` leaks as a quotable `original` into Apollo rewrites | Integrity (downstream) | OUT OF SCOPE P2 — flagged for P3 (D-04.2); note carried forward |

## Sources

### Primary (HIGH confidence) — current repo source, this session
- `src/lib/engine/qwen/schemas.ts` (emotion_arc :56–63/:152; inline segments :157–163; cap idioms :106,:45)
- `src/lib/engine/qwen/omni-analysis.ts` (buildSystemPrompt :54–147; assembly :236–271; bug annotation :249–257; temp0+seed :195–196; MAX_RETRIES/TIMEOUT :25–26)
- `src/lib/engine/aggregator.ts` (emotion_arc pluck :518–531; thread onto result :925; ENGINE_VERSION import :45/:959)
- `src/lib/engine/types.ts` (PredictionResult.emotion_arc? :268)
- `src/app/api/analyze/route.ts` (buildInsertRow :512–599; emotion_arc persist :594 + :921; persistCraftToVariants :109–152; placeholder insert :691–709)
- `src/lib/engine/version.ts` (ENGINE_VERSION = "3.1.0" :9)
- `src/lib/engine/cache/prediction-cache.ts` (cacheKey :20–21; L2 filter :88)
- `src/lib/engine/qwen/client.ts` (QWEN_SEED = 7 :28)
- `src/lib/engine/remix/decode.ts` (omniOutputToStructuralInput :176–212)
- `supabase/migrations/20260531000000_persist_engine_emitted_columns.sql` (minimal-column migration template)
- `src/lib/engine/__tests__/omni-analysis-emotion-arc.test.ts` (verification template, incl. assembly regression :170–184)
- `src/types/database.types.ts` (emotion_arc Row/Insert/Update :197/:251/:305)
- `scripts/measure-pipeline.ts` (E2E latency harness)

### Secondary (MEDIUM)
- `.planning/STATE.md` (R8 tolerance-band amendment), `.planning/REQUIREMENTS.md` (R1/R8/R12), `.planning/phases/02-omni-verbatim/02-CONTEXT.md` (locked decisions)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all idioms verified in repo.
- Architecture (4-hop threading): HIGH — traced line-by-line against current source; bug + fix located.
- Persistence: HIGH — both options are working precedents in the same route.
- Cache bump: HIGH — single constant, both cache layers confirmed.
- Determinism: HIGH on location; latency math is A1 (estimate, verify via harness).
- Remix no-regression: HIGH — consumption boundary reads a fixed allowlist.

**Research date:** 2026-06-04
**Valid until:** ~2026-07-04 (stable engine internals; re-verify line numbers if the route/aggregator is refactored before planning)
