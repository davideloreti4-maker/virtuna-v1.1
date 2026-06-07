/**
 * ExpertChatInput — composer variant A for the "Ask the expert" unified panel.
 *
 * Variant A spec (locked):
 * - Send embedded INSIDE the field (30px, anchored to field's right edge)
 * - Field height ~40px, 8px radius, real focus-within ring, bg rgba(255,255,255,.045)
 * - Send: subtle/grey when empty → coral shadow-button when text present
 * - While streaming: send replaced by Stop button
 * - Suggestion row ABOVE the field with ✦ Try label + horizontally-scrollable chips
 *   Bold key terms rendered via ** markdown syntax in chip labels
 * - Placeholder: "Ask why it flops, how to fix the hook…"
 * - Scope chip (removable) when board node selected
 * - "+ New analysis" demoted bottom-right
 *
 * Raycast tokens: 6% borders / 10% hover, 8px radius, coral accents only.
 */

'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Square, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBoardStore } from '@/stores/board-store';

// ── Frame label map ────────────────────────────────────────────────────────
const NODE_FRAME_LABELS: Record<string, string> = {
  engine: 'Engine',
  audience: 'Audience',
  verdict: 'Verdict',
  actions: 'Actions',
  content: 'Content craft',
};

function nodeIdToFrameLabel(id: string | null): string | null {
  if (!id) return null;
  const normalized = id.toLowerCase();
  for (const [key, label] of Object.entries(NODE_FRAME_LABELS)) {
    if (normalized.startsWith(key)) return label;
  }
  return null;
}

function nodeIdToScopeKey(id: string | null): string | null {
  if (!id) return null;
  const normalized = id.toLowerCase();
  const scopeKeys = ['engine', 'audience', 'verdict', 'actions', 'content'];
  for (const key of scopeKeys) {
    if (normalized.startsWith(key)) return key;
  }
  return null;
}

// ── Chip label — render **bold** key terms inline ──────────────────────────

