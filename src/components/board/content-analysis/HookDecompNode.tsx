'use client';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { X } from 'lucide-react';
import { GlassProgress, GlassPill } from '@/components/primitives';
import { cn } from '@/lib/utils';
import type { HookDecomposition } from '@/lib/engine/qwen/schemas';
import type { CounterfactualSuggestionItem } from '@/lib/engine/types';
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
  // Inline expander (no Sheet/popup) — primary value (bars + chips) stays always-on;
  // deeper detail (composition reasoning + how-to-fix) expands in-frame.
  const [detailOpen, setDetailOpen] = useState(false);
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

  const toggleDetail = useCallback(() => {
    if (!decomp) return;
    setDetailOpen((prev) => {
      const next = !prev;
      if (next) {
        // logger.event is not part of the Logger interface — use optional chaining for forward compat.
        (logger as unknown as { event?: (name: string, data: Record<string, unknown>) => void }).event?.(
          TELEMETRY.HOOK_DECOMP_EXPANDED,
          { weakest_modality: decomp.weakest_modality },
        );
      }
      return next;
    });
  }, [decomp]);

  const cognitiveBucket = useMemo(
    () => (decomp ? cognitiveLoadBucket(decomp.cognitive_load) : 'Low'),
    [decomp],
  );

  const hookFixes = useMemo(
    () => (counterfactuals ?? []).filter((s) => s.signal_anchor === 'hook'),
    [counterfactuals],
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
                onClick={toggleDetail}
                aria-expanded={detailOpen}
                aria-controls="hook-decomp-detail"
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
            onClick={toggleDetail}
            aria-expanded={detailOpen}
            aria-controls="hook-decomp-detail"
            className="cursor-pointer"
            data-testid="hook-decomp-coherence-chip"
          >
            <GlassPill size="sm">
              {COPY.COHERENCE_PREFIX}: {decomp.visual_audio_coherence.toFixed(1)}/10
            </GlassPill>
          </button>
          <button
            type="button"
            onClick={toggleDetail}
            aria-expanded={detailOpen}
            aria-controls="hook-decomp-detail"
            className="cursor-pointer"
            data-testid="hook-decomp-cognitive-chip"
          >
            <GlassPill size="sm">
              {COPY.COGNITIVE_LOAD_PREFIX}: {cognitiveBucket}
            </GlassPill>
          </button>
        </div>
      )}

      {/* Inline detail — replaces the former HookDecompInspector Sheet.
          Surfaces the weakest-modality callout, composition reasoning, and the
          hook-anchored fix list directly in-frame (no overlay). */}
      {detailOpen && decomp && (
        <div
          id="hook-decomp-detail"
          data-testid="hook-decomp-detail"
          className="flex flex-col gap-3 rounded-[8px] border border-white/[0.06] bg-white/[0.02] p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-white/75">
              Weakest element:{' '}
              <span className="font-medium text-accent">
                {HOOK_BAR_LABELS[decomp.weakest_modality]}
              </span>{' '}
              <span className="tabular-nums text-white/55">
                ({decomp[decomp.weakest_modality].toFixed(1)}/10)
              </span>
            </p>
            <button
              type="button"
              onClick={() => setDetailOpen(false)}
              aria-label="Close hook detail"
              className="rounded-md p-1 text-white/40 transition-colors hover:bg-white/[0.05] hover:text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF7F50]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Composition */}
          <section>
            <h4 className="mb-1 text-[10px] font-normal uppercase tracking-[0.04em] text-white/45">
              Composition
            </h4>
            <div className="flex flex-col gap-0.5 text-xs text-white/75">
              <span>
                Visual–audio coherence:{' '}
                <span className="tabular-nums text-white/90">
                  {decomp.visual_audio_coherence.toFixed(1)}/10
                </span>
              </span>
              <span>
                Cognitive load: <span className="text-white/90">{cognitiveBucket}</span>
              </span>
            </div>
          </section>

          {/* Fix suggestions — the primary new value over the always-on bars/chips */}
          {hookFixes.length > 0 && (
            <section>
              <h4 className="mb-1 text-[10px] font-normal uppercase tracking-[0.04em] text-white/45">
                How to fix
              </h4>
              <ul className="flex flex-col gap-2">
                {hookFixes.slice(0, 3).map((fix, i) => (
                  <li key={`${fix.timestamp_ms}-${i}`} className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-white/90">{fix.headline}</span>
                    <p className="text-xs leading-[1.45] text-foreground-muted">{fix.detail}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
