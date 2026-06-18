'use client';

/**
 * ChatThreadView — renders the open-chat surface for the user's open thread (Plan 05-03, Task 2).
 *
 * Renders two sources of markdown blocks:
 *  1. PERSISTED: markdown messages already in the thread (rehydrates on reload)
 *     → via MessageBlocks (D-14 double-validation, THREAD-07 proven).
 *  2. STREAMING: in-flight assistant turn from useChatStream (token-by-token).
 *
 * States:
 *  - EMPTY: no persisted turns + not streaming → empty-state heading + body copy (UI-SPEC verbatim)
 *  - STREAMING: shows aria-live status line + streamed markdown as it arrives
 *  - PERSISTED: shows prior turns rehydrated from the open thread
 *  - COLD-START NUDGE (D-08): one-time soft line when coldStart===true — gated by
 *    nudgeShown (sticky boolean from useChatStream, never reset) so it renders only once
 *    per session. Muted/secondary-cream styling, never coral.
 *  - ERROR (W2): inline notice when error is truthy. Clears on next successful start() call.
 *
 * Column: max-w-[760px] mx-auto gap-6, THEME-06 flat-warm, no glow.
 * Muted/secondary cream only for nudge + error — never coral (UI-SPEC §Color).
 * Markdown turns render through MarkdownBlockRenderer via MessageBlocks (not plain text).
 */

import { MessageBlocks } from '@/components/thread/message-blocks';
import type { MarkdownBlock } from '@/lib/tools/blocks';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ChatThreadViewProps {
  /** Validated markdown blocks from the persisted open thread (rehydration). */
  persistedBlocks: MarkdownBlock[];
  /** In-flight streamed turn (single MarkdownBlock or [] when idle). */
  streamingBlocks: MarkdownBlock[];
  /** True while the SSE stream is active. */
  isStreaming: boolean;
  /**
   * True when the meta frame carried coldStart=true (D-08).
   * Used to gate the nudge display (alongside nudgeShown).
   */
  coldStart: boolean;
  /**
   * Sticky session-level flag from useChatStream: once true, stays true.
   * Gates the one-time cold-start nudge render so it only shows once per session.
   */
  nudgeShown: boolean;
  /** Error string from useChatStream; null when no error. */
  error: string | null;
  /** Creator niche (interpolated into the cold-start nudge copy). */
  niche?: string;
  /** Current platform selection (interpolated into the cold-start nudge copy). */
  platform?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChatThreadView({
  persistedBlocks,
  streamingBlocks,
  isStreaming,
  nudgeShown,
  error,
  niche,
  platform,
}: ChatThreadViewProps) {
  const hasPersistedContent = persistedBlocks.length > 0;
  const hasStreamingContent = streamingBlocks.length > 0;
  const isEmpty = !isStreaming && !hasStreamingContent && !hasPersistedContent;

  // Interpolate niche/platform into the nudge copy, falling back to literal words
  const nicheLabel = niche && niche.trim() ? niche.trim() : 'your niche';
  const platformLabel = platform && platform.trim() ? platform.trim() : 'your platform';

  // Build raw body arrays for MessageBlocks (it expects unknown[])
  const persistedBody: unknown[] = persistedBlocks.map((b) => ({
    type: b.type,
    props: b.props,
  }));

  const streamingBody: unknown[] = streamingBlocks.map((b) => ({
    type: b.type,
    props: b.props,
  }));

  return (
    <div className="w-full max-w-[760px] mx-auto flex flex-col gap-6 px-4 py-6">

      {/* ── EMPTY STATE ──────────────────────────────────────────────────────── */}
      {/* Shown when there are no turns and we're not streaming yet */}
      {isEmpty && (
        <div className="flex flex-col gap-3 py-4">
          <h2 className="text-base font-semibold text-foreground leading-snug">
            Ask anything about your content.
          </h2>
          <p className="text-sm text-foreground-secondary leading-normal">
            Numen grounds every answer on your niche and your audience — not a generic chatbot.
            Try &ldquo;what should I post this week?&rdquo; or send an idea to test it.
          </p>
        </div>
      )}

      {/* ── ONE-TIME COLD-START NUDGE (D-08) ─────────────────────────────────── */}
      {/* Muted/secondary-cream styling only — never coral, no glow.
          nudgeShown is sticky (set once in useChatStream, never reset) — D-08 gate. */}
      {nudgeShown && (
        <p
          className="text-xs text-foreground-muted leading-normal py-1"
          aria-live="polite"
          aria-atomic="true"
        >
          {`Heads up — your profile is light, so I'm leaning on ${nicheLabel}/${platformLabel} baselines. Fill in your profile for sharper, you-specific reads.`}
        </p>
      )}

      {/* ── STREAMING STATUS ─────────────────────────────────────────────────── */}
      {isStreaming && !hasStreamingContent && (
        <p
          className="text-sm text-foreground-muted/70 text-center"
          aria-live="polite"
          aria-atomic="true"
        >
          Thinking…
        </p>
      )}

      {/* ── STREAMING TURN ───────────────────────────────────────────────────── */}
      {/* In-flight assistant turn — streams token-by-token via MarkdownBlockRenderer */}
      {hasStreamingContent && (
        <div
          className="flex flex-col gap-3"
          aria-live="polite"
          aria-atomic="false"
        >
          <MessageBlocks body={streamingBody} />
        </div>
      )}

      {/* ── PERSISTED TURNS ──────────────────────────────────────────────────── */}
      {/* Rehydrated from the open thread on reload */}
      {hasPersistedContent && (
        <div className="flex flex-col gap-3">
          {hasStreamingContent && (
            <div className="border-t border-white/[0.06] pt-4" />
          )}
          <MessageBlocks body={persistedBody} />
        </div>
      )}

      {/* ── CHAT-TURN ERROR STATE (W2) ────────────────────────────────────────── */}
      {/* Rendered below the last turn when error is truthy; clears on next send */}
      {/* Muted/secondary-cream inline notice — not a card, not coral */}
      {error && (
        <div
          className="flex flex-col gap-1 py-2"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-sm font-semibold text-foreground-secondary">
            {`That answer didn't come through.`}
          </p>
          <p className="text-xs text-foreground-muted">
            Send it again, or rephrase.
          </p>
        </div>
      )}
    </div>
  );
}
