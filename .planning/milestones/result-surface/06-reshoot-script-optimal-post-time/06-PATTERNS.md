# Phase 6: Reshoot Script + Optimal Post Time — Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 19 new/modified files
**Analogs found:** 18 / 19

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/api/analyze/[id]/script/route.ts` | API route | request-response | `src/app/api/analyze/[id]/comparisons/route.ts` | exact |
| `src/app/api/analyze/[id]/script/__tests__/route.test.ts` | test | — | `src/app/api/analyze/[id]/override/__tests__/route.test.ts` | exact |
| `src/app/api/analyze/[id]/optimal-post-override/route.ts` | API route | request-response | `src/app/api/analyze/[id]/override/route.ts` | exact |
| `src/app/api/analyze/[id]/optimal-post-override/__tests__/route.test.ts` | test | — | `src/app/api/analyze/[id]/override/__tests__/route.test.ts` | exact |
| `supabase/migrations/20260530000000_script_result.sql` | migration | — | `supabase/migrations/20260527000000_audience_overrides.sql` | role-match |
| `supabase/migrations/20260530000001_optimal_post_override.sql` | migration | — | `supabase/migrations/20260527000000_audience_overrides.sql` | role-match |
| `src/lib/script-utils.ts` | utility | transform | `src/components/board/actions/SimilarVideoCardCompact.tsx` (`formatCompactNumber`) | partial |
| `src/lib/optimal-post-time.ts` | utility | transform | none (new pattern — Intl.DateTimeFormat) | no analog |
| `src/lib/optimal-post-time.test.ts` | test | — | `src/app/api/analyze/[id]/override/__tests__/route.test.ts` | partial |
| `src/components/board/actions/script/ScriptBody.tsx` | component | request-response | `src/components/board/actions/SimilarVideosCard.tsx` | role-match |
| `src/components/board/actions/script/ScriptInspectorTrigger.tsx` | component | request-response | `src/components/board/audience/PersonaInspector.tsx` | role-match |
| `src/components/board/actions/script/ScriptEmptyState.tsx` | component | request-response | `src/components/board/actions/SimilarVideosCard.tsx` (empty state pattern) | role-match |
| `src/components/board/actions/script/CopyButton.tsx` | component | event-driven | `src/hooks/useCopyToClipboard.ts` (hook) | partial |
| `src/components/board/actions/script/use-script.ts` | hook/query | request-response | `src/components/board/verdict/use-comparisons.ts` | exact |
| `src/components/board/actions/script/script-constants.ts` | config | — | `src/components/board/actions/actions-constants.ts` | exact |
| `src/components/board/actions/script/script-types.ts` | type | — | `src/components/board/verdict/use-comparisons.ts` (interface pattern) | role-match |
| `src/components/board/actions/optimal-post/OptimalPostCard.tsx` | component | request-response | `src/components/board/actions/SimilarVideoCardCompact.tsx` | role-match |
| `src/components/board/actions/optimal-post/OptimalPostEditSheet.tsx` | component | event-driven | `src/components/board/audience/PersonaInspector.tsx` | role-match |
| `src/components/board/actions/optimal-post/OptimalPostSourcePill.tsx` | component | event-driven | `src/components/primitives/GlassPill.tsx` | partial |
| `src/components/board/actions/optimal-post/use-optimal-post-override.ts` | hook/mutation | request-response | `src/components/board/verdict/use-comparisons.ts` | role-match |
| `src/components/board/actions/optimal-post/optimal-post-constants.ts` | config | — | `src/components/board/actions/actions-constants.ts` | exact |
| `src/components/board/actions/ActionsReshootHeroSlot.tsx` (MODIFY) | component | — | self | exact |
| `src/components/board/actions/ActionsOptimalPostSlot.tsx` (MODIFY) | component | — | self | exact |
| `src/components/board/actions/actions-constants.ts` (MODIFY) | config | — | self | exact |
| `src/components/board/actions/__tests__/ActionsNode.test.tsx` (MODIFY) | test | — | self | exact |

---

## Pattern Assignments

### `src/app/api/analyze/[id]/script/route.ts` (API route, GET, request-response)

**Analog:** `src/app/api/analyze/[id]/comparisons/route.ts`

**Imports pattern** (lines 1-3):
```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
```

**Additional imports needed for script route** (not in analog):
```typescript
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
// import script transformation helpers from @/lib/script-utils
```

**Route export constants** (add after imports — NOT present in comparisons/route.ts):
```typescript
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
```

**ParamsSchema** (comparisons/route.ts lines 24-30 — copy verbatim):
```typescript
const ParamsSchema = z.object({
  id: z
    .string()
    .min(8)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/u, 'id must be url-safe id'),
});
```

**GET handler signature + auth gate** (lines 32-49):
```typescript
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const validated = ParamsSchema.safeParse(resolved);
  if (!validated.success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }
  const { id } = validated.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
