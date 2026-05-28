# Phase 1: Foundation — SSE consumer + engine signal extensions — Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 13 new/modified files
**Analogs found:** 11 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/hooks/queries/use-analysis-stream.ts` | hook | streaming + request-response | `src/hooks/queries/use-analyze.ts` | exact |
| `src/lib/engine/panel-mapping.ts` | utility | transform | `src/lib/engine/events.ts` | role-match |
| `src/lib/engine/optimal-post.ts` | service | CRUD | `src/lib/engine/calibration.ts` | role-match |
| `src/app/api/analyze/[id]/stream/route.ts` | route | streaming | `src/app/api/analyze/route.ts` | exact |
| `src/app/(app)/analyze/page.tsx` | page (server) | request-response | `src/app/(app)/dashboard/page.tsx` | exact |
| `src/app/(app)/analyze/[id]/page.tsx` | page (server) | request-response | `src/app/(app)/competitors/[handle]/page.tsx` | exact |
| `src/app/(app)/analyze/[id]/result-card.tsx` | component (client) | streaming | `src/app/(app)/dashboard/dashboard-client.tsx` | role-match |
| `supabase/migrations/{ts}_niche_post_windows.sql` | migration | CRUD | `supabase/migrations/20260520100000_phase11_retention_counter.sql` | exact |
| `src/lib/engine/types.ts` (modify) | model | transform | self | n/a |
| `src/lib/engine/aggregator.ts` (modify) | service | transform | self (+ calibration.ts pattern) | n/a |
| `src/lib/engine/qwen/omni-analysis.ts` (modify) | service | request-response | self (+ schemas.ts) | n/a |
| `src/lib/engine/qwen/schemas.ts` (modify) | model | transform | self | n/a |
| `src/app/api/analyze/route.ts` (modify) | route | streaming | self | n/a |

---

## Pattern Assignments

### `src/hooks/queries/use-analysis-stream.ts` (hook, streaming)

**Analog:** `src/hooks/queries/use-analyze.ts`

**Imports pattern** (lines 1-6):
```typescript
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/query-keys";
import type { PredictionResult } from "@/lib/engine/types";
import { useState, useCallback } from "react";
```

**State shape pattern** (lines 8-14, 29-30):
```typescript
type AnalysisPhase =
  | "idle"
  | "analyzing"
  | "reasoning"
  | "scoring"
  | "complete"
  | "error";

// In function body:
const [phase, setPhase] = useState<AnalysisPhase>("idle");
const [phaseMessage, setPhaseMessage] = useState("");
```

**Core SSE line-parse loop — copy verbatim** (lines 67-99):
```typescript
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith("event: ")) {
      const eventType = line.slice(7).trim();

      // Next line should be data:
      const dataLine = lines[i + 1];
      if (dataLine?.startsWith("data: ")) {
        const data = JSON.parse(dataLine.slice(6));

        if (eventType === "phase") {
          const phaseEvent = data as SSEPhaseEvent;
          setPhase(phaseEvent.phase);
          setPhaseMessage(phaseEvent.message);
        } else if (eventType === "complete") {
          result = data as PredictionResult;
          setPhase("complete");
        } else if (eventType === "error") {
          setPhase("error");
          throw new Error(data.error);
        }
      }
    }
  }
}
```
New hook extends this loop: add branches for `"started"` (extract `id`), `"stage"` (update `stages[]` + derive `panelReady`), and unknown events (silently ignore, same as existing).

**useMutation pattern** (lines 37-113):
```typescript
const mutation = useMutation({
  mutationFn: async (input: { ... }) => {
    // 1. fetch POST
    // 2. check !res.ok
    // 3. check !res.body
    // 4. run SSE parse loop
    // 5. return result
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.analysis.history() });
  },
  onError: () => {
    setPhase("error");
  },
});

return { ...mutation, phase, phaseMessage, reset };
```

**Return shape for new hook** (add alongside existing fields):
```typescript
return {
  ...mutation,
  phase,          // existing AnalysisPhase
  result,         // PredictionResult | null
  stages,         // StageEvent[]
  partial,        // { personas: Array<{ id, status, verdict?, reasoning? }> }
  panelReady,     // Record<PanelId, 'idle'|'loading'|'ready'|'error'>
  error,          // string | null
  reconnect,      // () => void
};
```

**Polling fallback pattern** (lines 120-144 — useAnalysisDetail):
```typescript
export function useAnalysisDetail(id: string | null) {
  return useQuery({
    queryKey: queryKeys.analysis.detail(id ?? ""),
    queryFn: async () => {
      const res = await fetch(`/api/analysis/${id}`);
      if (!res.ok) throw new Error("Failed to fetch analysis detail");
      return res.json();
    },
    enabled: !!id,
  });
}
```
New hook adapts: `enabled: phase === 'polling' && !!analysisId`, `refetchInterval: 2000`, stops when row has `overall_score !== null`.

---

### `src/lib/engine/panel-mapping.ts` (utility, transform)

**Analog:** `src/lib/engine/events.ts`

**Module structure pattern** (events.ts lines 1-13):
```typescript
/**
 * [descriptive JSDoc]
 */

