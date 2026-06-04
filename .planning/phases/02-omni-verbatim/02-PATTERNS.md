# Phase 2: Omni Verbatim - Pattern Map

**Mapped:** 2026-06-04
**Files analyzed:** 9 new/modified files
**Analogs found:** 9/9 (emotion_arc precedent covers all threading hops + persistence)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/engine/qwen/schemas.ts` | schema | request-response | `emotion_arc` lines 56–63, 152 | exact (same file, Zod pattern) |
| `src/lib/engine/qwen/omni-analysis.ts` | service | request-response | `emotion_arc` assembly lines 249–257 | exact (hop 2 — bug fix annotated) |
| `src/lib/engine/aggregator.ts` | service | CRUD | `emotion_arc` pluck lines 518–531, thread 925 | exact (hop 3 — `as unknown as` cast) |
| `src/lib/engine/types.ts` | model | request-response | `emotion_arc` field line 268 | exact (PredictionResult extension) |
| `src/app/api/analyze/route.ts` | controller | request-response | `emotion_arc` persist lines 594, 921 | exact (both INSERT + UPSERT sites) |
| `src/lib/engine/version.ts` | config | request-response | `ENGINE_VERSION` line 9 | exact (single constant bump 3.1.0 → 3.2.0) |
| `supabase/migrations/[timestamp]_persist_engine_verbatim.sql` | migration | request-response | `20260531000000` migration (3-column pattern) | exact (minimal ADD COLUMN template) |
| `src/types/database.types.ts` | model | request-response | `emotion_arc` Row/Insert/Update lines 197/251/305 | exact (Supabase generated types) |
| `src/lib/engine/__tests__/omni-analysis-verbatim.test.ts` | test | request-response | `omni-analysis-emotion-arc.test.ts` lines 170–184 | exact (assembly regression template) |

---

## Pattern Assignments

### 1. `src/lib/engine/qwen/schemas.ts` (schema, request-response)

**Analog:** emotion_arc ZodSchema (lines 56–63, 152)

**Zod field declaration pattern** (lines 150–152):
```typescript
  /** Phase 1 (R1.7) — Optional emotion arc timeline. Backward compat: existing
   *  Omni responses without this field continue to validate (Assumption A3). */
  emotion_arc: z.array(EmotionArcPointSchema).optional(),
```

**CRITICAL — Per-segment inline schema location** (lines 157–163):
> The inline `z.object({...})` within `OmniAnalysisZodSchema.segments` is the **actual shape** Omni output validates against. NOT the exported `SegmentSchema` (line 67). Extend **this inline** object, not the exported one.

```typescript
  segments: z.array(z.object({
    t_start: z.number().min(0),
    t_end:   z.number().min(0),
    visual_event: z.string().max(200),
    audio_event:  z.string().max(200),
    scene_boundary_reason: z.string().max(300).optional(),
  })).optional(),
```

**String-cap idiom** (precedent: line 106 `audio_description max 280`, line 45 `rationale max 300`):
```typescript
// Add to inline segments object:
spoken_text:    z.string().max(500).nullable().optional(),
on_screen_text: z.string().max(500).nullable().optional(),

// Top-level hook_verbatim:
hook_verbatim: z.object({
  spoken_words:   z.string().max(280).nullable().optional(),
  on_screen_text: z.string().max(280).nullable().optional(),
}).optional(),
```

**Rationale:** `.optional()` mirrors emotion_arc A3 backward-compat pattern. `.nullable()` allows explicit `null` (D-02: silence/absence). `.max(N)` prevents token-budget explosion (D-04.4).

---

### 2. `src/lib/engine/qwen/omni-analysis.ts` (service, request-response)

**Analog:** emotion_arc assembly (lines 249–257) — the bug-prone hop

**System prompt template addition** (lines 114–127 precedent; add verbatim rules after emotion_arc block):
```typescript
  "emotion_arc": [
    { "timestamp_ms": 0,    "intensity_0_1": 0.3, "label": "low" },
    { "timestamp_ms": 5000, "intensity_0_1": 0.8, "label": "high" }
  ],

  "hook_verbatim": {
    "spoken_words": "The first ~3 seconds of dialogue, verbatim, or null if silent.",
    "on_screen_text": "Any overlay text visible in the first ~3s, verbatim, or null if none."
  },

  // Extend to segments inline shape:
  "segments": [
    {
      "t_start": 0.0,
      "t_end": 2.8,
      "visual_event": "...",
      "audio_event": "...",
      "scene_boundary_reason": "...",
      "spoken_text": "Verbatim speech in this segment, [inaudible] for unclear, or null for silence.",
      "on_screen_text": "All overlay text visible in this segment, verbatim, or null if none."
    }
  ]