```

**RLS query pattern** (lines 54-60, adapted for script columns):
```typescript
  const { data, error } = await supabase
    .from('analysis_results')
    .select('id, counterfactuals, factors, reasoning, confidence, confidence_label, anti_virality_gated, hook_decomposition, engine_version, script_result')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
```

**Cache-miss service-client fire-and-forget write** (from prediction-cache.ts pattern, lines 75-101):
```typescript
  // D-08: fire-and-forget write on cache miss
  const serviceClient = createServiceClient();
  serviceClient
    .from('analysis_results')
    .update({ script_result: computedScript })
    .eq('id', id)
    .then(({ error: writeError }) => {
      if (writeError) log.warn('script_result cache write failed', { analysis_id: id, error: writeError.message });
    });
  // DO NOT await — fire-and-forget
```

**Server-side logger init** (prediction-cache.ts line 8 pattern):
```typescript
const log = createLogger({ module: 'analyze.script' });
```

---

### `src/app/api/analyze/[id]/optimal-post-override/route.ts` (API route, POST, request-response)

**Analog:** `src/app/api/analyze/[id]/override/route.ts`

**Imports + Zod schema** (lines 1-33, adapted):
```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const ParamsSchema = z.object({
  id: z
    .string()
    .min(8)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/u, 'id must be url-safe id'),
});

const OptimalPostOverrideSchema = z.object({
  day_of_week: z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']),
  hour_range: z
    .tuple([z.number().int().min(0).max(23), z.number().int().min(1).max(24)])
    .refine(([start, end]) => end > start, { message: 'end must be > start' }),
});
```

**POST handler with auth + JSON parse** (override/route.ts lines 35-59):
```typescript
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Security improvement over override/route.ts: validate id with ParamsSchema
  const resolvedParams = await params;
  const validatedParams = ParamsSchema.safeParse(resolvedParams);
  if (!validatedParams.success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }
  const { id } = validatedParams.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = OptimalPostOverrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_override' }, { status: 400 });
  }
