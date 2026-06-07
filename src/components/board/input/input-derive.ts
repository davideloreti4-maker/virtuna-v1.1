import { useEffect, useState } from 'react';
import type { BehavioralPredictions, ConfidenceLevel } from '@/lib/engine/types';

/** Title-case a qualitative intent label: "high intent" → "High intent".
 *  null when absent — the engine emits these labels only on the persona aggregate,
 *  never on raw DeepSeek predictions, so the render site must degrade. */
export function intentChip(s: string | undefined | null): string | null {
  if (!s) return null;
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
  /** Absolute predicted engagement rate, 0-100 — the honest field the engine
   *  actually emits (`behavioral_predictions.*_pct`), not a corpus rank. */
  pct: number;
  /** Qualitative intent label from the persona aggregate (e.g. "high intent").
   *  Absent on raw DeepSeek predictions — null-degrade at the render site. */
  intent?: string;
}

/** The four engagement predictions in a stable order (completion leads — it's the
 *  watch-through hero; the other three are the engagement actions). Each carries
 *  the absolute predicted % plus the optional qualitative intent label. */
export function toMetrics(b: BehavioralPredictions | null): InputMetric[] {
  if (!b) return [];
  return [
    { key: 'completion', name: 'Completion', pct: b.completion_pct, intent: b.completion_percentile },
    { key: 'share', name: 'Shares', pct: b.share_pct, intent: b.share_percentile },
    { key: 'comment', name: 'Comments', pct: b.comment_pct, intent: b.comment_percentile },
    { key: 'save', name: 'Saves', pct: b.save_pct, intent: b.save_percentile },
  ];
}

/**
 * Reach band for the hero, keyed off the absolute completion % (higher = better):
 * ≥75 Elite · ≥50 Strong · ≥30 Solid · else Modest. null → "Predicted" (no band).
 */
export function reachWord(pct: number | null): string {
  if (pct == null) return 'Predicted';
  if (pct >= 75) return 'Elite reach';
  if (pct >= 50) return 'Strong reach';
  if (pct >= 30) return 'Solid reach';
  return 'Modest reach';
}

/**
 * Counts the hero % up from a lower start to its real value (e.g. 34 → 62) on
 * mount — reads as "homing in". Returns the target immediately under reduced
 * motion. null target → null (no number).
 */
export function useCountIn(target: number | null, enabled: boolean): number | null {
  const [val, setVal] = useState<number | null>(() =>
    enabled && target != null ? Math.max(0, Math.round(target - 28)) : target,
  );
  useEffect(() => {
    // setState only ever fires inside a rAF callback (never synchronously in the
    // effect body) so the first frame paints the start value before animating.
    if (target == null || !enabled) {
      const id = requestAnimationFrame(() => setVal(target));
      return () => cancelAnimationFrame(id);
    }
    const from = Math.max(0, Math.round(target - 28));
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