```

Then add a "Rules for verbatim" block (mirror lines 141–146 emotion_arc rules):
```typescript
Rules for verbatim:
- Transcribe in the spoken language; do NOT translate (D-04.1).
- Use [inaudible] ONLY for present-but-unintelligible speech; use null when there is no speech/text — never describe sound (D-02 / D-04.2).
- Preserve exact casing, punctuation, emoji in on_screen_text (D-04.3).
- Cap hook_verbatim fields ~280 chars, per-segment ~500 chars (D-04.4).
```

**Assembly literal (lines 236–258) — CRITICAL DO-NOT-REMOVE ANNOTATION:**

The emotion_arc bug annotation (lines 249–257) is the EXACT template verbatim must follow:

```typescript
const analysis = {
  factors:            data.factors,
  overall_impression: data.overall_impression,
  content_summary:    data.content_summary,
  video_signals:      { /* ... */ },
  audio_signals:      data.audio_signals,
  hook_decomposition: data.hook_decomposition,
  cta_segment:        data.cta_segment,
  // emotion_arc MUST be threaded here. The aggregator plucks it off
  // geminiResult.analysis.emotion_arc (aggregator.ts ~692). Omitting it
  // — the original bug — silently dropped a Zod-parsed field on EVERY run,
  // so emotion_arc was null on 100% of persisted rows despite the prompt
  // marking it REQUIRED (26/26 rows null, confirmed in prod). GeminiVideoAnalysis
  // doesn't declare the field (Omni-only extension), so it rides through the
  // `as` cast and the aggregator's matching `as unknown as { emotion_arc? }` read.
  // Do NOT "clean up" by removing it — that re-introduces the drop.
  emotion_arc:        data.emotion_arc,
  
  // VERBATIM ADDITION — same pattern as emotion_arc above:
  // Non-fatal if missing; rides the `as GeminiVideoAnalysis` cast.
  hook_verbatim:      data.hook_verbatim,
  // Per-segment verbatim rides on data.segments, which flows through
  // normalizeSegments unchanged (or normalized in tandem if needed).
} as GeminiVideoAnalysis;
```

**Post-assembly log** (mirror line 263 for assembly-hop diagnostics):
```typescript
log.info("omni analysis complete", {
  model,
  cost_cents,
  attempt,
  emotion_arc_points: data.emotion_arc?.length ?? 0,
  // ADD:
  verbatim_present: data.hook_verbatim ? true : false,
});
```

**Determinism preserved** (lines 195–196 — unchanged):
```typescript
temperature: 0, // reproducible factors/hook/segments — same video → same score
seed: QWEN_SEED,
```

---

### 3. `src/lib/engine/aggregator.ts` (service, CRUD)

**Analog:** emotion_arc pluck (lines 518–531) + thread onto result (line 925)

**Pluck pattern** (lines 518–531 exact template):
```typescript
  // Phase 1 (R1.7) — emotion_arc pluck from Omni Plus output. Non-fatal per
  // Pitfall #5 (inserted BEFORE result assembly so Stage 10/11 critique +
  // counterfactuals see the populated field). Backward compat: when Omni omits
  // the field (existing responses, slideshow/text mode) emotion_arc is null and
  // the downstream P3 emotion-arc panel renders empty state.
  let emotion_arc: EmotionArcPoint[] | null = null;
  try {
    const arcRaw = (geminiResult.analysis as unknown as {
      emotion_arc?: EmotionArcPoint[];
    })?.emotion_arc;
    if (Array.isArray(arcRaw) && arcRaw.length > 0) emotion_arc = arcRaw;
  } catch {
    emotion_arc = null; // non-fatal
  }

  // VERBATIM ADDITION — same structure:
  let verbatim: VerbatimPayload | null = null;
  try {
    const vRaw = (geminiResult.analysis as unknown as {
      hook_verbatim?: { spoken_words?: string | null; on_screen_text?: string | null };
    })?.hook_verbatim;
    // Per-segment verbatim rides on normalizedSegments (plucked earlier in pipeline)
    if (vRaw) verbatim = { hook: vRaw /* segments: derived from normalizedSegments */ };
  } catch {
    verbatim = null; // non-fatal
  }