```

**UPDATE with defense-in-depth user_id filter** (override/route.ts lines 66-79, improved):
```typescript
  const { day_of_week, hour_range } = parsed.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: e1 } = await (supabase as any)
    .from('analysis_results')
    .update({
      optimal_post_override: {
        day_of_week,
        hour_range,
        saved_at: new Date().toISOString(),
      },
    })
    .eq('id', id)
    .eq('user_id', user.id);  // defense-in-depth: RLS already guards, but explicit filter

  if (e1) {
    return NextResponse.json({ error: 'override_write_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
```

---

### `supabase/migrations/20260530000000_script_result.sql` + `20260530000001_optimal_post_override.sql` (migrations)

**Analog:** `supabase/migrations/20260527000000_audience_overrides.sql` lines 10-11

**Pattern** (additive column, idempotent):
```sql
-- 20260530000000_script_result.sql
-- Phase 6 — Reshoot script + optimal post time
-- Additive JSONB column for script transformation cache (D-09)
-- Created: 2026-05-30

ALTER TABLE analysis_results
  ADD COLUMN IF NOT EXISTS script_result JSONB;
-- No NOT NULL: legacy rows + first-fetch-pending rows have NULL.
-- No index: only queried by primary key (analysis_results.id).
-- No CHECK: Zod parses on read; schema evolution stays cheap.

-- 20260530000001_optimal_post_override.sql
-- Phase 6 — Per-analysis post-time override (D-28)
ALTER TABLE analysis_results
  ADD COLUMN IF NOT EXISTS optimal_post_override JSONB;
-- Shape: { day_of_week: 'Mon'..'Sun', hour_range: [number, number], saved_at: string }
-- No RLS change needed: existing UPDATE policy covers authenticated user rows.
```

---

### `src/lib/script-utils.ts` (utility, transform)

**Analog:** `src/components/board/actions/SimilarVideoCardCompact.tsx` lines 11-15 (single-purpose formatter pattern)

**Pattern** — single-responsibility pure function, exported:
```typescript
// Mirror formatCompactNumber pattern: simple export, no class, no deps
export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
// Add markdown strip helper (D-05):
export function stripMarkdown(text: string): string {
  return text.replace(/\*\*|__|`/g, '').trim();
}
```

No imports needed — pure functions. Both used server-side in the `/script` endpoint and potentially client-side in tests.

---

### `src/components/board/actions/script/use-script.ts` (hook, request-response)

**Analog:** `src/components/board/verdict/use-comparisons.ts` (all 24 lines — copy exactly, adapt)

**Full pattern** (lines 1-24):
```typescript
'use client';
import { useQuery } from '@tanstack/react-query';
// import ScriptResult type from ./script-types

export function useScript(analysisId: string | null, phase: string) {
  return useQuery<ScriptResult>({
    queryKey: ['script', analysisId],
    queryFn: async () => {
      const res = await fetch(`/api/analyze/${analysisId}/script`);
      if (!res.ok) throw new Error('script_fetch_failed');
      return (await res.json()) as ScriptResult;
    },
    enabled: !!analysisId && phase === 'complete',  // D-35: never fetch during stream
    staleTime: Infinity,  // D-11: content-addressed cache, never stale
    gcTime: 5 * 60 * 1000,
  });
}
```

Key differences from `use-comparisons`:
- `enabled` adds `&& phase === 'complete'` gate
- `staleTime: Infinity` (not 5 minutes — cache is immutable per O-7)

---

### `src/components/board/actions/optimal-post/use-optimal-post-override.ts` (hook/mutation)

**Analog:** `src/components/board/verdict/use-comparisons.ts` (query shape) + `useMutation` from TanStack

**Pattern:**
```typescript
'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useOptimalPostOverride(analysisId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { day_of_week: string; hour_range: [number, number] }) => {
      const res = await fetch(`/api/analyze/${analysisId}/optimal-post-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('override_write_failed');
      return res.json();
    },
    onSuccess: () => {
      // Invalidate analysis stream result to re-read override from server
      queryClient.invalidateQueries({ queryKey: ['analysis', analysisId] });
    },
  });
}
```

---

### `src/components/board/actions/script/ScriptBody.tsx` (component, request-response)

**Analog:** `src/components/board/actions/SimilarVideosCard.tsx` (card-inside-Actions-slot pattern)

**Imports pattern** (SimilarVideosCard.tsx lines 1-11):
```typescript
'use client';
import { useRef } from 'react';
import { Copy, CheckCircle } from '@phosphor-icons/react';
import { GlassPill } from '@/components/primitives';
import { logger } from '@/lib/logger';
import { TELEMETRY } from '../script-constants';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import type { ScriptResult } from './script-types';
```

**Core pattern** (card-with-sections + empty-state guard, from SimilarVideosCard lines 54-80):
```typescript
// D-15: receives callbacks from host for telemetry wiring
interface ScriptBodyProps {
  script: ScriptResult;
  analysisId: string;
  onCopySection: (section: 'opening' | 'scenes' | 'voiceover' | 'captions', text: string) => void;
  onCopyAll: (text: string) => void;
}

export function ScriptBody({ script, analysisId, onCopySection, onCopyAll }: ScriptBodyProps) {
  // 'is_empty_state' discriminator — host should not render ScriptBody when true
  // but defensive guard here:
  if (script.is_empty_state) return null;

  return (
    <div className="flex flex-col gap-0 overflow-y-auto px-4 py-3" data-testid="actions-reshoot-body">
      {/* Section: each follows the same pattern */}
      <SectionRow label="NEW OPENING" content={script.script.opening_line} ... />
      ...
    </div>
  );
}
```

**testid convention** (ActionsNode.test.tsx line 86 — replace placeholder):
- Old: `data-testid="actions-reshoot-placeholder"` on `<PlaceholderCard>`
- New: `data-testid="actions-reshoot-body"` on `ScriptBody`'s outer div

---

### `src/components/board/actions/script/ScriptInspectorTrigger.tsx` (component, Sheet-based)

**Analog:** `src/components/board/audience/PersonaInspector.tsx`

**Sheet + mobile/desktop side pattern** (lines 110-126):
```typescript
'use client';
import { useRef, useState } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { ScriptBody } from './ScriptBody';

export function ScriptInspectorTrigger({ script, analysisId, ... }) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const side = isMobile ? 'bottom' : 'right';
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      {/* Compact teaser card — tapping opens Sheet */}
      <button ref={triggerRef} onClick={() => setOpen(true)} ...>
        ...teaser content...
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={side}
          className={cn(
            'border-white/[0.06] bg-[#18191a]',
            side === 'right' && 'max-w-[400px]',
            side === 'bottom' && 'max-h-[85dvh]',
          )}
          onCloseAutoFocus={(e) => {
            // PersonaInspector.tsx lines 120-125 — focus return pattern
            if (triggerRef?.current) {
              e.preventDefault();
              triggerRef.current.focus();
            }
          }}
        >
          <SheetHeader>
            <SheetTitle>Reshoot script</SheetTitle>
          </SheetHeader>
          <ScriptBody script={script} analysisId={analysisId} ... />
        </SheetContent>
      </Sheet>
    </>
  );
}
```

---

### `src/components/board/actions/script/ScriptEmptyState.tsx` (component)

**Analog:** `src/components/board/actions/SimilarVideosCard.tsx` (empty state branch pattern, lines 47-72)

**Pattern** — conditional empty message + list:
```typescript
'use client';
import { CheckCircle } from '@phosphor-icons/react';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { CopyButton } from './CopyButton';

interface Props {
  variant?: 'empty-state' | 'error';
  openingVariants?: string[];
  analysisId: string;
  onRetry?: () => void;
}

