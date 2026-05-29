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
        className="flex h-full w-full flex-col gap-2 rounded-[8px] border border-white/[0.06] p-3"
        data-testid="script-error-state"
      >
        <p className="text-xs text-white/85">{SCRIPT_COPY.ERROR_MESSAGE}</p>
        <button
          type="button"
          onClick={onRetry}
          className="h-[42px] rounded-lg border border-white/[0.06] bg-transparent text-xs text-white/85 transition-colors duration-150 hover:bg-white/[0.1]"
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
      className="flex h-full w-full flex-col gap-2 rounded-[8px] border border-white/[0.06] p-3"
      data-testid="script-empty-state"
      role="region"
      aria-label={`${SCRIPT_COPY.EMPTY_HEADLINE}. ${variantCount} optional opening ${variantWord} available.`}
    >
      <div className="flex items-center gap-1.5">
        <CheckCircle size={14} weight="fill" className="text-emerald-300/80" aria-hidden />
        <span className="text-xs font-medium text-white/85">{SCRIPT_COPY.EMPTY_HEADLINE}</span>
      </div>
      <p className="-mt-1 text-[10px] text-white/55">{SCRIPT_COPY.EMPTY_SUBHEAD}</p>

      {openingVariants.length > 0 && (
        <>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-white/40">
              {SCRIPT_COPY.EMPTY_AB_LABEL}
            </span>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>
          <ul className="flex flex-col gap-1.5">
            {openingVariants.map((v, i) => (
              <li
                key={`variant-${i}`}
                className="flex items-start gap-2.5 rounded-[6px] border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 transition-colors duration-150 hover:bg-white/[0.04]"
              >
                <span
                  className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] bg-white/[0.06] text-[9px] font-semibold text-white/60"
                  aria-hidden
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="min-w-0 flex-1 text-xs leading-snug text-white/85 line-clamp-2" title={v}>{v}</span>
                <CopyButton
                  text={v}
                  ariaLabel={`Copy opening variant ${String.fromCharCode(65 + i)}`}
                  onCopy={() =>
                    logger.info(TELEMETRY.SCRIPT_SECTION_COPIED, {
                      analysis_id: analysisId,
                      section: 'opening',
                      char_count: v.length,
                    })
                  }
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
