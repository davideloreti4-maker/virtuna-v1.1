'use client';

import { READING_LABEL } from './reading-section';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { cn } from '@/lib/utils';
import { useExpertChat, type ChatMessage } from '@/hooks/queries/use-expert-chat';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useIsMobileHydrated } from '@/hooks/useIsMobile';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

// Sidebar geometry — kept in sync with AppShell so the fixed composer aligns to the
// content column (and never sits under the persistent desktop sidebar).
const SIDEBAR_EXPANDED = 220;
const SIDEBAR_RAIL = 60;
const SIDEBAR_INSET = 12;
const CONTENT_GUTTER = 12;

// ─────────────────────────────────────────────────────────────────────────────
// ReadingChat — the persistent follow-up thread on /analyze/[id] (A3 UX fix).
//
// THE FIX: previously the only composer lived on /home and unmounted on submit,
// so the result screen had NO way to keep talking to the read. This mounts a
// real, interactable chat at the bottom of the Reading thread:
//   • the conversation flows INLINE in the 760px column (analysis = top of the
//     thread, follow-ups accumulate below),
//   • a composer stays sticky-pinned to the viewport bottom so it never vanishes.
//
// Reuses the battle-tested `useExpertChat` SSE engine (board-free) + the grounded
// Qwen endpoint /api/analyze/[id]/chat. Deliberately does NOT pull in the board
// CommandBar's ExpertChatInput/Thread (those are board-store-coupled, fixed-height
// dock, "Apollo"-branded, coral-Raycast). This is flat-warm + inline by design.
// ─────────────────────────────────────────────────────────────────────────────

const SEED_PROMPTS = [
  'Why do viewers drop off?',
  'How do I fix the hook?',
  'What would make this more shareable?',
];

/** Strip the internal `FRAME:<name>` directive the grounded model emits for the
 *  (retired) board camera-jump — it's a machine tag, never meant to render as the
 *  trailing line of an answer in the reading thread. */
function stripChatArtifacts(content: string): string {
  return content.replace(/\n?\s*FRAME:[^\n]*\s*$/i, '').trimEnd();
}

export interface ReadingChatProps {
  /** The current analysis id — the chat is grounded on this cached row. */
  analysisId: string;
}

