# Phase 5: Other group nodes — Verdict + Actions + Content Analysis populated - Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 27 new/modified files
**Analogs found:** 26 / 27 (1 no analog — `react-markdown` usage)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/board/cross-group-state.ts` | utility / selector | event-driven | `src/stores/board-store.ts:240-254` (derived selectors) | role-match |
| `src/components/board/Board.tsx` | orchestrator | event-driven | self (MODIFY lines 40-51) | self |
| `src/components/board/verdict/VerdictNode.tsx` | component (node shell) | request-response | `src/components/board/audience/AudienceNode.tsx` | exact |
| `src/components/board/verdict/PercentileChip.tsx` | component (display) | request-response | `src/components/board/audience/HeadlineChips.tsx` | role-match |
| `src/components/board/verdict/AntiViralityHeader.tsx` | component (conditional) | event-driven | `src/components/board/audience/AntiViralityOverlay.tsx` | role-match |
| `src/components/board/verdict/WhyVerdictCollapsible.tsx` | component (collapsible) | request-response | `src/components/board/audience/HeatmapDrawer.tsx` (expand/collapse pattern) | role-match |
| `src/components/board/verdict/VsHistoryCollapsible.tsx` | component (collapsible + chart) | CRUD | `src/components/competitors/comparison/comparison-bar-chart.tsx` | exact |
| `src/components/board/verdict/TopFixesList.tsx` | component (list) | request-response | `src/components/board/audience/AntiViralityOverlay.tsx` (fix chip pattern) | role-match |
| `src/components/board/verdict/use-comparisons.ts` | hook (data fetch) | CRUD | `src/components/board/audience/use-audience-choreography.ts` (hook shape) | role-match |
| `src/components/board/verdict/verdict-types.ts` | type definitions | — | `src/components/board/audience/audience-types.ts` | exact |
| `src/components/board/verdict/verdict-constants.ts` | config | — | `src/components/board/audience/audience-constants.ts` | exact |
| `src/components/board/actions/ActionsNode.tsx` | component (node shell) | event-driven | `src/components/board/audience/AudienceNode.tsx` | role-match |
| `src/components/board/actions/PlaceholderCard.tsx` | component (display) | — | `src/components/board/audience/HeadlineChips.tsx` (chip/card primitive) | partial |
| `src/components/board/actions/ActionsReshootHeroSlot.tsx` | component (slot) | — | `src/components/board/actions/PlaceholderCard.tsx` (composes) | role-match |
| `src/components/board/actions/ActionsOptimalPostSlot.tsx` | component (slot) | — | same | role-match |
| `src/components/board/actions/ActionsShareSlot.tsx` | component (slot) | — | same | role-match |
| `src/components/board/actions/SimilarVideosCard.tsx` | component (list) | CRUD | `src/components/board/audience/HeadlineChips.tsx` (card container) | partial |
| `src/components/board/actions/SimilarVideoCardCompact.tsx` | component (card) | request-response | `src/components/trending/video-card.tsx` (reference only, NOT reuse) | partial |
| `src/components/board/actions/actions-types.ts` | type definitions | — | `src/components/board/audience/audience-types.ts` | exact |
| `src/components/board/actions/actions-constants.ts` | config | — | `src/components/board/audience/audience-constants.ts` | exact |
| `src/components/board/content-analysis/ContentAnalysisFrame.tsx` | component (layout) | — | `src/components/board/audience/AudienceNode.tsx` (layout shell) | role-match |
| `src/components/board/content-analysis/HookDecompNode.tsx` | component (visualization) | request-response | `src/components/board/audience/HeadlineChips.tsx` + `GlassProgress` | role-match |
| `src/components/board/content-analysis/HookDecompInspector.tsx` | component (inspector sheet) | request-response | `src/components/board/audience/PersonaInspector.tsx` | exact |
| `src/components/board/content-analysis/EmotionArcNode.tsx` | component (chart) | request-response | `src/components/competitors/charts/follower-growth-chart.tsx` | exact |
| `src/components/board/content-analysis/EmotionArcInspector.tsx` | component (inspector sheet) | request-response | `src/components/board/audience/PersonaInspector.tsx` | exact |
| `src/components/board/content-analysis/content-analysis-types.ts` | type definitions | — | `src/components/board/audience/audience-types.ts` | exact |
| `src/app/api/analyze/[id]/comparisons/route.ts` | route (API) | CRUD | `src/app/api/analyze/[id]/override/route.ts` | exact |

---

## Pattern Assignments

### `src/components/board/cross-group-state.ts` (utility, event-driven)

**Analog:** `src/stores/board-store.ts` lines 240-254

**Imports pattern** (model from board-store.ts):
```typescript
import { useBoardStore } from '@/stores/board-store';
import type { BoardMachineState } from '@/stores/board-store';
import type { GroupId } from './board-types';
```

**Core selector pattern** (model from board-store.ts:240-254):
```typescript
// Existing derived selectors in board-store.ts:
export const selectIsAntiVirality = (s: BoardState) =>
  s.boardState === 'anti-virality';

