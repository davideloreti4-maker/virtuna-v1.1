# Phase 8: UX Gap Closure - Research

**Researched:** 2026-02-13
**Domain:** SSE timing, minimum duration enforcement, route wiring, prop usage
**Confidence:** HIGH

## Summary

Phase 8 closes the 2 remaining unsatisfied requirements from the v1.0 milestone audit: UX-02 (minimum 4.5s theater duration) and UX-08 (broken analyze button routing). Both are well-scoped with clear fixes and minimal blast radius.

The SSE timing issue is the most nuanced: currently all 4 phase events (`analyzing`, `matching`, `simulating`, `generating`) are emitted synchronously before `runPredictionPipeline()` is called in `analyze/route.ts:50-56`. The pipeline has natural stages (parallel Gemini+rules+trends, then sequential DeepSeek+aggregation) that SSE events should map to. The minimum duration enforcement is cleanest at the client level using `Promise.all([mutation, sleep(4500)])` in the hook, ensuring the UI never transitions to `viewing-results` before 4.5s regardless of backend speed.

The routing fix is trivial: change `/viral-predictor` to `/dashboard` in `video-detail-modal.tsx:131` and wire the `url` search param to pre-fill the content form on the dashboard.

**Primary recommendation:** Fix SSE event timing server-side (spread across pipeline stages), enforce minimum duration client-side (in `useAnalyze` or `DashboardClient`), wire `phaseMessage` prop in LoadingPhases, and fix routing + URL pre-fill.

## Standard Stack

### Core

No new libraries needed. All fixes use existing stack:

| Library | Version | Purpose | Already In Use |
|---------|---------|---------|----------------|
| Next.js 15 | 15.x | API routes (SSE), App Router (routing) | Yes |
| TanStack Query | 5.x | `useAnalyze` mutation hook | Yes |
| Zustand | 4.x | Test store (UI flow state) | Yes |
| Framer Motion | 11.x | LoadingPhases animation | Yes |

### Supporting

| Library | Purpose | When to Use |
|---------|---------|-------------|
| `next/navigation` | `useSearchParams` for reading URL params | Dashboard URL pre-fill |

### Alternatives Considered

None. All fixes are modifications to existing code, no new dependencies.

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Relevant File Map

```
src/
├── app/
│   ├── api/analyze/route.ts          # SSE phase events (FIX: spread timing)
│   └── (app)/dashboard/
│       ├── page.tsx                   # Server component (no changes)
│       └── dashboard-client.tsx       # Mutation wiring, min duration, URL pre-fill
├── hooks/queries/
│   └── use-analyze.ts                # SSE parsing, phase/phaseMessage state
├── components/
│   ├── app/simulation/
│   │   └── loading-phases.tsx         # Phase display (FIX: use phaseMessage)
│   └── trending/
│       └── video-detail-modal.tsx     # Analyze button (FIX: routing)
├── stores/
│   └── test-store.ts                  # SimulationPhase type, PHASE_MESSAGES
└── lib/engine/
    ├── pipeline.ts                    # Orchestration (no onProgress callback)
    ├── gemini.ts                      # Parallel stage 1
    ├── rules.ts                       # Parallel stage 1
    ├── trends.ts                      # Parallel stage 1
    ├── deepseek.ts                    # Sequential stage 2
    └── aggregator.ts                  # Sequential stage 3
```

### Pattern 1: Server-Side SSE Phase Spreading

**What:** Move SSE phase events from "all at once before pipeline" to interleaved with actual pipeline stages.

**Current (broken):**
```typescript
// analyze/route.ts:49-59 — ALL events sent BEFORE pipeline runs
send("phase", { phase: "analyzing", message: "Analyzing content..." });
send("phase", { phase: "matching", message: "Matching rules and trends..." });
send("phase", { phase: "simulating", message: "Simulating audience reactions..." });
send("phase", { phase: "generating", message: "Generating predictions..." });

// Only THEN does pipeline run
const result = await runPredictionPipeline(input);
```

