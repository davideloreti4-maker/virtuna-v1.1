'use client';
import { useState, useEffect } from 'react';
import { X } from '@phosphor-icons/react';
import { Icon } from '@/components/ui/icon';
import { GlassPanel } from '@/components/primitives/GlassPanel';
import { logger } from '@/lib/logger';

const STORAGE_KEY = 'virtuna-mobile-banner-dismissed';

function readDismissed(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return true; }
}

function writeDismissed(): void {
  try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
}

/**
 * Banner shown on narrow viewports (< 1024px) alerting users the board is optimised for desktop.
 * Fires `board_mobile_banner_shown` telemetry once per session on mount.
 * Dismissable via X button; persists dismissal in localStorage.
 */
export function MobileBoardBanner() {
  const [isNarrow, setIsNarrow] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(true); // SSR-safe default

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Fire telemetry once when banner becomes visible
  useEffect(() => {
    if (isNarrow && !dismissed) {
      logger.info('board_mobile_banner_shown', { viewport_width: window.innerWidth });
    }
  }, [isNarrow, dismissed]);

  if (!isNarrow || dismissed) return null;

  const handleDismiss = () => {
    writeDismissed();
    setDismissed(true);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="mobile-board-banner"
      className="fixed top-4 left-1/2 z-[160] -translate-x-1/2"
      style={{ width: 'min(560px, calc(100vw - 32px))' }}
    >
      <GlassPanel className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="text-xs text-foreground">
          This board is optimized for desktop. Use ⌘+scroll to pan/zoom, or rotate your device.
        </span>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss mobile notice"
          className="shrink-0 text-foreground-muted hover:text-foreground"
          data-testid="mobile-board-banner-dismiss"
        >
          <Icon icon={X} size={16} />
        </button>
      </GlassPanel>
    </div>
  );
}
