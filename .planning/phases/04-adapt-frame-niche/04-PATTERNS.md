# Phase 4: Adapt Frame + Niche - Pattern Map

**Mapped:** 2026-06-02
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/engine/remix/decode-types.ts` | type-contract | — | `src/lib/engine/qwen/schemas.ts` | role-match (type exports) |
| `src/lib/engine/remix/decode.fixture.ts` | test-fixture | — | synthesized from decode-types.ts | no-analog (net-new fixture) |
| `src/lib/engine/remix/adapt.ts` | service | request-response (Qwen JSON-mode) | `src/lib/engine/qwen/omni-analysis.ts` + `src/lib/engine/wave3/pass2.ts` | exact (same Qwen retry+repair+Zod+strip shape) |
| `src/app/api/remix/adapt/route.ts` | route | request-response (POST + variants JSONB write) | `src/app/api/analyze/route.ts` (`persistCraftToVariants`) + `src/app/api/profile/creator-profile/route.ts` | exact (auth + Zod + read-merge-write) |
| `src/components/board/adapt/AdaptFrameBody.tsx` | component | request-response (self-sourcing, dual-read rehydrate) | `src/components/board/content-analysis/ContentAnalysisFrame.tsx` | exact (same self-sourcing + dual-read shape) |
| `src/components/board/adapt/AdaptConceptCard.tsx` | component | — | `src/components/board/_kit/FrameHero.tsx` (card chrome) + NichePicker tile pattern | role-match (Raycast card language) |
| `src/components/board/adapt/AdaptShellNode.tsx` (modify) | component | — | existing shell (Phase 2) | exact (mount point, replace body) |
| `src/hooks/queries/use-adapt-concepts.ts` (optional) | hook | request-response (TanStack mutation) | `src/hooks/queries/use-creator-profile.ts` | exact (mutation + cache invalidation) |

---

## Pattern Assignments

---

### `src/lib/engine/remix/decode-types.ts` (type-contract)

**Analog:** `src/lib/engine/qwen/schemas.ts` (export style) + RESEARCH.md Code Examples

**Imports pattern** — mirror schemas.ts export-per-type convention:
```typescript
// No runtime imports — pure type file (no zod needed here; types are consumed,
// not validated, at the contract boundary).
// For zod validation of DecodeOutput when Phase 3 produces it, that lives in
// engine/remix/decode.ts (Phase 3), NOT here.
```

**Core pattern** — canonical type + narrowed AdaptInput (RESEARCH Code Examples):
```typescript
// RESEARCH.md Code Examples (synthesized from ROADMAP Phase 3 crit 3 + CONTEXT D-01)
export interface RepeatableItem {
  label: string;          // e.g. "open-loop cold open"
  why_repeatable: string; // structural reason it can be reused
}
export interface DecodeOutput {
  hook_pattern:   string;
  structure:      string;
  the_turn:       string;
  emotional_beat: string;
  repeatable:     RepeatableItem[];  // Adapt draws from this lane only (D-01)
  luck:           RepeatableItem[];  // present for Decode frame only — EXCLUDED from adapt input
}
// Adapt input builder: receive ONLY structural fields + repeatable[] + niche (Pitfall 1 guard)
export type AdaptInput = Pick<DecodeOutput,
  'hook_pattern' | 'structure' | 'the_turn' | 'emotional_beat' | 'repeatable'> & { niche: string };
```

**Output type** — ADAPT-01 concept shape:
```typescript
// RESEARCH.md Code Examples (from CONTEXT D-09 + UI-SPEC Component Inventory)
export interface AdaptConcept {
  hook:            string; // bold headline (UI-SPEC: text-base font-semibold)
  angle:           string; // muted sub-row
  who_its_for:     string; // muted sub-row
  format_borrowed: string; // coral chip, prefixed "Borrowed:" in UI
}
```

**No analog footnote:** RepeatableItem shape (`label` + `why_repeatable`) is MEDIUM-confidence per RESEARCH A5. Keep the fixture loose enough to absorb Phase 3's real Omni output refinements.

---

### `src/lib/engine/remix/decode.fixture.ts` (test-fixture)

**Analog:** None — hand-authored fixture, no existing decode fixture in codebase.

**Pattern:** Plain export, no framework deps. Realistic repeatable/luck split (not pasta-recipe content — use format language only, to satisfy the content-leak guard test in Pitfall 1):

```typescript
// Pattern: plain export matching DecodeOutput interface exactly
import type { DecodeOutput } from './decode-types';