**Fix approach — inline pipeline in route (recommended):**
```typescript
// Inline the pipeline stages directly in the SSE handler
// so events can be sent BETWEEN actual stages

send("phase", { phase: "analyzing", message: "Analyzing content..." });

// Stage 1: Parallel — Gemini + rules + trends
const [geminiResult, rules, trendEnrichment] = await Promise.all([
  analyzeWithGemini(validated),
  loadActiveRules(supabase, validated.content_type),
  enrichWithTrends(supabase, validated),
]);

send("phase", { phase: "matching", message: "Matching against rules..." });

// Stage 2: Score against rules
const ruleResult = await scoreContentAgainstRules(
  validated.content_text,
  rules
);

send("phase", { phase: "simulating", message: "Simulating audience reactions..." });

// Stage 3: DeepSeek reasoning
const deepseekResult = await reasonWithDeepSeek({...});

send("phase", { phase: "generating", message: "Generating predictions..." });

// Stage 4: Aggregate
const result = aggregateScores(...);

send("complete", result);
```

**Alternative — callback approach:**
Add an `onProgress` callback to `runPredictionPipeline`. This is cleaner separation but adds complexity for a single consumer. The inline approach is simpler and the route is the only caller.

**When to use:** The inline approach is preferred because the route is the only consumer of the pipeline, and inlining gives direct control over when SSE events fire.

### Pattern 2: Client-Side Minimum Duration Floor

**What:** Ensure the UI never transitions from "simulating" to "viewing-results" before 4.5s have elapsed since submission.

**Approach — wrap at the call site in DashboardClient:**
```typescript
const MINIMUM_THEATER_MS = 4500;

const handleContentSubmit = (content: string) => {
  const startTime = Date.now();
  setSubmittedContent(content);
  setStatus("simulating");

  analyzeMutation.mutate(
    { content_text: content, ... },
    {
      onSuccess: async () => {
        const elapsed = Date.now() - startTime;
        const remaining = MINIMUM_THEATER_MS - elapsed;
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining));
        }
        setStatus("viewing-results");
      },
      onError: () => setStatus("filling-form"),
    }
  );
};
```

**Why client-side, not server-side:** The 4.5s is a UX requirement. The server should respond as fast as possible. The client enforces the minimum theater duration. This keeps concerns separated and avoids artificial server-side delays.

**Important:** The same pattern must be applied in BOTH `DashboardClient` (dashboard-client.tsx) AND `TestCreationFlow` (test-creation-flow.tsx), since both have their own `handleContentSubmit` and `handleSurveySubmit` handlers that call `analyzeMutation.mutate()`. Extract a shared helper or constant for the 4500ms value.

### Pattern 3: URL Pre-fill via Search Params

**What:** When the Analyze button navigates from trending to dashboard, pass the video URL as a search param and pre-fill the content form.

**Flow:**
1. `video-detail-modal.tsx` navigates to `/dashboard?url=<encoded_url>`
2. `dashboard-client.tsx` reads `url` search param via `useSearchParams()`
3. Auto-fills content form and optionally auto-selects test type

**Consideration:** The dashboard currently has no `useSearchParams` usage. The `ContentForm` initializes content as empty string `useState("")`. Pre-fill needs to either:
- Set content in the form via a prop (cleanest)
- Or set it via the Zustand store
- Or auto-trigger the flow (auto-select type, pre-fill, potentially auto-submit)

The simplest approach: dashboard reads `?url=` param, auto-selects "tiktok-script" type, transitions to "filling-form" status, and passes the URL as initial content. This doesn't require modifying ContentForm internals.

### Anti-Patterns to Avoid

- **Server-side artificial delays:** Don't add `setTimeout` or `sleep` in the API route to slow down responses. The minimum duration is a client concern.
- **Modifying runPredictionPipeline for SSE:** Don't pass a `send` callback into the pipeline function. The pipeline is a pure business logic layer. SSE is a transport concern that belongs in the route handler.
- **Mutating state after component unmount:** The `setTimeout` in the minimum duration pattern could fire after navigation. Use a cleanup mechanism or check mount state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Search param reading | Manual `window.location.search` parsing | `useSearchParams()` from `next/navigation` | SSR-safe, reactive, standard Next.js pattern |
| Phase message display | Custom message lookup from `PHASE_MESSAGES` constant | Direct use of `phaseMessage` prop from SSE events | SSE already sends the message text; PHASE_MESSAGES is redundant |

