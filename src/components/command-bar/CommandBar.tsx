'use client';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { GlassPanel } from '@/components/primitives/GlassPanel';
import { cn } from '@/lib/utils';
import { useBoardStore } from '@/stores/board-store';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { placeholderFor, chipsFor, inputEnabledFor, type ChipDescriptor } from './command-bar-state';
import { CommandBarChip } from './CommandBarChip';

interface Props {
  /**
   * Human-readable streaming stage label emitted by the SSE pipeline.
   * Pass from the parent (Board) that reads useAnalysisStream().stages.
   * When null/undefined and boardState === 'streaming', falls back to "Analyzing…".
   */
  currentStage?: string | null;
  /** Called when user submits in idle/complete state with non-empty text. */
  onSubmit?: (text: string) => void;
  /** Called when user clicks Stop analysis. */
  onStop?: () => void;
}

const AUTO_HIDE_MS = 5000;

/**
 * CommandBar — bottom-pinned context-aware command bar.
 *
 * Fixed at bottom-center on /analyze and /analyze/[id].
 * Width: min(720px, calc(100vw - 32px)), 52px+ height.
 * Auto-hides after 5s of no interaction; chevron re-opens.
 */
export function CommandBar({ currentStage, onSubmit, onStop }: Props) {
  const boardState = useBoardStore((s) => s.boardState);
  const resetToIdle = useBoardStore((s) => s.resetToIdle);
  const reducedMotion = usePrefersReducedMotion();

  const [value, setValue] = useState('');
  const [hidden, setHidden] = useState(false);
  const lastInteractRef = useRef<number>(Date.now());

  // Auto-hide after 5s of no interaction (UI-SPEC §Command Bar auto-hide)
  useEffect(() => {
    const t = setInterval(() => {
      if (Date.now() - lastInteractRef.current > AUTO_HIDE_MS) setHidden(true);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const markActive = () => {
    lastInteractRef.current = Date.now();
    setHidden(false);
  };

  // edit-input: bar hidden, drawer renders its own form
  if (boardState === 'edit-input') return null;

  const placeholder = placeholderFor(boardState, currentStage ?? null);
  const chips: ChipDescriptor[] = chipsFor(boardState);
  const inputEnabled = inputEnabledFor(boardState);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!inputEnabled) return;
    onSubmit?.(trimmed);
    setValue('');
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    markActive();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChipClick = (chip: ChipDescriptor) => {
    markActive();
    if (chip.id === 'stop') {
      resetToIdle();
      onStop?.();
    }
    // Other chips are Phase 2 placeholders (UI-SPEC chip action map, all enabled: false).
  };

  // Hidden state — render the re-open chevron at bottom-center
  if (hidden) {
    return (
      <button
        type="button"
        aria-label="Show command bar"
        onClick={() => { markActive(); }}
        className="fixed bottom-2 left-1/2 z-[200] -translate-x-1/2 rounded-full border border-white/[0.06] bg-surface px-3 py-1 text-foreground-muted"
        style={
          reducedMotion
            ? undefined
            : { transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)' }
        }
      >
        ‹
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-4 left-1/2 z-[200] -translate-x-1/2"
      style={{ width: 'min(720px, calc(100vw - 32px))' }}
      onPointerDown={markActive}
    >
      <GlassPanel className="flex flex-col gap-2 rounded-[12px] px-3 py-2">
        {/* Chip row (above input) */}
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <CommandBarChip key={c.id} chip={c} onClick={() => handleChipClick(c)} />
            ))}
          </div>
        )}
        <input
          type="text"
          role="combobox"
          aria-label="Analysis command bar"
          aria-expanded={false}
          autoComplete="off"
          disabled={!inputEnabled}
          placeholder={placeholder}
          value={value}
          onChange={(e) => { markActive(); setValue(e.target.value); }}
          onFocus={markActive}
          onKeyDown={handleKey}
          className={cn(
            'h-9 w-full bg-transparent text-sm text-foreground outline-none',
            'placeholder:text-foreground-muted',
            !inputEnabled && 'cursor-not-allowed',
          )}
        />
      </GlassPanel>
    </div>
  );
}