// New cross-group-state.ts must expose:
type CrossGroupSignal = 'anti-virality';

const AFFECTED_FRAMES: Record<CrossGroupSignal, Set<GroupId>> = {
  'anti-virality': new Set(['verdict', 'audience', 'actions']),
};

export function useAntiViralityAffectedFrames(): Set<GroupId> {
  const boardState = useBoardStore((s) => s.boardState);
  return boardState === 'anti-virality' ? AFFECTED_FRAMES['anti-virality'] : new Set();
}

export function getFrameAntiViralityState(
  frameId: GroupId,
  boardState: BoardMachineState,
): 'idle' | 'streaming' | 'anti-virality' | 'complete' {
  if (boardState === 'idle' || boardState === 'edit-input') return 'idle';
  if (boardState === 'streaming') return 'streaming';
  if (boardState === 'anti-virality' && AFFECTED_FRAMES['anti-virality'].has(frameId)) {
    return 'anti-virality';
  }
  return 'complete';
}
```

---

### `src/components/board/Board.tsx` (MODIFY — lines 40-51)

**Analog:** self

**Lines 40-51 to refactor** (current):
```typescript
function deriveFrameVisual(
  boardMachineState: BoardMachineState,
  frameId: GroupId,
): FrameVisualState {
  if (boardMachineState === 'idle' || boardMachineState === 'edit-input') return 'idle';
  if (boardMachineState === 'streaming') return 'streaming';
  // HARD-CODED — refactor target
  if (boardMachineState === 'anti-virality' && (frameId === 'verdict' || frameId === 'audience')) {
    return 'anti-virality';
  }
  return 'complete';
}
```

**After refactor** — replace body with call to `getFrameAntiViralityState`:
```typescript
import { getFrameAntiViralityState } from './cross-group-state';

function deriveFrameVisual(
  boardMachineState: BoardMachineState,
  frameId: GroupId,
): FrameVisualState {
  return getFrameAntiViralityState(frameId, boardMachineState);
}
```

**Node wiring pattern** (Board.tsx lines 302-304 — add verdict/actions/content-analysis):
```typescript
{layout.id === 'engine' && <EngineGroup />}
{layout.id === 'audience' && <AudienceNode camera={camera} layout={layout} />}
{/* Phase 5 additions follow this same pattern: */}
{layout.id === 'verdict' && <VerdictNode camera={camera} layout={layout} />}
{layout.id === 'actions' && <ActionsNode camera={camera} layout={layout} />}
{layout.id === 'content-analysis' && <ContentAnalysisFrame camera={camera} layout={layout} />}
```

---

### `src/components/board/verdict/VerdictNode.tsx` (component, request-response)

**Analog:** `src/components/board/audience/AudienceNode.tsx` (lines 1-362)

**Imports pattern** (AudienceNode.tsx lines 1-20):
```typescript
'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { useBoardStore } from '@/stores/board-store';
import type { Camera, GroupFrameLayout } from '../board-types';
import { TITLE_BAR_HEIGHT } from '../board-constants';
// Phase 5 adds:
import { getFrameAntiViralityState } from '../cross-group-state';
import { useComparisons } from './use-comparisons';
```

**Node props pattern** (AudienceNode.tsx lines 26-29):
```typescript
export interface VerdictNodeProps {
  camera: Camera;
  layout: GroupFrameLayout;
}
```

**Root render pattern** (AudienceNode.tsx lines 254-260):
```typescript
return (
  <>
    <div
      aria-live="polite"
      aria-busy={isStreaming}
      className="relative flex h-full w-full flex-col gap-3 overflow-y-auto"
    >
      {/* children stacked vertically */}
    </div>
    {/* Portals for TapPopover, inspector sheets rendered outside */}
  </>
);
```

**Board store subscription pattern** (AudienceNode.tsx lines 57-58):
```typescript
const setActivePreset = useBoardStore((s) => s.setActivePreset);
// VerdictNode adds:
const boardMachineState = useBoardStore((s) => s.boardState);
const avState = getFrameAntiViralityState('verdict', boardMachineState);
```

**Phase/streaming detection** (AudienceNode.tsx line 229):
```typescript
const isStreaming = phase === 'analyzing' || phase === 'reconnecting' || phase === 'polling';
```

---

### `src/components/board/verdict/PercentileChip.tsx` (component, display)

**Analog:** `src/components/board/audience/HeadlineChips.tsx` (lines 40-67)

**Chip primitive pattern** (HeadlineChips.tsx lines 40-67):
```typescript
function Chip({ label, value, isSkeleton, valueClassName }) {
  return (
    <dl
      className="flex min-w-0 flex-1 flex-col rounded-[8px] border border-white/[0.06] px-2 py-1.5"
      style={{ background: 'rgba(255,255,255,0.05)' }}
    >
      <dt className="truncate text-[10px] font-normal uppercase tracking-[0.04em] opacity-60">
        {label}
      </dt>
      <dd className={cn('text-sm font-semibold leading-[1.1] tabular-nums', valueClassName)}>
        {isSkeleton ? <Skeleton className="h-[14px] w-[36px]" /> : value}
      </dd>
    </dl>
  );
}
```

**PercentileChip-specific pattern** (new, per UI-SPEC):
```typescript
// Big number: text-5xl font-semibold, coral when score >= 70
// Layout: flex items-end justify-between gap-2
// Skeleton state: '--' in text-5xl font-semibold white/20
// Confidence GlassPill to the right: no coral, white/60 text
// Band label: text-xs font-normal white/60 below big number
// Uncalibrated: text-[10px] white/40 italic "(score uncalibrated)" when is_calibrated === false
```

**GlassPill import** (from primitives/index.ts, used in video-card.tsx line 7):
```typescript
import { GlassPill } from '@/components/primitives';
```

---

### `src/components/board/verdict/AntiViralityHeader.tsx` (component, event-driven)

**Analog:** `src/components/board/audience/AntiViralityOverlay.tsx` (lines 1-79)

**Imports pattern** (AntiViralityOverlay.tsx lines 1-7):
```typescript
'use client';