export function ScriptEmptyState({ variant = 'empty-state', openingVariants = [], analysisId, onRetry }: Props) {
  if (variant === 'error') {
    return (
      <div className="flex flex-col gap-2 p-2" data-testid="script-error-state">
        <p className="text-xs text-white/85">Couldn't generate script</p>
        <button onClick={onRetry} className="...">Try again</button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1 p-2" data-testid="script-empty-state">
      <div className="flex items-center gap-1">
        <CheckCircle size={14} className="text-emerald-300/70" />
        <span className="text-xs text-white/85">Your video is solid</span>
      </div>
      <p className="text-[10px] text-white/55">Optional tweaks below</p>
      {/* A/B opening variants list — mirrors SimilarVideosCard's visible.map() pattern */}
      {openingVariants.map((v, i) => (
        <div key={i} className="flex items-center justify-between">
          <span className="text-xs text-white/85">{v}</span>
          <CopyButton text={v} ariaLabel={`Copy opening variant ${i + 1}`} ... />
        </div>
      ))}
    </div>
  );
}
```

---

### `src/components/board/actions/script/CopyButton.tsx` (component, ~30 lines)

**Analog:** `src/hooks/useCopyToClipboard.ts` (hook consumed)

**Pattern:**
```typescript
'use client';
import { Copy, CheckCircle } from '@phosphor-icons/react';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';

interface CopyButtonProps {
  text: string;
  ariaLabel: string;
  label?: string;        // optional text label (Copy-all only)
  onCopy?: () => void;   // telemetry callback
}

export function CopyButton({ text, ariaLabel, label, onCopy }: CopyButtonProps) {
  // S-4: explicitly pass 1500 to override default 2000ms
  const { copied, copy } = useCopyToClipboard(1500);

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      className="flex items-center gap-1 text-white/55 hover:text-white/80 focus:outline-2 focus:outline-offset-2 focus:outline-white/40 p-2.5 min-h-[44px] min-w-[44px]"
      onClick={async () => {
        const ok = await copy(text);
        if (ok) onCopy?.();
      }}
    >
      {copied ? (
        <>
          <CheckCircle size={14} className="text-coral-500" />
          <span className="text-xs text-coral-500">Copied!</span>
        </>
      ) : (
        <>
          <Copy size={14} />
          {label && <span className="text-xs">{label}</span>}
        </>
      )}
    </button>
  );
}
```

Note: `useCopyToClipboard` signature (lines 25-51): `useCopyToClipboard(resetDelay = 2000)` — returns `{ copied: boolean, copy: (text: string) => Promise<boolean> }`.

---

### `src/components/board/actions/optimal-post/OptimalPostCard.tsx` (component, ~80 lines)

**Analog:** `src/components/board/actions/SimilarVideoCardCompact.tsx` (compact card pattern)

**Imports pattern** (SimilarVideoCardCompact.tsx lines 1-4):
```typescript
'use client';
import { Clock } from '@phosphor-icons/react';
import { GlassPill } from '@/components/primitives';
import { logger } from '@/lib/logger';
import { TELEMETRY } from '../optimal-post-constants';
import { OptimalPostSourcePill } from './OptimalPostSourcePill';
import { OptimalPostEditSheet } from './OptimalPostEditSheet';
import type { OptimalPostWindow } from '@/lib/engine/types';
```

**Card structure pattern** (SimilarVideoCardCompact.tsx lines 20-65):
```typescript
export function OptimalPostCard({ window, override, analysisId, result }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // D-36: render skeleton when result is null, not window
  if (!window) {
    return <div className="h-4 w-20 bg-white/[0.06] rounded animate-pulse" />;
  }

  return (
    <div
      className="flex h-full w-full flex-col gap-1 p-2"
      data-testid="actions-optimal-post-card"
    >
      <div className="flex items-center gap-1">
        <Clock size={12} aria-hidden />
        <span className="text-xs font-medium text-white/85">When to post</span>
      </div>
      {/* Day+time chip: tappable → opens edit Sheet */}
      <div className="flex items-center gap-1">
        <GlassPill size="sm" onClick={() => setEditOpen(true)}>
          {formattedDay} · {formattedHourRange}
        </GlassPill>
        <button ref={triggerRef} onClick={() => setEditOpen(true)} className="text-[10px] text-white/55 hover:text-white/80">
          Edit
        </button>
      </div>
      {/* Reasoning row */}
      <p className="text-xs text-white/65 line-clamp-1" title={window.reasoning}>
        {window.reasoning}
      </p>
      <OptimalPostSourcePill source={effectiveSource} reasoningString={window.reasoning} />

      <OptimalPostEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        currentWindow={override ?? window}
        originalWindow={window}
        analysisId={analysisId}
        triggerRef={triggerRef}
      />
    </div>
  );
}
```

**testid update** (per RESEARCH.md item 14, S-2):
- `ActionsOptimalPostSlot` needs outer wrapper: `<div data-testid="actions-optimal-post-slot">`
- Old test query `actions-optimal-post-placeholder` → new `actions-optimal-post-card`

---

### `src/components/board/actions/optimal-post/OptimalPostEditSheet.tsx` (component, Sheet-based)

**Analog:** `src/components/board/audience/PersonaInspector.tsx` (Sheet pattern, lines 110-170)

**Sheet + focus-return pattern** (PersonaInspector.tsx lines 111-125):
```typescript
'use client';
import { useRef, useState } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { GlassPill } from '@/components/primitives';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useOptimalPostOverride } from './use-optimal-post-override';

