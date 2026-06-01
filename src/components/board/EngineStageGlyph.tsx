'use client';
import { CheckCircle, Circle, CircleHalf, type Icon as PhosphorIcon } from '@phosphor-icons/react';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

export type EngineStageStatus = 'waiting' | 'active' | 'complete';

const ICON: Record<EngineStageStatus, PhosphorIcon> = {
  waiting: Circle,
  active: CircleHalf,
  complete: CheckCircle,
};

const ICON_COLOR: Record<EngineStageStatus, string> = {
  waiting: 'text-foreground-muted',
  active: 'text-accent',
  complete: 'text-success',
};

const NAME_COLOR: Record<EngineStageStatus, string> = {
  waiting: 'text-white/40',
  active: 'text-white/90',
  complete: 'text-white/85',
};

/** ms → compact human duration: 850ms, 1.2s, 12.4s. */
export function formatStageDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

interface Props {
  label: string;                 // canonical engine stage (e.g. "Qwen-VL segmentation")
  subtitle: string;              // what the stage did / is doing
  status: EngineStageStatus;
  durationMs?: number | null;    // per-stage timing (live events only); omitted on history
  isLast?: boolean;              // suppress the connector rail below the last row
  reducedMotion: boolean;
}

/**
 * EngineStageRow — one row of the vertical pipeline stepper inside the Engine
 * frame. A status glyph + connector rail on the left; canonical stage name,
 * plain-English subtitle, and optional duration on the right. Used for both the
 * streaming view (live statuses + durations) and the history view (all complete).
 */
export function EngineStageGlyph({ label, subtitle, status, durationMs, isLast, reducedMotion }: Props) {
  return (
    <li
      className="relative flex gap-2.5 pb-4 last:pb-0"
      title={label}
      aria-label={`${label}: ${status}`}
    >
      {/* Connector rail behind the glyph (skipped on the last row). */}
      {!isLast && (
        <span
          aria-hidden
          className="absolute left-[7.5px] top-[18px] bottom-0 w-px bg-white/[0.08]"
        />
      )}
      <Icon
        icon={ICON[status]}
        size={16}
        weight={status === 'complete' ? 'fill' : 'regular'}
        className={cn(
          'relative z-10 mt-px shrink-0',
          ICON_COLOR[status],
          status === 'active' && !reducedMotion && 'animate-pulse',
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn('truncate text-xs font-medium', NAME_COLOR[status])}>{label}</span>
          {durationMs != null && (
            <span className="shrink-0 text-[10px] tabular-nums text-foreground-muted">
              {formatStageDuration(durationMs)}
            </span>
          )}
        </div>
        <span className="text-[10px] leading-tight text-foreground-muted">{subtitle}</span>
      </div>
    </li>
  );
}