import { useMemo } from 'react';
import { isAntiViralityGatedFull } from '@/lib/engine/anti-virality';
import type { HeatmapPayload } from './audience-types';
```

**Conditional render guard** (AntiViralityOverlay.tsx lines 17-23):
```typescript
export function AntiViralityOverlay({ result, onFixChipTap, fixTextBySegment }) {
  // ...derive state...
  if (!state.gated) return null;   // ← copy this guard pattern
```

**Warning color token** (AntiViralityOverlay.tsx line 51):
```typescript
style={{ color: 'var(--color-warning)' }}
```

**AntiViralityHeader-specific pattern** (per UI-SPEC):
```typescript
// Full-bleed 40px band: background linear-gradient(90deg, var(--color-accent), var(--color-warning))
// Text left: "⚠ Don't post yet — fixable in {N} steps" text-xs font-semibold text-white/90
// Text right: "Post anyway →" text-xs, color: var(--color-accent), pointer-events-auto
// localStorage key: 'virtuna:verdict-av-override:{analysisId}'
// On override tap: fire verdict_anti_virality_override event + persist dismissal + set dismissed state
// role="status" aria-live="polite" (mirrors AntiViralityOverlay.tsx line 32)
```

---

### `src/components/board/verdict/WhyVerdictCollapsible.tsx` (component, collapsible)

**Analog:** `src/components/board/audience/HeatmapDrawer.tsx` lines 1-8 (Sheet/expand import pattern) + RESEARCH Pattern 5

**Imports pattern** (HeatmapDrawer.tsx lines 1-8):
```typescript
'use client';
import { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CaretDown, CaretUp } from '@phosphor-icons/react';
```

**Native `<details>` collapsible pattern** (RESEARCH Pattern 5 — no existing codebase analog, but pattern is specified):
```typescript
<details className="group rounded-[8px] border border-white/[0.06] bg-white/[0.02] open:bg-white/[0.04]">
  <summary
    className="flex cursor-pointer items-center justify-between p-2 text-sm font-medium list-none"
    onClick={() => logger.event('verdict_reasoning_expanded', { score: result.overall_score })}
  >
    <span>Why this verdict?</span>
    <CaretDown size={12} className="opacity-60 group-open:rotate-180 transition-transform" />
  </summary>
  <div className="p-3 pt-0 text-xs">{/* 4 sub-sections */}</div>
</details>
```

**react-markdown pattern** (NO existing codebase analog — new install):
```typescript
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

// ALWAYS pair — never react-markdown alone on engine-emitted content:
<ReactMarkdown rehypePlugins={[rehypeSanitize]}>{result.reasoning}</ReactMarkdown>
```

**Reasoning bucket assembly** (RESEARCH Pattern 1):
```typescript
// From src/lib/engine/types.ts:227 + 311 + 423 shape
function assembleReasoningBuckets(result: PredictionResult) {
  return {
    intro: result.reasoning,                                          // single markdown block
    works: result.factors.filter((f) => f.score >= 7),               // factors[] score >= 7
    mightNot: result.factors.filter((f) => f.score < 4),             // factors[] score < 4
    flagged: result.warnings,                                          // flat string[]
    counterfactual: result.counterfactuals?.suggestions
      .filter((s) => s.type === 'fix' || s.type === 'stretch')
      .slice(0, 5)
      ?? [],
  };
}
```

**Sub-section chip-header style** (mirrors HeadlineChips.tsx dt pattern):
```typescript
// text-[10px] uppercase tracking-wide white/50 — same as HeadlineChips dt:
className="text-[10px] font-normal uppercase tracking-[0.04em] opacity-50"
```

---

### `src/components/board/verdict/VsHistoryCollapsible.tsx` (component, chart)

**Analog:** `src/components/competitors/comparison/comparison-bar-chart.tsx` (lines 1-107)

**Imports pattern** (comparison-bar-chart.tsx lines 1-13):
```typescript
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartTooltip } from "@/components/competitors/charts/chart-tooltip";
```

**ResponsiveContainer + BarChart pattern** (comparison-bar-chart.tsx lines 45-87):
```typescript
<ResponsiveContainer width="100%" height={300}>  // Phase 5 uses height={88} (compact)
  <BarChart
    data={data}
    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
  >
    {/* Phase 5: NO CartesianGrid (Raycast minimal) */}
    <XAxis
      dataKey="metric"
      stroke="var(--color-foreground-muted)"
      fontSize={10}  // Phase 5: 10px not 12px (tight frame)
      tickLine={false}
      axisLine={false}
    />
    <YAxis
      stroke="var(--color-foreground-muted)"
      fontSize={10}
      tickLine={false}
      axisLine={false}
    />
    <Tooltip content={<ChartTooltip formatter={(v) => String(v)} />} />
    <Bar
      dataKey="current"
      fill="var(--color-accent)"          // coral = current analysis
      isAnimationActive={!prefersReducedMotion}
      radius={[4, 4, 0, 0]}
    />
    <Bar
      dataKey="history"
      fill="rgba(255,255,255,0.30)"        // white/30 = prior analyses
      isAnimationActive={!prefersReducedMotion}
      radius={[4, 4, 0, 0]}
    />
  </BarChart>
