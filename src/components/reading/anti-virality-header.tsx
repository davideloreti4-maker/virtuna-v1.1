'use client';

import { useState, useCallback } from 'react';
import type { PredictionResult } from '@/lib/engine/types';
import {
  AV_OVERRIDE_LOCALSTORAGE_PREFIX,
  COPY,
  TELEMETRY,
  fixCount,
} from '@/components/board/verdict/verdict-constants';
import { logger } from '@/lib/logger';

/**
 * AntiViralityHeader — the "Don't post yet" gate banner for the Reading
 * namespace (READ-03, D-04). Surfaced ABOVE the gauge (D-04); returns `null`
 * when `!result.anti_virality_gated`. Self-manages its localStorage dismissal.
 *
 * WR-04 (CONTRAST ONLY): this is a THIN reading-local fork of the board's
 * `board/verdict/AntiViralityHeader.tsx`, NOT a verbatim re-export and NOT a
 * restyle. The phase mounts this banner above the gauge, so its styling is now
 * part of The Reading's surface. The board source colors the "Post anyway →"
 * override link `var(--color-cream-secondary)` (coral) — and that link sits on the LEFT
 * edge of a gradient that STARTS at `var(--color-cream-secondary)`, i.e. coral-text-on-
 * coral, effectively invisible / failing contrast. The ONLY change here vs the
 * board source is the override link's foreground: `var(--color-action-foreground)`
 * (the locked dark-brown text-on-coral token, >7:1 on coral) so the control is
 * readable. The gradient + body copy are byte-identical to the board; the shared
 * board source is deliberately left untouched (it still serves the dormant board).
 */

interface AntiViralityHeaderProps {
  result: PredictionResult | null;
  analysisId: string;
}

function localStorageKey(analysisId: string): string {
  return `${AV_OVERRIDE_LOCALSTORAGE_PREFIX}${analysisId}`;
}

function readDismissed(analysisId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(localStorageKey(analysisId)) === '1';
  } catch {
    return false;
  }
}

export function AntiViralityHeader({ result, analysisId }: AntiViralityHeaderProps) {
  // Read localStorage exactly once on mount via lazy initializer.
  const [dismissed, setDismissed] = useState<boolean>(() => readDismissed(analysisId));

  const handleOverride = useCallback(() => {
    try {
      window.localStorage.setItem(localStorageKey(analysisId), '1');
    } catch {
      // localStorage unavailable (private mode) — degrade gracefully, still hide header for session.
    }
    logger.info(TELEMETRY.VERDICT_ANTI_VIRALITY_OVERRIDE, { analysisId });
    setDismissed(true);
  }, [analysisId]);

  if (!result || !result.anti_virality_gated || dismissed) return null;

  const n = fixCount(result.counterfactuals?.suggestions);

  // Two-line layout when fixCount=0 (copy is long and collides with "Post anyway →" in h-10).
  const twoLine = n === 0;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="av-header"
      className={
        twoLine
          ? 'flex min-h-[40px] flex-col items-start gap-1 px-2 py-1.5 text-xs'
          : 'flex h-10 items-center justify-between px-2 text-xs'
      }
      style={{
        background: 'linear-gradient(90deg, var(--color-cream-secondary), var(--color-warning))',
        color: 'rgba(255,255,255,0.9)',
        fontWeight: 600,
      }}
    >
      <span data-testid="av-header-text">{COPY.AV_HEADER(n)}</span>
      <button
        type="button"
        onClick={handleOverride}
        className="text-xs font-medium"
        // WR-04: dark-brown text-on-coral token (readable on the coral gradient
        // edge), NOT var(--color-cream-secondary) (coral-on-coral, invisible).
        style={{ color: 'var(--color-action-foreground)', pointerEvents: 'auto' }}
        data-testid="av-override-link"
      >
        {COPY.AV_OVERRIDE_LINK}
      </button>
    </div>
  );
}

AntiViralityHeader.displayName = 'AntiViralityHeader';