export function ReadingChat({ analysisId }: ReadingChatProps) {
  const { messages, streamingText, isStreaming, error, send, stop } = useExpertChat({
    analysisId,
  });
  const [value, setValue] = useState('');
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  // Match AppShell's content offset so the fixed composer aligns to the column.
  const { isCollapsed } = useSidebarStore();
  const { isMobile, hydrated } = useIsMobileHydrated();
  const reducedMotion = usePrefersReducedMotion();
  const treatAsMobile = hydrated && isMobile;
  const leftOffset = treatAsMobile
    ? 0
    : SIDEBAR_INSET + (isCollapsed ? SIDEBAR_RAIL : SIDEBAR_EXPANDED) + CONTENT_GUTTER;

  const hasThread = messages.length > 0 || isStreaming || !!error;

  // Keep the latest turn in view above the pinned composer.
  useEffect(() => {
    if (!hasThread) return;
    endRef.current?.scrollIntoView({ block: 'end', behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [messages.length, streamingText, hasThread, reducedMotion]);

  // Auto-grow the textarea up to a ceiling, then scroll internally.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    // Only pin an explicit height when there IS content. Pinning while empty
    // captures a pre-hydration scrollHeight: the fixed dock mounts at the
    // DESKTOP leftOffset (useIsMobileHydrated starts false), so on a phone the
    // placeholder wraps inside a ~90px-wide box and locks 140px onto an empty
    // field — and [value] alone never re-measures it. leftOffset in the deps
    // re-measures typed content when the sidebar toggles the dock's width.
    if (value) ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }, [value, leftOffset]);

  const submit = useCallback(() => {
    const t = value.trim();
    if (!t || isStreaming) return;
    void send(t);
    setValue('');
    requestAnimationFrame(() => taRef.current?.focus());
  }, [value, isStreaming, send]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [submit],
  );

  // Seed a quick-prompt INTO the composer (P5 behavior, kept over fire-immediately):
  // the user can edit before sending, and the chips stay available for every turn.
  const seedPrompt = useCallback((prompt: string) => {
    setValue(prompt);
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      // Drop the caret at the end so editing continues naturally.
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });
  }, []);

  return (
    <section data-testid="reading-chat" className="flex flex-col gap-5">
      {/* section eyebrow — same quiet-uppercase spec as ReadingSection's label
          (10px/0.14em); the hairline is dropped so every section label on the
          surface carries one grammar. */}
      <p className={`ml-0.5 ${READING_LABEL}`}>
        Ask anything
      </p>

      {/* ── thread (inline, flows in the column) ── */}
      {hasThread && (
        <div className="flex flex-col gap-5" data-testid="reading-chat-thread">
          {messages.map((m, i) => (
            <ChatBubble key={i} message={m} />
          ))}
          {isStreaming && streamingText && (
            <ChatBubble message={{ role: 'assistant', content: streamingText }} streaming />
          )}
          {isStreaming && !streamingText && <Thinking />}
          {error && (
            <p className="rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-xs text-warning">
              {error}
            </p>
          )}
        </div>
      )}

      {/* seed prompt chips — seed the composer (editable) and stay available for
          every turn, so a quick prompt is always a tap away. */}
      <div className="flex flex-wrap gap-2" data-testid="reading-chat-seeds">
        {SEED_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => seedPrompt(p)}
            className="rounded-full border border-[var(--color-border)] bg-white/[0.02] px-3 py-1.5 text-[13px] text-foreground-secondary transition-colors hover:bg-white/[0.05] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/10"
          >
            {p}
          </button>
        ))}
      </div>

      {/* scroll anchor — keeps the latest turn visible above the fixed composer */}
      <div ref={endRef} aria-hidden className="h-0" />

      {/* ── composer — FIXED to the viewport bottom, aligned to the content column,
          always visible (never scrolls away). Offset matches AppShell's sidebar gutter. ── */}
      <div
        data-testid="reading-chat-composer"
        className="fixed bottom-0 right-0 z-20"
        style={{
          left: `${leftOffset}px`,
          transition: reducedMotion ? undefined : 'left 150ms var(--ease-out-cubic)',
        }}
      >
        {/* fade so column content dissolves cleanly as it scrolls under the composer */}
        <div
          aria-hidden
          className="pointer-events-none h-8"
          style={{ background: 'linear-gradient(to top, var(--color-background), transparent)' }}
        />
        <div className="bg-background px-4 pb-4">
          <div className="mx-auto max-w-[600px]">
            <div className="rounded-2xl border border-white/[0.06] bg-surface-elevated p-2.5 shadow-float">
              <div className="flex items-end gap-2">
                <textarea
                  ref={taRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  placeholder="Ask about this simulation…"
                  aria-label="Ask about this simulation"
                  className="min-h-[24px] max-h-[140px] min-w-0 flex-1 resize-none bg-transparent px-1 py-1.5 text-base leading-relaxed text-foreground placeholder:text-foreground-muted focus:outline-none"
                />
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={stop}
                    aria-label="Stop"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.04] text-foreground-muted transition-colors hover:bg-white/[0.1] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={value.trim().length === 0}
                    aria-label="Send"
                    className={cn(
                      // Round send disc — the #219 composer grammar (the cream disc
                      // is the one bright thing; /home renders the same 36px circle).
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10',
                      value.trim().length > 0
                        ? 'bg-action text-action-foreground hover:bg-action/90'
                        : 'cursor-not-allowed border border-white/[0.06] bg-white/[0.03] text-foreground-muted/50',
                    )}
                  >
                    <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.25} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

ReadingChat.displayName = 'ReadingChat';

// ── ChatBubble ───────────────────────────────────────────────────────────────

function ChatBubble({
  message,
  streaming = false,
}: {
  message: Pick<ChatMessage, 'role' | 'content'>;
  streaming?: boolean;
}) {
  const isUser = message.role === 'user';
  if (isUser) {
    return (
      <div className="flex justify-end">
        <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-white/[0.055] px-3.5 py-2 text-[15px] leading-relaxed text-foreground">
          {message.content}
        </p>
      </div>
    );
  }
  const content = stripChatArtifacts(message.content);
  return (
    <div className="flex flex-col gap-1">
      <span className={READING_LABEL}>
        Maven
      </span>
      {/* `.md` (globals.css) owns the markdown structure. It replaces both the dead
          `reading-chat-prose` class (never defined anywhere) and the hand-rolled element
          overrides that used to live here — those forced EVERY list item to a dot span,
          so an ordered list rendered as identical bullets and "1. 2. 3." lost its numbers
          on the surface that most needs to enumerate steps. The host keeps the type scale
          (15px / secondary / 68ch); the layer restores what Preflight strips. */}
      <div className="md max-w-[68ch] text-[15px] leading-relaxed text-foreground-secondary">
        <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{content}</ReactMarkdown>
        {streaming && (
          <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse rounded-full bg-foreground-muted/60 align-middle" aria-hidden />
        )}
      </div>
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex items-center gap-1.5 text-xs text-foreground-muted">
      <span>Reading</span>
      <span className="flex gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1 w-1 animate-pulse rounded-full bg-foreground-muted/60"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
    </div>
  );
}