**Key insight:** The SSE event payload already includes the phase message text (e.g., `{ phase: "analyzing", message: "Analyzing content..." }`). The `PHASE_MESSAGES` constant in test-store.ts is a leftover from pre-SSE design. The `phaseMessage` prop on LoadingPhases receives the real-time message from the server — just use it directly instead of looking up from the constant.

## Common Pitfalls

### Pitfall 1: Race Condition in Minimum Duration Timer

**What goes wrong:** User cancels during the minimum duration wait, but the `setTimeout` callback still fires and transitions to "viewing-results" after the form has been reset.

**Why it happens:** The `onSuccess` callback closes over stale state references, and the timer fires regardless of whether the user has cancelled.

**How to avoid:** Check current status before transitioning, or use an AbortController / ref to track whether the submission is still active.

**Warning signs:** Clicking "Cancel" during loading and then seeing results flash briefly.

### Pitfall 2: Duplicate Phase Events in SSE Buffer

**What goes wrong:** The SSE parser in `useAnalyze` processes lines by looking for `event:` followed by `data:` on the next line. If the stream chunks split an event across reads, events could be missed or duplicated.

**Why it happens:** `ReadableStream.read()` doesn't guarantee line-aligned chunks. The existing buffer logic handles partial lines but assumes `event:` and `data:` lines arrive in the same chunk.

**How to avoid:** The existing buffer implementation at `use-analyze.ts:60-93` already handles line splitting correctly: it accumulates in `buffer`, splits on `\n`, and keeps the last incomplete line. The `event:` / `data:` pair parsing at lines 71-76 looks ahead to `lines[i+1]` which should work since both lines would be complete before the pair is processed. Verify this works with the new spread timing by testing with actual SSE events.

**Warning signs:** Missing phase transitions (e.g., jumping from "analyzing" to "generating" without "matching" / "simulating").

### Pitfall 3: Type Mismatch Between AnalysisPhase and SimulationPhase

**What goes wrong:** `useAnalyze` uses `AnalysisPhase` (which includes "idle", "complete", "error") while `LoadingPhases` expects `SimulationPhase` (only "analyzing", "matching", "simulating", "generating"). The dashboard bridges this with `as SimulationPhase | null` cast at line 192.

**Why it happens:** Two separate type definitions for overlapping concepts. `AnalysisPhase` is a superset.

**How to avoid:** The cast is acceptable since LoadingPhases only renders during "simulating" status (when phase is always a valid `SimulationPhase`). Don't unify the types — they serve different purposes (hook lifecycle vs. animation states).

**Warning signs:** TypeScript errors when removing the cast.

### Pitfall 4: DB Operations After SSE Events in Route

**What goes wrong:** When inlining the pipeline in the route, the DB save and usage tracking operations (currently at `route.ts:62-96`) happen after the pipeline. If we send `complete` event before DB save finishes, the results are shown but not persisted.

**Why it happens:** Current code sends `complete` after DB save. When restructuring for phase spreading, it's easy to accidentally send `complete` too early.

**How to avoid:** Keep the DB save and usage tracking BEFORE the `send("complete", result)` call, exactly as it is now. The order should be: pipeline stages with phase events -> DB save -> usage tracking -> send("complete").

### Pitfall 5: Missing Suspense Boundary for useSearchParams

**What goes wrong:** `useSearchParams()` in a client component without a Suspense boundary causes a build error in Next.js 15.

**Why it happens:** Next.js 15 requires client components using `useSearchParams` to be wrapped in `<Suspense>`.

**How to avoid:** Either wrap DashboardClient in a Suspense boundary in `page.tsx`, or use a pattern where the page.tsx (server component) passes `searchParams` as props.

**Warning signs:** Build error: "useSearchParams() should be wrapped in a suspense boundary at page..."

## Code Examples

### Example 1: Inlined Pipeline with Spread SSE Events

