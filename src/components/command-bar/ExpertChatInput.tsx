/**
 * ExpertChatInput — post-analysis "Ask the expert" input surface.
 *
 * Renders:
 *   - Seeded prompt chips (derived from the analysis) above the textarea
 *   - A removable "about: <frame>" scope chip when a board node is selected
 *   - Textarea + submit button for the question
 *   - A demoted "+ New analysis" secondary affordance
 *
 * Placement: replaces ContentForm inside CommandBar when an analysis is complete.
 * Must NOT break the pre-analysis path.
 */

'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { ArrowUp, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBoardStore } from '@/stores/board-store';

// ── Frame label map (board-store selectedNodeId → readable label) ──────────
const NODE_FRAME_LABELS: Record<string, string> = {
  engine: 'Engine',
  audience: 'Audience',
  verdict: 'Verdict',
  actions: 'Actions',
  content: 'Content craft',
  // Handle mixed-case or suffix variants defensively
  Engine: 'Engine',
  Audience: 'Audience',
  Verdict: 'Verdict',
  Actions: 'Actions',
};

function nodeIdToFrameLabel(id: string | null): string | null {
  if (!id) return null;
  // Normalize: match by start or exact
  const normalized = id.toLowerCase();
  for (const [key, label] of Object.entries(NODE_FRAME_LABELS)) {
    if (normalized.startsWith(key.toLowerCase())) return label;
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

// ── Props ─────────────────────────────────────────────────────────────────

interface ExpertChatInputProps {
  seedPrompts: string[];
  isStreaming: boolean;
  onSend: (message: string, scope: string | null) => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export function ExpertChatInput({ seedPrompts, isStreaming, onSend }: ExpertChatInputProps) {
  const [value, setValue] = useState('');
  const [scopeOverridden, setScopeOverridden] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Read selectedNodeId from board-store (defensively — may always be null)
  const selectedNodeId = useBoardStore((s) => s.selectedNodeId);
  const triggerNewAnalysis = useBoardStore((s) => s.triggerNewAnalysis);
  const openInputDrawer = useBoardStore((s) => s.openInputDrawer);

  // Scope chip: derived from selectedNodeId unless user manually removed it
  const activeNodeId = scopeOverridden ? null : selectedNodeId;
  const scopeLabel = nodeIdToFrameLabel(activeNodeId);
  const scopeKey = nodeIdToScopeKey(activeNodeId);

  // Reset scope override when the selected node changes
  useEffect(() => {
    setScopeOverridden(false);
  }, [selectedNodeId]);

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
      }
    },
    [handleSubmit]
  );

  const handleSeedClick = useCallback(
    (prompt: string) => {
      if (isStreaming) return;
      onSend(prompt, scopeKey);
    },
    [isStreaming, onSend, scopeKey]
  );

  const handleNewAnalysis = useCallback(() => {
    triggerNewAnalysis();
    openInputDrawer();
  }, [triggerNewAnalysis, openInputDrawer]);

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-white/[0.06] p-3"
      style={{
        background:
          'linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        boxShadow: 'rgba(255,255,255,0.15) 0 1px 1px 0 inset',
      }}
    >
      {/* Seeded prompt chips */}
      {seedPrompts.length > 0 && !isStreaming && (
        <div className="flex flex-wrap gap-1.5">
          {seedPrompts.map((prompt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSeedClick(prompt)}
              className="rounded-full border border-white/[0.06] bg-white/[0.04] px-2.5 py-1 text-xs text-foreground-muted transition-colors hover:bg-white/[0.08] hover:text-foreground"
              disabled={isStreaming}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Scope chip (removable) */}
      {scopeLabel && (
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.04] px-2 py-0.5">
            <span className="text-xs text-foreground-muted">about: {scopeLabel}</span>
            <button
              type="button"
              onClick={() => setScopeOverridden(true)}
              className="flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-white/[0.1] transition-colors"
              aria-label={`Remove scope filter: ${scopeLabel}`}
            >
              <X className="h-2.5 w-2.5 text-foreground-muted" />
            </button>
          </div>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? 'Apollo is thinking…' : 'Ask the expert…'}
          disabled={isStreaming}
          rows={1}
          className={cn(
            'flex-1 resize-none rounded-lg bg-white/[0.05] px-3 py-2.5 text-sm text-foreground',
            'border border-white/[0.05] outline-none',
            'placeholder:text-foreground-muted/60',
            'transition-colors focus:border-white/[0.1]',
            'disabled:opacity-50',
            // Auto-expand vertically up to ~4 rows
            'min-h-[42px] max-h-[108px] overflow-y-auto',
          )}
          style={{ height: 'auto', letterSpacing: '0.2px' }}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim() || isStreaming}
          aria-label="Send message"
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            'border border-white/[0.06] bg-white/[0.04] text-foreground-muted',
            'transition-colors',
            'hover:bg-white/[0.08] hover:text-foreground',
            'disabled:opacity-30 disabled:cursor-not-allowed',
          )}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>

      {/* Demoted "+ New analysis" affordance */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleNewAnalysis}
          className="flex items-center gap-1 text-xs text-foreground-muted/60 transition-colors hover:text-foreground-muted"
        >
          <Plus className="h-3 w-3" />
          New analysis
        </button>
      </div>
    </div>
  );
}
