'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBoardStore } from '@/stores/board-store';
import { ContentForm, type ContentFormData } from '@/components/app/content-form';
import { ExpertChatThread } from './ExpertChatThread';
import { ExpertChatInput } from './ExpertChatInput';
import { useExpertChat } from '@/hooks/queries/use-expert-chat';
import { deriveSeedPrompts } from '@/lib/chat/seed-prompts';
import type { AnalysisRow } from '@/lib/chat/seed-context';

interface Props {
  /** Called when the embedded ContentForm submits a fresh analysis. */
  onContentSubmit?: (data: ContentFormData) => void;
  /**
   * If set, a completed analysis exists and the CommandBar enters "Ask the expert" mode.
   * The pre-analysis ContentForm is demoted behind the "+ New analysis" affordance.
   */
  completedAnalysisId?: string | null;
  /**
   * The cached analysis_results row used to derive seeded prompts and build chat context.
   * Must be present when completedAnalysisId is set.
   */
  analysisRow?: AnalysisRow | null;
}

// Height of the CommandBar dock (grabber + input) — used to position the thread above.
// Approximate value; the thread uses CSS positioning so exact pixel counts don't matter.
const BAR_HEIGHT_PX = 96;
const BAR_BOTTOM_PX = 16; // bottom-4 = 16px
const THREAD_BOTTOM_OFFSET = BAR_HEIGHT_PX + BAR_BOTTOM_PX + 8; // gap

/**
 * CommandBar — bottom-pinned input surface.
 *
 * Dual-mode:
 *   - Pre-analysis (completedAnalysisId = null/undefined): renders ContentForm as today.
 *     The pre-analysis flow is BYTE-UNCHANGED.
 *   - Post-analysis (completedAnalysisId set): renders "Ask the expert" chat surface.
 *     ExpertChatThread expands upward as a fixed DOM overlay (survives Konva pan/zoom).
 *     "+ New analysis" demoted to a secondary affordance inside ExpertChatInput.
 *
 * The grabber/collapse button pattern is reused in both modes.
 * On mobile (<768px), the thread renders as a full-height sheet (ExpertChatThread handles this).
 */
export function CommandBar({ onContentSubmit, completedAnalysisId, analysisRow }: Props) {
  const focusPulse = useBoardStore((s) => s.inputBarFocusPulse);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [threadExpanded, setThreadExpanded] = useState(false);

  const isPostAnalysis = !!completedAnalysisId;

  // Reset thread state when switching between analyses or modes
  useEffect(() => {
    setThreadExpanded(false);
    setCollapsed(false);
  }, [completedAnalysisId]);

  // Focus pulse — open bar + focus textarea when requested
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

  // Chat hook — only active in post-analysis mode
  const chat = useExpertChat({ analysisId: completedAnalysisId ?? null });

  // Derive seeded prompts from the cached analysis row (memoized)
  const seedPrompts = useMemo(() => {
    if (!analysisRow) return [];
    try {
      return deriveSeedPrompts(analysisRow);
    } catch {
      return [];
    }
  }, [analysisRow]);

  // Expand thread when there are messages or streaming starts
  useEffect(() => {
    if (chat.messages.length > 0 || chat.isStreaming) {
      setThreadExpanded(true);
    }
  }, [chat.messages.length, chat.isStreaming]);

  const handleSend = (message: string, scope: string | null) => {
    setThreadExpanded(true);
    void chat.send(message, scope);
  };

  return (
    <>
      {/* Upward-expanding chat thread — rendered OUTSIDE the bar container so it
          doesn't affect the bar's layout. Fixed position above the bar. */}
      {isPostAnalysis && (
        <ExpertChatThread
          messages={chat.messages}
          streamingText={chat.streamingText}
          isStreaming={chat.isStreaming}
          error={chat.error}
          isExpanded={threadExpanded && !collapsed}
          bottomOffset={THREAD_BOTTOM_OFFSET}
        />
      )}

      {/* The CommandBar dock itself */}
      <div
        ref={containerRef}
        className="group fixed bottom-4 left-1/2 z-[200] -translate-x-1/2 flex flex-col items-center gap-1.5"
        style={{ width: 'min(720px, calc(100vw - 32px))' }}
      >
        {/* Collapse handle — the grabber button. Reused in both modes.
            Hidden at rest on fine pointers (revealed on hover); always shown on touch. */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'relative flex h-5 w-9 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.04] text-foreground-muted backdrop-blur-sm transition-all duration-200 motion-reduce:transition-none hover:bg-white/[0.08] hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none',
            "pointer-coarse:before:absolute pointer-coarse:before:-inset-3 pointer-coarse:before:content-['']",
            collapsed
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100',
          )}
          aria-label={collapsed ? 'Expand input' : 'Collapse input'}
        >
          <ChevronDown
            className={cn(
              'h-3 w-3 transition-transform duration-200',
              collapsed && 'rotate-180',
            )}
          />
        </button>

        {!collapsed && (
          <>
            {isPostAnalysis ? (
              /* Post-analysis: Ask-the-expert input surface */
              <ExpertChatInput
                seedPrompts={seedPrompts}
                isStreaming={chat.isStreaming}
                onSend={handleSend}
              />
            ) : (
              /* Pre-analysis: unchanged ContentForm */
              <ContentForm
                onSubmit={(data) => onContentSubmit?.(data)}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
