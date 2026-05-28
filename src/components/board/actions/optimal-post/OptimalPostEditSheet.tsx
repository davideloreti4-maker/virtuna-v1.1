'use client';
import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { GlassPill } from '@/components/primitives';
import { logger } from '@/lib/logger';
import { TELEMETRY } from '../actions-constants';
import { DAY_LABELS, OPTIMAL_POST_COPY, type DayOfWeek } from './optimal-post-constants';
import { useOptimalPostOverride } from './use-optimal-post-override';
import { useIsMobile } from '@/hooks/useIsMobile';
import { cn } from '@/lib/utils';
import type { OptimalPostWindow } from '@/lib/engine/optimal-post';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentWindow: { day_of_week: DayOfWeek; hour_range: [number, number] };
  originalWindow: OptimalPostWindow;
  analysisId: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

function formatHourLabel(h: number): string {
  // 0 -> 12 AM, 12 -> 12 PM, 13 -> 1 PM, etc.
  const period = h < 12 ? 'AM' : 'PM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh} ${period}`;
}

export function OptimalPostEditSheet({
  open, onOpenChange, currentWindow, originalWindow, analysisId, triggerRef,
}: Props) {
  const isMobile = useIsMobile();
  const side = isMobile ? 'bottom' : 'right';
  const mutation = useOptimalPostOverride(analysisId);

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(currentWindow.day_of_week);
  const [startHour, setStartHour] = useState<number>(currentWindow.hour_range[0]);
  const [endHour, setEndHour] = useState<number>(currentWindow.hour_range[1]);
  const [editCount, setEditCount] = useState(0);

  // Reset state when Sheet (re)opens
  useEffect(() => {
    if (open) {
      setSelectedDay(currentWindow.day_of_week);
      setStartHour(currentWindow.hour_range[0]);
      setEndHour(currentWindow.hour_range[1]);
    }
  }, [open, currentWindow.day_of_week, currentWindow.hour_range]);

  const invalid = endHour <= startHour;

  async function handleSave() {
    if (invalid) return;
    const oldVal = { day: currentWindow.day_of_week, hours: currentWindow.hour_range };
    const newVal = { day: selectedDay, hours: [startHour, endHour] as [number, number] };
    setEditCount((c) => c + 1);
    try {
      await mutation.mutateAsync({ day_of_week: selectedDay, hour_range: [startHour, endHour] });
      logger.info(TELEMETRY.OPTIMAL_POST_EDITED, {
        analysis_id: analysisId,
        old: oldVal,
        new: newVal,
        edit_count: editCount + 1,
      });
      onOpenChange(false);
    } catch {
      // Mutation error visible via mutation.isError; do not close sheet
    }
  }

  async function handleReset() {
    logger.info(TELEMETRY.OPTIMAL_POST_RESET, { analysis_id: analysisId });
    // D-27: Reset CLEARS the override (writes NULL via { clear: true }) so the engine
    // recommendation becomes effective again. D-29 demands the source pill returns to
    // the engine source ('from your niche' / 'default') — NOT 'yours'. Posting the
    // original values back as a new override row would leave optimal_post_override
    // non-null and keep the pill in 'yours' state, violating D-29.
    try {
      await mutation.mutateAsync({ clear: true });
      onOpenChange(false);
    } catch {
      /* surface via mutation state */
    }
  }

  function handleDayKeyDown(e: React.KeyboardEvent) {
    const i = DAY_LABELS.indexOf(selectedDay);
    if (e.key === 'ArrowRight') setSelectedDay(DAY_LABELS[(i + 1) % 7] as DayOfWeek);
    else if (e.key === 'ArrowLeft') setSelectedDay(DAY_LABELS[(i + 6) % 7] as DayOfWeek);
    else if (e.key === 'Home') setSelectedDay(DAY_LABELS[0]);
    else if (e.key === 'End') setSelectedDay(DAY_LABELS[6]);
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const endHours = Array.from({ length: 24 }, (_, i) => i + 1); // 1..24

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          'border-white/[0.06] bg-[#18191a]',
          side === 'right' && 'max-w-[320px]',
          side === 'bottom' && 'max-h-[85dvh]',
        )}
        onCloseAutoFocus={(e) => {
          if (triggerRef.current) {
            e.preventDefault();
            triggerRef.current.focus();
          }
        }}
      >
        <SheetHeader>
          <SheetTitle>{OPTIMAL_POST_COPY.SHEET_TITLE}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 p-4">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-white/55 mb-2">
              {OPTIMAL_POST_COPY.DAY_SECTION_LABEL}
            </div>
            <div
              role="radiogroup"
              aria-label="Day of week"
              onKeyDown={handleDayKeyDown}
              className="flex flex-wrap gap-2"
            >
              {DAY_LABELS.map((d) => (
                <GlassPill
                  key={d}
                  size="sm"
                  active={selectedDay === d}
                  onClick={() => setSelectedDay(d)}
                >
                  {d}
                </GlassPill>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <label className="flex flex-col gap-1 flex-1">
              <span className="text-[10px] uppercase tracking-wide text-white/55">
                {OPTIMAL_POST_COPY.START_HOUR_LABEL}
              </span>
              <select
                value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
                className="h-[42px] rounded-lg bg-white/[0.05] border border-white/[0.06] text-xs text-white/85 px-2"
              >
                {hours.map((h) => (
                  <option key={h} value={h}>{formatHourLabel(h)}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 flex-1">
              <span className="text-[10px] uppercase tracking-wide text-white/55">
                {OPTIMAL_POST_COPY.END_HOUR_LABEL}
              </span>
              <select
                value={endHour}
                onChange={(e) => setEndHour(Number(e.target.value))}
                className="h-[42px] rounded-lg bg-white/[0.05] border border-white/[0.06] text-xs text-white/85 px-2"
              >
                {endHours.map((h) => (
                  <option key={h} value={h}>{h === 24 ? '12 AM' : formatHourLabel(h)}</option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="self-start text-[10px] text-white/55 hover:text-white/80 focus:outline-2 focus:outline-offset-2 focus:outline-white/40"
          >
            Reset to {originalWindow.day_of_week} {formatHourLabel(originalWindow.hour_range[0])} – {originalWindow.hour_range[1] === 24 ? '12 AM' : formatHourLabel(originalWindow.hour_range[1])}
          </button>

          <button
            type="button"
            disabled={invalid || mutation.isPending}
            onClick={handleSave}
            className="w-full h-[42px] rounded-lg bg-transparent border border-white/[0.06] hover:bg-white/[0.1] text-xs text-white/85 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
          >
            {OPTIMAL_POST_COPY.SAVE_BUTTON}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
