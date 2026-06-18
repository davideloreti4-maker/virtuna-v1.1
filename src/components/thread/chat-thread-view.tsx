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
 *  - SUGGESTED CHAIN CTA (Plan 05-05 / D-05 / STUDIO-03): after a completed chat turn,
 *    renders a tappable "Turn this into hooks →" CTA sourced from chain-handoff.ts.
 *    CRITICAL: CTA NEVER auto-fires on render — only fires on explicit tap (onClick).
 *
 * Column: max-w-[760px] mx-auto gap-6, THEME-06 flat-warm, no glow.
 * Muted/secondary cream only for nudge + error — never coral (UI-SPEC §Color).
 * Chain CTA uses coral accent per UI-SPEC §Color (coral reserved for chain CTAs).
 * Markdown turns render through MarkdownBlockRenderer via MessageBlocks (not plain text).
 */

import { MessageBlocks } from '@/components/thread/message-blocks';
import type { MarkdownBlock } from '@/lib/tools/blocks';
import { handoffsFor } from '@/lib/tools/chain-handoff';

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
  /**
   * Called when the user taps a suggested chain-step CTA (Plan 05-05 / D-05 / STUDIO-03).
   * Receives the ctaLabel of the tapped handoff (e.g. "Turn this into hooks →").
   * CRITICAL: this handler fires ONLY on user tap (onClick), NEVER on render (D-05).
   */
  onSuggestChain?: (ctaLabel: string) => void;
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
  onSuggestChain,
}: ChatThreadViewProps) {
  const hasPersistedContent = persistedBlocks.length > 0;
  const hasStreamingContent = streamingBlocks.length > 0;
  const isEmpty = !isStreaming && !hasStreamingContent && !hasPersistedContent;

  // Suggested chain-step CTAs (D-05 / STUDIO-03): show after a chat turn completes.
  // Sourced from chain-handoff.ts (handoffsFor "chat" — but chat is not a SkillId,
  // so we use idea → hooks handoff as the canonical "next step" from a chat answer).
  // Only show when there is content (a completed chat turn) and not currently streaming.
  // CRITICAL: CTAs are NEVER auto-fired — they only render as tappable buttons.
  const hasCompletedTurn = !isStreaming && (hasStreamingContent || hasPersistedContent);
  // Get CTAs from the chain-handoff registry for the "idea" skill (idea → hooks is the
  // most relevant next step for a chat answer about content). Filter out placeholder
  // entries (endpoint: null + not the test/hooks chain steps that are actually wired).
  const suggestedCTAs = hasCompletedTurn && onSuggestChain
    ? handoffsFor('idea').filter((h) => h.endpoint !== null || h.to === 'hooks')
    : [];

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

      {/* ── SUGGESTED CHAIN-STEP CTA (Plan 05-05 / D-05 / STUDIO-03) ─────────── */}
      {/* Tappable only — NEVER auto-fires on render. Fires on explicit onClick tap. */}
      {/* Coral accent per UI-SPEC §Color (coral reserved for chain CTAs). */}
      {suggestedCTAs.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {suggestedCTAs.map((handoff) => (
            <button
              key={`${handoff.from}-${handoff.to}`}
              type="button"
              onClick={() => onSuggestChain?.(handoff.ctaLabel)}
              className={[
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5",
                "text-xs font-semibold leading-snug",
                "border border-accent/30 bg-accent/10 text-accent",
                "transition-colors hover:bg-accent/20 hover:border-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              ].join(" ")}
              aria-label={`Suggest: ${handoff.ctaLabel}`}
            >
              {handoff.ctaLabel}
            </button>
          ))}
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