export type StageEventWave = 0 | 1 | 2 | 3 | 4 | "aggregator" | "post";

export type StageEvent =
  | { type: "stage_start"; ... }
  | { type: "stage_end"; ... }
  | { type: "pipeline_warning"; ... };
```
New file mirrors this: export `const PANEL_IDS`, `type PanelId`, `const STAGE_TO_PANEL`. No class, no default export, pure named exports.

**Content to author** (from RESEARCH.md Pattern 4):
```typescript
export const PANEL_IDS = [
  'verdict',
  'retention',
  'persona_breakdown',
  'hook_decomp',
  'similar_videos',
  'reasoning',
  'emotion_arc',
  'comparative_baseline',
  'optimal_post',
  'anti_virality',
] as const;

export type PanelId = (typeof PANEL_IDS)[number];

export const STAGE_TO_PANEL: Record<string, PanelId[]> = {
  'wave_1': ['hook_decomp', 'similar_videos', 'emotion_arc'],
  'wave_2': ['reasoning'],
  'wave_3_personas': ['retention', 'persona_breakdown'],
  'aggregator': ['verdict', 'comparative_baseline', 'optimal_post', 'anti_virality'],
};
```

---

### `src/lib/engine/optimal-post.ts` (service, CRUD)

**Analog:** `src/lib/engine/calibration.ts`

**Imports pattern** (calibration.ts lines 1-6):
```typescript
import * as Sentry from "@sentry/nextjs";
import { createServiceClient } from "@/lib/supabase/service";
import { createCache } from "@/lib/cache";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "calibration" });
```
New file: same pattern, module tag `"engine.optimal-post"`.

**Supabase query pattern** (calibration.ts lines 54-80):
```typescript
export async function fetchOutcomePairs(
  supabase: ReturnType<typeof createServiceClient>,
  options?: { sinceDays?: number }
): Promise<OutcomePair[]> {
  // ...
  const { data, error } = (await query) as unknown as {
    data: OutcomeRow[] | null;
    error: { message: string } | null;
  };
```
New file: same param signature — `supabase: ReturnType<typeof createServiceClient>`, cast through unknown, return typed interface.

**Non-fatal fallback pattern** (calibration.ts style — try/catch returning null on failure):
```typescript
export async function computeOptimalPostWindow(
  supabase: ReturnType<typeof createServiceClient>,
  niche: string | null,
  _creator: CreatorContext,
): Promise<OptimalPostWindow | null> {
  if (!niche) return FALLBACK;
  try {
    const { data, error } = await supabase
      .from('niche_post_windows')
      .select('day_of_week, hour_start, hour_end, sample_size')
      .eq('niche', niche)
      .single();
    if (error || !data) return FALLBACK;
    return { /* mapped result */ };
  } catch {
    return null; // non-fatal per D-15
  }
}
```

---

### `src/app/api/analyze/[id]/stream/route.ts` (route, streaming)

**Analog:** `src/app/api/analyze/route.ts`

**Route config — copy verbatim** (route.ts lines 25-27):
```typescript
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
```

**Imports pattern** (route.ts lines 1-16):
```typescript
import * as Sentry from "@sentry/nextjs";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
```

**Auth pattern** (route.ts lines 52-61):
```typescript
const supabase = await createClient();
const {
  data: { user },
} = await supabase.auth.getUser();

if (!user) {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
```

**SSE response builder — copy verbatim** (route.ts lines 243-264):
```typescript
const encoder = new TextEncoder();
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(
      encoder.encode(
        `event: complete\ndata: ${JSON.stringify(cached)}\n\n`
      )
    );
    controller.close();
  },
});
return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    Vary: "Accept",
  },
});
```
New GET endpoint extends this: adds heartbeat `setInterval`, handles `Last-Event-ID` header, short-polls DB for in-flight analyses (see RESEARCH.md Example 1).

**`send` helper pattern** (route.ts lines 401-405):
```typescript
const send = (event: string, data: unknown) => {
  controller.enqueue(
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  );
};
```
GET endpoint adds optional `eventId` param: `send(event, data, eventId?)` — prepend `id: ${eventId}\n` when provided.

**Supabase row lookup + notFound pattern** (competitors/[handle]/page.tsx lines 56-63):
```typescript
const { data: row, error } = await supabase
  .from("analysis_results")
  .select("*")
  .eq("id", id)
  .eq("user_id", user.id)
  .is("deleted_at", null)
  .single();

