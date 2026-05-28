'use client';
import { CheckCircle, Circle, CircleHalf, type Icon as PhosphorIcon } from '@phosphor-icons/react';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

export type EngineStageStatus = 'waiting' | 'active' | 'complete';

interface Props {
  label: string;          // canonical engine stage (e.g. "Qwen-VL segmentation")
  status: EngineStageStatus;
  reducedMotion: boolean;
}

const ICON: Record<EngineStageStatus, PhosphorIcon> = {
  waiting: Circle,
  active: CircleHalf,
  complete: CheckCircle,
};

const COLOR: Record<EngineStageStatus, string> = {
  waiting: 'text-foreground-muted',
  active: 'text-accent',
  complete: 'text-success',
};

export function EngineStageGlyph({ label, status, reducedMotion }: Props) {
  return (
    <li className="flex flex-col items-center" title={label} aria-label={`${label}: ${status}`}>
      <Icon
        icon={ICON[status]}
        size={16}
        weight={status === 'complete' ? 'fill' : 'regular'}
        className={cn(COLOR[status], status === 'active' && !reducedMotion && 'animate-pulse')}
      />
    </li>
  );
}
