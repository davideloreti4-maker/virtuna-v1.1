'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BehavioralPredictions, ConfidenceLevel } from '@/lib/engine/types';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { usePermalinkFilmstrips } from '@/hooks/queries/use-permalink-filmstrips';
import { useBoardStore } from '@/stores/board-store';
import { cn } from '@/lib/utils';
import {
  FrameHero,
  StatTileRow,
  KeyframeImage,
  resolveKeyframeUrl,
  type StatTileData,
  type KeyframeSegmentLike,
} from './_kit';
import {
  CONF_WORD,
  posterDurationLabel,
  rankStatusWord,
  titleCasePct,
  toMetrics,
  useCountIn,
} from './input/input-derive';

interface Props {
  /** Behavioral predictions — the four engagement percentiles. Null until complete. */
  behavioral: BehavioralPredictions | null;
  /** Model self-certainty (0-1). */
  confidence?: number | null;
  /** Categorical confidence for the footer verdict word. */
  confidenceLabel?: ConfidenceLevel | null;
  /** True when the aggregator gated the result (low confidence / timeline pattern) —
   *  flips the card to the "Hold" state: dimmed, directional-only metrics. */
  gated?: boolean;
  /** True while the analysis is in flight. */
  isStreaming?: boolean;
}

/**
 * InputResultCard — the Input frame's engagement scorecard, in the shared board
 * language: a single dominant hero (the strongest "Top X%" percentile, label
 * "PREDICTED RANK", status word by band) over a calm 4-up tile row of the
 * engagement percentiles. The gated path flips the hero to a coral "Hold"
 * verdict and dims the tiles to directional-only. The model's own confidence
 * anchors the footer. The hero number still counts in (`useCountIn`).
 */
