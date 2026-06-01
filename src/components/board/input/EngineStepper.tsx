import { cn } from '@/lib/utils';
import type { EngineStageStatus } from '../EngineGroup';

/**
 * EngineStepper — a calm, thin horizontal stepper (Linear-progress aesthetic).
 * Five segments whose fill encodes stage status: complete = soft coral,
 * active = bright coral (with a faint glow), waiting = hairline white. The
 * active node carries a coral dot. Pure-presentational, `aria-hidden` — the
 * live label is announced separately by the parent's aria-live region.
 */
export function EngineStepper({
  statuses,
  className,
}: {
  statuses: EngineStageStatus[];
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1.5', className)} aria-hidden>
      {statuses.map((s, i) => (
        <div key={i} className="relative flex-1">
          <span
            className={cn(
              'block h-[3px] w-full rounded-full transition-colors',
              s === 'complete' && 'bg-accent/40',
              s === 'active' && 'bg-accent',
              s === 'waiting' && 'bg-white/[0.07]',
            )}
            style={
              s === 'active'
                ? { boxShadow: '0 0 10px -1px rgba(255,127,80,0.6)' }
                : undefined
            }
          />
        </div>
      ))}
    </div>
  );
}