export const DECODE_FIXTURE: DecodeOutput = {
  hook_pattern:   "Open with a provocative question, delay the answer",
  structure:      "Hook (0-3s) → tension build (3-12s) → reveal (12-22s) → CTA (22-30s)",
  the_turn:       "Pivot from problem statement to counter-intuitive solution at 15s",
  emotional_beat: "Curiosity → frustration → relief → motivation",
  repeatable: [
    { label: "open-loop cold open", why_repeatable: "Format hook, not topic-specific" },
    { label: "4-beat emotional arc", why_repeatable: "Structural pacing, replicable in any niche" },
    { label: "counter-intuitive turn at 60% mark", why_repeatable: "Structure, not content" },
  ],
  luck: [
    { label: "viral sound at time of posting", why_repeatable: "Timing, not structure" },
    { label: "algorithm boost from existing audience", why_repeatable: "Distribution, not format" },
  ],
};
```

---

### `src/lib/engine/remix/adapt.ts` (service, Qwen JSON-mode)

**Analog:** `src/lib/engine/qwen/omni-analysis.ts:149-291` (canonical retry+repair+strip shape) + `src/lib/engine/wave3/pass2.ts:152-201` (reasoning model + explicit count guard)

**Imports pattern** — mirror omni-analysis.ts:12-22:
```typescript
// src/lib/engine/qwen/omni-analysis.ts:12-22
import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@/lib/logger";
import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "./client";
import { stripModelOutput } from "../utils/strip";
import { z } from "zod";
import type { AdaptInput, AdaptConcept } from "./decode-types";
// Note: QWEN_OMNI_MODEL is NOT used here — adapt has no video input.
// Use QWEN_REASONING_MODEL (qwen3.6-plus) — same as pass2.ts:160
```

**Client pattern** — `src/lib/engine/qwen/client.ts:7-18`:
```typescript
// client has maxRetries:0 — app owns the retry loop (critical, see client.ts:11-15)
// QWEN_SEED = 7 (client.ts:28)
// QWEN_REASONING_MODEL = "qwen3.6-plus" (client.ts:32)
export function getQwenClient(): OpenAI {  // returns singleton OpenAI pointed at DashScope
  // ... maxRetries: 0 — never rely on SDK retries
}
```

**Core retry+repair pattern** — `src/lib/engine/qwen/omni-analysis.ts:159-291`:
```typescript
// src/lib/engine/qwen/omni-analysis.ts:159-212 (the canonical retry+repair loop)
const MAX_RETRIES = 1; // 2 total attempts

const log = createLogger({ module: "engine.remix.adapt" });

