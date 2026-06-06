/**
 * ExpertChatThread — upward-expanding fixed DOM overlay for the "Ask the expert" chat.
 *
 * Positioned above the CommandBar dock. Never touches the Konva canvas — it is a
 * DOM overlay so it survives board pan/zoom with no reflow.
 *
 * Desktop: fixed, bottom-anchored above the bar, max-height ~60vh, internal scroll.
 * Mobile (<768px): full-height sheet (triggered by parent controlling isExpanded).
 *
 * Raycast styling: glass gradient + border-white/[0.06], 12px radius, inset shadow.
 */

'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/hooks/queries/use-expert-chat';

interface ExpertChatThreadProps {
  messages: ChatMessage[];
  streamingText: string;
  isStreaming: boolean;
  error: string | null;
  /** Whether the thread is visible / expanded. */
  isExpanded: boolean;
  /** Bottom offset in px (e.g. CommandBar height + gap) for positioning. */
  bottomOffset: number;
}

export function ExpertChatThread({
  messages,
  streamingText,
  isStreaming,
  error,
  isExpanded,
  bottomOffset,
}: ExpertChatThreadProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to newest message / streaming chunk
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streamingText]);

  if (!isExpanded || (messages.length === 0 && !isStreaming && !error)) return null;

  return (
    <div
      className={cn(
        // Desktop: fixed above the CommandBar, matching its width
        'fixed left-1/2 -translate-x-1/2 z-[199]',
        // Mobile: full-height sheet anchored to bottom
        'max-sm:left-0 max-sm:right-0 max-sm:translate-x-0 max-sm:max-h-none',
        'pointer-events-auto',
      )}
      style={{
        bottom: `${bottomOffset}px`,
        width: 'min(720px, calc(100vw - 32px))',
        // Desktop: ~60vh max; Mobile: full height via CSS override below
        maxHeight: 'min(60vh, calc(100dvh - 120px))',
      }}
    >
      {/* Glass panel — Raycast gradient + border + inset shadow per CLAUDE.md */}
      <div
        className="flex flex-col rounded-xl border border-white/[0.06] overflow-hidden"
        style={{
          background:
            'linear-gradient(137deg, rgba(17,18,20,0.92) 4.87%, rgba(12,13,15,0.97) 75.88%)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          boxShadow: 'rgba(255,255,255,0.15) 0 1px 1px 0 inset, 0 4px 24px rgba(0,0,0,0.4)',
        }}
      >
        {/* Thread scroll area */}
        <div
          ref={scrollRef}
          className="overflow-y-auto overscroll-contain px-4 py-3 flex flex-col gap-3"
          style={{ maxHeight: 'min(60vh, calc(100dvh - 120px))' }}
        >
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          {/* Live streaming token display */}
          {isStreaming && streamingText && (
            <MessageBubble
              message={{ role: 'assistant', content: streamingText }}
              isStreaming
            />
          )}

          {/* Loading indicator while waiting for first token */}
          {isStreaming && !streamingText && (
            <div className="flex items-center gap-1.5 pl-1">
              <span className="text-xs text-foreground-muted">Apollo is thinking</span>
              <StreamingDots />
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: Pick<ChatMessage, 'role' | 'content'>;
  isStreaming?: boolean;
}

function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex flex-col gap-0.5',
        isUser ? 'items-end' : 'items-start',
      )}
    >
      <span
        className={cn(
          'text-[10px] font-medium tracking-wide uppercase',
          isUser ? 'text-foreground-muted' : 'text-coral/70',
        )}
      >
        {isUser ? 'You' : 'Apollo'}
      </span>
      <div
        className={cn(
          'max-w-[88%] rounded-lg px-3 py-2 text-sm leading-relaxed',
          isUser
            ? 'bg-white/[0.06] text-foreground'
            : 'bg-coral/[0.08] border border-coral/[0.12] text-foreground',
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {isStreaming && (
          <span
            className="ml-0.5 inline-block h-3 w-0.5 animate-pulse rounded-full bg-coral/60"
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}

function StreamingDots() {
  return (
    <span className="flex gap-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1 w-1 rounded-full bg-foreground-muted/60 animate-pulse"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}