</ResponsiveContainer>
```

**Empty state pattern** (comparison-bar-chart.tsx lines 33-37):
```typescript
if (data.length === 0) {
  return (
    <div className="flex items-center justify-center h-[300px] border border-white/[0.06] rounded-xl">
      <p className="text-sm text-foreground-muted">No data to compare</p>
    </div>
  );
}
// Phase 5 version: "Need 3+ prior analyses to show comparison. {N}/3 complete."
// text-xs text-foreground-muted italic — no border wrapper (inline text only)
```

---

### `src/components/board/verdict/TopFixesList.tsx` (component, list)

**Analog:** `src/components/board/audience/AntiViralityOverlay.tsx` lines 57-72 (fix chip pattern)

**Fix chip pattern** (AntiViralityOverlay.tsx lines 57-72):
```typescript
{state.dropoff_segment_indices.map((segIdx) => {
  const fixText = fixTextBySegment[segIdx] ?? 'rework segment';
  return (
    <button
      key={segIdx}
      type="button"
      onClick={() => onFixChipTap(segIdx, fixText)}
      className="rounded-[4px] border px-2 py-0.5 text-[11px]"
      style={{
        borderColor: 'var(--color-warning)',
        background: 'var(--color-surface-elevated)',
      }}
    >
      seg {segIdx}: {fixText}
    </button>
  );
})}
```

**TopFixesList-specific pattern** (per UI-SPEC — extends fix chip):
```typescript
// Each fix item: rounded-[8px] border border-white/[0.06] bg-white/[0.02] p-2
// Timestamp pill: text-[10px] rounded-[4px] border border-accent/30 px-1.5 py-0.5 text-accent
// Headline: text-xs font-medium
// Detail: text-xs text-foreground-muted
// Tap timestamp → setActivePreset('audience') (mirrors AudienceNode.tsx line 199: setActivePreset)
// Max 3 items — filter suggestions where type === 'fix', slice(0, 3)
```

**Camera pan tap pattern** (AudienceNode.tsx line 196-201):
```typescript
const handleJumpToSegment = useCallback(
  (_segIdx: number) => {
    setActivePreset('audience');   // ← copy this exact call
  },
  [setActivePreset],
);
```

---

### `src/components/board/verdict/use-comparisons.ts` (hook, CRUD)

**Analog:** `src/app/api/analyze/[id]/override/route.ts` (server-side shape) + TanStack Query pattern from useAnalysisStream

**TanStack Query pattern** (from RESEARCH.md — `useAnalysisStream` shape):
```typescript
'use client';
import { useQuery } from '@tanstack/react-query';

