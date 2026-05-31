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
 * Board⇄cards segmented switch. Pinned top-center under the camera-preset
 * toolbar (board mode) or in the reserved top strip (cards mode). Styling mirrors
 * CameraOverlay so the two read as one control group. Selecting an option pins
 * the mode as an explicit override regardless of viewport — usable on both
 * desktop and mobile.
 */
export function ViewModeToggle({ mode, onSelect }: Props) {
  // Board mode shows the camera toolbar at top-4; sit beneath it. Cards mode has
  // no toolbar but reserves a 56px top strip (BoardMobile) — sit inside that band.
  const topClass = mode === 'board' ? 'top-16' : 'top-4';

  return (
    <div
      role="group"
      aria-label="Board view mode"
      data-testid="view-mode-toggle"
      className={`fixed left-1/2 z-[150] flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-white/[0.06] p-0.5 ${topClass}`}
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
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF7F50] ${
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
