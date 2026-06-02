# Phase 3: Decode Frame - Pattern Map

**Mapped:** 2026-06-02
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/engine/remix/decode.ts` | service | request-response (LLM) | `src/lib/engine/stage11-counterfactuals.ts` | exact |
| `src/lib/engine/remix/decode-types.ts` | model | — | `src/lib/engine/stage11-counterfactuals-prompts.ts` (Zod schema shape) | role-match |
| `src/lib/engine/remix/decode-prompts.ts` | utility | transform | `src/lib/engine/stage11-counterfactuals-prompts.ts` | exact |
| `src/lib/engine/remix/resolve-and-rehost.ts` | utility | file-I/O | `src/lib/engine/pipeline.ts:530-609` (inline hop) | role-match |
| `src/app/api/analyze/route.ts` (modified) | controller | request-response + streaming | self — existing SSE branch pattern | self-modification |
| `src/components/board/decode/DecodeShellNode.tsx` (modified) | component | event-driven (stream) | `src/components/board/content-analysis/ContentAnalysisFrame.tsx` | exact |
| `src/lib/engine/remix/__tests__/decode.test.ts` | test | — | `src/app/api/analyze/__tests__/derive-and-drop.test.ts` | role-match |
| `src/components/board/decode/__tests__/DecodeShellNode.test.tsx` | test | — | existing board component tests | role-match |

---

## Pattern Assignments

### `src/lib/engine/remix/decode.ts` (service, LLM call)

**Analog:** `src/lib/engine/stage11-counterfactuals.ts`

**Imports pattern** (lines 12-26):
```typescript
import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@/lib/logger";
import { calculateCost } from "./qwen/cost";
import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "./qwen/client";
import { stripModelOutput } from "./utils/strip";
// decode-specific:
import { DecodeResultZodSchema, DECODE_SYSTEM_PROMPT, buildDecodeContext } from "./decode-prompts";
import type { OmniStructuralInput } from "./decode-types";
import type { DecodeResult } from "./decode-types";
```

**Model/timeout constants** (lines 29-36):
```typescript
const QWEN_DECODE_MODEL = process.env.QWEN_DECODE_MODEL ?? QWEN_REASONING_MODEL;
const PER_CALL_TIMEOUT_MS = 45_000; // stage11 uses 60_000; decode context is smaller
```

**Core Qwen call pattern** (lines 94-127 of stage11 — copy verbatim, adjust params):
```typescript
const completion = await ai.chat.completions.create(
  {
    model,
    messages: [
      { role: "system", content: DECODE_SYSTEM_PROMPT },
      { role: "user",   content: userMessage + extraInstruction },
    ],
    response_format: { type: "json_object" },
    max_tokens: 1200,
    temperature: 0,
    seed: QWEN_SEED,
    // @ts-expect-error — DashScope extensions not in OpenAI SDK types
    enable_thinking: true,
    thinking_budget: 2000,
  },
  { signal: controller.signal },
);
```

**Single-retry loop + AbortController + cost** (lines 91-179 of stage11):
```typescript
let attempt = 0;
let lastError: Error | null = null;