export function useComparisons(analysisId: string | null) {
  return useQuery({
    queryKey: ['comparisons', analysisId],
    queryFn: async () => {
      const res = await fetch(`/api/analyze/${analysisId}/comparisons`);
      if (!res.ok) throw new Error('comparisons_fetch_failed');
      return res.json() as Promise<{
        history: number[];
        niche: { median: number; p75: number; count: number };
      }>;
    },
    enabled: !!analysisId,
    staleTime: 5 * 60 * 1000,  // 5 min — aggregate is stable per analysis
  });
}
```

---

### `src/app/api/analyze/[id]/comparisons/route.ts` (route, CRUD)

**Analog:** `src/app/api/analyze/[id]/override/route.ts` (lines 1-106)

**Imports pattern** (override/route.ts lines 1-3):
```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
```

**Auth + param pattern** (override/route.ts lines 35-44):
```typescript
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  // ...
}
```

**Error response pattern** (override/route.ts lines 77-79):
```typescript
if (e1) {
  return NextResponse.json({ error: 'override_write_failed' }, { status: 500 });
}
```

**Success pattern** (override/route.ts line 105):
```typescript
return NextResponse.json({ ok: true });
// Phase 5 GET returns:
// return NextResponse.json({ history: number[], niche: { median, p75, count } });
```

---

### `src/components/board/actions/ActionsNode.tsx` (component, event-driven)

**Analog:** `src/components/board/audience/AudienceNode.tsx` (lines 1-50 for shell; layout differs)

**Imports pattern** (AudienceNode.tsx lines 1-20 — same substrate):
```typescript
'use client';
import { useMemo } from 'react';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { useBoardStore } from '@/stores/board-store';
import { getFrameAntiViralityState } from '../cross-group-state';
import type { Camera, GroupFrameLayout } from '../board-types';
```

**AV-driven grid pattern** (per UI-SPEC / RESEARCH Pattern 2):
```typescript
// Default: CSS Grid grid-cols-2 grid-rows-2 gap-2 p-2, card cells ~170×88
// AV state: grid-template-rows changes; ActionsReshootHeroSlot spans both cols at top
// Transition: 200ms ease-out on height (mirrors AntiViralityOverlay transition)
const avState = getFrameAntiViralityState('actions', boardMachineState);
const isAV = avState === 'anti-virality';

<div
  className="grid grid-cols-2 gap-2 p-2"
  style={{
    gridTemplateRows: isAV ? '160px 1fr' : '88px 88px',
    transition: prefersReducedMotion ? 'none' : 'grid-template-rows 200ms ease-out',
  }}
>
  {isAV && <ActionsReshootHeroSlot style={{ gridColumn: '1 / -1' }} />}
  {/* ... card slots ... */}