for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const extraInstruction = attempt > 0
      ? "\nIMPORTANT: Your previous response was not valid JSON. Return ONLY the raw JSON object, no explanation."
      : "";

    const completion = await ai.chat.completions.create(
      {
        model: QWEN_REASONING_MODEL,         // qwen3.6-plus — same as pass2.ts:160
        messages: [
          { role: "system", content: ADAPT_SYSTEM_PROMPT + extraInstruction },
          { role: "user",   content: buildAdaptUserContent(input) },
        ],
        response_format: { type: "json_object" },
        temperature: 0,                      // reproducible (client.ts:20-28)
        seed: QWEN_SEED,                     // 7
      },
      { signal: controller.signal },
    );

    clearTimeout(timer);

    const raw     = completion.choices[0]?.message?.content ?? "";
    const cleaned = stripModelOutput(raw);   // strips <think>...</think> + fences (strip.ts:1-8)
    const parsed  = JSON.parse(cleaned);
    const result  = AdaptConceptsZodSchema.safeParse(parsed);

    if (!result.success) {
      log.warn("adapt Zod validation failed", { attempt, error: result.error.message });
      lastError = result.error;
      continue;  // → repair attempt with extraInstruction on next loop
    }
    // D-06 belt-and-suspenders count guard (mirrors pass2.ts:197-200)
    if (result.data.concepts.length !== 3) {
      throw new Error(`concept count mismatch: ${result.data.concepts.length}`);
    }
    return result.data.concepts;

  } catch (err: unknown) {
    clearTimeout(timer);
    lastError = err;
    if (attempt >= MAX_RETRIES) break;
  }
}
Sentry.captureException(lastError, { tags: { stage: "remix_adapt" } }); // omni-analysis.ts:282
return null; // graceful failure → frame shows error state (D-06)
```

**Zod schema pattern** — `src/lib/engine/qwen/schemas.ts:125` (`.length(N)` enforcement):
```typescript
// schemas.ts:125: z.array(HookFactorSchema).length(5)  ← the .length(N) precedent
const AdaptConceptZodSchema = z.object({
  hook:            z.string().min(1).max(200),
  angle:           z.string().min(1).max(300),
  who_its_for:     z.string().min(1).max(200),
  format_borrowed: z.string().min(1).max(200),
});
const AdaptConceptsZodSchema = z.object({
  concepts: z.array(AdaptConceptZodSchema).length(3), // ADAPT-01: exactly 3
});
```

**strip.ts usage** — `src/lib/engine/utils/strip.ts:1-8`:
```typescript
// Called as: const cleaned = stripModelOutput(raw);
// Removes <think>...</think> blocks (qwen3.6-plus reasoning model) + markdown fences
export function stripModelOutput(text: string): string {
  let out = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const fenced = out.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
  return fenced ? fenced[1]!.trim() : out;
}
```

**Input builder guard** — enforce Pitfall 1 (no caption leak):
```typescript
// buildAdaptUserContent MUST accept only AdaptInput (Pick<DecodeOutput,...> & {niche})
// — not DecodeOutput directly. This makes passing luck[] or content_summary a type error.
function buildAdaptUserContent(input: AdaptInput): string {
  // input has: hook_pattern, structure, the_turn, emotional_beat, repeatable[], niche
  // input does NOT have: luck[], content_summary, raw caption
}
```

---

### `src/app/api/remix/adapt/route.ts` (route, POST)

**Analog:** `src/app/api/analyze/route.ts:1-17,88-145,175-183` (imports + persistCraftToVariants + auth) + `src/app/api/profile/creator-profile/route.ts:48-211` (CSRF/Content-Type guards + Zod)

**Imports pattern** — mirror analyze/route.ts:1-16:
```typescript
// src/app/api/analyze/route.ts:1-16
import * as Sentry from "@sentry/nextjs";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import type { Json } from "@/types/database.types";
import { generateAdaptConcepts } from "@/lib/engine/remix/adapt";
import type { AdaptInput } from "@/lib/engine/remix/decode-types";
```

**Auth pattern** — `src/app/api/analyze/route.ts:175-183`:
```typescript
// MUST be first thing in the POST handler (every route in the codebase uses this exact shape)
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
```

**CSRF + Content-Type guard** — `src/app/api/profile/creator-profile/route.ts:92-125`:
```typescript
// PATCH guard from creator-profile/route.ts:92-125 — apply same to POST /api/remix/adapt
const contentType = request.headers.get("content-type")?.split(";")[0]?.trim()?.toLowerCase();
if (contentType !== "application/json") {
  return Response.json({ error: "Unsupported Media Type" }, { status: 415 });
}
const origin = request.headers.get("origin");
if (origin) {
  const url = new URL(request.url);
  const expectedOrigin = `${url.protocol}//${url.host}`;
  if (origin !== expectedOrigin) {
    return Response.json({ error: "Cross-origin request denied" }, { status: 403 });
  }
}
```

**Body validation pattern** — `src/app/api/profile/creator-profile/route.ts:137-145`:
```typescript
// creatorProfilePatchSchema.safeParse(body) pattern — apply same with adapt schema
const AdaptRequestSchema = z.object({
  analysis_id: z.string().uuid(),
  decode: z.object({              // receives only AdaptInput structural fields
    hook_pattern:   z.string().min(1),
    structure:      z.string().min(1),
    the_turn:       z.string().min(1),
    emotional_beat: z.string().min(1),
    repeatable:     z.array(z.object({ label: z.string(), why_repeatable: z.string() })),
    // luck[] NOT included — D-01 structural guard at the schema level
  }),
  niche: z.string().min(1).max(200),
});
const parsed = AdaptRequestSchema.safeParse(body);
if (!parsed.success) {
  return Response.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
}
```

**Read-merge-write pattern** — `src/app/api/analyze/route.ts:102-145` (`persistCraftToVariants`):
```typescript
// src/app/api/analyze/route.ts:121-138 — the canonical read-merge-write (copy verbatim)
const service = createServiceClient();
const { data: row, error: readErr } = await service
  .from("analysis_results")
  .select("variants")
  .eq("id", analysisId)
  .single();