while (attempt <= 1) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);
  try {
    const extraInstruction = attempt > 0
      ? "\n\nIMPORTANT: Return ONLY raw JSON — no explanation, no markdown fences."
      : "";
    // ... ai.chat.completions.create (above) ...
    clearTimeout(timer);
    costCents += calculateCost(model, completion.usage ?? undefined);
    const raw  = completion.choices[0]?.message?.content ?? "{}";
    const text = stripModelOutput(raw);
    let parsed: ReturnType<typeof DecodeResultZodSchema.safeParse>;
    try {
      parsed = DecodeResultZodSchema.safeParse(JSON.parse(text));
    } catch {
      parsed = { success: false, error: new Error("JSON parse failed") } as never;
    }
    if (!parsed.success) {
      // log + retry
      if (attempt === 0) { attempt++; continue; }
      throw lastError;
    }
    // pure-TS backstop AFTER Zod parse:
    const data = parsed.data as DecodeResult;
    if (data.luck.length === 0) {
      Sentry.captureMessage("decode_luck_empty_backstop", "warning");
      data.luck.push({ category: 'algorithmic_outlier', note: 'Viral performance included an unrepeatable algorithmic distribution spike.' });
    }
    if (data.beats.length !== 4) throw new Error(`Expected 4 beats, got ${data.beats.length}`);
    return data;
  } catch (err) {
    clearTimeout(timer);
    lastError = err instanceof Error ? err : new Error(String(err));
    if (lastError.name === "AbortError" || attempt >= 1) break;
    attempt++;
  }
}
Sentry.captureException(lastError, { tags: { stage: "decode" } });
return null;
```

**Pattern S7 Sentry** (line 181 of stage11):
```typescript
Sentry.captureException(lastError, { tags: { stage: "decode" } });
```

---

### `src/lib/engine/remix/decode-types.ts` (model)

**Analog:** `src/lib/engine/stage11-counterfactuals-prompts.ts` (Zod schema section) + RESEARCH.md §Decode Output Schema

**Recommended shape** (from RESEARCH.md §Decode Output Schema — concrete, no analog in codebase yet):
```typescript
import { z } from "zod";

export type BeatId = 'hook_pattern' | 'structure_pacing' | 'the_turn' | 'emotional_beat';

export const BEAT_IDS: BeatId[] = ['hook_pattern', 'structure_pacing', 'the_turn', 'emotional_beat'];

export interface DecodeBeat {
  id: BeatId;
  body: string;       // 1-2 honest declarative lines, third-person, no advice verbs
  verdict: 'present' | 'weak' | 'absent';
}

export type LuckCategory =
  | 'timing_trend_moment'
  | 'existing_audience_reach'
  | 'algorithmic_outlier'
  | 'topic_zeitgeist';

export interface DecodeResult {
  beats: DecodeBeat[];           // EXACTLY 4, fixed order
  repeatable: string[];          // clean bullet list (Phase 4 Adapt parses this)
  luck: { category: LuckCategory; note: string }[];  // length >= 1 ALWAYS
}

// Zod schema enforcing the above
export const DecodeBeatSchema = z.object({
  id: z.enum(['hook_pattern', 'structure_pacing', 'the_turn', 'emotional_beat']),
  body: z.string().min(1),
  verdict: z.enum(['present', 'weak', 'absent']),
});

export const LuckCategoryEnum = z.enum([
  'timing_trend_moment',
  'existing_audience_reach',
  'algorithmic_outlier',
  'topic_zeitgeist',
]);

export const DecodeResultZodSchema = z.object({
  beats: z.array(DecodeBeatSchema).length(4),
  repeatable: z.array(z.string()).min(1),
  luck: z.array(z.object({
    category: LuckCategoryEnum,
    note: z.string().min(1),
  })).min(1),
});
```

---

### `src/lib/engine/remix/decode-prompts.ts` (utility, transform)

**Analog:** `src/lib/engine/stage11-counterfactuals-prompts.ts`

**Module structure to mirror** (lines 1-59 of stage11-counterfactuals-prompts.ts):
```typescript
// Three exports mirror stage11-counterfactuals-prompts.ts structure:
// 1. DECODE_SYSTEM_PROMPT — cache-stable system prompt (never interpolate)
// 2. buildDecodeContext(omniFields) — user message builder
// 3. DecodeResultZodSchema — re-exported from decode-types.ts