</div>
```

---

### `src/components/board/actions/PlaceholderCard.tsx` (component, display)

**Analog:** `src/components/board/audience/HeadlineChips.tsx` lines 53-67 (Chip primitive pattern — card container baseline)

**Card base pattern** (from CLAUDE.md + HeadlineChips.tsx Chip):
```typescript
// Cards: bg-transparent, border rgba(255,255,255,0.06), radius 12px
// PlaceholderCard-specific:
export function PlaceholderCard({ label, phase, icon: Icon }: PlaceholderCardProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1 rounded-[12px] p-3 bg-white/[0.02] text-white/40"
      style={{
        border: '1px dashed rgba(255,255,255,0.06)',  // dashed NOT solid
      }}
      aria-label={`${label}: coming in Phase ${phase}`}
      role="presentation"  // not in tab order
    >
      <Icon size={16} aria-hidden="true" />
      <span className="text-xs font-medium">{label}</span>
      <span className="text-[10px]">Coming in Phase {phase}</span>
    </div>
  );
}
// NO hover state — role="presentation", not interactive
```

---

### `src/components/board/actions/SimilarVideoCardCompact.tsx` (component, request-response)

**Analog:** `src/components/trending/video-card.tsx` (reference / cross-link only — do NOT reuse)

**VideoCard import path** (video-card.tsx lines 1-15 — for code comment cross-link):
```typescript
// Cross-link in SimilarVideoCardCompact.tsx:
// Ref: src/components/trending/video-card.tsx (~190 lines, grid-tile model, depends on useBookmarkStore)
// This compact variant shares: Card base, GlassPill, @phosphor-icons/react
// Does NOT share: useBookmarkStore, Image from next/image, VelocityIndicator, HoverScale
```

**Card + GlassPill pattern** (video-card.tsx lines 1-8):
```typescript
import { Card } from '@/components/ui/card';
import { GlassPill } from '@/components/primitives';
```

**SimilarVideoCardCompact-specific pattern** (per UI-SPEC, ~80 lines target):
```typescript
// Layout: flex items-center gap-2 p-2 cursor-pointer rounded-[8px]
// Thumb: h-14 w-14 shrink-0 rounded-[6px] bg-white/[0.06] (no thumbnail_url in RetrievalEvidenceItem)
// Creator: text-xs font-medium truncate
// Views: text-[10px] text-foreground-muted
// Similarity: GlassPill size="sm" "{N}%"
// Hover: bg-white/[0.02] only (Raycast card hover rule)
// Tap: TikTokEmbed modal via Radix Dialog at body level
// role="button" tabIndex={0} aria-label="Similar video by @{handle}, {N} views"
```

**TikTok embed modal trigger** (tiktok-embed.tsx lines 32-100):
```typescript
// Reuse TikTokEmbed directly — do NOT build a new embed component
// tiktok-embed.tsx handles: script injection, cache-busting, cleanup, loading skeleton
import { TikTokEmbed } from '@/components/trending/tiktok-embed';
// Wrap in Radix Dialog portal at body level (NOT inline mount)
```

---

### `src/components/board/content-analysis/ContentAnalysisFrame.tsx` (component, layout)

**Analog:** `src/components/board/audience/AudienceNode.tsx` lines 254-260 (root render shell)

**Shell pattern** (AudienceNode.tsx):
```typescript
// ContentAnalysisFrame = horizontal split, not vertical stack
// flex flex-row gap-4 p-2 h-full (from UI-SPEC)
export function ContentAnalysisFrame({ camera: _camera, layout }: ContentAnalysisFrameProps) {
  const stream = useAnalysisStream();
  return (
    <div className="flex flex-row gap-4 p-2 h-full">
      <HookDecompNode
        decomp={stream.result?.hook_decomposition ?? null}
        segments={stream.result?.heatmap?.segments ?? null}
        // ~480px left node
        className="w-[480px] shrink-0"
      />
      <EmotionArcNode
        points={stream.result?.emotion_arc ?? null}
        // ~872px right node, flex-1
        className="flex-1"
      />
    </div>
  );
}
```

---

### `src/components/board/content-analysis/HookDecompNode.tsx` (component, visualization)

**Analog:** `src/components/primitives/GlassProgress.tsx` (lines 1-53) + `src/components/board/audience/HeadlineChips.tsx` (chip row)

**GlassProgress pattern** (GlassProgress.tsx lines 28-53):
```typescript
import { GlassProgress } from '@/components/primitives/GlassProgress';
// Usage for hook decomp bars:
<GlassProgress
  value={decomp.visual_stop_power * 10}  // schema 0-1 × 10 → 0-10 scale
  color="coral"
  size="md"
  className="flex-1"
/>
// Weakest modality row highlight:
className={cn(
  'flex items-center gap-2',
  b.key === decomp.weakest_modality && 'bg-accent/8 -mx-1 px-1 rounded-[6px]',
)}
```

**Bar row layout** (per RESEARCH Pattern 3):
```typescript
const bars = [
  { key: 'visual_stop_power', label: 'Visual stop power', value: decomp.visual_stop_power },
  { key: 'audio_hook_quality', label: 'Audio hook', value: decomp.audio_hook_quality },
  { key: 'text_overlay_score', label: 'Text overlay', value: decomp.text_overlay_score },
  { key: 'first_words_speech_score', label: 'First words', value: decomp.first_words_speech_score },
];
// Label width: w-[120px] (layout constant, not spacing token)
// Score: w-[32px] text-[10px] tabular-nums text-right
// Bar gap: gap-1 (4px) between rows — NOT gap-1.5 (UI-SPEC anti-pattern)
```

**Cognitive load inversion** (schema comment src/lib/engine/qwen/schemas.ts:27 — inverted polarity):
```typescript
// NEVER show raw 0-10; ALWAYS bucket via inverted polarity:
const cognitiveBucket = decomp.cognitive_load <= 3 ? 'Low'
  : decomp.cognitive_load <= 6 ? 'Med' : 'High';
// Display: GlassPill size="sm" "Cognitive load: {Low/Med/High}"
```

**Chip row pattern** (HeadlineChips.tsx lines 99-136 — flex items-stretch gap-1.5):
```typescript
import { GlassPill } from '@/components/primitives';
// chip row: flex gap-1 (not gap-1.5 — UI-SPEC anti-pattern flag)
<div className="flex gap-1">
  <GlassPill size="sm">Coherence: {decomp.visual_audio_coherence.toFixed(1)}/10</GlassPill>
  <GlassPill size="sm">Cognitive load: {cognitiveBucket}</GlassPill>