if (error || !row) {
  return Response.json({ error: "Analysis not found" }, { status: 404 });
}
```

---

### `src/app/(app)/analyze/page.tsx` (page server, request-response)

**Analog:** `src/app/(app)/dashboard/page.tsx`

**Imports + metadata pattern** (dashboard/page.tsx lines 1-8):
```typescript
import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardClient } from "./dashboard-client";

export const metadata: Metadata = {
  title: "Dashboard | Virtuna",
  description: "AI-powered content intelligence for TikTok creators.",
};
```

**Server shell pattern** (dashboard/page.tsx lines 15-21):
```typescript
export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardClient />
    </Suspense>
  );
}
```
New page: same shape, renders `<ContentForm>` inside Suspense. No server data fetch needed — form page is static shell.

**Auth gating:** inherited from `src/app/(app)/layout.tsx` (lines 13-32) — layout does `redirect("/login")` on no user. New page inside `(app)/` group gets this for free, no per-page auth check.

---

### `src/app/(app)/analyze/[id]/page.tsx` (page server, request-response)

**Analog:** `src/app/(app)/competitors/[handle]/page.tsx`

**Dynamic segment + metadata pattern** (competitors/[handle]/page.tsx lines 23-34):
```typescript
interface DetailPageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({
  params,
}: DetailPageProps): Promise<Metadata> {
  const { handle } = await params;
  return {
    title: `@${handle} | Competitors | Virtuna`,
  };
}
```
New file: `params: Promise<{ id: string }>`, metadata from fetched row title/content_type.

**Server fetch + notFound pattern** (competitors/[handle]/page.tsx lines 44-72):
```typescript
export default async function CompetitorDetailPage({ params }: DetailPageProps) {
  const { handle } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("competitor_profiles")
    .select("*")
    .eq("tiktok_handle", handle)
    .single();

  if (!profile) notFound();
  // ... compute + pass as props to client
  return (
    <div ...>
      <ClientComponent initialData={...} />
    </div>
  );
}
```
New file: fetch `analysis_results` by `id` + `user_id`. Pass `initialData={row}` to `<ResultCard>`.

**Parallel fetch pattern** (compare/page.tsx lines 68-80):
```typescript
const [{ data: snapshots }, { data: videos }] = await Promise.all([
  supabase.from("competitor_snapshots")...
  supabase.from("competitor_videos")...
]);
```
New file: single fetch is fine; use `Promise.all` if additional data needed (creator profile for metadata, etc.).

---

### `src/app/(app)/analyze/[id]/result-card.tsx` (component client, streaming)

**Analog:** `src/app/(app)/dashboard/dashboard-client.tsx`

**"use client" + imports pattern** (dashboard-client.tsx lines 1-25):
```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  TestTypeSelector,
  ContentForm,
  LoadingPhases,
  ResultsPanel,
} from "@/components/app";
import { useAnalyze } from "@/hooks/queries";
```
New file: `"use client"` directive, import `useAnalysisStream` from `@/hooks/queries`, import panel constants from `@/lib/engine/panel-mapping`.

**Props interface pattern** (compare/page.tsx lines 16-32 — ComparisonData as typed prop):
```typescript
export interface ComparisonData { ... }
// passed as: <ComparisonClient dataA={dataA} dataB={dataB} ... />
```
New file: `interface ResultCardProps { initialData: AnalysisResultRow | null }` — received from server page, drives stream-open gate (Pitfall #3).

**Stream-open gate** (from Pitfall #3 in RESEARCH.md):
```typescript
// Hook accepts initialData — if already complete, skip stream
// initialData?.overall_score !== null → phase='complete', no stream
```

---

### `supabase/migrations/{ts}_niche_post_windows.sql` (migration, CRUD)

**Analog:** `supabase/migrations/20260520100000_phase11_retention_counter.sql`

**Migration header pattern** (phase11 lines 1-9):
```sql
-- Phase N: [what it does]
-- Adds [columns]:
--   table.column — purpose (requirement ID)
-- Creates [function/index] for [reason]
-- All statements use IF NOT EXISTS / CREATE OR REPLACE for idempotent re-runs.
-- RLS: [policy note]
```

**ADD COLUMN idempotent pattern** (phase11 lines 11-18):
```sql
ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS analysis_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS storage_retention_opted_in BOOLEAN NOT NULL DEFAULT false;
```
New migration: `CREATE TABLE IF NOT EXISTS niche_post_windows (...)`.

**pg_cron pattern** (phase11 uses `rpc("increment_creator_analysis_count", ...)` — cron reference from phase8):
```sql
SELECT cron.schedule(
  'job-name',
  '15 6 * * *',
  $$SELECT fn_name()$$
);
```
Verified pg_cron installed (phase8 pgvector migration + phase11 retention counter both reference it).

---

### `src/lib/engine/types.ts` (modify — extend PredictionResult)

**Existing PredictionResult assembly** (aggregator.ts lines 990-1030):
```typescript
const result: PredictionResult = {
  overall_score,
  confidence: conf.confidence,
  // ...
  audio_perceptual_score,
  audio_fingerprint: audioFingerprintResult,
  audio_description,
  score_weights: weights,
  // ...
};
```
New fields follow the same optional-with-comment pattern used for Phase 6 additions (lines 180-186):
```typescript
/** Phase 6 (D-G3) — ... Optional to preserve compile against existing consumers */
audio_perceptual_score?: number;
/** Phase 6 (D-G1) — ... Optional to preserve compile ... */
audio_fingerprint?: AudioFingerprintResult | null;
```
Add for Phase 1:
```typescript
/** Phase 1 (D-13) — Optimal posting window. Null on failure (non-fatal per D-15). */
optimal_post_window?: OptimalPostWindow | null;
/** Phase 1 (R1.7) — Emotion arc from Omni Plus. Null when video absent. */
emotion_arc?: EmotionArcPoint[] | null;
```

---

### `src/lib/engine/aggregator.ts` (modify — call computeOptimalPostWindow)

**Call-site insertion point** (aggregator.ts line 990 — just before `const result: PredictionResult`):
Insert `computeOptimalPostWindow` call here. Pattern matches existing non-fatal stage calls:

**Non-fatal try/catch pattern** (calibration.ts style used throughout aggregator):
```typescript
let optimal_post_window: OptimalPostWindow | null = null;
try {
  optimal_post_window = await computeOptimalPostWindow(
    serviceClient,
    pipelineResult.payload.niche ?? null,
    /* creator */ {} as CreatorContext,
  );
} catch {
  // non-fatal — D-15: null on failure, panel shows generic copy
}
```
Then add to `result` object: `optimal_post_window`.

---

### `src/lib/engine/qwen/omni-analysis.ts` + `src/lib/engine/qwen/schemas.ts` (modify — add emotion_arc)

**Zod schema extension pattern** (schemas.ts lines 36-47):
```typescript
const HookFactorSchema = z.object({
  name: z.enum([...]),
  score:           ScoreSchema,
  rationale:       z.string().min(1).max(300),
  improvement_tip: z.string().max(300).optional(),
});
```
New schema field uses `.optional()` for backward compat (same pattern as `improvement_tip`):
```typescript
const EmotionArcPointSchema = z.object({
  timestamp_ms:  z.number().min(0),
  intensity_0_1: z.number().min(0).max(1),
  label:         z.enum(['low', 'mid', 'high']).optional(),
});