export function OptimalPostEditSheet({ open, onOpenChange, currentWindow, originalWindow, analysisId, triggerRef }) {
  const isMobile = useIsMobile();
  const side = isMobile ? 'bottom' : 'right';
  const prefersReducedMotion = usePrefersReducedMotion();
  const mutation = useOptimalPostOverride(analysisId);
  const [selectedDay, setSelectedDay] = useState(currentWindow.day_of_week);
  const [startHour, setStartHour] = useState(currentWindow.hour_range[0]);
  const [endHour, setEndHour] = useState(currentWindow.hour_range[1]);

  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          'border-white/[0.06] bg-[#18191a]',
          side === 'right' && 'max-w-[320px]',
          side === 'bottom' && 'max-h-[85dvh]',
          prefersReducedMotion && 'transition-none',
        )}
        onCloseAutoFocus={(e) => {
          // PersonaInspector.tsx lines 120-125 pattern
          if (triggerRef?.current) {
            e.preventDefault();
            triggerRef.current.focus();
          }
        }}
      >
        <SheetHeader>
          <SheetTitle>Edit post time</SheetTitle>
        </SheetHeader>
        {/* Day picker — role="radiogroup" per RESEARCH item 8 */}
        <div role="radiogroup" aria-label="Day of week" className="flex gap-1">
          {DAY_LABELS.map((day) => (
            <GlassPill
              key={day}
              size="sm"
              active={selectedDay === day}
              onClick={() => setSelectedDay(day)}
              role="radio"
              aria-checked={selectedDay === day}
            >
              {day}
            </GlassPill>
          ))}
        </div>
        {/* Hour selects */}
        ...
        {/* Reset link */}
        <button className="text-[10px] text-white/55 hover:text-white/80" onClick={handleReset}>
          Reset to {originalDay} {originalHours}
        </button>
        {/* Save button — secondary style per CLAUDE.md */}
        <button
          className="w-full bg-transparent border border-white/[0.06] hover:bg-white/[0.1] rounded-lg h-[42px] text-xs text-white/85 disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={endHour <= startHour}
          onClick={handleSave}
        >
          Save for this analysis
        </button>
      </SheetContent>
    </Sheet>
  );
}
```

---

### `src/components/board/actions/optimal-post/OptimalPostSourcePill.tsx` (component, ~40 lines)

**Analog:** `src/components/primitives/GlassPill.tsx` (wraps GlassPill)

**Pattern:**
```typescript
'use client';
import { Info } from '@phosphor-icons/react';
import { GlassPill } from '@/components/primitives';
// Use Radix Tooltip from shadcn stack

const SOURCE_CONFIG = {
  niche: { label: 'from your niche' },
  fallback: { label: 'default' },
  creator: { label: 'yours' },
} as const;

interface Props {
  source: 'niche' | 'fallback' | 'creator';
  reasoningString?: string;
  analysisId: string;
}

export function OptimalPostSourcePill({ source, reasoningString, analysisId }: Props) {
  const config = SOURCE_CONFIG[source];
  const tooltipText = buildTooltipText(source, reasoningString);

  return (
    <div className="flex items-center gap-1">
      <GlassPill size="sm">{config.label}</GlassPill>
      {/* Radix Tooltip trigger on Info icon */}
      <button
        type="button"
        title="View data source"
        aria-label="View data source"
        tabIndex={0}
        // onFocus/onMouseEnter opens tooltip via Radix
      >
        <Info size={10} className="text-white/55" />
      </button>
    </div>
  );
}