</div>
```

**Empty state** (mirrors FollowerGrowthChart empty state):
```typescript
if (!decomp) return (
  <div className="flex flex-col gap-2">
    {/* 4 bars at value=0, no weakest highlight */}
    {bars.map(b => <GlassProgress key={b.key} value={0} color="coral" size="md" />)}
    <p className="text-xs text-foreground-muted italic">
      Hook analysis unavailable for this video
    </p>
  </div>
);
```

---

### `src/components/board/content-analysis/HookDecompInspector.tsx` (component, inspector)

**Analog:** `src/components/board/audience/PersonaInspector.tsx` (lines 1-225)

**Imports pattern** (PersonaInspector.tsx lines 1-12):
```typescript
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/useIsMobile';
```

**Sheet side pattern** (PersonaInspector.tsx lines 94-95):
```typescript
const isMobile = useIsMobile();
const side = isMobile ? 'bottom' : 'right';
```

**SheetContent pattern** (PersonaInspector.tsx lines 111-126):
```typescript
<Sheet open={open} onOpenChange={onOpenChange}>
  <SheetContent
    side={side}
    className={cn(
      'border-white/[0.06] bg-[#18191a]',   // solid opaque — NOT glass
      side === 'right' && 'max-w-[360px]',
      side === 'bottom' && 'max-h-[85dvh]',
    )}
    onCloseAutoFocus={(e) => {
      if (triggerRef?.current) {
        e.preventDefault();
        triggerRef.current.focus();         // focus restoration
      }
    }}
  >
```

**Section heading pattern** (PersonaInspector.tsx lines 177-179):
```typescript
<h3 className="text-xs font-semibold uppercase tracking-wide mb-1"
    style={{ color: 'rgba(249,249,249,0.4)' }}>
  Section Title
</h3>
```

---

### `src/components/board/content-analysis/EmotionArcNode.tsx` (component, chart)

**Analog:** `src/components/competitors/charts/follower-growth-chart.tsx` (lines 1-87)

**Imports pattern** (follower-growth-chart.tsx lines 1-13):
```typescript
"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,     // Phase 5 adds this for peak/valley markers
} from "recharts";
import { ChartTooltip } from "@/components/competitors/charts/chart-tooltip";
```

**linearGradient pattern** (follower-growth-chart.tsx lines 40-53):
```typescript
<defs>
  <linearGradient id="emotionGradient" x1="0" y1="0" x2="0" y2="1">
    {/* Phase 5 gradient: gray→coral-200→coral-500 (NOT follower gradient) */}
    <stop offset="0%"   stopColor="var(--color-accent)" stopOpacity={0.6} />
    <stop offset="60%"  stopColor="var(--color-accent)" stopOpacity={0.3} />
    <stop offset="100%" stopColor="rgba(132,133,134,0.1)" stopOpacity={1} />
  </linearGradient>
</defs>
```

**ResponsiveContainer with explicit height** (follower-growth-chart.tsx line 35 — CRITICAL pitfall fix):
```typescript
// follower-growth-chart uses height={300}
// Phase 5 MUST use explicit height={140} (not "100%") to avoid Pitfall 1
<ResponsiveContainer width="100%" height={140}>
```

**Area pattern** (follower-growth-chart.tsx lines 76-83):
```typescript
<Area
  type="monotone"
  dataKey="intensity_0_1"      // Phase 5 data key (not "followers")
  stroke="var(--color-accent)"
  fill="url(#emotionGradient)"
  strokeWidth={2}
  isAnimationActive={!prefersReducedMotion}   // Phase 5: conditional (not hard false)