// In OmniAnalysisZodSchema:
emotion_arc: z.array(EmotionArcPointSchema).optional(),
```

**System prompt extension** (omni-analysis.ts lines 48-60 — `buildSystemPrompt`):
```typescript
function buildSystemPrompt(opts: OmniAnalysisOptions): string {
  // ...
  return `...Return ONLY valid JSON matching this exact structure:
{
  "content_type": "...",
  // existing fields...
  "emotion_arc": [{ "timestamp_ms": 0, "intensity_0_1": 0.7, "label": "high" }, ...]
  // array of 3-8 points across video timeline; omit if video absent
}`;
}
```

---

### `src/app/api/analyze/route.ts` (modify — insert placeholder row + `event: started`)

**Existing INSERT location** (route.ts lines 449-452):
```typescript
const { error: insertError } = await service
  .from("analysis_results")
  .insert(buildInsertRow(finalResult, ruleContributions));
```
Modification per Pitfall #6 Option A: add a second early INSERT (after auth + validation, before pipeline call) that creates a placeholder row with `overall_score=null`. Emit `event: started` with the new `id` in the first SSE frame. Pattern for early send:
```typescript
// After validation, before pipeline:
const analysisId = nanoid(12); // or uuid from DB
send("started", { id: analysisId });
```
`useAnalyze` (lines 86-96) only branches on `phase`, `complete`, `error` — unknown `started` event is silently ignored. Backward compat confirmed.

---

## Shared Patterns

### Authentication
**Source:** `src/app/(app)/layout.tsx` lines 13-32 (layout guard) + `src/app/api/analyze/route.ts` lines 52-61 (API guard)

**Apply to:** All new route handlers (`/api/analyze/[id]/stream/route.ts`), all new server pages (`analyze/page.tsx`, `analyze/[id]/page.tsx`)

Route handler pattern:
```typescript
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
```
Server page inside `(app)/` group inherits layout redirect — no per-page check needed, but `if (!user) return null` is the defensive fallback (seen in competitors/[handle]/page.tsx line 53).

### Logging
**Source:** `src/app/api/analyze/route.ts` lines 49-51
**Apply to:** New GET stream endpoint
```typescript
const requestId = nanoid(12);
const log = createLogger({ requestId, module: "analyze.stream" });
```
Log `info` on stream connect (with `id`, `lastEventId`, status), `error` on DB insert failure.

### SSE Response Headers
**Source:** `src/app/api/analyze/route.ts` lines 255-263
**Apply to:** New GET stream endpoint
```typescript
{
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
  Vary: "Accept",
}
```
Copy verbatim — these headers prevent buffering at Vercel edge + Nginx proxies.

### TanStack Query Key Registration
**Source:** `src/lib/queries/query-keys.ts` lines 20-24
**Apply to:** `use-analysis-stream.ts` polling fallback + any new query in the hook
```typescript
analysis: {
  all: ["analysis"] as const,
  history: () => ["analysis", "history"] as const,
  detail: (id: string) => ["analysis", "detail", id] as const,
},
```
New hook polling query reuses `queryKeys.analysis.detail(id)`. No new key namespace needed.

### Zod `.optional()` for new engine fields
**Source:** `src/lib/engine/qwen/schemas.ts` lines 46-47
**Apply to:** `emotion_arc` in OmniAnalysisZodSchema, `optimal_post_window` in types.ts
```typescript
improvement_tip: z.string().max(300).optional(),
```
All new fields added to existing Zod schemas MUST use `.optional()` (never `.required()`) to preserve backward compat with existing consumers that construct these objects without the new fields.

### Non-fatal engine stage pattern
**Source:** `src/lib/engine/aggregator.ts` (existing audio_fingerprint stage + calibration stage)
**Apply to:** `computeOptimalPostWindow` call in aggregator, `emotion_arc` extraction in omni-analysis
```typescript
try {
  // new computation
} catch {
  // set field to null — never throw
  // optionally push to pipelineResult.warnings
}
```

### Migration idempotency
**Source:** `supabase/migrations/20260520100000_phase11_retention_counter.sql` lines 11-16
**Apply to:** `{ts}_niche_post_windows.sql`
```sql
-- All DDL uses IF NOT EXISTS / CREATE OR REPLACE
ALTER TABLE foo ADD COLUMN IF NOT EXISTS bar TEXT NULL;
CREATE OR REPLACE FUNCTION ...
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Wave 0 test files (11 files in `src/hooks/queries/__tests__/`, `src/app/api/analyze/__tests__/`, `src/lib/engine/__tests__/`, `e2e/`) | test | various | No existing test for SSE hook or stream-by-id endpoint; closest is `src/lib/engine/__tests__/aggregator.test.ts` for engine unit tests. Use Vitest happy-dom pragma for hook tests, node env for route handler tests. |
| Test fixtures (`src/test/fixtures/stage-events.ts`, `src/test/fixtures/completed-prediction.ts`) | utility | transform | No existing fixture files in this path; `src/lib/engine/__tests__/factories.ts` is closest analog (typed factory helpers). |

For test files: use RESEARCH.md §Validation Architecture as the pattern source. Vitest happy-dom pragma: `// @vitest-environment happy-dom`. Node env is default. Mock pattern follows existing engine tests in `src/lib/engine/__tests__/aggregator.test.ts`.

---

## Metadata

**Analog search scope:** `src/hooks/queries/`, `src/app/api/analyze/`, `src/app/(app)/`, `src/lib/engine/`, `supabase/migrations/`
**Files scanned:** 14 source files read in full or targeted excerpts
**Pattern extraction date:** 2026-05-24
