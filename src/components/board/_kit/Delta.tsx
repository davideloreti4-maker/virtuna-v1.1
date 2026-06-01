import { cn } from '@/lib/utils';

/**
 * Delta — small signed change indicator (▲/▼) used by hero, tiles, tables.
 * Color encodes good/bad: up=success, down=error by default; `invert` flips
 * the polarity (e.g. drop-off, where lower is better).
 */
export interface DeltaProps {
  /** Signed value, e.g. +6 or -0.34. Sign drives direction when dir='auto'. */
  value: number;
  /** Unit suffix, e.g. '%', 'pts'. */
  suffix?: string;
  /** Force a direction; 'auto' infers from the sign of `value`. */
  dir?: 'up' | 'down' | 'auto';
  /** When true, down=good / up=bad (e.g. churn, drop-off). */
  invert?: boolean;
  /** Render even when value is 0. */
  showZero?: boolean;
  className?: string;
}

export function Delta({
  value,
  suffix = '',
  dir = 'auto',
  invert = false,
  showZero = false,
  className,
}: DeltaProps) {
  const resolved =
    dir === 'auto' ? (value > 0 ? 'up' : value < 0 ? 'down' : 'flat') : dir;
  if (resolved === 'flat' && !showZero) return null;

  const good =
    resolved === 'flat' ? null : invert ? resolved === 'down' : resolved === 'up';
  const arrow = resolved === 'up' ? '▲' : resolved === 'down' ? '▼' : '–';
  const tone =
    good === null ? 'text-white/40' : good ? 'text-success' : 'text-error';
  const mag = Math.abs(value);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-[3px] text-[11px] font-medium tabular-nums',
        tone,
        className,
      )}
      data-testid="delta"
      aria-label={`${resolved === 'flat' ? 'no change' : resolved} ${mag}${suffix}`}
    >
      <span aria-hidden className="text-[7px] leading-none">
        {arrow}
      </span>
      {mag}
      {suffix}
    </span>
  );
}
