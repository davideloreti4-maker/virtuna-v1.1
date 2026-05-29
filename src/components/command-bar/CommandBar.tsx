'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBoardStore } from '@/stores/board-store';
import { ContentForm, type ContentFormData } from '@/components/app/content-form';

interface Props {
  /** Called when the embedded ContentForm submits a fresh analysis. */
  onContentSubmit?: (data: ContentFormData) => void;
}

/**
 * CommandBar — bottom-pinned input surface that hosts the full ContentForm.
 *
 * Fixed at bottom-center on /analyze and /analyze/[id]. Width:
 * min(720px, calc(100vw - 32px)) — grows wider on desktop. The form is always visible — there is no
 * separate "minimal" mode and no auto-hide. The Input node on the board is
 * display-only; this bar is the single entry point for starting an analysis.
 *
 * Focus pulse (store.inputBarFocusPulse) is still respected so callers like
 * "Run another analysis" can pull the user's attention to the textarea.
 */
export function CommandBar({ onContentSubmit }: Props) {
  const focusPulse = useBoardStore((s) => s.inputBarFocusPulse);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (focusPulse === 0) return;
    const id = requestAnimationFrame(() => {
      if (collapsed) setCollapsed(false);
      const ta = containerRef.current?.querySelector<HTMLTextAreaElement>('textarea');
      ta?.focus();
      ta?.scrollIntoView({ block: 'nearest' });
    });
    return () => cancelAnimationFrame(id);
  }, [focusPulse, collapsed]);

  return (
    <div
      ref={containerRef}
      className="fixed bottom-4 left-1/2 z-[200] -translate-x-1/2 flex flex-col items-center gap-1.5"
      style={{ width: 'min(720px, calc(100vw - 32px))' }}
    >
      {/* Collapse toggle */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-center w-5 h-5 rounded-full bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-colors"
        aria-label={collapsed ? 'Expand input' : 'Collapse input'}
      >
        <ChevronDown
          className={cn(
            'h-2.5 w-2.5 text-foreground-muted transition-transform duration-200',
            collapsed && 'rotate-180',
          )}
        />
      </button>

      {!collapsed && (
        <ContentForm
          onSubmit={(data) => onContentSubmit?.(data)}
        />
      )}
    </div>
  );
}