const current = (row?.variants ?? {}) as Record<string, unknown>;
const currentRemix = (current.remix ?? {}) as Record<string, unknown>;

const { error: writeErr } = await service
  .from("analysis_results")
  .update({ variants: { ...current, remix: { ...currentRemix, adapt: concepts } } as unknown as Json })
  .eq("id", analysisId);
// CRITICAL: spread current AND current.remix — preserves variants.craft + variants.remix.decode (Pitfall 2)
```

**Ownership check** — verify row belongs to caller before write (ASVS V4):
```typescript
// After auth, before write: confirm the analysis_results row belongs to this user
const { data: ownerRow } = await service
  .from("analysis_results")
  .select("user_id")
  .eq("id", analysisId)
  .single();
if (!ownerRow || ownerRow.user_id !== user.id) {
  return Response.json({ error: "Not found" }, { status: 404 });
}
```

---

### `src/components/board/adapt/AdaptFrameBody.tsx` (component, self-sourcing + dual-read)

**Analog:** `src/components/board/content-analysis/ContentAnalysisFrame.tsx:1-99`

**Imports + directive pattern** — `ContentAnalysisFrame.tsx:1-33`:
```typescript
// ContentAnalysisFrame.tsx:1-3
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';
// adapt-specific additions:
import { useCreatorProfile, useUpdateCreatorProfile } from '@/hooks/queries/use-creator-profile';
import { NichePicker } from '@/components/app/cards/niche-picker';
import { getPrimaryLabel, getSubLabel } from '@/lib/niches/taxonomy';
import type { AdaptConcept } from '@/lib/engine/remix/decode-types';
import { AdaptConceptCard } from './AdaptConceptCard';
```

**Self-sourcing + dual-read pattern** — `ContentAnalysisFrame.tsx:64-99`:
```typescript
// ContentAnalysisFrame.tsx:64-99 — copy this shape exactly; replace craft with adapt
export function AdaptFrameBody({ camera: _camera, layout: _layout }: AdaptFrameBodyProps) {
  const { data: permalinkData } = usePermalinkAnalysis();
  const stream = useAnalysisStream({ initialData: permalinkData ?? null });
  const row = stream.result as unknown as AdaptRow | null;

  // Dual-read: live source = mutation response held in local state (adapt is
  // generated outside the pipeline — no top-level PredictionResult field).
  // Permalink source = row?.variants?.remix?.adapt (persisted by /api/remix/adapt).
  const [liveAdaptConcepts, setLiveAdaptConcepts] = useState<AdaptConcept[] | null>(null);
  const adapt: AdaptConcept[] | null =
    (row?.variants as Record<string, unknown> | null)?.remix?.adapt as AdaptConcept[] | null
    ?? liveAdaptConcepts;

  // ContentAnalysisFrame.tsx:79-99 dual-read precedent (craft signals):
  // v.video_signals ?? row?.video_signals — two sources, variants wins on permalink
  // Same principle: variants.remix.adapt ?? liveAdaptConcepts
```

**Niche empty-gate pattern** — `use-creator-profile.ts:54-101` + `niche-picker.tsx:24-38`:
```typescript
const { data: profile } = useCreatorProfile();            // use-creator-profile.ts:54
const updateProfile = useUpdateCreatorProfile();          // use-creator-profile.ts:75
const nicheEmpty = profile?.niche_primary == null && profile?.niche_sub == null; // D-11 — BOTH null
const [draft, setDraft] = useState<{ primary: string | null; sub: string | null }>({
  primary: null, sub: null,
});

// On CTA confirm: await then pass niche directly (avoids cache-race Pitfall 5)
const handleGenerateWithNiche = async () => {
  await updateProfile.mutateAsync({ niche_primary: draft.primary, niche_sub: draft.sub });
  // cache invalidated by onSuccess (use-creator-profile.ts:95-99)
  // pass draft niche directly into adapt call — don't re-read cache (Pitfall 5)
  triggerAdaptGeneration(draft.primary!, draft.sub!);
};
```

**Already-fired guard** — prevent double-generation and regeneration on reload (Pitfall 3):
```typescript
// Mirror Board.tsx:182 streamingAnalysisIdRef pattern
const adaptFiredRef = useRef(false);
useEffect(() => {
  if (adaptFiredRef.current) return;
  // Only fire when: niche present AND decode output present AND variants.remix.adapt absent AND live session
  if (!nicheEmpty && decodeOutput && !adapt) {
    adaptFiredRef.current = true;
    triggerAdaptGeneration(nicheSlug);
  }
}, [nicheEmpty, decodeOutput, adapt]);
```

---

### `src/components/board/adapt/AdaptConceptCard.tsx` (component, Raycast card)

**Analog:** `src/components/board/_kit/FrameHero.tsx` (typography + card chrome) + `src/components/app/cards/niche-picker.tsx:59-68` (Raycast tile pattern)

**Imports:**
```typescript
import { cn } from '@/lib/utils';
import type { AdaptConcept } from '@/lib/engine/remix/decode-types';
```

**Raycast card chrome** — `FrameHero.tsx` + BRAND-BIBLE.md (verified in CLAUDE.md):
```typescript
// Raycast card: bg-transparent, border 6%, 12px radius, 2% hover, inset shadow
// Source: CLAUDE.md §"Raycast Design Language Rules" + UI-SPEC §Surface Patterns
<article
  className={cn(
    "relative flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-transparent p-4",
    "hover:bg-white/[0.02]",  // ONLY this on hover — no translate-y, no border change (Raycast rule)
  )}
  style={{ boxShadow: "rgba(255,255,255,0.05) 0px 1px 0px 0px inset" }}
>
```

**Internal layout** — hook headline + chip + divider + muted rows (UI-SPEC D-09):
```typescript
// UI-SPEC §Surface Patterns §Concept Card (each of 3)
{/* 1. Hook headline — leads with the most actionable element */}
<p className="text-base font-semibold text-foreground">{concept.hook}</p>

{/* 2. format_borrowed chip — coral, pill, "Borrowed:" prefix */}
<span className="inline-flex text-xs font-medium text-accent bg-accent/[0.12] rounded-full px-2 py-0.5">
  Borrowed: {concept.format_borrowed}
</span>

{/* 3. Divider */}
<div className="border-t border-white/[0.04] mt-2" />

{/* 4 + 5. Muted rows — Angle + Who it's for */}
{/* Label: text-xs font-medium text-white/45 uppercase tracking-widest */}
{/* Value: text-xs font-medium text-foreground-secondary */}
```

**Accessibility** — `<article>` for reading order; chip as plain `<span>` (no icon-only); `role="alert"` on error container per UI-SPEC §Accessibility.

---

### `src/components/board/adapt/AdaptShellNode.tsx` (modify — fill body)

**Analog:** existing `src/components/board/adapt/AdaptShellNode.tsx` (Phase 2 shell, lines 1-24)

**Current state** (lines 1-24):
```typescript
// 'use client' directive + single <div> + descriptor <p>
// Phase 4: replace the <p> descriptor body with <AdaptFrameBody camera={...} layout={...} />
// Keep: 'use client', data-testid="adapt-shell", outer div className
```

**Mount point context** — `src/components/board/Board.tsx:517`:
```typescript
// Board.tsx:517 — passes no props currently (shell takes none)
{layout.id === 'adapt' && <AdaptShellNode />}
// Phase 4: thread camera + layout props (same as ContentAnalysisFrame.tsx:64 receives them)
{layout.id === 'adapt' && <AdaptShellNode camera={camera} layout={layout} />}
```

**Mobile mount** — `src/components/board/BoardMobile.tsx:137`:
```typescript
// BoardMobile.tsx:137 — same change, CARD_CAMERA passed
case 'adapt':
  return <AdaptShellNode />;  // → <AdaptShellNode camera={CARD_CAMERA} layout={layout ?? ADAPT_STUB_LAYOUT} />
```

---

### `src/hooks/queries/use-adapt-concepts.ts` (hook, TanStack mutation — optional)

**Analog:** `src/hooks/queries/use-creator-profile.ts:75-101` (mutation + cache invalidation shape)

**Imports + mutation pattern** — `use-creator-profile.ts:1-12,80-101`:
```typescript
// use-creator-profile.ts:1-8
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/query-keys";

// Mutation shape (use-creator-profile.ts:82-101 — copy this exactly):
return useMutation({
  mutationFn: async (input: AdaptMutationInput) => {
    const res = await fetch("/api/remix/adapt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to generate adapt concepts");
    }
    return res.json() as Promise<{ concepts: AdaptConcept[] }>;
  },
  onSuccess: () => {
    // invalidate analysis query so permalink rehydrate picks up variants.remix.adapt
    queryClient.invalidateQueries({ queryKey: queryKeys.analysis.byId(analysisId) });
  },
});
```

---

## Shared Patterns

### Authentication (ALL new route files)
**Source:** `src/app/api/analyze/route.ts:175-183` + `src/app/api/profile/creator-profile/route.ts:48-58`
**Apply to:** `src/app/api/remix/adapt/route.ts`
```typescript
const supabase = await createClient();
const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
```

### CSRF + Content-Type Guards (state-mutating routes)
**Source:** `src/app/api/profile/creator-profile/route.ts:92-125`
**Apply to:** `src/app/api/remix/adapt/route.ts` POST handler
```typescript
// 415 Content-Type guard:
const contentType = request.headers.get("content-type")?.split(";")[0]?.trim()?.toLowerCase();
if (contentType !== "application/json") return Response.json({ error: "Unsupported Media Type" }, { status: 415 });
// 403 cross-origin guard:
const origin = request.headers.get("origin");
if (origin) {
  const url = new URL(request.url);
  if (origin !== `${url.protocol}//${url.host}`) return Response.json({ error: "Cross-origin request denied" }, { status: 403 });
}
```

### `<think>` Token + Fence Stripping (ALL Qwen calls)
**Source:** `src/lib/engine/utils/strip.ts:1-8`
**Apply to:** `src/lib/engine/remix/adapt.ts`
```typescript
// Always call stripModelOutput(raw) before JSON.parse — qwen3.6-plus emits <think> blocks
const cleaned = stripModelOutput(raw);
const parsed  = JSON.parse(cleaned);
```

### Variants JSONB Read-Merge-Write (any `variants` writer)
**Source:** `src/app/api/analyze/route.ts:121-138`
**Apply to:** `src/app/api/remix/adapt/route.ts`
```typescript
// NEVER: update({ variants: { remix: { adapt: concepts } } }) — overwrites craft + decode
// ALWAYS: read current → spread current → spread current.remix → set adapt
const current      = (row?.variants ?? {}) as Record<string, unknown>;
const currentRemix = (current.remix ?? {}) as Record<string, unknown>;
await service.from("analysis_results")
  .update({ variants: { ...current, remix: { ...currentRemix, adapt: concepts } } as unknown as Json })
  .eq("id", id);
