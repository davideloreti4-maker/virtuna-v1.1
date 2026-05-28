'use client';
import { useEffect, useRef } from 'react';
import { CheckCircle } from '@phosphor-icons/react';
import { logger } from '@/lib/logger';
import { TELEMETRY } from '../actions-constants';
import { SCRIPT_COPY } from './script-constants';
import { CopyButton } from './CopyButton';

interface Props {
  variant?: 'empty-state' | 'error';
  openingVariants?: string[];
  analysisId: string;
  onRetry?: () => void;
}

export function ScriptEmptyState({
  variant = 'empty-state',
  openingVariants = [],
  analysisId,
  onRetry,
}: Props) {
  // D-23: fire SCRIPT_EMPTY_STATE_SHOWN once per analysis render
  const firedRef = useRef(false);
  useEffect(() => {
    if (variant === 'empty-state' && !firedRef.current) {
      firedRef.current = true;
      logger.info(TELEMETRY.SCRIPT_EMPTY_STATE_SHOWN, {
        analysis_id: analysisId,
        variant_count: openingVariants.length,
      });
    }
  }, [variant, analysisId, openingVariants.length]);

  if (variant === 'error') {
    return (
      <div
        className="flex flex-col gap-2 p-2"
        data-testid="script-error-state"
      >
        <p className="text-xs text-white/85">{SCRIPT_COPY.ERROR_MESSAGE}</p>
        <button
          type="button"
          onClick={onRetry}
          className="bg-transparent border border-white/[0.06] hover:bg-white/[0.1] rounded-lg h-[42px] text-xs text-white/85 transition-colors duration-150"
        >
          {SCRIPT_COPY.ERROR_RETRY}
        </button>
      </div>
    );
  }

  const variantCount = openingVariants.length;
  const variantWord = variantCount === 1 ? 'variant' : 'variants';

  return (
    <div
      className="flex flex-col gap-1 p-2"
      data-testid="script-empty-state"
      role="region"
      aria-label={`${SCRIPT_COPY.EMPTY_HEADLINE}. ${variantCount} optional opening ${variantWord} available.`}
    >
      <div className="flex items-center gap-1">
        <CheckCircle size={14} weight="regular" className="text-emerald-300/70" aria-hidden />
        <span className="text-xs text-white/85">{SCRIPT_COPY.EMPTY_HEADLINE}</span>
      </div>
      <p className="text-[10px] text-white/55">{SCRIPT_COPY.EMPTY_SUBHEAD}</p>
      <div className="text-[10px] text-white/40 my-1">— {SCRIPT_COPY.EMPTY_AB_LABEL} —</div>
      {openingVariants.map((v, i) => (
        <div key={`variant-${i}`} className="flex items-center justify-between gap-2">
          <span className="text-xs text-white/85 truncate flex-1">{v}</span>
          <CopyButton
            text={v}
            ariaLabel={`Copy opening variant ${i + 1}`}
            onCopy={() =>
              logger.info(TELEMETRY.SCRIPT_SECTION_COPIED, {
                analysis_id: analysisId,
                section: 'opening',
                char_count: v.length,
              })
            }
          />
        </div>
      ))}
    </div>
  );
}