```

**Thread onto result** (lines 920–925 area):
```typescript
    // Phase 1 (R1.7) — emotion arc timeline plucked from Omni Plus output above.
    // Null when video absent or Qwen omitted the field; non-fatal per Pitfall #5.
    emotion_arc,
    // VERBATIM ADDITION:
    verbatim,
    // ... rest of result
```

**Key insight:** The `as unknown as { hook_verbatim? }` narrow cast is how Omni-only fields "ride the cast" without modifying the base `GeminiVideoAnalysis` interface.

---

### 4. `src/lib/engine/types.ts` (model, request-response)

**Analog:** emotion_arc field on PredictionResult (line 268)

**Current emotion_arc declaration** (lines 266–268):
```typescript
  /** Phase 1 (R1.7) — Emotion arc timeline from Omni Plus. Null when video absent
   *  or Qwen omitted the field. Optional to preserve compile against existing consumers. */
  emotion_arc?: EmotionArcPoint[] | null;
```

**Verbatim addition** (same pattern):
```typescript
  /** Phase 2 (R1) — Verbatim transcription from Omni (hook + per-segment).
   *  Null when video absent, no speech, or Qwen omitted the field. */
  verbatim?: VerbatimPayload | null;
```

**Type definition** (new, to add near EmotionArcPoint):
```typescript
export interface VerbatimPayload {
  hook?: { spoken_words?: string | null; on_screen_text?: string | null };
  // Per-segment verbatim rides on segments array, not here.
}
```

Or inline verbatim directly in PredictionResult:
```typescript
  verbatim?: {
    hook?: { spoken_words?: string | null; on_screen_text?: string | null };
  } | null;
```

---

### 5. `src/app/api/analyze/route.ts` (controller, request-response)

**Analog:** emotion_arc persistence at TWO sites (lines 594 INSERT, 921 UPSERT)

**buildInsertRow INSERT site** (line 594 area):
```typescript
      emotion_arc: (finalResult.emotion_arc ?? null) as unknown as Json,
      // VERBATIM ADDITION:
      verbatim: (finalResult.verbatim ?? null) as unknown as Json,
      persona_behavioral_aggregate:
        (finalResult.persona_behavioral_aggregate ?? null) as unknown as Json,
```

**SSE safety-net UPDATE site** (line 921 area — CRITICAL):
```typescript
                emotion_arc: (finalResult.emotion_arc ?? null) as unknown as null,
                // VERBATIM ADDITION:
                verbatim: (finalResult.verbatim ?? null) as unknown as null,
                persona_behavioral_aggregate:
                  (finalResult.persona_behavioral_aggregate ?? null) as unknown as null,
