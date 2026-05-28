'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock } from '@phosphor-icons/react';
import { GlassPill } from '@/components/primitives';
import { logger } from '@/lib/logger';
import { TELEMETRY } from '../actions-constants';
import { OPTIMAL_POST_COPY, type DayOfWeek } from './optimal-post-constants';
import { OptimalPostSourcePill } from './OptimalPostSourcePill';
import { OptimalPostEditSheet } from './OptimalPostEditSheet';
import { convertUTCWindow } from '@/lib/optimal-post-time';
import type { OptimalPostWindow } from '@/lib/engine/optimal-post';

export interface OptimalPostOverride {
  day_of_week: DayOfWeek;
  hour_range: [number, number];
  saved_at?: string;
}

interface Props {
  window: OptimalPostWindow | null;
  override: OptimalPostOverride | null;
  analysisId: string;
}

export function OptimalPostCard({ window: postWindow, override, analysisId }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const tzFiredRef = useRef(false);

  // Effective source: override present → creator, else window.source
  const effectiveSource: 'niche' | 'fallback' | 'creator' = override ? 'creator' : (postWindow?.source ?? 'fallback');

  // Effective day/hour: override wins over server window
  const effectiveDay = (override?.day_of_week ?? postWindow?.day_of_week) as DayOfWeek | undefined;
  const effectiveHours = override?.hour_range ?? postWindow?.hour_range;

  const converted = useMemo(() => {
    if (!effectiveDay || !effectiveHours) return null;
    return convertUTCWindow(effectiveDay, effectiveHours);
  }, [effectiveDay, effectiveHours]);

  // Fire OPTIMAL_POST_TZ_CONVERTED once per analysis render
  useEffect(() => {
    if (postWindow && converted && !tzFiredRef.current) {
      tzFiredRef.current = true;
      logger.info(TELEMETRY.OPTIMAL_POST_TZ_CONVERTED, {
        analysis_id: analysisId,
        source_tz: 'UTC',
        user_tz: converted.userTz,
        crossed_midnight: converted.crossedMidnight,
      });
    }
  }, [postWindow, converted, analysisId]);

  // Skeleton when no window data yet
  if (!postWindow) {
    return (
      <div className="flex h-full w-full flex-col gap-1 p-2" data-testid="actions-optimal-post-card">
        <div className="flex items-center gap-1">
          <Clock size={12} weight="regular" aria-hidden />
          <span className="text-xs font-medium text-white/85">{OPTIMAL_POST_COPY.CARD_LABEL}</span>
        </div>
        <div className="h-4 w-20 bg-white/[0.06] rounded animate-pulse" />
      </div>
    );
  }

  if (!converted || !effectiveDay || !effectiveHours) return null;

  return (
    <>
      <div
        className="flex h-full w-full flex-col gap-1 p-2"
        data-testid="actions-optimal-post-card"
      >
        <div className="flex items-center gap-1">
          <Clock size={12} weight="regular" aria-hidden />
          <span className="text-xs font-medium text-white/85">{OPTIMAL_POST_COPY.CARD_LABEL}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            ref={triggerRef}
            onClick={() => setEditOpen(true)}
            className="bg-transparent border-0 p-0 focus:outline-2 focus:outline-offset-2 focus:outline-white/40"
            aria-label="Edit post time"
          >
            <GlassPill size="sm">{converted.day} · {converted.hourRangeFormatted}</GlassPill>
          </button>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="text-[10px] text-white/55 hover:text-white/80 focus:outline-2 focus:outline-offset-2 focus:outline-white/40"
          >
            {OPTIMAL_POST_COPY.EDIT_LINK}
          </button>
        </div>
        <p
          className="text-xs text-white/65 line-clamp-1"
          title={postWindow.reasoning}
        >
          {postWindow.reasoning}
        </p>
        <OptimalPostSourcePill
          source={effectiveSource}
          reasoningString={postWindow.reasoning}
          analysisId={analysisId}
        />
      </div>

      <OptimalPostEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        currentWindow={{ day_of_week: effectiveDay, hour_range: effectiveHours }}
        originalWindow={postWindow}
        analysisId={analysisId}
        triggerRef={triggerRef}
      />
    </>
  );
}