export const DECODE_SYSTEM_PROMPT = `You are a structural decoder ...
// Third-person about the source video ("the hook", "this structure") — NEVER "you".
// Declarative analysis of why it worked — NEVER advice verbs (fix/improve/should/try/consider).
// Each beat MUST be emitted; when weak/absent set verdict accordingly and name the absence.
// The luck array MUST contain >= 1 entry from the fixed taxonomy.
// Every viral video has at least one unrepeatable factor — identify it.
// Do NOT collapse everything into repeatable.
// OMIT improvement_tip from your analysis — surface rationale only.
`;
```

**`buildDecodeContext` signature** (mirrors `buildSignalContextUserMessage`):
```typescript
export function buildDecodeContext(omni: OmniStructuralInput): string {
  // Serialize: hook_decomposition, factors (name+score+rationale, NO improvement_tip),
  // segments (compact: t_start/t_end/visual_event/audio_event/scene_boundary_reason/is_hook_zone),
  // video_signals, emotion_arc, content_summary, overall_impression, content_type, niche
  // NOTE: NEVER include factors[].improvement_tip — advice-voiced, violates D-06
}
```

---

### `src/lib/engine/remix/resolve-and-rehost.ts` (utility, file-I/O)

**Analog:** `src/lib/engine/pipeline.ts` lines 530–609 (inline resolve→rehost→signed-URL hop)

The exact inline code in `pipeline.ts:530-609` is the source to extract. Key security-critical elements to preserve verbatim:
- `ApifyScrapingProvider.resolveVideoUrl` call for URL→mp4Url
- SSRF host allowlist enforcement (inside `apify-provider.ts`)
- Supabase Storage `videos` bucket rehost
- `finally` block that deletes the temp object (derive-and-drop — pitfall C4)
- Never sets `video_storage_path` on a remix row

**Interface to expose:**
```typescript
export interface ResolveAndRehostResult {
  signedUrl: string;
  cleanup: () => Promise<void>;  // always call in finally — deletes the temp mp4
}

export async function resolveAndRehost(tiktokUrl: string): Promise<ResolveAndRehostResult>
```

---

### `src/app/api/analyze/route.ts` (modified — decode branch)

**Analog:** self — the existing SSE `ReadableStream.start` block (lines 614-798)

**`persistCraftToVariants` → `persistDecodeToVariants` pattern** (lines 102-145 of route.ts):
```typescript
// Read-merge-write — preserves sibling variants (craft, filmstrip_segments)
async function persistDecodeToVariants(
  service: ServiceClient,
  id: string,
  decode: DecodeResult,
  log: Logger,
): Promise<void> {
  try {
    const { data: row, error: readErr } = await service
      .from("analysis_results")
      .select("variants")
      .eq("id", id)
      .single();
    if (readErr || !row) {
      log.warn("decode_variants_read_failed", { id, error: readErr?.message });
      return;
    }
    const current = (row.variants ?? {}) as Record<string, unknown>;
    const remix = (current.remix ?? {}) as Record<string, unknown>;
    const { error: writeErr } = await service
      .from("analysis_results")
      .update({ variants: { ...current, remix: { ...remix, decode } } as unknown as Json })
      .eq("id", id);
    if (writeErr) {
      log.warn("decode_variants_write_failed", { id, error: writeErr.message });
    }
  } catch (err) {
    log.warn("decode_variants_persist_threw", {
      id, error: err instanceof Error ? err.message : String(err),
    });
  }
}
```

**Placeholder insert pattern for remix row** (lines 583-608 of route.ts — modify for decode):
```typescript
// Decode row: overall_score: null, mode: 'remix'
// completion marker is variants.remix != null (NOT overall_score)
const { error: placeholderError } = await service
  .from("analysis_results")
  .insert({
    id: analysisId,
    user_id: user.id,
    content_text: validated.tiktok_url ?? "",
    content_type: validated.content_type,
    overall_score: null,        // ALWAYS null on decode rows (m3)
    engine_version: "pending",
    input_mode: validated.input_mode,
    mode: 'remix',              // ALWAYS 'remix' on decode rows
    content_hash: contentHash,
    // video_storage_path: DO NOT SET (derive-and-drop, pitfall C4)
  });
