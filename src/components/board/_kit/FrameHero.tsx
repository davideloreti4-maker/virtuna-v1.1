import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Delta, type DeltaProps } from './Delta';

export type HeroTone = 'good' | 'warn' | 'crit' | 'neutral';

const TONE_TEXT: Record<HeroTone, string> = {
  good: 'text-success',
  warn: 'text-warning',
  crit: 'text-accent',
  neutral: 'text-white/70',
};

/**
 * FrameHero — the single dominant element at the top of every frame.
 * Either a big number (`value` + `unit` + optional `delta`) or a custom hero
 * visual via `children` (e.g. the Audience persona graph). One hero per frame.
 */
export interface FrameHeroProps {
  /** Uppercase caps label above the hero. */
  label: string;
  /** Small lead-in before the big value, e.g. "Top". Kept visually secondary. */
  prefix?: string;
  /** Big number / value. Omit when passing a `children` hero visual. */
  value?: ReactNode;
  unit?: string;
  delta?: DeltaProps;
  status?: { word: string; tone?: HeroTone };
  insight?: ReactNode;
  align?: 'center' | 'left';
  /** Hero visual slot — replaces the value block when provided. */
  children?: ReactNode;
  className?: string;
}

export function FrameHero({
  label,
  prefix,
  value,
  unit,
  delta,
  status,
  insight,
  align = 'left',
  children,
  className,
}: FrameHeroProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2',
        align === 'center' ? 'items-center text-center' : 'items-start text-left',
        className,
      )}
      data-testid="frame-hero"
    >
      <span className="text-[10px] uppercase tracking-[0.1em] text-white/45">
        {label}
      </span>

      {children ?? (
        <div className="flex items-end gap-2">
          <span className="flex items-baseline text-[44px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-white">
            {prefix && (
              <span className="mr-2 text-[20px] font-medium tracking-normal text-white/55">
                {prefix}
              </span>
            )}
            {value}
            {unit && (
              <span className="ml-0.5 text-[16px] font-medium text-white/40">{unit}</span>
            )}
          </span>
          {delta && (
            <span className="mb-[7px]">
              <Delta {...delta} />
            </span>
          )}
        </div>
      )}

      {(status || insight) && (
        <div className={cn('flex flex-col gap-1', align === 'center' && 'items-center')}>
          {status && (
            <span
              className={cn('text-[13px] font-semibold', TONE_TEXT[status.tone ?? 'neutral'])}
            >
              {status.word}
            </span>
          )}
          {insight && (
            <p
              className="max-w-[44ch] text-[13px] leading-[1.4] text-white/60"
              style={{ textWrap: 'balance' }}
            >
              {insight}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
