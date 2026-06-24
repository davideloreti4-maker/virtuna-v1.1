'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';
import { usePermalinkFilmstrips } from '@/hooks/queries/use-permalink-filmstrips';
import type { HookDecomposition } from '@/lib/engine/qwen/schemas';
import type { EmotionArcPoint } from '@/lib/engine/qwen/schemas';
import type {
  GeminiVideoSignals,
  GeminiAudioSignals,
  CtaSegmentResult,
  Factor,
} from '@/lib/engine/types';
import type { RulebookInput } from '@/lib/engine/creator-rulebook';
import { CraftFilmstrip } from './CraftFilmstrip';
import { CraftRail } from './CraftRail';
import { CreatorRulebookCard } from './CreatorRulebookCard';
import { COPY, PILLAR_LABELS } from './content-analysis-constants';
import {
  durationFromSegments,
  buildPillars,
  selectWeakLink,
  buildCells,
  buildHeadline,
  segmentsFromFilmstrips,
  formatTimeSec,
  firstSentence,
} from './content-analysis-derive';
import type {
  ContentAnalysisFrameProps,
  CraftSegment,
  CraftSignals,
} from './content-analysis-types';

/** The streamed `result` is the analysis_results DB row — read the craft-relevant
 *  columns + the variants.craft bag defensively (none are on PredictionResult). */
interface CraftRow {
  hook_decomposition?: HookDecomposition | null;
  emotion_arc?: EmotionArcPoint[] | null;
  heatmap?: { segments?: Array<Partial<CraftSegment>> | null } | null;
  variants?: { craft?: Partial<CraftSignals> | null } | null;
  // Craft signals the Rulebook reads. On the LIVE SSE PredictionResult they sit at the
  // top level; the permalink row nests them under variants.craft — so read both (below).
  // factors + feature_vector are dedicated columns / top-level on both shapes.
  video_signals?: GeminiVideoSignals | null;
  cta_segment?: CtaSegmentResult | null;
  audio_signals?: GeminiAudioSignals | null;
  audio_perceptual_score?: number | null;
  overall_impression?: string | null;
  content_summary?: string | null;
  factors?: Factor[] | null;
  feature_vector?: { durationSeconds: number | null } | null;
}

const EMPTY_CRAFT: CraftSignals = {
  video_signals: null,
  cta_segment: null,
  audio_signals: null,
  audio_perceptual_score: null,
  overall_impression: null,
  content_summary: null,
};

