'use client';
import { useState, useRef } from 'react';
import { GlassPill } from '@/components/primitives';
import { cn } from '@/lib/utils';
import { BAND_THRESHOLDS, COPY, bandFromScore } from './verdict-constants';

interface PercentileChipProps {
  score: number | null;
  confidenceLabel: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  isCalibrated: boolean;
}

export function PercentileChip({ score, confidenceLabel, isCalibrated }: PercentileChipProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const isStreaming = score == null || confidenceLabel == null;
  const band = !isStreaming ? bandFromScore(score!) : null;
  const isCoral = !isStreaming && score! >= BAND_THRESHOLDS.STRONG;

  return (
    <div className="flex items-end justify-between gap-2 px-1">
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1">
          <span
            className={cn(
              'text-5xl font-semibold leading-none tabular-nums',
              isStreaming && 'text-white/20',
              !isStreaming && isCoral && 'text-accent',
              !isStreaming && !isCoral && 'text-white/95',
            )}
            data-testid="percentile-number"
          >
            {isStreaming ? COPY.SKELETON_PERCENTILE : score}
          </span>
          {!isStreaming && (
            <span className="text-xs text-white/60">{COPY.PERCENTILE_SUFFIX}</span>
          )}
        </div>
        {!isStreaming && (
          <span className="text-xs font-normal text-white/60" data-testid="band-label">
            {band}
          </span>
        )}
        {!isStreaming && !isCalibrated && (
          <span className="text-[10px] italic text-white/40" data-testid="uncalibrated-note">
            {COPY.UNCALIBRATED_NOTE}
          </span>
        )}
      </div>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setPopoverOpen((o) => !o)}
          className="cursor-pointer"
          aria-expanded={popoverOpen}
          aria-haspopup="dialog"
          data-testid="confidence-pill-trigger"
        >
          <GlassPill size="sm">
            <span className="text-white/60">
              {isStreaming ? COPY.SKELETON_CONFIDENCE : COPY.CONFIDENCE_PILL(confidenceLabel!)}
            </span>
          </GlassPill>
        </button>
        {popoverOpen && (
          <div
            role="dialog"
            aria-label="What does confidence mean?"
            className="absolute right-0 top-full mt-1 w-56 rounded-[8px] border border-white/[0.06] p-2 text-xs text-white/80 z-50"
            style={{
              background: 'linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%)',
              backdropFilter: 'blur(5px)',
              WebkitBackdropFilter: 'blur(5px)',
              boxShadow: 'rgba(255,255,255,0.15) 0px 1px 1px 0px inset',
            }}
            data-testid="confidence-popover"
          >
            {COPY.CONFIDENCE_POPOVER}
          </div>
        )}
      </div>
    </div>
  );
}
