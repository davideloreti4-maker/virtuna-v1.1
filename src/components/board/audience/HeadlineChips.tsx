'use client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { PersonaWeights } from '@/lib/engine/persona-weights';

export interface HeadlineChipsProps {
  weighted_completion_pct: number | null | undefined;
  weighted_top_dropoff_t: number | null | undefined;
  weighted_hook_score: number | null | undefined;
  fallback?: { completion_pct: number; top_dropoff_t: number; hook_score: number };
  loop_pct: number | null | undefined;
  vs_niche_diff_pct: number | null | undefined;
  weights: PersonaWeights;
  isStreaming: boolean;
  onWeightsBadgeClick: () => void;
}

function fmt(
  value: number | null | undefined,
  fallback: number | undefined,
  unit: '%' | 's',
): { display: string; isFallback: boolean; isSkeleton: boolean } {
  if (value != null) {
    return {
      display: unit === '%' ? `${Math.round(value)}%` : `${value.toFixed(1)}s`,
      isFallback: false,
      isSkeleton: false,
    };
  }
  if (fallback != null) {
    return {
      display: unit === '%' ? `${Math.round(fallback)}%` : `${fallback.toFixed(1)}s`,
      isFallback: true,
      isSkeleton: false,
    };
  }
  return { display: '—', isFallback: false, isSkeleton: true };
}

function Chip({
  label,
  value,
  isSkeleton,
  isFallback,
  valueClassName,
}: {
  label: string;
  value: string;
  isSkeleton: boolean;
  isFallback: boolean;
  valueClassName?: string;
}) {
  return (
    <dl
      className="flex flex-col rounded-[8px] border border-white/[0.06] px-2 py-1"
      style={{ background: 'rgba(255,255,255,0.05)' }}
    >
      <dt role="term" className="text-xs font-normal opacity-70">
        {label}
      </dt>
      <dd role="definition" className={cn('text-sm font-semibold leading-[1.1]', valueClassName)}>
        {isSkeleton ? <Skeleton className="h-[14px] w-[48px]" /> : value}
        {isFallback && <span className="sr-only"> (estimated, Pass 1)</span>}
      </dd>
    </dl>
  );
}

export function HeadlineChips(props: HeadlineChipsProps) {
  const c = fmt(props.weighted_completion_pct, props.fallback?.completion_pct, '%');
  const td = fmt(props.weighted_top_dropoff_t, props.fallback?.top_dropoff_t, 's');
  const h = fmt(props.weighted_hook_score, props.fallback?.hook_score, '%');
  const loop = fmt(props.loop_pct, undefined, '%');
  const vs = fmt(props.vs_niche_diff_pct, undefined, '%');

  const vsClass =
    props.vs_niche_diff_pct != null
      ? props.vs_niche_diff_pct >= 0
        ? 'text-[var(--color-success)]'
        : 'text-[var(--color-error)]'
      : undefined;

  const w = props.weights;
  const badgeText = `Weighted: ${Math.round(w.fyp * 100)}/${Math.round(w.niche * 100)}/${Math.round(w.loyalist * 100)}/${Math.round(w.cross_niche * 100)}`;

  return (
    <div
      className="flex flex-wrap items-stretch gap-4"
      role="group"
      aria-label="Audience headline metrics"
    >
      <Chip
        label="Avg watch %"
        value={c.display}
        isSkeleton={props.isStreaming || c.isSkeleton}
        isFallback={c.isFallback}
      />
      <Chip
        label="Loop %"
        value={loop.display}
        isSkeleton={props.isStreaming || loop.isSkeleton}
        isFallback={false}
      />
      <Chip
        label="Top dropoff"
        value={td.display}
        isSkeleton={props.isStreaming || td.isSkeleton}
        isFallback={td.isFallback}
      />
      <Chip
        label="Hook score"
        value={h.display}
        isSkeleton={props.isStreaming || h.isSkeleton}
        isFallback={h.isFallback}
      />
      <Chip
        label="vs Niche"
        value={vs.display}
        isSkeleton={props.isStreaming || vs.isSkeleton}
        isFallback={false}
        valueClassName={vsClass}
      />
      <button
        type="button"
        onClick={props.onWeightsBadgeClick}
        className="ml-auto rounded-[8px] border border-white/[0.06] px-2 py-1 text-xs hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF7F50]"
        style={{ background: 'rgba(255,255,255,0.05)' }}
        aria-label={`Audience weighting: ${badgeText}. Tap to override.`}
      >
        {badgeText}
      </button>
    </div>
  );
}