export function ContentAnalysisFrame({ camera: _camera, layout: _layout }: ContentAnalysisFrameProps) {
  const { data: permalinkData } = usePermalinkAnalysis();
  const stream = useAnalysisStream({ initialData: permalinkData ?? null });
  const { result, phase, filmstrips } = stream;
  const permalinkFilmstrips = usePermalinkFilmstrips();

  const isStreaming = phase === 'analyzing' || phase === 'reconnecting' || phase === 'polling';

  const row = result as unknown as CraftRow | null;
  const decomp = row?.hook_decomposition ?? null;
  const arc = useMemo<EmotionArcPoint[]>(() => row?.emotion_arc ?? [], [row?.emotion_arc]);
  // Dual-read like rulebookInput (below): on the LIVE SSE PredictionResult the craft
  // signals sit at the TOP LEVEL; only the persisted permalink row nests them under
  // variants.craft. Reading variants.craft alone left Audio/Pacing/CTA blank on the
  // freshly-completed board ("No speech track" / "None") — regression WPk976kozfWs.
  const craft = useMemo<CraftSignals>(() => {
    const v = row?.variants?.craft ?? {};
    return {
      ...EMPTY_CRAFT,
      ...v,
      video_signals: v.video_signals ?? row?.video_signals ?? null,
      cta_segment: v.cta_segment ?? row?.cta_segment ?? null,
      audio_signals: v.audio_signals ?? row?.audio_signals ?? null,
      audio_perceptual_score: v.audio_perceptual_score ?? row?.audio_perceptual_score ?? null,
      overall_impression: v.overall_impression ?? row?.overall_impression ?? null,
      content_summary: v.content_summary ?? row?.content_summary ?? null,
    };
  }, [
    row?.variants?.craft,
    row?.video_signals,
    row?.cta_segment,
    row?.audio_signals,
    row?.audio_perceptual_score,
    row?.overall_impression,
    row?.content_summary,
  ]);

  // Merged keyframe URLs — stream wins, else permalink replay (AudienceNode pattern).
  // Guard against undefined (test mocks of useAnalysisStream may omit `filmstrips`).
  const mergedFilmstrips = useMemo<Record<number, string>>(() => {
    if (filmstrips && Object.keys(filmstrips).length > 0) return filmstrips;
    if (permalinkFilmstrips && Object.keys(permalinkFilmstrips).length > 0) return permalinkFilmstrips;
    return {};
  }, [filmstrips, permalinkFilmstrips]);

  // Real heatmap segments, else synthetic ones from streamed keyframe indices.
  const segments = useMemo<CraftSegment[]>(() => {
    const raw = (row?.heatmap?.segments ?? []).filter(Boolean) as Array<Partial<CraftSegment>>;
    const mapped: CraftSegment[] = raw.map((s, i) => ({
      idx: s.idx ?? i,
      t_start: s.t_start ?? 0,
      t_end: s.t_end ?? 0,
      is_hook_zone: s.is_hook_zone ?? false,
      keyframe_uri: s.keyframe_uri ?? null,
    }));
    if (mapped.length > 0) return mapped;
    return segmentsFromFilmstrips(mergedFilmstrips, 30);
  }, [row?.heatmap?.segments, mergedFilmstrips]);

  const durationSec = useMemo(() => durationFromSegments(segments, 30), [segments]);

  const pillars = useMemo(
    () =>
      buildPillars({
        decomp,
        video: craft.video_signals,
        arc,
        perceptual: craft.audio_perceptual_score,
        audio: craft.audio_signals,
        cta: craft.cta_segment,
        durationSec,
      }),
    [decomp, craft, arc, durationSec],
  );
  const weakKey = useMemo(() => selectWeakLink(pillars), [pillars]);

  const ctaPresent = craft.cta_segment?.cta_present ?? false;
  const cells = useMemo(
    () => buildCells(segments, mergedFilmstrips, arc, durationSec),
    [segments, mergedFilmstrips, arc, durationSec],
  );
  const audioCaption = pillars.find((p) => p.key === 'audio')?.caption ?? '';

  // Creator Rulebook adapter — dual-read the craft signals (live SSE top-level, else the
  // permalink's variants.craft, surfaced via `craft`). durationOverride wins so the
  // length_fit check uses the trusted segment-derived duration, not feature_vector.
  const rulebookInput = useMemo<RulebookInput>(
    () => ({
      hook_decomposition: decomp,
      video_signals: row?.video_signals ?? craft.video_signals,
      cta_segment: row?.cta_segment ?? craft.cta_segment,
      audio_signals: row?.audio_signals ?? craft.audio_signals,
      factors: row?.factors ?? undefined,
      feature_vector: row?.feature_vector ?? null,
    }),
    [
      decomp,
      craft,
      row?.video_signals,
      row?.cta_segment,
      row?.audio_signals,
      row?.factors,
      row?.feature_vector,
    ],
  );

  // Has any craft signal to render? Otherwise (text / tiktok_url) → empty state.
  const hasAnyCraft =
    !!decomp ||
    !!craft.video_signals ||
    !!craft.audio_signals ||
    !!craft.cta_segment ||
    segments.length > 0;

  const headline = useMemo(() => buildHeadline(pillars, ctaPresent), [pillars, ctaPresent]);
  const headlineFallback = firstSentence(craft.overall_impression);

  // Loading: streaming with no craft signal yet (the CTA pillar always carries a
  // score-0 "None" default, so gate on real signals via hasAnyCraft, not pillar scores).
  const filmstripLoading = isStreaming && cells.length === 0;
  const railLoading = isStreaming && !hasAnyCraft;
  const showEmpty = !isStreaming && !hasAnyCraft;

  // aria-live: announce the weak craft element ~500ms after data settles.
  const [ariaText, setAriaText] = useState('');
  const announcedRef = useRef(false);
  useEffect(() => {
    if (announcedRef.current || !hasAnyCraft || !weakKey) return;
    announcedRef.current = true;
    const handle = window.setTimeout(
      () => setAriaText(`${PILLAR_LABELS[weakKey]} is the weakest craft element`),
      500,
    );
    return () => window.clearTimeout(handle);
  }, [hasAnyCraft, weakKey]);

  return (
    <div
      aria-busy={isStreaming}
      className="flex w-full flex-col p-2"
      data-testid="content-analysis-frame"
    >
      <span className="sr-only" aria-live="polite" data-testid="content-analysis-aria-live">
        {ariaText}
      </span>

      {showEmpty ? (
        <p
          className="py-8 text-center text-xs italic text-white/[0.34]"
          data-testid="content-analysis-empty"
        >
          {COPY.EMPTY}
        </p>
      ) : (
        <>
          {/* editorial read + duration */}
          <div className="flex items-baseline justify-between gap-4">
            <p
              className="text-[20px] font-[450] leading-[1.32] tracking-[-0.014em] text-white"
              style={{ textWrap: 'balance' }}
              data-testid="content-analysis-headline"
            >
              {hasAnyCraft && headline.length > 0 ? (
                <>
                  {headline.map((c, i) => {
                    const sep =
                      i === 0
                        ? ''
                        : headline.length === 2
                          ? ' and '
                          : i === headline.length - 1
                            ? ', and '
                            : ', ';
                    return (
                      <span key={i}>
                        {sep}
                        <span className={c.weak ? 'text-foreground-secondary' : undefined}>{c.text}</span>
                      </span>
                    );
                  })}
                  .
                </>
              ) : (
                <span className="text-white/55">{(hasAnyCraft && headlineFallback) || ''}</span>
              )}
            </p>
            {(segments.length > 0 || isStreaming) && (
              <span
                className="shrink-0 text-[12px] tabular-nums text-white/40"
                data-testid="content-analysis-duration"
              >
                {formatTimeSec(durationSec)}
              </span>
            )}
          </div>

          <CraftFilmstrip
            cells={cells}
            durationSec={durationSec}
            arc={arc}
            audio={craft.audio_signals}
            audioCaption={audioCaption}
            ctaPresent={ctaPresent}
            isLoading={filmstripLoading}
          />

          <CraftRail pillars={pillars} weakKey={weakKey} isLoading={railLoading} />

          <CreatorRulebookCard
            result={rulebookInput}
            durationOverride={durationSec}
            isLoading={railLoading}
          />
        </>
      )}
    </div>
  );
}