function buildTooltipText(source: string, reasoning?: string): string {
  const n = reasoning ? (reasoning.match(/\(n=(\d+)/) ?? [])[1] : null;
  if (source === 'niche') {
    return n
      ? `Based on ${n} videos in your niche.`
      : 'Based on videos in your niche.';
  }
  if (source === 'fallback') return 'Niche data unavailable yet — using the default Tue evening window. Add your niche to your creator profile for tailored timing.';
  return 'Edited for this analysis. Reset to use the niche recommendation.';
}
```

---

### `src/components/board/actions/script/script-constants.ts` (config)

**Analog:** `src/components/board/actions/actions-constants.ts` (all 27 lines — copy structure exactly)

**Pattern** (actions-constants.ts lines 1-27):
```typescript
// Verbatim copy contract per actions-constants.ts pattern.
export const SCRIPT_COPY = {
  SECTION_NEW_OPENING: 'NEW OPENING',
  SECTION_SCENE_ORDER: 'SCENE ORDER',
  SECTION_VOICEOVER: 'VOICEOVER',
  SECTION_CAPTIONS: 'CAPTIONS',
  COPY_ALL_LABEL: 'Copy all',
  COPY_ALL_ARIA: 'Copy full reshoot script',
  COPY_ALL_TITLE: 'Copy full reshoot script',
  AV_HEADLINE: 'Try this instead',
  AV_SUBHEAD: '4-section rewrite based on what dropped',
  TEASER_LABEL: 'Reshoot script',
  TEASER_AFFORDANCE: 'Open script →',
  EMPTY_HEADLINE: 'Your video is solid',
  EMPTY_SUBHEAD: 'Optional tweaks below',
  EMPTY_AB_LABEL: 'A/B opening',
  ERROR_MESSAGE: "Couldn't generate script",
  ERROR_RETRY: 'Try again',
} as const;

// Extend TELEMETRY in actions-constants.ts with these new events:
// (do NOT redefine TELEMETRY here — extend the existing object)
```

**Extending `actions-constants.ts` TELEMETRY** (existing lines 18-21 → append):
```typescript
// Add to TELEMETRY in src/components/board/actions/actions-constants.ts:
SCRIPT_SECTION_COPIED: 'script_section_copied',
SCRIPT_COPY_ALL: 'script_copy_all',
SCRIPT_INSPECTOR_OPENED: 'script_inspector_opened',
SCRIPT_EMPTY_STATE_SHOWN: 'script_empty_state_shown',
OPTIMAL_POST_TZ_CONVERTED: 'optimal_post_tz_converted',
OPTIMAL_POST_EDITED: 'optimal_post_edited',
OPTIMAL_POST_SOURCE_EXPLAINED: 'optimal_post_source_explained',
OPTIMAL_POST_RESET: 'optimal_post_reset_to_recommendation',
// Remove: ACTIONS_RESHOOT_PLACEHOLDER_VISIBLE (Phase 6 replaces placeholder)
```

---

### `src/components/board/actions/optimal-post/optimal-post-constants.ts` (config)

**Analog:** `src/components/board/actions/actions-constants.ts`

**Pattern:**
```typescript
export const OPTIMAL_POST_COPY = {
  CARD_LABEL: 'When to post',
  EDIT_LINK: 'Edit',
  SHEET_TITLE: 'Edit post time',
  DAY_SECTION_LABEL: 'Day',
  START_HOUR_LABEL: 'Start hour',
  END_HOUR_LABEL: 'End hour',
  SAVE_BUTTON: 'Save for this analysis',
  // Reset: dynamic — built at runtime: `Reset to ${day} ${hours}`
} as const;

export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type DayOfWeek = typeof DAY_LABELS[number];
```

---

### `src/components/board/actions/ActionsReshootHeroSlot.tsx` (MODIFY)

**Analog:** self (lines 1-23)

**Current inner JSX to replace** (lines 15-20):
```typescript
// REMOVE:
<PlaceholderCard
  label="Reshoot script"
  phase="6"
  icon={FilmScript}
  data-testid="actions-reshoot-placeholder"
/>

// REPLACE WITH (AV state conditional — D-13, D-14, D-19):
// When isAV: render AV chrome + <ScriptBody />
// When not isAV: render <ScriptInspectorTrigger /> or <ScriptEmptyState />
// Outer div + data-testid="actions-reshoot-hero-slot" stays unchanged (O-1)
```

Phase 6 adds `isAV` + `script` + `phase` props to the slot wrapper, or reads from store internally. Researcher's finding: `ActionsNode.tsx` already passes `className="col-span-2"` for AV state — the wrapper just needs to accept the script data.

---

### `src/components/board/actions/ActionsOptimalPostSlot.tsx` (MODIFY)

**Analog:** self (lines 1-14) + `ActionsReshootHeroSlot.tsx` (for outer div wrapper — S-2 fix)

**Current** (no outer div, returns PlaceholderCard directly — lines 5-8):
```typescript
// CURRENT — no outer div:
export function ActionsOptimalPostSlot() {
  return (
    <PlaceholderCard label="When to post" phase="6" icon={Clock} data-testid="actions-optimal-post-placeholder" />
  );
}

// PHASE 6 — add outer div wrapper (S-2 fix) + swap content:
export function ActionsOptimalPostSlot({ result, analysisId }: Props) {
  return (
    <div data-testid="actions-optimal-post-slot">
      <OptimalPostCard
        window={result?.optimal_post_window ?? null}
        override={result?.optimal_post_override ?? null}
        analysisId={analysisId}
      />
    </div>
  );
}
```

---

### `src/components/board/actions/__tests__/ActionsNode.test.tsx` (MODIFY)

**Analog:** self (lines 86, 94, 95, 106 — testid updates per RESEARCH.md item 15)

**Exact testid changes:**

| Line | Old query | New query |
|------|-----------|-----------|
| 86 | `getByTestId('actions-reshoot-placeholder')` | `getByTestId('actions-reshoot-body')` |
| 94 | `getByTestId('actions-optimal-post-placeholder')` | `getByTestId('actions-optimal-post-card')` |
| 95 | (same OptimalPost testid in same test) | `getByTestId('actions-optimal-post-card')` |
| 106 | `getByTestId('actions-optimal-post-placeholder')` | `getByTestId('actions-optimal-post-card')` |

Also add Phosphor icon stubs for new icons in `vi.mock('@phosphor-icons/react', ...)` block (lines 21-31):
```typescript
// Add to existing @phosphor-icons/react mock:
Copy: ({ size, ...rest }: { size?: number }) => <svg width={size} height={size} data-testid="icon-copy" {...rest} />,
CheckCircle: ({ size, ...rest }: { size?: number }) => <svg width={size} height={size} data-testid="icon-check-circle" {...rest} />,
Info: ({ size, ...rest }: { size?: number }) => <svg width={size} height={size} data-testid="icon-info" {...rest} />,
```

---

### `src/app/api/analyze/[id]/script/__tests__/route.test.ts` (test)

**Analog:** `src/app/api/analyze/[id]/override/__tests__/route.test.ts` (all 202 lines — copy structure exactly)

**Mock setup pattern** (lines 1-54):
```typescript
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: vi.fn() }));
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn() }) }));