```

**SSE send helpers** (lines 615-619 of route.ts — copy verbatim):
```typescript
const encoder = new TextEncoder();
const stream = new ReadableStream({
  async start(controller) {
    const send = (event: string, data: unknown) => {
      controller.enqueue(
        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      );
    };
    // decode branch:
    send("started", { id: analysisId });
    send("phase", { phase: "analyzing", message: "Decoding structure…" });
    // ... resolveAndRehost → analyzeVideoWithOmni → runDecode → persistDecodeToVariants ...
    // NO usage_tracking upsert (pitfall C2)
    // NO runPredictionPipeline (pitfall C2)
    send("complete", { id: analysisId, mode: 'remix', overall_score: null,
                       variants: { remix: { decode } } });
  }
});
```

**Branch insertion point** (lines 629-640 of route.ts — branch BEFORE `runPredictionPipeline`):
```typescript
// NEW: branch on mode BEFORE runPredictionPipeline and BEFORE usage_tracking upsert
if (validated.mode === 'remix') {
  // decode path — see runDecodeStream helper
  return await runDecodeStream(/* ... */);
}
// existing score path continues with runPredictionPipeline below
```

---

### `src/components/board/decode/DecodeShellNode.tsx` (modified — fill body)

**Analog:** `src/components/board/content-analysis/ContentAnalysisFrame.tsx`

**Dual-read hook setup pattern** (lines 64-72 of ContentAnalysisFrame.tsx):
```typescript
'use client';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';

