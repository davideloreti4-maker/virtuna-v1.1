'use client';
import { useEffect, useState } from 'react';
import { X } from '@phosphor-icons/react';
import { Icon } from '@/components/ui/icon';
import { GlassPanel } from '@/components/primitives/GlassPanel';
import { useBoardStore } from '@/stores/board-store';

const STORAGE_KEY = 'virtuna-orientation-hint-dismissed';

function readDismissed(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return true; }
}

function writeDismissed(): void {
  try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
}

export function OrientationHint() {
  const boardState = useBoardStore((s) => s.boardState);
  const [dismissed, setDismissed] = useState<boolean>(true); // SSR-safe default

  // Initialize from storage post-mount
  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  // Auto-dismiss when user starts analyzing (idle → anything else)
  useEffect(() => {
    if (!dismissed && boardState !== 'idle') {
      writeDismissed();
      setDismissed(true);
    }
  }, [boardState, dismissed]);

  if (dismissed) return null;
  if (boardState !== 'idle') return null;

  const handleDismiss = () => {
    writeDismissed();
    setDismissed(true);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 left-1/2 z-[150] -translate-x-1/2"
      style={{ width: 'min(640px, calc(100vw - 32px))' }}
    >
      <GlassPanel className="flex items-center justify-between gap-3 rounded-[12px] px-4 py-3">
        <span className="text-sm text-foreground">
          Drop a video below or type in command bar to begin
        </span>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss orientation hint"
          className="text-foreground-muted hover:text-foreground"
        >
          <Icon icon={X} size={16} />
        </button>
      </GlassPanel>
    </div>
  );
}