import { GET } from '../route';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

function createMockClient({
  user = { id: 'user-123' },
  row = null as Record<string, unknown> | null,
  selectError = null,
  updateError = null,
} = {}) {
  const selectBuilder = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: row, error: selectError }),
  };
  const updateBuilder = {
    eq: vi.fn().mockResolvedValue({ error: updateError }),
  };
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn((table: string) => {
      if (table === 'analysis_results') {
        return { select: vi.fn().mockReturnValue(selectBuilder), update: vi.fn().mockReturnValue(updateBuilder) };
      }
      return {};
    }),
  };
}

function makeRequest(id = 'test-analysis-id-1') {
  return {
    req: new Request(`http://localhost/api/analyze/${id}/script`),
    params: Promise.resolve({ id }),
  };
}
```

**Test matrix** (10 tests per RESEARCH.md Validation Architecture):
1. Cache hit — `script_result` non-null → returns parsed result
2. Cache miss, low band → computes full script (opening/scenes/voiceover/captions)
3. Cache miss, high-confidence empty state → `is_empty_state: true` + `opening_variants`
4. AV state → full script (NOT empty state)
5. Auth failure → 401
6. Invalid id (path traversal chars) → 400
7. Wrong owner (row not found) → 404
8. Missing row → 404
9. Engine version skew → force recompute
10. Service-client write failure → response still 200

---

### `src/app/api/analyze/[id]/optimal-post-override/__tests__/route.test.ts` (test)

**Analog:** `src/app/api/analyze/[id]/override/__tests__/route.test.ts` (copy structure, swap schema)

Test matrix (6 tests):
1. Zod rejection — invalid `day_of_week` → 400
2. Zod rejection — `hour_range[1] <= hour_range[0]` → 400
3. Auth — no user → 401
4. Write success → 200 `{ ok: true }`
5. DB error → 500 `override_write_failed`
6. XSS guard — error response never echoes raw input

---

## Shared Patterns

### Authentication
**Source:** `src/app/api/analyze/[id]/comparisons/route.ts` lines 43-49
**Apply to:** `route.ts` (script) + `route.ts` (optimal-post-override)
```typescript
const supabase = await createClient();
const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}
```

### Server-Side Logger
**Source:** `src/lib/engine/cache/prediction-cache.ts` line 8
**Apply to:** `src/app/api/analyze/[id]/script/route.ts`
```typescript
import { createLogger } from '@/lib/logger';
const log = createLogger({ module: 'analyze.script' });
// Usage: log.info('script_endpoint_cache_hit', { analysis_id: id });
// Usage: log.warn('script_result cache write failed', { analysis_id: id, error: e.message });
```

### Client-Side Logger (telemetry)
**Source:** `src/components/board/actions/ActionsNode.tsx` lines 13, 33 + `src/lib/logger.ts` line 75
**Apply to:** All React components with telemetry callbacks
```typescript
import { logger } from '@/lib/logger';
// Singleton — no createLogger needed on client
logger.info(TELEMETRY.SCRIPT_SECTION_COPIED, { analysis_id: analysisId, section: 'opening', char_count: 42 });
```

### Raycard Card Hover
**Source:** `src/components/board/actions/SimilarVideoCardCompact.tsx` line 34 + `CLAUDE.md`
**Apply to:** `ScriptInspectorTrigger` compact teaser card, `OptimalPostCard`
```typescript
className="... hover:bg-white/[0.02]"
// NO translate-y, NO border change on hover (CLAUDE.md Raycast rule)
```

### GlassPill chip
**Source:** `src/components/primitives/GlassPill.tsx` — import path is `@/components/primitives` (NOT `@/components/ui`)
**Apply to:** `OptimalPostCard` day/time chip, `OptimalPostSourcePill`, `ScriptEmptyState` A/B variants
```typescript
import { GlassPill } from '@/components/primitives';
// Size: "sm" for compact slots, "md" for Sheet context
// onClick makes it a button
```

### Sheet + Mobile/Desktop Side
**Source:** `src/components/board/audience/PersonaInspector.tsx` lines 93-125
**Apply to:** `ScriptInspectorTrigger`, `OptimalPostEditSheet`
```typescript
const isMobile = useIsMobile();
const side = isMobile ? 'bottom' : 'right';
// onCloseAutoFocus: focus return to triggerRef
// className: max-w-[360px] right | max-h-[85dvh] bottom
// bg: bg-[#18191a] + border-white/[0.06]
```

### TanStack Query hook colocation
**Source:** `src/components/board/verdict/use-comparisons.ts` — colocated with verdict component, NOT in `src/hooks/queries/`
**Apply to:** `use-script.ts`, `use-optimal-post-override.ts`
- Colocate in `src/components/board/actions/script/` and `src/components/board/actions/optimal-post/`
- Query key: simple inline array `['script', analysisId]` — NOT a queryKeys factory

### Service-Client Fire-and-Forget Write
**Source:** `src/lib/engine/cache/prediction-cache.ts` lines 75-100 (`createServiceClient()` pattern)
**Apply to:** `src/app/api/analyze/[id]/script/route.ts` (D-08 cache write)
```typescript
import { createServiceClient } from '@/lib/supabase/service';
const serviceClient = createServiceClient();
serviceClient
  .from('analysis_results')
  .update({ script_result: computedScript })
  .eq('id', analysisId)
  .then(({ error }) => {
    if (error) log.warn('script_result cache write failed', { analysis_id: analysisId, error: error.message });
  });
