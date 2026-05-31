'use client';

import { useEffect, useState } from 'react';
import type { BehavioralPredictions, ConfidenceLevel } from '@/lib/engine/types';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { cn } from '@/lib/utils';

interface Props {
  /** Behavioral predictions — the four engagement percentiles. Null until complete. */
  behavioral: BehavioralPredictions | null;
  /** Model self-certainty (0-1). */
  confidence?: number | null;
  /** Categorical confidence for the footer verdict word. */
  confidenceLabel?: ConfidenceLevel | null;
  /** True when the aggregator gated the result (low confidence / timeline pattern) —
   *  flips the card to the "Hold" state: dimmed, directional-only metrics. */
  gated?: boolean;
  /** True while the analysis is in flight. */
  isStreaming?: boolean;
}

/** "top 5%" → 5. Lower = stronger rank. null when unparseable. */
function parsePercentile(s: string | undefined | null): number | null {
  if (!s) return null;
  const m = s.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]!) : null;
}

/** "top 20%" → "Top 20%". */
function titleCasePct(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const CONF_WORD: Record<ConfidenceLevel, string> = {
  HIGH: 'High confidence',
  MEDIUM: 'Medium confidence',
  LOW: 'Low confidence',
};

/**
 * Counts the hero percentile in from a worse rank down to its real value
 * (e.g. 34 → 5) on mount — reads as "homing in on your rank". Returns the
 * target immediately under reduced motion. null target → null (no number).
 */
function useCountIn(target: number | null, enabled: boolean): number | null {
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

/**
 * InputResultCard — the Input frame's engagement scorecard.
 *
 * A-led hero + C data rows (design: `.playwright-mcp/input-engine-final.html`):
 * the strongest of the four percentiles owns the surface as a monumental
 * number; the rest fall to quiet rows; the model's own confidence anchors the
 * footer. When the aggregator gated the result the card flips to the "Hold"
 * state — a coral verdict word, directional-only dimmed metrics. No video, no
 * prose, no chrome: the numbers are the value.
 */
export function InputResultCard({
  behavioral,
  confidence,
  confidenceLabel,
  gated = false,
  isStreaming = false,
}: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const showResult = !isStreaming && !!behavioral;

  // One-shot mount fade-in-up (skipped under reduced motion). rAF defers the
  // flip so the opacity:0 start frame paints before the transition runs.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Four metrics in a stable order; the strongest (lowest "top X%") leads.
  const metrics = behavioral
    ? [
        { key: 'share', name: 'Shares', pct: behavioral.share_percentile },
        { key: 'completion', name: 'Completion', pct: behavioral.completion_percentile },
        { key: 'comment', name: 'Comments', pct: behavioral.comment_percentile },
        { key: 'save', name: 'Saves', pct: behavioral.save_percentile },
      ]
    : [];
  const ranked = [...metrics].sort(
    (a, b) => (parsePercentile(a.pct) ?? 999) - (parsePercentile(b.pct) ?? 999),
  );
  const lead = ranked[0];
  const rest = gated ? metrics : ranked.slice(1);
  const heroNum = useCountIn(
    showResult && !gated ? parsePercentile(lead?.pct) : null,
    !reducedMotion,
  );

  const hasConf = confidence != null && !!confidenceLabel;
  const footer = hasConf ? (
    <div
      className="mt-auto border-t border-white/[0.055] pt-3.5 text-[11.5px] tracking-[0.05px] text-white/[0.38]"
      data-testid="input-confidence"
    >
      <span className="text-white/[0.56]">{CONF_WORD[confidenceLabel!]}</span>
      {' · '}
      <span className="tabular-nums">{confidence!.toFixed(2)}</span>
    </div>
  ) : null;

  // ── Idle / streaming — calm holding states (no broken-player vocabulary) ──
  if (!showResult) {
    return (
      <div className="flex h-full w-full items-center" data-testid="input-scorecard" data-state={isStreaming ? 'streaming' : 'idle'}>
        {isStreaming ? (
          <span className="flex items-center gap-2 text-[13px] text-white/[0.56]">
            <span className={cn('inline-block h-1.5 w-1.5 rounded-full bg-accent', !reducedMotion && 'animate-pulse')} />
            Analyzing
          </span>
        ) : (
          <span className="text-[13px] text-white/[0.38]">Awaiting analysis</span>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full w-full flex-col"
      data-testid="input-scorecard"
      data-state={gated ? 'gated' : 'confident'}
      style={
        reducedMotion
          ? undefined
          : {
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(4px)',
              transition: 'opacity 240ms ease, transform 240ms ease',
            }
      }
    >
      {/* Coral edge-flag — gated only (coral = needs attention now). */}
      {gated && (
        <span
          aria-hidden
          className="absolute -left-2 bottom-0 top-0 w-[3px] rounded-full bg-accent"
          style={{ boxShadow: '0 0 16px -2px rgba(255,127,80,0.5)' }}
        />
      )}

      {/* Hero — monumental number (confident) or verdict word (gated). */}
      {gated ? (
        <>
          <div className="leading-none">
            <span className="text-[52px] font-semibold tracking-[-0.03em] text-accent">Hold</span>
          </div>
          <p className="mt-3 text-[13px] tracking-[0.05px] text-white/[0.38]">directional only</p>
        </>
      ) : (
        <>
          <div className="flex items-baseline gap-2.5 leading-none">
            <span className="text-[21px] font-semibold tracking-tight text-white/[0.56]">Top</span>
            <span className="text-[56px] font-semibold tabular-nums tracking-[-0.035em] text-white/[0.95]">
              {heroNum ?? parsePercentile(lead?.pct) ?? lead?.pct}
              <span className="ml-px text-[0.55em] font-semibold">%</span>
            </span>
          </div>
          <p className="mt-3 text-[13px] tracking-[0.05px] text-white/[0.38]">
            predicted rank in <span className="font-medium text-white/[0.56]">{lead?.name}</span>
          </p>
        </>
      )}

      {/* Data rows — the supporting percentiles (dimmed when gated). */}
      <div className={cn('mt-7 flex flex-col', gated && 'opacity-[0.32]')}>
        {rest.map((m) => (
          <div
            key={m.key}
            className="flex items-baseline justify-between gap-3 border-t border-white/[0.04] py-2.5 first:border-t-0"
          >
            <span className="text-[13px] tracking-[0.05px] text-white/[0.56]">{m.name}</span>
            <span className="text-[13.5px] font-semibold tabular-nums text-white/[0.95]">{titleCasePct(m.pct)}</span>
          </div>
        ))}
      </div>

      {footer}
    </div>
  );
}
