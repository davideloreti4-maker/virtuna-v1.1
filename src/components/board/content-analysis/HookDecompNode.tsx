'use client';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { GlassProgress, GlassPill } from '@/components/primitives';
import { cn } from '@/lib/utils';
import type { HookDecomposition } from '@/lib/engine/qwen/schemas';
import type { CounterfactualSuggestionItem } from '@/lib/engine/types';
import { HookDecompInspector } from './HookDecompInspector';
import {
  HOOK_BAR_LABELS,
  HOOK_BAR_ORDER,
  COPY,
  TELEMETRY,
  cognitiveLoadBucket,
  hookZoneLabel,
} from './content-analysis-constants';
import { logger } from '@/lib/logger';

interface Segment {
  t_start: number;
  t_end: number;
  is_hook_zone: boolean;
  label?: string;
}

interface Props {
  decomp: HookDecomposition | null;
  segments: ReadonlyArray<Segment> | null | undefined;
  counterfactuals: ReadonlyArray<CounterfactualSuggestionItem> | undefined;
  className?: string;
}

export function HookDecompNode({ decomp, segments, counterfactuals, className }: Props) {
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [ariaText, setAriaText] = useState('');
  const announcedRef = useRef(false);

  // Aria-live: announce weakest modality 500ms after mount with valid decomp.
  useEffect(() => {
    if (!decomp || announcedRef.current) return;
    announcedRef.current = true;
    const handle = window.setTimeout(() => {
      setAriaText(`${HOOK_BAR_LABELS[decomp.weakest_modality]} is weakest hook element`);
    }, 500);
    return () => window.clearTimeout(handle);
  }, [decomp]);

  const openInspector = useCallback(() => {
    if (!decomp) return;
    // logger.event is not part of the Logger interface — use optional chaining for forward compat.
    (logger as unknown as { event?: (name: string, data: Record<string, unknown>) => void }).event?.(
      TELEMETRY.HOOK_DECOMP_EXPANDED,
      { weakest_modality: decomp.weakest_modality },
    );
    setInspectorOpen(true);
  }, [decomp]);

  const cognitiveBucket = useMemo(
    () => (decomp ? cognitiveLoadBucket(decomp.cognitive_load) : 'Low'),
    [decomp],
  );

  return (
    <div className={cn('flex flex-col gap-2 p-2', className)} data-testid="hook-decomp-node">
      <span className="sr-only" aria-live="polite" data-testid="hook-decomp-aria-live">
        {ariaText}
      </span>

      {/* Headline strip — role="none" prevents banner landmark violation (axe landmark-banner-is-top-level)
          since this header is nested inside role=region (GroupFrameOverlay). */}
      <header role="none" className="flex items-center justify-between">
        <span className="text-xs font-medium" data-testid="hook-decomp-title">
          {COPY.HOOK_DECOMP_TITLE}
        </span>
        <GlassPill size="sm">{hookZoneLabel(segments)}</GlassPill>
      </header>

      {/* 4-bar stack */}
      {decomp ? (
        <div className="flex flex-col gap-1" data-testid="hook-decomp-bars">
          {HOOK_BAR_ORDER.map((key) => {
            const value = decomp[key]; // 0-10 schema value
            const isWeakest = key === decomp.weakest_modality;
            return (
              <button
                key={key}
                type="button"
                onClick={openInspector}
                className={cn(
                  'flex items-center gap-1 rounded-[6px] px-1 py-0.5 cursor-pointer hover:bg-white/[0.02] text-left',
                  isWeakest && 'bg-accent/8 -mx-1',
                )}
                data-testid={`hook-decomp-bar-${key}`}
                data-weakest={isWeakest ? 'true' : 'false'}
                aria-label={`${HOOK_BAR_LABELS[key]}: ${value.toFixed(1)} out of 10`}
              >
                <span className="w-[120px] text-[10px] text-foreground-muted truncate">
                  {HOOK_BAR_LABELS[key]}
                </span>
                {/*
                  GlassProgress: value * 10 maps schema 0-10 → 0-100 scale.
                  Verified: GlassProgress clamps to Math.max(0, Math.min(100, value))
                  and uses the value as a percentage width. Schema is 0-10, so we multiply by 10.
                */}
                <GlassProgress
                  value={value * 10}
                  color="coral"
                  size="md"
                  className="flex-1"
                />
                <span
                  className="w-[32px] text-[10px] tabular-nums text-right"
                  data-testid={`hook-decomp-score-${key}`}
                >
                  {value.toFixed(1)}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        /* Empty state: 4 bars at 0 + caption */
        <div className="flex flex-col gap-1" data-testid="hook-decomp-empty">
          {HOOK_BAR_ORDER.map((key) => (
            <div key={key} className="flex items-center gap-1">
              <span className="w-[120px] text-[10px] text-foreground-muted truncate">
                {HOOK_BAR_LABELS[key]}
              </span>
              <GlassProgress value={0} color="coral" size="md" className="flex-1" />
              <span className="w-[32px] text-[10px] tabular-nums text-right text-white/30">0</span>
            </div>
          ))}
          <p
            className="text-xs italic text-foreground-muted"
            data-testid="hook-decomp-empty-caption"
          >
            {COPY.HOOK_DECOMP_UNAVAILABLE}
          </p>
        </div>
      )}

      {/* Chip row — only when decomp is populated */}
      {decomp && (
        <div className="flex gap-1" data-testid="hook-decomp-chips">
          <button
            type="button"
            onClick={openInspector}
            className="cursor-pointer"
            data-testid="hook-decomp-coherence-chip"
          >
            <GlassPill size="sm">
              {COPY.COHERENCE_PREFIX}: {decomp.visual_audio_coherence.toFixed(1)}/10
            </GlassPill>
          </button>
          <button
            type="button"
            onClick={openInspector}
            className="cursor-pointer"
            data-testid="hook-decomp-cognitive-chip"
          >
            <GlassPill size="sm">
              {COPY.COGNITIVE_LOAD_PREFIX}: {cognitiveBucket}
            </GlassPill>
          </button>
        </div>
      )}

      <HookDecompInspector
        open={inspectorOpen}
        onOpenChange={setInspectorOpen}
        decomp={decomp}
        counterfactuals={counterfactuals}
      />
    </div>
  );
}