// NOT awaited — fire-and-forget (D-08)
```

### Reduced-Motion Guard
**Source:** `src/components/board/actions/ActionsNode.tsx` lines 25, 43, 47
**Apply to:** `OptimalPostEditSheet` Sheet animation
```typescript
const prefersReducedMotion = usePrefersReducedMotion();
// Sheet: pass className={prefersReducedMotion ? 'transition-none' : undefined}
// Already wired in ActionsNode grid transition — Phase 6 inherits
```

### Anti-Virality State Subscription
**Source:** `src/components/board/actions/ActionsNode.tsx` lines 21-23
**Apply to:** `ActionsReshootHeroSlot` (modified) to detect AV state
```typescript
const boardMachineState = useBoardStore((s) => s.boardState);
const avState = getFrameAntiViralityState('actions', boardMachineState);
const isAV = avState === 'anti-virality';
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/optimal-post-time.ts` | utility | transform | No existing TZ conversion utility. Pattern: `Intl.DateTimeFormat(undefined, { hour: 'numeric', hour12: true, timeZone: userTz }).formatRange(startDate, endDate)`. Verified: `formatRange` safe for all Virtuna browser targets (RESEARCH item 20). |

---

## Metadata

**Analog search scope:** `src/app/api/analyze/`, `src/components/board/actions/`, `src/components/board/audience/`, `src/components/board/verdict/`, `src/components/primitives/`, `src/hooks/`, `src/lib/`, `supabase/migrations/`
**Files scanned:** 16 source files read directly
**Pattern extraction date:** 2026-05-28

**Critical findings from codebase scan:**
1. `GlassPill` import path is `@/components/primitives` (NOT `@/components/ui/GlassPill`)
2. `ActionsOptimalPostSlot` has NO outer div wrapper (S-2) — Phase 6 must add `<div data-testid="actions-optimal-post-slot">`
3. `runtime`/`dynamic`/`maxDuration` NOT present in `comparisons/route.ts` — Phase 6 script route adds them explicitly
4. `useCopyToClipboard` default is 2000ms — pass `1500` explicitly (S-4)
5. `use-comparisons.ts` is colocated at `src/components/board/verdict/` — `use-script.ts` follows same pattern at `src/components/board/actions/script/`
6. Service-client write = direct `createServiceClient().update()`, NOT `populatePredictionCache` (S-3)
7. `niche_primary` NOT in `optimal_post_window.reasoning` string — tooltip uses option B: "Based on {N} videos in your niche" (S-5)