```typescript
// analyze/route.ts — SSE handler with phases spread across pipeline stages
const stream = new ReadableStream({
  async start(controller) {
    const send = (event: string, data: unknown) => {
      controller.enqueue(
        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      );
    };

    try {
      const validated = AnalysisInputSchema.parse(body);
      const service = createServiceClient();

      // Phase 1: Analyzing (Gemini + rules loading + trends — parallel)
      send("phase", { phase: "analyzing", message: "Analyzing content structure and patterns..." });
      const [geminiResult, rules, trendEnrichment] = await Promise.all([
        analyzeWithGemini(validated),
        loadActiveRules(service, validated.content_type),
        enrichWithTrends(service, validated),
      ]);

      // Phase 2: Matching (rule scoring)
      send("phase", { phase: "matching", message: "Matching against rule library and trends..." });
      const ruleResult = await scoreContentAgainstRules(
        validated.content_text,
        rules
      );

      // Phase 3: Simulating (DeepSeek reasoning)
      send("phase", { phase: "simulating", message: "Simulating audience reactions..." });
      const deepseekResult = await reasonWithDeepSeek({
        input: validated,
        gemini_analysis: geminiResult.analysis,
        rule_result: ruleResult,
        trend_enrichment: trendEnrichment,
      });

      // Phase 4: Generating (aggregation + DB save)
      send("phase", { phase: "generating", message: "Generating predictions and insights..." });
      const latencyMs = Math.round(performance.now() - start);
      const result = aggregateScores(
        geminiResult.analysis,
        ruleResult,
        trendEnrichment,
        deepseekResult,
        geminiResult.cost_cents,
        latencyMs,
      );

      // DB save (before sending complete)
      await service.from("analysis_results").insert({...});
      await service.from("usage_tracking").upsert({...});

      send("complete", result);
    } catch (error) {
      send("error", { error: error instanceof Error ? error.message : "Pipeline failed" });
    } finally {
      controller.close();
    }
  },
});
```

### Example 2: Client-Side Minimum Duration

```typescript
// Shared constant (e.g., in lib/constants.ts or inline)
const MINIMUM_THEATER_MS = 4500;

// In DashboardClient handleContentSubmit:
const handleContentSubmit = (content: string) => {
  if (!selectedSocietyId || !currentTestType) return;

  const theatreStart = Date.now();
  setSubmittedContent(content);
  setStatus("simulating");

  analyzeMutation.mutate(
    {
      content_text: content,
      content_type: contentTypeMap[currentTestType] ?? "post",
      society_id: selectedSocietyId,
    },
    {
      onSuccess: async () => {
        const elapsed = Date.now() - theatreStart;
        const remaining = MINIMUM_THEATER_MS - elapsed;
        if (remaining > 0) {
          await new Promise((resolve) => setTimeout(resolve, remaining));
        }
        setStatus("viewing-results");
      },
      onError: () => setStatus("filling-form"),
    }
  );
};
```

### Example 3: phaseMessage Prop Usage in LoadingPhases

```typescript
// Current (broken): phaseMessage is accepted but prefixed with _ (unused)
export function LoadingPhases({ simulationPhase, phaseMessage: _phaseMessage, onCancel }: LoadingPhasesProps) {

// Fixed: Use phaseMessage to show real-time status text
export function LoadingPhases({ simulationPhase, phaseMessage, onCancel }: LoadingPhasesProps) {
  // ... existing skeleton logic ...

  return (
    <div className="space-y-3">
      {/* Phase status message */}
      {phaseMessage && (
        <p className="text-sm text-foreground-muted text-center animate-pulse">
          {phaseMessage}
        </p>
      )}

      <AnimatePresence mode="popLayout">
        {/* ... existing skeleton sections ... */}
      </AnimatePresence>

      <Button variant="secondary" onClick={onCancel} className="mt-4 w-full">
        Cancel
      </Button>
    </div>
  );
}
```

### Example 4: Fixed Analyze Button Routing

```typescript
// Current (broken):
const handleAnalyze = () => {
  if (!video) return;
  const url = `/viral-predictor?url=${encodeURIComponent(video.tiktokUrl)}`;
  router.push(url);
  onOpenChange(false);
};

// Fixed:
const handleAnalyze = () => {
  if (!video) return;
  const url = `/dashboard?url=${encodeURIComponent(video.tiktokUrl)}`;
  router.push(url);
  onOpenChange(false);
};
```

### Example 5: Dashboard URL Pre-fill