```

**Why both sites matter:**
- INSERT (line 594): JSON-branch responses use this path.
- UPDATE (line 921): SSE/streaming (default board UI) uses this safety-net path to persist mid-pipeline. Missing verbatim here → streamed runs lose the field on DB.

---

### 6. `src/lib/engine/version.ts` (config, request-response)

**Analog:** ENGINE_VERSION constant (line 9)

**Current value:**
```typescript
export const ENGINE_VERSION = "3.1.0";
```

**Bump to:**
```typescript
export const ENGINE_VERSION = "3.2.0";
```

**Rationale:** Single source of truth. Both prediction-cache.ts line 20 (L1 in-memory template) and line 88 (L2 Supabase `.eq("engine_version", ENGINE_VERSION)` filter) key on this constant. Bumping auto-invalidates stale pre-verbatim cached rows on next `/api/analyze` call.

---

### 7. `supabase/migrations/[timestamp]_persist_engine_verbatim.sql` (migration, request-response)

**Analog:** `20260531000000_persist_engine_emitted_columns.sql` (minimal ADD COLUMN pattern)

**Template** (Option A — dedicated `verbatim` JSONB column):
```sql
-- Phase 2 (R1) — Persist Omni verbatim transcription so it survives
-- permalink reload (GET /api/analysis/[id]).
-- Before this, buildInsertRow dropped verbatim on the floor:
--   hook_verbatim        → Omni hook transcription (first ~3s)
--   per-segment verbatim → per-segment spoken_text/on_screen_text
--
-- No backfill: historical rows keep NULL (engine output isn't re-derivable).
-- Newly inserted rows are populated by buildInsertRow in src/app/api/analyze/route.ts.

ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS verbatim JSONB;

COMMENT ON COLUMN public.analysis_results.verbatim IS
  'Omni verbatim transcription (P2/R1): { hook_verbatim {spoken_words,on_screen_text}, per-segment spoken_text/on_screen_text via segments[].{spoken_text,on_screen_text} }. Null when no speech/text. [inaudible] marks present-but-unclear speech. No backfill — historical rows NULL. Consumed by P3 Apollo rewrites (R2) and P4 Audience-Sim (R3).';
```

**Naming convention:** Use `20260604000000_persist_engine_verbatim_phase2.sql` (monotonic timestamp + phase reference).

---

### 8. `src/types/database.types.ts` (model, request-response)

**Analog:** emotion_arc Row/Insert/Update entries (line 197 Row, 251 Insert, 305 Update)

**Current emotion_arc pattern** (line 197 in Row):
```typescript
          emotion_arc: Json | null
```

**Verbatim addition** (same pattern, after emotion_arc):
```typescript
          verbatim: Json | null
```

Repeat at Insert (line ~251) and Update (line ~305).

**How to apply:**
- **Option A (cleanest):** Regenerate `database.types.ts` from Supabase after migration applies: `npx supabase gen types typescript --local > src/types/database.types.ts`
- **Option B (hand-add):** Search for `emotion_arc: Json | null` in each of Row/Insert/Update sections, add `verbatim: Json | null` immediately after on each occurrence.

---

### 9. `src/lib/engine/__tests__/omni-analysis-verbatim.test.ts` (test, request-response)

**Analog:** `omni-analysis-emotion-arc.test.ts` (lines 170–184 assembly regression, A3 backward-compat)

**Clone structure** (adapt lines 88–162 + 170–208):

1. **Schema validation tests** (mirror lines 88–162):
   - `VerbatimPayload` schema happy path (hook present)
   - Schema backward-compat (hook absent, `.optional()` works)
   - System prompt contains literal `"hook_verbatim"`, `"spoken_text"`, `"on_screen_text"`
   - Zod rejects over-cap strings (`z.string().max(280)` / `.max(500)`)

2. **Assembly regression (CRITICAL — mirror lines 170–208):**
```typescript
describe("verbatim — analyzeVideoWithOmni assembly (regression)", () => {
  it("threads model-emitted hook_verbatim onto geminiResult.analysis", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: makeOmniResponse(withVerbatim: true) } }],
      usage: { prompt_tokens: 100, completion_tokens: 150, total_tokens: 250 },
    });

    const out = await analyzeVideoWithOmni("https://example.com/v.mp4");

    // The exact field+path the aggregator reads (aggregator.ts ~ line where verbatim is plucked)
    const v = (out.geminiResult?.analysis as unknown as {
      hook_verbatim?: { spoken_words?: string | null; on_screen_text?: string | null };
    })?.hook_verbatim;
    expect(v).toBeDefined();
    expect(v?.spoken_words).toContain("...");
  });

  it("leaves verbatim undefined when model omits it (backward compat)", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: makeOmniResponse(withVerbatim: false) } }],
      usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
    });

    const out = await analyzeVideoWithOmni("https://example.com/v.mp4");
    const v = (out.geminiResult?.analysis as unknown as {
      hook_verbatim?: unknown;
    })?.hook_verbatim;
    expect(v).toBeUndefined();
  });
});