```

### Raycast Card Language (concept cards + inline picker)
**Source:** `CLAUDE.md §"Raycast Design Language Rules"` + `src/components/app/cards/niche-picker.tsx:59-68`
**Apply to:** `AdaptConceptCard.tsx`, inline `NichePicker` wrapper in `AdaptFrameBody.tsx`
```typescript
// Cards: bg-transparent, border-white/[0.06], rounded-xl (12px), inset shadow, hover:bg-white/[0.02] ONLY
// Inputs/buttons: border-white/[0.06] default, border-white/[0.12] selected, bg-white/[0.08] selected
// NO translate-y, NO border change on hover — Raycast card rule (CLAUDE.md verified)
```

### Error Handling (routes + engine)
**Source:** `src/app/api/analyze/route.ts:139-144` + `src/lib/engine/qwen/omni-analysis.ts:282`
**Apply to:** `src/app/api/remix/adapt/route.ts`, `src/lib/engine/remix/adapt.ts`
```typescript
// In engine: Sentry.captureException(lastError, { tags: { stage: "remix_adapt" } }); return null;
// In route: try/catch wrapping the entire handler body; catch → Response.json({ error: "..." }, { status: 500 })
// Frame: null adapt → Adapt error state only — never propagates to Decode (D-06)
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/engine/remix/decode.fixture.ts` | test-fixture | — | No existing decode fixture; hand-authored against `decode-types.ts` contract |

---

## Metadata

**Analog search scope:** `src/lib/engine/qwen/`, `src/lib/engine/wave3/`, `src/lib/engine/utils/`, `src/app/api/analyze/`, `src/app/api/profile/creator-profile/`, `src/components/board/content-analysis/`, `src/components/board/adapt/`, `src/components/board/_kit/`, `src/components/app/cards/`, `src/hooks/queries/`
**Files scanned:** 14 source files read directly
**Pattern extraction date:** 2026-06-02