function ChipLabel({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) => {
        const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
        if (boldMatch) {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {boldMatch[1]}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────

interface ExpertChatInputProps {
  seedPrompts: string[];
  isStreaming: boolean;
  onSend: (message: string, scope: string | null) => void;
  onStop?: () => void;
  /** Last user message text (for ↑ edit-last-question behaviour). */
  lastUserMessage?: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export function ExpertChatInput({
  seedPrompts,
  isStreaming,
  onSend,
  onStop,
  lastUserMessage,
}: ExpertChatInputProps) {
  const [value, setValue] = useState('');
  const [scopeOverridden, setScopeOverridden] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const selectedNodeId = useBoardStore((s) => s.selectedNodeId);
  const triggerNewAnalysis = useBoardStore((s) => s.triggerNewAnalysis);
  const openInputDrawer = useBoardStore((s) => s.openInputDrawer);

  const activeNodeId = scopeOverridden ? null : selectedNodeId;
  const scopeLabel = nodeIdToFrameLabel(activeNodeId);
  const scopeKey = nodeIdToScopeKey(activeNodeId);

  // Reset scope when selected node changes
  useEffect(() => {
    setScopeOverridden(false);
  }, [selectedNodeId]);

  const hasText = value.trim().length > 0;

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed, scopeKey);
    setValue('');
    textareaRef.current?.focus();
  }, [value, isStreaming, onSend, scopeKey]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
        return;
      }
      // ↑ in empty input → recall last user message
      if (e.key === 'ArrowUp' && value === '' && lastUserMessage) {
        e.preventDefault();
        setValue(lastUserMessage);
        requestAnimationFrame(() => {
          const ta = textareaRef.current;
          if (ta) {
            ta.selectionStart = ta.value.length;
            ta.selectionEnd = ta.value.length;
          }
        });
      }
    },
    [handleSubmit, value, lastUserMessage]
  );

  const handleSeedClick = useCallback(
    (prompt: string) => {
      if (isStreaming) return;
      // Strip ** markdown markers for send/display
      const clean = prompt.replace(/\*\*/g, '');
      onSend(clean, scopeKey);
    },
    [isStreaming, onSend, scopeKey]
  );

  const handleNewAnalysis = useCallback(() => {
    triggerNewAnalysis();
    openInputDrawer();
  }, [triggerNewAnalysis, openInputDrawer]);

  return (
    <div className="flex flex-col gap-2">
      {/* ✦ Try suggestion row — ABOVE the field, horizontally scrollable */}
      {seedPrompts.length > 0 && !isStreaming && (
        <div className="flex items-center gap-2 min-w-0">
          {/* Leading ✦ Try label */}
          <span className="flex shrink-0 items-center gap-1 text-xs text-foreground-muted/60 select-none">
            ✦ Try
          </span>
          {/* Scrollable chip row */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 min-w-0 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none]">
            {seedPrompts.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSeedClick(prompt)}
                disabled={isStreaming}
                className="shrink-0 rounded border border-white/[0.06] bg-white/[0.04] px-2.5 py-1 text-xs text-foreground-muted whitespace-nowrap transition-colors hover:bg-white/[0.08] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
              >
                <ChipLabel text={prompt} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Scope chip (removable) */}
      {scopeLabel && (
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1 rounded border border-white/[0.06] bg-white/[0.04] px-2 py-0.5">
            <span className="text-xs text-foreground-muted">about: {scopeLabel}</span>
            <button
              type="button"
              onClick={() => setScopeOverridden(true)}
              className="flex h-3.5 w-3.5 items-center justify-center rounded hover:bg-white/[0.1] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
              aria-label={`Remove scope filter: ${scopeLabel}`}
            >
              <X className="h-2.5 w-2.5 text-foreground-muted" />
            </button>
          </div>
        </div>
      )}

      {/* Input field with embedded send/stop — Variant A */}
      <div
        className={cn(
          'relative flex items-center rounded-lg border transition-colors',
          'bg-[rgba(255,255,255,0.045)] border-white/[0.05]',
          'focus-within:border-white/[0.12]',
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isStreaming ? 'Apollo is thinking…' : 'Ask why it flops, how to fix the hook…'
          }
          disabled={isStreaming}
          rows={1}
          className={cn(
            'flex-1 resize-none rounded-lg bg-transparent py-2.5 pl-3 pr-10 text-sm text-foreground',
            'outline-none placeholder:text-foreground-muted/50',
            'disabled:opacity-60',
            'min-h-[40px] max-h-[108px] overflow-y-auto',
          )}
          style={{ height: 'auto', letterSpacing: '0.2px' }}
        />

        {/* Embedded send/stop — 30px right-anchored */}
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop streaming"
            className={cn(
              'absolute right-1.5 top-1/2 -translate-y-1/2',
              'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded',
              'border border-white/[0.06] bg-white/[0.06] text-foreground-muted',
              'transition-colors hover:bg-white/[0.12] hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20',
            )}
          >
            <Square className="h-3 w-3 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!hasText}
            aria-label="Send message"
            className={cn(
              'absolute right-1.5 top-1/2 -translate-y-1/2',
              'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded',
              'transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-coral/40',
              hasText
                ? // Coral shadow-button when text present
                  [
                    'bg-coral text-white border border-coral/80',
                    'shadow-[0_0_0_1px_rgba(255,127,80,0.3),0_2px_8px_rgba(255,127,80,0.25)]',
                    'hover:bg-coral/90',
                  ].join(' ')
                : // Subtle grey when empty
                  'border border-white/[0.06] bg-white/[0.04] text-foreground-muted/40 cursor-not-allowed',
            )}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M7 11V3M3 7l4-4 4 4" />
            </svg>
          </button>
        )}
      </div>

      {/* Demoted "+ New analysis" — bottom right */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleNewAnalysis}
          className="flex items-center gap-1 text-xs text-foreground-muted/50 transition-colors hover:text-foreground-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
        >
          <Plus className="h-3 w-3" />
          New analysis
        </button>
      </div>
    </div>
  );
}
