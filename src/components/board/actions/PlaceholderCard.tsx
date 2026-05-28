'use client';
import type { PlaceholderCardProps } from './actions-types';
import { COPY } from './actions-constants';

export function PlaceholderCard({
  label,
  phase,
  icon: Icon,
  'data-testid': testId,
}: PlaceholderCardProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1 rounded-[12px] p-3 bg-white/[0.02] text-white/55"
      style={{
        border: '1px dashed rgba(255,255,255,0.06)',
      }}
      aria-label={`${label}: coming in Phase ${phase}`}
      role="presentation"
      data-testid={testId ?? 'placeholder-card'}
    >
      <Icon size={16} aria-hidden={true} />
      <span className="text-xs font-medium" data-testid="placeholder-label">
        {label}
      </span>
      <span className="text-[10px]" data-testid="placeholder-sub-label">
        {COPY.COMING_PREFIX} {phase}
      </span>
    </div>
  );
}