export function DecodeShellNode() {
  const { data: permalinkData } = usePermalinkAnalysis();
  const stream = useAnalysisStream({ initialData: permalinkData ?? null });
  const { result, phase } = stream;

  const isDecoding = phase === 'analyzing' || phase === 'reconnecting' || phase === 'polling';

  // Decode-specific: cast result to access variants.remix.decode
  // NOTE: overall_score is null on decode rows — do NOT use it as completion signal (pitfall m3)
  const row = result as unknown as { variants?: { remix?: { decode?: DecodeResult } } } | null;
  const decode = row?.variants?.remix?.decode
    // m3: permalink direct-read when overall_score is null (hook won't short-circuit to 'complete')
    ?? (permalinkData as { variants?: { remix?: { decode?: DecodeResult } } } | null)
         ?.variants?.remix?.decode
    ?? null;
```

**`aria-busy` + root div pattern** (line 86-89 of VerdictNode.tsx):
```tsx
<div
  aria-busy={isDecoding}
  className="relative flex w-full flex-col gap-2"
  data-testid="decode-shell"
>
```

**In-flight skeleton pattern** (lines 248-261 of VerdictNode.tsx — VerdictSkeleton, copy verbatim):
```tsx
// Decode in-flight: same structure, different label
function DecodingState() {
  return (
    <div className="flex flex-col gap-2" data-testid="decode-skeleton">
      <span className="text-[10px] uppercase tracking-[0.1em] text-white/45 motion-safe:animate-skeleton-breathe">
        Decoding structure…
      </span>
      <span className="text-[44px] font-semibold leading-none tabular-nums text-white/25 motion-safe:animate-skeleton-breathe">
        —
      </span>
    </div>
  );
}
```

**Beat block label pattern** (lines 27-30 of VerdictNode.tsx — SectionHead, inline the classes):
```tsx
// Do NOT import SectionHead (internal to VerdictNode); inline the 3 classes:
<div className="mb-2 text-[11px] uppercase tracking-[0.08em] text-white/45">
  {beatLabel}
</div>
```

**Beat body typography** (from FrameHero.tsx line 108 — insight `<p>` classes):
```tsx
<p className="max-w-[44ch] text-[13px] leading-[1.4] text-white/60"
   style={{ textWrap: 'balance' } as React.CSSProperties}>
  {beat.body}
</p>
// absent/weak: swap text-white/60 → text-white/35
```

**Full component structure** (UI-SPEC.md §Component Inventory):
```
DecodeShellNode (flex w-full flex-col gap-2, aria-busy={isDecoding})
  when (isDecoding && !decode): <DecodingState />
  when decode:
    DecodedBody (flex flex-col gap-4)
      BeatList (flex flex-col, border-b border-white/[0.06] between each beat except last)
        BeatBlock × 4 (pb-4 last:pb-0)
          BeatLabel (mb-2 text-[11px] uppercase tracking-[0.08em] text-white/45)
          BeatBody  (text-[13px] leading-[1.4], text-white/60 if present, text-white/35 if absent|weak)
      LanesDivider (mt-6 border-t border-white/[0.06] pt-4)
      LanesSection (flex flex-col gap-4)
        LaneBlock — "What you can repeat"
          LaneHeader (mb-3 text-[11px] uppercase tracking-[0.08em] text-white/45)
          BulletList (flex flex-col gap-2)
            BulletItem (text-[13px] text-white/60, pl-3, em-dash prefix text-white/25)
        LaneBlock — "What was luck / timing"
          LaneHeader (mb-3 text-[11px] uppercase tracking-[0.08em] text-white/45)
          BulletList (flex flex-col gap-3)
            LuckItem (flex flex-col gap-1)
              CategoryTag (text-[11px] font-medium text-white/40)
              LuckNote  (text-[13px] leading-[1.5] text-white/55)
```

---

## Shared Patterns

### Qwen client setup
**Source:** `src/lib/engine/qwen/client.ts` (entire file, 34 lines)
**Apply to:** `src/lib/engine/remix/decode.ts`
```typescript
// Always use getQwenClient() + QWEN_REASONING_MODEL + QWEN_SEED
// maxRetries:0 on the client — the decode call owns its own retry loop
export function getQwenClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey, baseURL: DASHSCOPE_ENDPOINT, maxRetries: 0 });
  }
  return client;
}
export const QWEN_SEED = 7;
export const QWEN_REASONING_MODEL = process.env.QWEN_REASONING_MODEL ?? "qwen3.6-plus";
```

### Sentry error capture (PATTERN S7)
**Source:** `src/lib/engine/stage11-counterfactuals.ts` line 181
**Apply to:** `src/lib/engine/remix/decode.ts`
```typescript
Sentry.captureException(lastError, { tags: { stage: "decode" } });
```

### `stripModelOutput` before Zod parse
**Source:** `src/lib/engine/stage11-counterfactuals.ts` line 133
**Apply to:** `src/lib/engine/remix/decode.ts`
```typescript
const raw  = completion.choices[0]?.message?.content ?? "{}";
const text = stripModelOutput(raw);
// then: JSON.parse(text) → Zod safeParse
```

### `calculateCost` telemetry
**Source:** `src/lib/engine/stage11-counterfactuals.ts` line 130
**Apply to:** `src/lib/engine/remix/decode.ts`
```typescript
costCents += calculateCost(model, completion.usage ?? undefined);
```

### JSONB read-merge-write (`variants`)
**Source:** `src/app/api/analyze/route.ts` lines 122-144 (`persistCraftToVariants`)
**Apply to:** `persistDecodeToVariants` in `route.ts`
```typescript
const current = (row.variants ?? {}) as Record<string, unknown>;
const remix   = (current.remix   ?? {}) as Record<string, unknown>;
await service.from("analysis_results")
  .update({ variants: { ...current, remix: { ...remix, decode } } as unknown as Json })
  .eq("id", id);
