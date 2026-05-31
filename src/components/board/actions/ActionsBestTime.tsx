'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PencilSimple } from '@phosphor-icons/react';
import { logger } from '@/lib/logger';
import { ACTIONS_COPY, TELEMETRY } from './actions-constants';
import { OptimalPostEditPanel } from './optimal-post/OptimalPostEditPanel';
import type { OptimalPostOverride } from './optimal-post/OptimalPostCard';
import type { DayOfWeek } from './optimal-post/optimal-post-constants';
import { convertUTCWindow } from '@/lib/optimal-post-time';
import type { OptimalPostWindow } from '@/lib/engine/optimal-post';

interface Props {
  /** 'foot' = quiet label/value row (needs-work, degraded). 'hero' = the focal
   *  ship moment for a strong video. */
  variant: 'foot' | 'hero';
  window: OptimalPostWindow | null;
  override: OptimalPostOverride | null;
  analysisId: string | null;
}

/**
 * When-to-post, rendered in the action-led Actions frame. Reuses the existing
 * UTC→local conversion + inline edit panel + override persistence, but drops the
 * old card chrome (bordered box, GlassPill, source pill) for plain type so it
 * reads editorial, not widget.
 */
export function ActionsBestTime({ variant, window: postWindow, override, analysisId }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const tzFired = useRef(false);

  const effectiveDay = (override?.day_of_week ?? postWindow?.day_of_week) as DayOfWeek | undefined;
  const effectiveHours = override?.hour_range ?? postWindow?.hour_range;
  const source: 'niche' | 'fallback' | 'creator' = override
    ? 'creator'
    : (postWindow?.source ?? 'fallback');

  const converted = useMemo(
    () => (effectiveDay && effectiveHours ? convertUTCWindow(effectiveDay, effectiveHours) : null),
    [effectiveDay, effectiveHours],
  );

  useEffect(() => {
    if (postWindow && converted && !tzFired.current) {
      tzFired.current = true;
      logger.info(TELEMETRY.OPTIMAL_POST_TZ_CONVERTED, {
        analysis_id: analysisId,
        source_tz: 'UTC',
        user_tz: converted.userTz,
        crossed_midnight: converted.crossedMidnight,
      });
    }
  }, [postWindow, converted, analysisId]);

  // Window is effectively always present (server backfills it). Render nothing on
  // the rare null rather than a noisy skeleton — the rest of the frame stands alone.
  if (!postWindow || !converted || !effectiveDay || !effectiveHours || !analysisId) {
    return null;
  }

  const value = `${converted.day}, ${converted.hourRangeFormatted}`;
  const isGuess = source === 'fallback';

  const panel = editOpen && (
    <div className="mt-3">
      <OptimalPostEditPanel
        currentWindow={{ day_of_week: effectiveDay, hour_range: effectiveHours }}
        originalWindow={postWindow}
        analysisId={analysisId}
        onDone={() => setEditOpen(false)}
      />
    </div>
  );

  if (variant === 'hero') {
    return (
      <div data-testid="actions-best-time" data-variant="hero">
        <div className="mb-[9px] text-[11px] font-medium tracking-[0.01em] text-white/30">
          {ACTIONS_COPY.KICKER_STRONG}
        </div>
        <div className="text-[21px] font-semibold leading-[1.1] tracking-[-0.02em] text-white/95 tabular-nums">
          {value}
        </div>
        {/* Curated warm line, not raw engine reasoning — keeps the ship moment
            premium and free of clinical "(n=12 …)" debris. The "why" lives in the
            Score frame. */}
        <p className="mt-2 max-w-[290px] text-[13px] leading-[1.55] text-white/55">
          {ACTIONS_COPY.STRONG_SUB}
        </p>
        <button
          type="button"
          onClick={() => setEditOpen((v) => !v)}
          aria-expanded={editOpen}
          aria-label="Edit post time"
          className="mt-3.5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-white/30 hover:text-white/55 focus:outline-2 focus:outline-offset-2 focus:outline-white/40"
        >
          <PencilSimple size={13} weight="regular" aria-hidden />
          {ACTIONS_COPY.EDIT_TIME}
        </button>
        {panel}
      </div>
    );
  }

  return (
    <div data-testid="actions-best-time" data-variant="foot">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-white/55">{ACTIONS_COPY.BEST_TIME}</span>
        <span className="flex items-center gap-2 text-[13px] font-medium tracking-[-0.005em] text-white/95">
          {value}
          {isGuess && (
            <span className="font-normal text-white/30">· {ACTIONS_COPY.BEST_GUESS}</span>
          )}
          <button
            type="button"
            onClick={() => setEditOpen((v) => !v)}
            aria-expanded={editOpen}
            aria-label="Edit post time"
            className="text-white/25 hover:text-white/55 focus:outline-2 focus:outline-offset-2 focus:outline-white/40"
          >
            <PencilSimple size={12} weight="regular" aria-hidden />
          </button>
        </span>
      </div>
      {panel}
    </div>
  );
}
