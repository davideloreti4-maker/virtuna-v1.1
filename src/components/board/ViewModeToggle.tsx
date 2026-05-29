'use client';
import { Cards, SquaresFour } from '@phosphor-icons/react';
import { Icon } from '@/components/ui/icon';
import type { ViewMode } from './use-view-mode';

interface Props {
  mode: ViewMode;
  onToggle: () => void;
}

/**
 * Floating board⇄cards switch. Rendered only when the current mode isn't the
 * plain desktop default (i.e. on phones, or when the user has pinned a mode),
 * so wide screens stay clean. The label names the mode you'll switch *to*.
 */
export function ViewModeToggle({ mode, onToggle }: Props) {
  const toCards = mode === 'board';
  const label = toCards ? 'Card view' : 'Board view';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${label.toLowerCase()}`}
      data-testid="view-mode-toggle"
      className="fixed bottom-4 right-4 z-[150] flex items-center gap-2 rounded-[8px] border border-white/[0.06] bg-surface px-3 py-2 text-xs font-medium text-foreground shadow-button hover:bg-white/[0.1]"
    >
      <Icon icon={toCards ? Cards : SquaresFour} size={16} />
      <span>{label}</span>
    </button>
  );
}