```
Key: three-level merge (`current` → `current.remix` → `current.remix.decode`). Preserves `filmstrip_segments` and `craft` regardless of write order.

### Content-hash with mode fold (D-14)
**Source:** `src/lib/engine/cache/prediction-cache.ts` lines 31-54
**Apply to:** decode cache lookup in `route.ts` decode branch
```typescript
// mode='remix' already folds into hash — no change needed
if (input.mode === "remix") h.update("::mode=remix");
```

### Dual-read (live stream + permalink) for `variants` payload
**Source:** `src/components/board/content-analysis/ContentAnalysisFrame.tsx` lines 64-99
**Apply to:** `src/components/board/decode/DecodeShellNode.tsx`
```typescript
const { data: permalinkData } = usePermalinkAnalysis();
const stream = useAnalysisStream({ initialData: permalinkData ?? null });
// read from stream.result first, fall back to permalinkData
// CRITICAL (pitfall m3): overall_score is null on decode rows —
// use-analysis-stream:127 short-circuit (overall_score != null → 'complete') never fires.
// Direct-read permalinkData.variants.remix.decode when overall_score is null.
```

### SSE `send` helper + `ReadableStream.start`
**Source:** `src/app/api/analyze/route.ts` lines 613-619
**Apply to:** decode branch in `route.ts`
```typescript
const encoder = new TextEncoder();
const stream = new ReadableStream({
  async start(controller) {
    const send = (event: string, data: unknown) => {
      controller.enqueue(
        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      );
    };
    // ... decode logic ...
    // finally: controller.close()
  }
});
return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', ... } });
```

### Raycast typography tokens
**Source:** `src/components/board/verdict/VerdictNode.tsx` lines 27-31 (`SectionHead`) + `src/components/board/_kit/FrameHero.tsx` lines 65-66, 107-110
**Apply to:** `src/components/board/decode/DecodeShellNode.tsx`
```typescript
// Beat/lane labels:
"text-[11px] uppercase tracking-[0.08em] text-white/45"
// Beat body (present):
"text-[13px] leading-[1.4] text-white/60"
// Beat body (absent/weak):
"text-[13px] leading-[1.4] text-white/35"
// In-flight label:
"text-[10px] uppercase tracking-[0.1em] text-white/45 motion-safe:animate-skeleton-breathe"
// In-flight glyph:
"text-[44px] font-semibold leading-none tabular-nums text-white/25 motion-safe:animate-skeleton-breathe"
// Universal borders: border-white/[0.06]
```

---

## No Analog Found

No files in this phase are without a codebase analog. All patterns have direct matches:

| File | Role | Analog | Notes |
|------|------|--------|-------|
| `decode-types.ts` | model | `stage11-counterfactuals-prompts.ts` Zod section | Schema shape is new; Zod pattern is identical |
| `resolve-and-rehost.ts` | utility | `pipeline.ts:530-609` (inline) | Extraction of existing inline code; no novel pattern |

---

## Critical Implementation Notes for Planner

1. **Pitfall C2** — `usage_tracking` upsert (`route.ts:708-717`) is inside the existing SSE branch's `try` block. The decode branch must diverge BEFORE this point (and before `runPredictionPipeline` at line 634). Branch on `validated.mode === 'remix'` near line 629.

2. **Pitfall m3** — `use-analysis-stream:127` short-circuits to `'complete'` only when `overall_score != null`. Decode rows have `overall_score: null`. `DecodeShellNode` must read `permalinkData.variants.remix.decode` directly when the stream doesn't complete from `initialData`.

3. **`improvement_tip` exclusion** — `factors[].improvement_tip` must be omitted from `buildDecodeContext()`. It's advice-voiced (violates D-06). Serialize only `name`, `score`, `rationale` per factor.

4. **Pure-TS backstop order** — run after Zod parse succeeds, before returning: assert `beats.length === 4`; if `luck.length === 0` push `{ category: 'algorithmic_outlier', note: '...' }` + Sentry warn. Mirrors `maybeAppendLikelyFlopWarning` in stage11 (lines 43-55).

5. **Derive-and-drop (pitfall C4)** — `resolveAndRehost` must expose a `cleanup()` function called in `finally`. Never set `video_storage_path` on the remix row. Pattern: `const { signedUrl, cleanup } = await resolveAndRehost(url); try { ... } finally { await cleanup(); }`.

---

## Metadata

**Analog search scope:** `src/lib/engine/`, `src/app/api/analyze/`, `src/components/board/`, `src/hooks/queries/`, `src/lib/engine/cache/`
**Files read:** 11
**Pattern extraction date:** 2026-06-02