// D-02 / D-04.2 contract: null vs [inaudible]
describe("verbatim — null vs [inaudible] contract", () => {
  it("silent input yields null, NOT [inaudible]", async () => {
    const silent = makeOmniResponse(withVerbatim: true, silent: true);
    // Assert: spoken_words is null, not "[inaudible]" or "[music plays]"
    const parsed = JSON.parse(silent);
    expect(parsed.hook_verbatim.spoken_words).toBeNull();
  });

  it("present-but-unclear speech yields [inaudible], NOT null", async () => {
    const unclear = makeOmniResponse(withVerbatim: true, hasUnclearSpeech: true);
    const parsed = JSON.parse(unclear);
    // Assert: spoken_words contains [inaudible] marker
    expect(parsed.hook_verbatim.spoken_words).toContain("[inaudible]");
    expect(parsed.hook_verbatim.spoken_words).not.toBeNull();
  });
});
```

3. **Helper fixture** (adapt line 36–86 makeOmniResponse):
```typescript
function makeOmniResponse(withVerbatim: boolean, silent?: boolean): string {
  const body = { /* all existing emotion_arc fixture fields */ };
  if (withVerbatim) {
    if (silent) {
      body.hook_verbatim = { spoken_words: null, on_screen_text: null };
    } else {
      body.hook_verbatim = {
        spoken_words: "Welcome to my channel, here's how to...",
        on_screen_text: "SUBSCRIBE NOW"
      };
    }
    body.segments[0].spoken_text = "Welcome to my channel";
    body.segments[0].on_screen_text = "SUBSCRIBE NOW";
  }
  return JSON.stringify(body);
}
```

---

## Shared Patterns

### Authentication / Authorization
**No change.** Route auth already guards `/api/analyze`; verbatim persists on the same `user_id`-scoped row. RLS unchanged.

### Error Handling
**Non-fatal pluck pattern** (mirror aggregator.ts lines 523–531):
```typescript
let verbatim: VerbatimPayload | null = null;
try {
  // ... pluck logic
} catch {
  verbatim = null; // non-fatal — absence doesn't break the pipeline
}
```

### Validation
**Zod schema pattern** (mirror schemas.ts):
- `.optional()` for backward-compat (existing/silent responses still validate)
- `.nullable()` for explicit `null` (D-02 absence contract)
- `.max(N)` for token-budget ceiling (D-04.4: hook ~280, segment ~500)
- Rejects on Zod parse fail → MAX_RETRIES re-prompt (omni-analysis.ts:25)

### Persistence
**Two-site pattern** (critical for streaming):
- **INSERT** (route.ts:594): JSON-branch responses
- **UPDATE** (route.ts:921): SSE/streaming safety-net (default UI flow)
- Both sites use `(finalResult.verbatim ?? null) as unknown as Json`

### Cache Invalidation
**Single constant** (version.ts:9):
- L1 in-memory: `cacheKey()` template (prediction-cache.ts:20)
- L2 Supabase: `.eq("engine_version", ENGINE_VERSION)` filter (prediction-cache.ts:88)
- Bump constant → auto-invalidates all stale pre-verbatim rows

---

## No Analog Found

None. The emotion_arc precedent covers all 9 files across all 4 threading hops + both persistence sites + schema + test.

---

## Metadata

**Analog search scope:** `src/lib/engine/`, `src/app/api/analyze/`, `supabase/migrations/`, `src/lib/engine/__tests__/`
**Files scanned:** 20+
**Pattern extraction date:** 2026-06-04
**Confidence:** HIGH — every claim traced to current repo source; emotion_arc is a complete, battle-tested precedent including the bug fix (assembly drop) and warning annotation.

**Key risk:** The assembly hop (hop 2). Emotion_arc once dropped silently here despite Zod validation. The fix is annotated inline at omni-analysis.ts:249–257 with a do-not-remove warning. Verbatim MUST follow this exact pattern or it will silently null on all runs.

**Verification checklist (for planner):**
- [ ] Per-segment verbatim added to **inline** `segments` object in schemas.ts:157, NOT exported `SegmentSchema`
- [ ] Assembly literal (omni-analysis.ts:236–258) includes both `hook_verbatim: data.hook_verbatim` and per-segment verbatim via `data.segments`
- [ ] Aggregator pluck (aggregator.ts ~518) + thread (aggregator.ts ~925) both present
- [ ] Route persistence (route.ts) at **BOTH** INSERT (594) and UPDATE (921) sites
- [ ] ENGINE_VERSION bumped (version.ts:9)
- [ ] Migration created + types.ts updated (or regenerated)
- [ ] Test includes assembly regression (verbatim survives omni-analysis.ts assembly)
- [ ] Test includes null-vs-`[inaudible]` contract (D-02 / D-04.2)
- [ ] Real run on speech-bearing video → non-empty `verbatim` in DB
- [ ] Real run on silent video → `null` verbatim (NOT `"[inaudible]"`), NOT a description