export function InputResultCard({
  behavioral,
  confidence,
  confidenceLabel,
  gated = false,
  isStreaming = false,
}: Props) {
  const reducedMotion = usePrefersReducedMotion();

  // ── Video poster data layer ────────────────────────────────────────────────
  // The card receives its scorecard via props (lifted in Board.tsx), but the
  // keyframe poster is sourced here the least-invasive way: a cached permalink
  // read for replay, merged with the live SSE filmstrips + any pending upload
  // frames (the AudienceNode pattern). The poster renders ONLY when a real
  // keyframe URL resolves — text / url / no-video modes show no poster.
  const { data: permalinkData } = usePermalinkAnalysis();
  const posterStream = useAnalysisStream({ initialData: permalinkData ?? null });
  const streamFilmstrips = posterStream.filmstrips;
  const permalinkFilmstrips = usePermalinkFilmstrips();
  const pendingVideo = useBoardStore((s) => s.pendingVideo);

  const mergedFilmstrips = useMemo<Record<number, string>>(() => {
    if (streamFilmstrips && Object.keys(streamFilmstrips).length > 0) return streamFilmstrips;
    if (permalinkFilmstrips && Object.keys(permalinkFilmstrips).length > 0) return permalinkFilmstrips;
    return (pendingVideo?.frames as Record<number, string> | undefined) ?? {};
  }, [streamFilmstrips, permalinkFilmstrips, pendingVideo?.frames]);

  // Heatmap segments carry per-frame keyframe_uri fallbacks; for a 'first' poster
  // the merged filmstrips alone suffice, but pass segments when present.
  const posterSegments = useMemo<KeyframeSegmentLike[]>(() => {
    const row = posterStream.result as { heatmap?: { segments?: Array<Partial<KeyframeSegmentLike>> | null } | null } | null;
    const raw = (row?.heatmap?.segments ?? []).filter(Boolean) as Array<Partial<KeyframeSegmentLike>>;
    return raw.map((s, i) => ({
      idx: s.idx ?? i,
      t_start: s.t_start ?? 0,
      t_end: s.t_end ?? 0,
      keyframe_uri: s.keyframe_uri ?? null,
    }));
  }, [posterStream.result]);

  const posterUrl = useMemo(
    () => resolveKeyframeUrl(mergedFilmstrips, posterSegments, 'first'),
    [mergedFilmstrips, posterSegments],
  );

  // Duration badge: last segment's t_end, else the pending upload's known length.
  // null → badge omitted (a poster can render without a known duration).
  const durationSec = useMemo(() => {
    const lastEnd = posterSegments.length > 0 ? posterSegments[posterSegments.length - 1]!.t_end : 0;
    if (lastEnd && lastEnd > 0) return lastEnd;
    return pendingVideo?.duration ?? null;
  }, [posterSegments, pendingVideo?.duration]);
  const durationStr = posterDurationLabel(durationSec);

  // Gate: a poster only exists when a real keyframe URL resolved (real video).
  const poster = posterUrl ? (
    <KeyframeImage
      ratio="vertical"
      src={posterUrl}
      play
      badge={durationStr ?? undefined}
      alt="Video poster"
      className="w-[60px] shrink-0"
    />
  ) : null;

  const showResult = !isStreaming && !!behavioral;

  // One-shot mount fade-in-up (skipped under reduced motion). rAF defers the
  // flip so the opacity:0 start frame paints before the transition runs.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Four metrics in a stable order; the strongest (lowest "top X%") leads the hero.
  const metrics = toMetrics(behavioral);
  const ranked = [...metrics].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  const lead = ranked[0];
  const heroNum = useCountIn(
    showResult && !gated ? (lead?.rank ?? null) : null,
    !reducedMotion,
  );

  const hasConf = confidence != null && !!confidenceLabel;
  const footer = hasConf ? (
    <div
      className="mt-auto border-t border-white/[0.055] pt-3.5 text-[11.5px] tracking-[0.05px] text-white/[0.38]"
      data-testid="input-confidence"
    >
      <span className="text-white/[0.56]">{CONF_WORD[confidenceLabel!]}</span>
      {' · '}
      <span className="tabular-nums">{confidence!.toFixed(2)}</span>
    </div>
  ) : null;

  // ── Idle / streaming — calm holding states (no broken-player vocabulary) ──
  if (!showResult) {
    return (
      <div
        className="flex h-full w-full items-center"
        data-testid="input-scorecard"
        data-state={isStreaming ? 'streaming' : 'idle'}
      >
        {isStreaming ? (
          <span className="flex items-center gap-2 text-[13px] text-white/[0.56]">
            <span
              className={cn(
                'inline-block h-1.5 w-1.5 rounded-full bg-accent',
                !reducedMotion && 'animate-pulse',
              )}
            />
            Analyzing
          </span>
        ) : (
          <span className="text-[13px] text-white/[0.38]">Awaiting analysis</span>
        )}
      </div>
    );
  }

  // Hero value: count-in number (confident) or the "Hold" verdict word (gated).
  const leadRank = heroNum ?? lead?.rank ?? null;
  const heroValue = gated ? (
    'Hold'
  ) : (
    <>
      <span className="text-[16px] font-medium text-white/55">Top </span>
      {leadRank ?? lead?.pct}
    </>
  );

  // Tiles: the four percentiles. The lead (strongest rank) is accented; gated
  // dims them all to directional-only. tabular-nums via StatTile.
  const tiles: StatTileData[] = metrics.map((m) => ({
    k: m.name,
    v: titleCasePct(m.pct),
    tone: !gated && m.key === lead?.key ? 'accent' : 'default',
  }));

  // The hero, factored so it renders identically standalone (no poster) or as the
  // flex-1 lead of the hero+poster row (real video).
  const hero = (className?: string) => (
    <FrameHero
      className={className}
      label="PREDICTED RANK"
      value={heroValue}
      unit={gated ? undefined : '%'}
      status={
        gated
          ? { word: 'Hold', tone: 'crit' }
          : { word: rankStatusWord(lead?.rank ?? null), tone: 'neutral' }
      }
      insight={
        gated ? (
          'Directional only — confidence too low to rank.'
        ) : (
          <>
            predicted rank in{' '}
            <span className="font-medium text-white/75">{lead?.name}</span>
          </>
        )
      }
    />
  );

  return (
    <div
      className="relative flex h-full w-full flex-col gap-4"
      data-testid="input-scorecard"
      data-state={gated ? 'gated' : 'confident'}
      style={
        reducedMotion
          ? undefined
          : {
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(4px)',
              transition: 'opacity 240ms ease, transform 240ms ease',
            }
      }
    >
      {/* Coral edge-flag — gated only (coral = needs attention now). */}
      {gated && (
        <span
          aria-hidden
          className="absolute -left-2 bottom-0 top-0 w-[3px] rounded-full bg-accent"
          style={{ boxShadow: '0 0 16px -2px rgba(255,127,80,0.5)' }}
        />
      )}

      {/* Hero + (real-video) poster row. No poster → the hero renders standalone
          exactly as before (no extra wrapper, no layout shift) for text / url /
          no-video modes. With a poster the hero takes remaining width, poster right. */}
      {poster ? (
        <div className="flex items-start justify-between gap-4">
          {hero('min-w-0 flex-1')}
          {poster}
        </div>
      ) : (
        hero()
      )}

      <div className={cn(gated && 'pointer-events-none opacity-[0.4]')}>
        <StatTileRow tiles={tiles} />
      </div>

      {footer}
    </div>
  );
}
