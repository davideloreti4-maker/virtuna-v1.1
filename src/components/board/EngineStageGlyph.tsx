'use client';
import { CheckCircle, Circle, CircleHalf, type Icon as PhosphorIcon } from '@phosphor-icons/react';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

export type EngineStageStatus = 'waiting' | 'active' | 'complete';

interface Props {
  label: string;          // canonical engine stage (e.g. "Qwen-VL segmentation")
  plainEnglish?: string;  // R2.7 "Reading the hook…"
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

export function EngineStageGlyph({ label, plainEnglish, status, reducedMotion }: Props) {
  return (
    <li className="flex items-center gap-2">
      <Icon
        icon={ICON[status]}
        size={16}
        weight={status === 'complete' ? 'fill' : 'regular'}
        className={cn(COLOR[status], status === 'active' && !reducedMotion && 'animate-pulse')}
      />
      <span className="flex flex-col">
        <span className="text-xs font-semibold text-foreground">{label}</span>
        {plainEnglish && status === 'active' && (
          <span className="text-[11px] text-foreground-muted">{plainEnglish}</span>
        )}
      </span>
    </li>
  );
}
