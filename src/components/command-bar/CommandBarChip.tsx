'use client';
import { cn } from '@/lib/utils';
import type { ChipDescriptor } from './command-bar-state';

interface Props {
  chip: ChipDescriptor;
  onClick?: () => void;
}

/**
 * CommandBarChip — UI-SPEC §Command Bar chip styling.
 * 8px radius, bg-surface-elevated, 6% border, 12px text.
 * Disabled chips are visible (opacity 0.5) + non-interactive (cursor not-allowed).
 */
export function CommandBarChip({ chip, onClick }: Props) {
  return (
    <button
      type="button"
      disabled={!chip.enabled}
      aria-disabled={!chip.enabled}
      onClick={chip.enabled ? onClick : undefined}
      className={cn(
        'inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-xs',
        'border-white/[0.06] bg-surface-elevated',
        chip.enabled
          ? 'cursor-pointer hover:bg-white/[0.05]'
          : 'cursor-not-allowed opacity-50',
        chip.destructive && 'border-error/40 text-error hover:bg-error/10',
      )}
    >
      {chip.label}
    </button>
  );
}
