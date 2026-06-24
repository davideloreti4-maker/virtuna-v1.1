'use client';
import { Cards, SquaresFour } from '@phosphor-icons/react';
import { Icon } from '@/components/ui/icon';
import type { ViewMode } from './use-view-mode';

interface Props {
  mode: ViewMode;
  onSelect: (mode: ViewMode) => void;
}

const OPTIONS: { value: ViewMode; label: string; icon: typeof Cards }[] = [
  { value: 'board', label: 'Board', icon: SquaresFour },
  { value: 'cards', label: 'Cards', icon: Cards },
];

/**
 * Board⇄cards segmented switch. Pinned to the top-RIGHT corner in both modes —
 * a secondary view control that sits opposite the sidebar hamburger (top-left)
 * and clear of the centered camera-preset nav, so the two never read as a pair
 * of stacked twins. Selecting an option pins the mode as an explicit override
 * regardless of viewport — usable on both desktop and mobile.
 */
export function ViewModeToggle({ mode, onSelect }: Props) {
  return (
    <div
      role="group"
      aria-label="Board view mode"
      data-testid="view-mode-toggle"
      className="fixed right-4 top-4 z-[150] flex items-center gap-0.5 rounded-lg border border-white/[0.06] p-0.5"
      style={{
        background: 'linear-gradient(137deg, rgba(17,18,20,0.7) 4.87%, rgba(12,13,15,0.85) 75.88%)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow:
          'rgba(0,0,0,0.3) 0 4px 12px -4px, rgba(255,255,255,0.06) 0 1px 0 0 inset',
      }}
    >
      {OPTIONS.map(({ value, label, icon }) => {
        const isActive = mode === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={isActive}
            aria-label={`${label} view`}
            data-testid={`view-mode-${value}`}
            onClick={() => onSelect(value)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none pointer-coarse:min-h-11 pointer-coarse:px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-foreground-secondary)] ${
              isActive
                ? 'bg-white/[0.08] text-foreground'
                : 'text-foreground/50 hover:bg-white/[0.04] hover:text-foreground/90'
            }`}
          >
            <Icon icon={icon} size={16} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
