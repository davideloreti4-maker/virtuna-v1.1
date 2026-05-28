'use client';
import { useEffect, useRef } from 'react';
import { useBoardStore } from '@/stores/board-store';
import { ContentForm, type ContentFormData } from '@/components/app/content-form';

interface Props {
  /** Optional upload progress (0-100) passed through to the ContentForm. */
  uploadProgress?: number;
  /** Called when the embedded ContentForm submits a fresh analysis. */
  onContentSubmit?: (data: ContentFormData) => void;
}

/**
 * CommandBar — bottom-pinned input surface that hosts the full ContentForm.
 *
 * Fixed at bottom-center on /analyze and /analyze/[id]. Width:
 * min(720px, calc(100vw - 32px)). The form is always visible — there is no
 * separate "minimal" mode and no auto-hide. The Input node on the board is
 * display-only; this bar is the single entry point for starting an analysis.
 *
 * Focus pulse (store.inputBarFocusPulse) is still respected so callers like
 * "Run another analysis" can pull the user's attention to the textarea.
 */
export function CommandBar({ onContentSubmit, uploadProgress }: Props) {
  const focusPulse = useBoardStore((s) => s.inputBarFocusPulse);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (focusPulse === 0) return;
    const id = requestAnimationFrame(() => {
      const ta = containerRef.current?.querySelector<HTMLTextAreaElement>('textarea');
      ta?.focus();
      ta?.scrollIntoView({ block: 'nearest' });
    });
    return () => cancelAnimationFrame(id);
  }, [focusPulse]);

  return (
    <div
      ref={containerRef}
      className="fixed bottom-4 left-1/2 z-[200] -translate-x-1/2"
      style={{ width: 'min(720px, calc(100vw - 32px))' }}
    >
      <ContentForm
        onSubmit={(data) => onContentSubmit?.(data)}
        uploadProgress={uploadProgress}
      />
    </div>
  );
}
