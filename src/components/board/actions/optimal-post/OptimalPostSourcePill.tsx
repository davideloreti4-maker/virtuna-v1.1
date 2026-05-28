'use client';
import { useCallback, useState } from 'react';
import { Info } from '@phosphor-icons/react';
import { GlassPill } from '@/components/primitives';
import { logger } from '@/lib/logger';
import { TELEMETRY } from '../actions-constants';
import { OPTIMAL_POST_COPY } from './optimal-post-constants';

interface Props {
  source: 'niche' | 'fallback' | 'creator';
  reasoningString?: string;
  analysisId: string;
}

const SOURCE_LABEL: Record<Props['source'], string> = {
  niche: OPTIMAL_POST_COPY.SOURCE_NICHE_LABEL,
  fallback: OPTIMAL_POST_COPY.SOURCE_FALLBACK_LABEL,
  creator: OPTIMAL_POST_COPY.SOURCE_CREATOR_LABEL,
};

function buildTooltipText(source: Props['source'], reasoning?: string): string {
  if (source === 'niche') {
    const match = reasoning ? reasoning.match(/\(n=(\d+)/) : null;
    const n = match ? match[1] : null;
    return n
      ? `Based on ${n} videos in your niche.`
      : 'Based on videos in your niche.';
  }
  if (source === 'fallback') return OPTIMAL_POST_COPY.SOURCE_FALLBACK_TOOLTIP;
  return OPTIMAL_POST_COPY.SOURCE_CREATOR_TOOLTIP;
}

export function OptimalPostSourcePill({ source, reasoningString, analysisId }: Props) {
  const [open, setOpen] = useState(false);
  const tooltip = buildTooltipText(source, reasoningString);

  const fireExplained = useCallback(() => {
    logger.info(TELEMETRY.OPTIMAL_POST_SOURCE_EXPLAINED, { analysis_id: analysisId, source });
  }, [analysisId, source]);

  function openTooltip() {
    if (!open) {
      setOpen(true);
      fireExplained();
    }
  }

  return (
    <div className="relative flex items-center gap-1" data-testid="optimal-post-source-pill">
      <GlassPill size="sm">{SOURCE_LABEL[source]}</GlassPill>
      <button
        type="button"
        aria-label={OPTIMAL_POST_COPY.INFO_ARIA}
        aria-describedby={open ? `source-tooltip-${analysisId}` : undefined}
        title={OPTIMAL_POST_COPY.INFO_ARIA}
        onMouseEnter={openTooltip}
        onFocus={openTooltip}
        onMouseLeave={() => setOpen(false)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        className="inline-flex items-center justify-center min-w-[24px] min-h-[24px] text-white/55 hover:text-white/80 focus:outline-2 focus:outline-offset-2 focus:outline-white/40"
      >
        <Info size={12} weight="regular" />
      </button>
      {open ? (
        <div
          role="tooltip"
          id={`source-tooltip-${analysisId}`}
          className="absolute top-full left-0 mt-1 z-30 max-w-[240px] rounded-lg border border-white/[0.06] bg-[#18191a] px-2 py-1 text-xs text-white/85 shadow-lg"
        >
          {tooltip}
        </div>
      ) : null}
    </div>
  );
}
