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
  /** Emphasis hint, kept for telemetry/QA parity across view-kinds. 'hero' = the
   *  ship moment (strong / all-set), 'foot' = supporting card (needs-work etc.).
   *  Both render the same calm token card; the section header owns the label. */
  variant?: 'foot' | 'hero';
  window: OptimalPostWindow | null;
  override: OptimalPostOverride | null;
  analysisId: string | null;
}

/**
 * When-to-post, rendered as ONE calm token card inside the unified Actions frame.
 * Keeps the UTC→local conversion + inline edit panel + override persistence; the
 * "WHEN TO POST" section header (in ActionsContent) owns the label so the card
 * itself is just the value + edit affordance.
 */
export function ActionsBestTime({
  variant = 'foot',
  window: postWindow,
  override,
  analysisId,
}: Props) {
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

  return (
    <div
      className="rounded-[11px] border border-white/[0.06] bg-white/[0.016] px-3 py-[11px]"
      data-testid="actions-best-time"
      data-variant={variant}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[15px] font-semibold leading-none tracking-[-0.015em] text-white/95 tabular-nums">
          {value}
        </span>
        <span className="flex items-center gap-2">
          {isGuess && (
            <span className="text-[11px] font-normal text-white/30">{ACTIONS_COPY.BEST_GUESS}</span>
          )}
          <button
            type="button"
            onClick={() => setEditOpen((v) => !v)}
            aria-expanded={editOpen}
            aria-label="Edit post time"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-white/35 hover:text-white/65 focus:outline-2 focus:outline-offset-2 focus:outline-white/40"
          >
            <PencilSimple size={12} weight="regular" aria-hidden />
            {ACTIONS_COPY.EDIT_TIME}
          </button>
        </span>
      </div>
      {editOpen && (
        <div className="mt-3">
          <OptimalPostEditPanel
            currentWindow={{ day_of_week: effectiveDay, hour_range: effectiveHours }}
            originalWindow={postWindow}
            analysisId={analysisId}
            onDone={() => setEditOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