```typescript
// dashboard-client.tsx — read URL param and auto-start flow
import { useSearchParams } from "next/navigation";

export function DashboardClient() {
  const searchParams = useSearchParams();
  const urlParam = searchParams.get("url");

  // Auto-start flow when URL param is present
  useEffect(() => {
    if (urlParam && currentStatus === "idle") {
      setTestType("tiktok-script");
      setStatus("filling-form");
      // ContentForm will need to receive initialContent prop
    }
  }, [urlParam]);
  // ...
}

// page.tsx — add Suspense boundary for useSearchParams
import { Suspense } from "react";

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardClient />
    </Suspense>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All SSE events sent before pipeline | Events interleaved with pipeline stages | This phase | Natural phase progression in UI |
| No minimum theater duration | Client-side 4.5s floor with `Promise.all` | This phase | Consistent UX regardless of backend speed |
| `phaseMessage` prop unused (`_` prefix) | Prop displayed in LoadingPhases UI | This phase | Real-time phase-specific messaging |
| `/viral-predictor` route (doesn't exist) | `/dashboard?url=` with pre-fill | This phase | Working cross-page analyze flow |

**Deprecated/outdated:**
- `PHASE_MESSAGES` constant in `test-store.ts`: Redundant now that SSE events carry their own message text. Can be removed or kept as fallback.

## Open Questions

1. **ContentForm initial content prop**
   - What we know: ContentForm initializes `content` as empty string `useState("")`. It has a pre-fill path for history viewing (lines 77-81) but no prop for initial content from URL params.
   - What's unclear: Should ContentForm accept an `initialContent` prop, or should the dashboard set content via a different mechanism (e.g., passing through store)?
   - Recommendation: Add `initialContent?: string` prop to ContentForm. Simpler than routing through store. The `useEffect` for history viewing is a precedent.

2. **TestCreationFlow parity**
   - What we know: TestCreationFlow (test-creation-flow.tsx) also calls `analyzeMutation.mutate()` with `onSuccess: () => setStatus("viewing-results")`. It does NOT use LoadingPhases (uses a simple Spinner instead, line 187).
   - What's unclear: Should TestCreationFlow also enforce the 4.5s minimum? Its "simulating" state shows a basic spinner, not the theater.
   - Recommendation: Apply minimum duration to TestCreationFlow too for consistency, even though its loading state is simpler. Users shouldn't see results faster just because they used a different entry point.

3. **Cancel during minimum duration wait**
   - What we know: If user clicks "Cancel" during the wait period after backend has already responded, we need to prevent the delayed `setStatus("viewing-results")` from firing.
   - What's unclear: Best cleanup pattern.
   - Recommendation: Use a ref (`isCancelledRef`) that's set to `true` when cancel is clicked, and check it before calling `setStatus("viewing-results")` in the `onSuccess` handler.

## Sources

### Primary (HIGH confidence)

- **Direct codebase inspection** — all 4 owned files read and analyzed:
  - `src/hooks/queries/use-analyze.ts` (SSE parsing, AnalysisPhase type, phaseMessage state)
  - `src/app/api/analyze/route.ts` (SSE event emission, pipeline call)
  - `src/components/trending/video-detail-modal.tsx` (broken `/viral-predictor` route at line 131)
  - `src/components/app/simulation/loading-phases.tsx` (unused `_phaseMessage` prop at line 127)
- **Supporting files analyzed:**
  - `src/app/(app)/dashboard/dashboard-client.tsx` (mutation wiring, no searchParams usage)
  - `src/stores/test-store.ts` (SimulationPhase type, PHASE_MESSAGES constant)
  - `src/lib/engine/pipeline.ts` (pipeline orchestration, no progress callback)
  - `src/components/app/test-creation-flow.tsx` (parallel mutation consumer)
  - `src/components/app/content-form.tsx` (no initialContent prop, history pre-fill exists)
- **`.planning/v1.0-MILESTONE-AUDIT.md`** — gap analysis for UX-02 and UX-08

### Secondary (MEDIUM confidence)

- Next.js 15 `useSearchParams` Suspense requirement — well-documented in Next.js docs

### Tertiary (LOW confidence)

None — all findings are from direct codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all existing code
- Architecture: HIGH — all 4 fixes are straightforward modifications to known files
- Pitfalls: HIGH — identified from actual code paths and type analysis

**Research date:** 2026-02-13
**Valid until:** 2026-03-13 (stable — no external dependencies changing)
