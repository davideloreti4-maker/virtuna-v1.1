'use client';

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBoardStore } from '@/stores/board-store';
import { ContentForm, type ContentFormData } from '@/components/app/content-form';
import { ExpertChatThread } from './ExpertChatThread';
import { ExpertChatInput } from './ExpertChatInput';
import { useExpertChat } from '@/hooks/queries/use-expert-chat';
import { deriveSeedPrompts } from '@/lib/chat/seed-prompts';
import type { AnalysisRow } from '@/lib/chat/seed-context';
import { NumenMark } from '@/components/brand/numen-logo';

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

/**
 * CommandBar — bottom-pinned dock.
 *
 * v2 (unified panel): thread + composer live as siblings inside ONE panel container
 * (one border, one shadow, one glass gradient). No magic BAR_HEIGHT/THREAD_BOTTOM_OFFSET
 * numbers — the panel expands naturally.
 *
 * Panel structure:
 *   sticky header (only when conversation exists) → scrollable thread → sticky footer (composer)
 *
 * Pre-analysis mode: renders ContentForm (unchanged).
 * Post-analysis mode: renders the unified expert chat panel.
 *
 * Keyboard:
 *   ⌘K → focus Ask (handled by board-store focus pulse)
 *   Esc → collapse
 *   Enter → send / Shift+Enter → newline
 *   ↑ in empty input → recall last question
 *   ⌘⌫ → clear conversation
 *
 * Mobile (<768px): panel is full-height sheet (maxHeight gated to desktop only — bug fix).
 */
export function CommandBar({ onContentSubmit, completedAnalysisId, analysisRow }: Props) {
  const focusPulse = useBoardStore((s) => s.inputBarFocusPulse);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hasConversation, setHasConversation] = useState(false);

  const isPostAnalysis = !!completedAnalysisId;

  // Reset conversation state when switching between analyses
  useEffect(() => {
    setCollapsed(false);
    setHasConversation(false);
  }, [completedAnalysisId]);

  // Focus pulse — open bar + focus textarea when requested (⌘K from board)
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

  // Track conversation presence for header visibility
  useEffect(() => {
    if (chat.messages.length > 0 || chat.isStreaming) {
      setHasConversation(true);
    }
  }, [chat.messages.length, chat.isStreaming]);

  const handleSend = useCallback(
    (message: string, scope: string | null) => {
      setHasConversation(true);
      if (!collapsed) void chat.send(message, scope);
    },
    [chat, collapsed]
  );

  const handleRegenerate = useCallback(() => {
    // Resend the last user message
    const lastUser = [...chat.messages].reverse().find((m) => m.role === 'user');
    if (lastUser && !chat.isStreaming) {
      void chat.send(lastUser.content, lastUser.scope ?? null);
    }
  }, [chat]);

  const handleClearConversation = useCallback(() => {
    chat.clearMessages();
    setHasConversation(false);
  }, [chat]);

  // ⌘⌫ → clear conversation
  useEffect(() => {
    if (!isPostAnalysis) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleClearConversation();
      }
      if (e.key === 'Escape') {
        setCollapsed(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isPostAnalysis, handleClearConversation]);

  const lastUserMessage = useMemo(() => {
    const last = [...chat.messages].reverse().find((m) => m.role === 'user');
    return last?.content ?? undefined;
  }, [chat.messages]);

  // Panel expanded = conversation exists OR streaming
  const panelExpanded = hasConversation && !collapsed;

  return (
    <div
      ref={containerRef}
      className="group fixed bottom-4 left-1/2 z-[200] -translate-x-1/2 flex flex-col items-center gap-1.5 max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:translate-x-0"
      style={{ width: 'min(720px, calc(100vw - 32px))' }}
    >
      {/* Grabber chevron — shown only at rest (no conversation) or when collapsed.
          One collapse control: grabber at rest, header chevron when conversing. */}
      {(!hasConversation || collapsed) && (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'relative flex h-5 w-9 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.04] text-foreground-muted backdrop-blur-sm transition-all duration-200 motion-reduce:transition-none hover:bg-white/[0.08] hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20',
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
      )}

      {!collapsed && (
        <>
          {isPostAnalysis ? (
            /* ── Unified expert chat panel ──────────────────────────────────── */
            <div
              className="w-full flex flex-col rounded-xl border border-white/[0.06] overflow-hidden max-sm:rounded-none max-sm:w-screen max-sm:h-dvh"
              style={{
                background:
                  'linear-gradient(137deg, rgba(17,18,20,0.92) 4.87%, rgba(12,13,15,0.97) 75.88%)',
                backdropFilter: 'blur(5px)',
                WebkitBackdropFilter: 'blur(5px)',
                boxShadow:
                  'rgba(255,255,255,0.15) 0 1px 1px 0 inset, 0 4px 24px rgba(0,0,0,0.4)',
              }}
            >
              {/* ── Sticky header — only when conversation exists ────────── */}
              {panelExpanded && (
                <div
                  className="sticky top-0 z-10 flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]"
                  style={{
                    background:
                      'linear-gradient(137deg, rgba(17,18,20,0.95) 4.87%, rgba(12,13,15,0.98) 75.88%)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <NumenMark size={16} />
                    <span className="text-xs font-medium text-foreground-muted">
                      Ask the expert
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Clear conversation ⌘⌫ */}
                    <button
                      type="button"
                      onClick={handleClearConversation}
                      aria-label="Clear conversation (⌘⌫)"
                      title="Clear conversation (⌘⌫)"
                      className="flex h-6 w-6 items-center justify-center rounded text-foreground-muted/50 transition-colors hover:bg-white/[0.06] hover:text-foreground-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    {/* Collapse chevron — only in header when conversing */}
                    <button
                      type="button"
                      onClick={() => setCollapsed(true)}
                      aria-label="Collapse"
                      className="flex h-6 w-6 items-center justify-center rounded text-foreground-muted/50 transition-colors hover:bg-white/[0.06] hover:text-foreground-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Scrollable thread ───────────────────────────────────────── */}
              {panelExpanded && (
                <div
                  className="overflow-hidden sm:max-h-[55vh] max-sm:flex-1"
                >
                  {/* Mobile full-height fix: sm:max-h-[55vh] only applies ≥640px.
                      On mobile, the wrapper is flex-1 so the panel fills the screen.
                      NO inline maxHeight here (that was the v1 bug — it overrode CSS). */}
                  <ExpertChatThread
                    messages={chat.messages}
                    streamingText={chat.streamingText}
                    isStreaming={chat.isStreaming}
                    error={chat.error}
                    isExpanded={panelExpanded}
                    onRegenerate={handleRegenerate}
                  />
                </div>
              )}

              {/* ── Sticky footer (composer) ────────────────────────────────── */}
              <div className="sticky bottom-0 p-3 border-t border-white/[0.04]">
                <ExpertChatInput
                  seedPrompts={seedPrompts}
                  isStreaming={chat.isStreaming}
                  onSend={handleSend}
                  onStop={chat.stop}
                  lastUserMessage={lastUserMessage}
                />
              </div>
            </div>
          ) : (
            /* ── Pre-analysis: ContentForm (unchanged) ──────────────────── */
            <ContentForm onSubmit={(data) => onContentSubmit?.(data)} />
          )}
        </>
      )}
    </div>
  );
}
