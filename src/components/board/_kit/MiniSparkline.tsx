import { cn } from '@/lib/utils';

/** MiniSparkline — tiny inline trend line for table rows. SVG, no axes. */
export interface MiniSparklineProps {
  points: number[];
  w?: number;
  h?: number;
  tone?: 'accent' | 'muted';
  className?: string;
}

export function MiniSparkline({
  points,
  w = 64,
  h = 20,
  tone = 'muted',
  className,
}: MiniSparklineProps) {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stepX = w / (points.length - 1);
  const d = points
    .map((p, i) => {
      const x = i * stepX;
      const y = h - ((p - min) / span) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const stroke = tone === 'accent' ? 'var(--color-accent)' : 'rgba(255,255,255,0.4)';
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={cn('overflow-visible', className)}
      aria-hidden
      data-testid="mini-sparkline"
    >
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
