import { useEffect, useState } from 'react';
import type { BehavioralPredictions, ConfidenceLevel } from '@/lib/engine/types';

/** "top 5%" → 5. Lower = stronger rank. null when unparseable. */
export function parsePercentile(s: string | undefined | null): number | null {
  if (!s) return null;
  const m = s.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]!) : null;
}

/** "top 20%" → "Top 20%". */
export function titleCasePct(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * "M:SS" duration badge for the video poster, from whole seconds. null when the
 * duration is missing or non-positive — the badge is omitted rather than showing
 * a bogus "0:00" (a poster can render without a known length).
 */
export function posterDurationLabel(durationSec: number | null | undefined): string | null {
  if (durationSec == null || !Number.isFinite(durationSec) || durationSec <= 0) return null;
  const s = Math.round(durationSec);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

export const CONF_WORD: Record<ConfidenceLevel, string> = {
  HIGH: 'High confidence',
  MEDIUM: 'Medium confidence',
  LOW: 'Low confidence',
};

export interface InputMetric {
  key: string;
  name: string;
  /** Percentile label, e.g. "top 15%". Optional: deepseek's fabricated labels were
   *  removed (Plan 01-04/01-06, R9); honest labels come from the persona aggregate
   *  but may be absent — null-degrade at the render site. */
  pct?: string;
  /** Parsed "top X%" magnitude — lower = stronger. null when unparseable. */
  rank: number | null;
}

/** The four engagement percentiles in a stable order. */
export function toMetrics(b: BehavioralPredictions | null): InputMetric[] {
  if (!b) return [];
  const raw = [
    { key: 'share', name: 'Shares', pct: b.share_percentile },
    { key: 'completion', name: 'Completion', pct: b.completion_percentile },
    { key: 'comment', name: 'Comments', pct: b.comment_percentile },
    { key: 'save', name: 'Saves', pct: b.save_percentile },
  ];
  return raw.map((m) => ({ ...m, rank: parsePercentile(m.pct) }));
}

/**
 * Status word for the hero, keyed off the strongest percentile (lower = better):
 * ≤5% Elite · ≤15% Strong · ≤35% Solid · else Modest.
 */
export function rankStatusWord(rank: number | null): string {
  if (rank == null) return 'Predicted';
  if (rank <= 5) return 'Elite reach';
  if (rank <= 15) return 'Strong reach';
  if (rank <= 35) return 'Solid reach';
  return 'Modest reach';
}

/**
 * Counts the hero percentile in from a worse rank down to its real value
 * (e.g. 34 → 5) on mount — reads as "homing in on your rank". Returns the
 * target immediately under reduced motion. null target → null (no number).
 */
export function useCountIn(target: number | null, enabled: boolean): number | null {
  const [val, setVal] = useState<number | null>(() =>
    enabled && target != null ? Math.min(60, Math.round(target + 28)) : target,
  );
  useEffect(() => {
    // setState only ever fires inside a rAF callback (never synchronously in the
    // effect body) so the first frame paints the start value before animating.
    if (target == null || !enabled) {
      const id = requestAnimationFrame(() => setVal(target));
      return () => cancelAnimationFrame(id);
    }
    const from = Math.min(60, Math.round(target + 28));
    const dur = 620;
    let startTs = 0;
    let raf = requestAnimationFrame(function tick(now: number) {
      if (!startTs) startTs = now;
      const t = Math.min(1, (now - startTs) / dur);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setVal(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);
  return val;
}