/>
```

**ReferenceDot pattern** (Phase 5 addition — no analog, from RESEARCH Pattern 4):
```typescript
{points.map((p) =>
  p.label === 'high' ? (
    <ReferenceDot
      key={`peak-${p.timestamp_ms}`}
      x={p.timestamp_ms}
      y={p.intensity_0_1}
      r={6}
      fill="var(--color-accent)"
      stroke="none"
    />
  ) : p.label === 'low' ? (
    <ReferenceDot
      key={`valley-${p.timestamp_ms}`}
      x={p.timestamp_ms}
      y={p.intensity_0_1}
      r={4}
      fill="rgba(132,133,134,0.6)"
      stroke="none"
    />
  ) : null,
)}
```

**Axes hide pattern** (per UI-SPEC — XAxis/YAxis hidden, Raycast minimal):
```typescript
<XAxis dataKey="timestamp_ms" hide />
<YAxis domain={[0, 1]} hide />
// follower-growth-chart shows axes — Phase 5 hides both (different visual contract)
```

**Empty state** (mirrors follower-growth-chart.tsx lines 27-31):
```typescript
if (!points || points.length === 0) {
  // Flat gray baseline: static data [{x:0,y:0.5},{x:1,y:0.5}] in rgba(132,133,134,0.3)
  // Caption overlaid: text-xs text-foreground-muted italic "Emotion arc unavailable"
}
```

---

### `src/components/board/content-analysis/EmotionArcInspector.tsx` (component, inspector)

**Analog:** `src/components/board/audience/PersonaInspector.tsx` (lines 84-225)

Same Sheet/SheetContent/isMobile pattern as `HookDecompInspector.tsx` above. Body replaces persona-specific content with larger chart rerender + per-peak table (timestamp, intensity, label). All structural patterns identical.

---

## Shared Patterns

### Authentication (API routes only)
**Source:** `src/app/api/analyze/[id]/override/route.ts` lines 35-44
**Apply to:** `src/app/api/analyze/[id]/comparisons/route.ts`
```typescript
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}
```

### Perf-tier degradation hook
**Source:** `src/lib/perf-tier.ts` (imported in Board.tsx lines 32, 66)
**Apply to:** `VerdictNode.tsx`, `ActionsNode.tsx`, `EmotionArcNode.tsx`, `HookDecompNode.tsx`
```typescript
import { usePerfStore } from '@/lib/perf-tier';
const tier = usePerfStore((s) => s.tier);
// Low tier: disable tap-popover dots on emotion arc, suppress hook decomp bar animation
```

### Reduced-motion hook
**Source:** `src/hooks/usePrefersReducedMotion` (used in Board.tsx line 14, 61)
**Apply to:** `VerdictNode.tsx`, `VsHistoryCollapsible.tsx`, `EmotionArcNode.tsx`, `HookDecompNode.tsx`, `ActionsNode.tsx`
```typescript
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
const prefersReducedMotion = usePrefersReducedMotion();
// Pass to Recharts: isAnimationActive={!prefersReducedMotion}
// Collapsibles: transition: prefersReducedMotion ? 'none' : 'height 200ms ease-out'
// Skeleton shimmer: suppress animate-pulse when prefersReducedMotion
```

### Streaming phase detection
**Source:** `src/components/board/audience/AudienceNode.tsx` line 229
**Apply to:** All node shells (`VerdictNode`, `ActionsNode`, `ContentAnalysisFrame`)
```typescript
const isStreaming = phase === 'analyzing' || phase === 'reconnecting' || phase === 'polling';
```

### Raycast border token
**Source:** `CLAUDE.md` §Raycast Design Language Rules
**Apply to:** All new components
```typescript
// Solid borders: border-white/[0.06]        (6% — NOT 8% or 12%)
// Hover borders: border-white/[0.1]          (10%)
// Dashed borders (PlaceholderCard only): style={{ border: '1px dashed rgba(255,255,255,0.06)' }}
// Inspector/modal bg: bg-[#18191a]           (solid opaque — NEVER glass)
// Card radius: rounded-[12px]
// backdrop-filter: ALWAYS inline style={{ backdropFilter: 'blur(5px)' }} — never Tailwind class
```

### Glass panel inline style
**Source:** `src/components/board/audience/TapPopover.tsx` lines 9-16
**Apply to:** Any new popover / floating panel
```typescript
const GLASS_STYLE: React.CSSProperties = {
  background: 'linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%)',
  backdropFilter: 'blur(5px)',
  WebkitBackdropFilter: 'blur(5px)',
  boxShadow: 'rgba(255,255,255,0.15) 0px 1px 1px 0px inset',
  zIndex: 300,
};
```

### ChartTooltip reuse
**Source:** `src/components/competitors/charts/chart-tooltip.tsx` lines 22-52
**Apply to:** `VsHistoryCollapsible.tsx`, `EmotionArcNode.tsx`
```typescript
import { ChartTooltip } from '@/components/competitors/charts/chart-tooltip';
<Tooltip content={<ChartTooltip formatter={(v) => String(v)} />} />
```

### aria-live announcement pattern
**Source:** `src/components/board/audience/AudienceNode.tsx` lines 257-259
**Apply to:** `VerdictNode.tsx`, `HookDecompNode.tsx`, `EmotionArcNode.tsx`
```typescript
// Debounced 500ms after boardState === 'complete':
<div
  aria-live="polite"
  aria-busy={isStreaming}
  className="relative flex h-full w-full flex-col gap-3 overflow-y-auto"
>
```

### useBoardStore anti-virality selector
**Source:** `src/stores/board-store.ts` lines 249-251
**Apply to:** `VerdictNode.tsx`, `ActionsNode.tsx` (via cross-group-state.ts)
```typescript
export const selectIsAntiVirality = (s: BoardState) => s.boardState === 'anti-virality';
// Phase 5 nodes call getFrameAntiViralityState(frameId, boardMachineState) instead
// of calling selectIsAntiVirality directly — single source of truth
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `react-markdown` + `rehype-sanitize` usage | — | — | No existing markdown rendering in codebase. New install. Pattern from RESEARCH.md: `<ReactMarkdown rehypePlugins={[rehypeSanitize]}>{str}</ReactMarkdown>`. Always pair both. |

---

## Metadata

**Analog search scope:** `src/components/board/`, `src/components/competitors/`, `src/components/trending/`, `src/components/primitives/`, `src/app/api/analyze/`, `src/stores/`
**Files scanned:** 15 files read in full
**Pattern extraction date:** 2026-05-27
