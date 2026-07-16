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
import { ThreadShell, ThreadAssistantTurn } from '@/components/thread/thread-shell';
import { SkillResultCard } from '@/components/thread/skill-result-card';
import { ThreadLoadingSkeleton } from '@/components/thread/thread-loading';
import type { MarkdownBlock } from '@/lib/tools/blocks';
import { handoffsFor } from '@/lib/tools/chain-handoff';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ChatThreadViewProps {
  /** Validated markdown blocks from the persisted open thread (rehydration). */
  persistedBlocks: MarkdownBlock[];
  /**
   * Chat-as-agent reload (CHAT_AGENT_DISPATCH): the FULL ordered assistant block stream for a thread
   * produced by chat-as-agent — cards + co-pilot lines interleaved in message order. When non-empty it
   * REPLACES the markdown-only `persistedBlocks` as the persisted body, so a reloaded chat-run ideas
   * set renders as one thread here (not split into the ideas view). Empty for a normal chat thread →
   * the markdown-only path is unchanged. Raw blocks (MessageBlocks re-validates each) → loosely typed.
   */
  persistedStream?: unknown[];
  /** In-flight streamed turn (single MarkdownBlock or [] when idle). */
  streamingBlocks: MarkdownBlock[];
  /**
   * Chat-as-agent (CHAT_AGENT_DISPATCH) — card-blocks a dispatched skill produced this turn, in
   * arrival order. Rendered via MessageBlocks (every card type has a renderer) ABOVE the closing
   * co-pilot line, so a chat-run ideas/hooks/script shows its real cards in this same thread. Empty
   * on a plain chat turn → this view is byte-identical to the shipped markdown-only chat. Raw
   * blocks (MessageBlocks re-validates each), so the type is intentionally loose.
   */
  streamingCardBlocks?: unknown[];
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
  /** Optimistic echo of the user's submitted prompt (presentation-only). */
  userTurn?: string | null;
  /** Active skill label for result chrome (passed from composer). */
  skillLabel?: string;
  /** Active audience name for result chrome (passed from composer). */
  audienceLabel?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChatThreadView({
  persistedBlocks,
  persistedStream = [],
  streamingBlocks,
  streamingCardBlocks = [],
  isStreaming,
  nudgeShown,
  error,
  niche,
  platform,
  onSuggestChain,
  userTurn,
  skillLabel = 'Chat',
  audienceLabel = 'General',
}: ChatThreadViewProps) {
  // Unified chat-agent reload: the ordered stream (cards + co-pilot lines) REPLACES the markdown-only
  // persisted body when present. A normal chat thread has an empty stream → markdown-only, unchanged.
  const hasPersistedStream = persistedStream.length > 0;
  const hasPersistedContent = hasPersistedStream || persistedBlocks.length > 0;
  const hasStreamingContent = streamingBlocks.length > 0;
  // Chat-as-agent skill cards streamed this turn (CHAT_AGENT_DISPATCH). Drive the result-card
  // gate too, so a dispatched run that produced ONLY cards (co-pilot line still streaming) shows.
  const hasStreamingCards = streamingCardBlocks.length > 0;

  // Suggested chain-step CTAs (D-05 / STUDIO-03): show after a chat turn completes.
  // Sourced from chain-handoff.ts (handoffsFor "chat" — but chat is not a SkillId,
  // so we use idea → hooks handoff as the canonical "next step" from a chat answer).
  // Only show when there is content (a completed chat turn) and not currently streaming.
  // CRITICAL: CTAs are NEVER auto-fired — they only render as tappable buttons.
  const hasCompletedTurn = !isStreaming && (hasStreamingContent || hasStreamingCards || hasPersistedContent);
  // Get CTAs from the chain-handoff registry for the "idea" skill (idea → hooks is the
  // most relevant next step for a chat answer about content). Filter out placeholder
  // entries (endpoint: null + not the test/hooks chain steps that are actually wired).
  const suggestedCTAs = hasCompletedTurn && onSuggestChain
    ? handoffsFor('idea').filter((h) => h.endpoint !== null || h.to === 'hooks')
    : [];

  // Interpolate niche/platform into the nudge copy, falling back to literal words
  const nicheLabel = niche && niche.trim() ? niche.trim() : 'your niche';
  const platformLabel = platform && platform.trim() ? platform.trim() : 'your platform';

  // Build raw body arrays for MessageBlocks (it expects unknown[]). A unified chat-agent reload passes
  // the ordered stream verbatim; a normal chat thread maps its markdown blocks. MessageBlocks
  // re-validates every block either way (D-14).
  const persistedBody: unknown[] = hasPersistedStream
    ? persistedStream
    : persistedBlocks.map((b) => ({ type: b.type, props: b.props }));

  const streamingBody: unknown[] = streamingBlocks.map((b) => ({
    type: b.type,
    props: b.props,
  }));

  return (
    // Idle is NOT this view's business any more. Chat's empty state was a left-aligned
    // prose block that matched nothing else in the app; it now comes from the ONE starter
    // (home-starter.tsx — THE STARTER CONTRACT), rendered by the composer alongside every
    // other skill's. This view owns only what it produces: turns, nudge, error.
    <ThreadShell userTurn={userTurn}>
      {nudgeShown && (
        <p
          className="text-xs text-foreground-muted leading-normal py-1"
          aria-live="polite"
          aria-atomic="true"
        >
          {`Heads up — your profile is light, so I'm leaning on ${nicheLabel}/${platformLabel} baselines. Fill in your profile for sharper, you-specific reads.`}
        </p>
      )}

      {isStreaming && !hasStreamingContent && !hasStreamingCards && <ThreadLoadingSkeleton variant="chat" />}

      {(hasStreamingContent || hasStreamingCards || hasPersistedContent) && (
        <ThreadAssistantTurn>
          <SkillResultCard skillLabel={skillLabel} audienceLabel={audienceLabel}>
            {hasStreamingCards && (
              // Chat-as-agent (CHAT_AGENT_DISPATCH): the dispatched skill's real cards, inline in
              // this thread, ABOVE the co-pilot line. MessageBlocks re-validates every block.
              <div aria-live="polite" aria-atomic="false">
                <MessageBlocks body={streamingCardBlocks} />
              </div>
            )}
            {hasStreamingContent && (
              <div aria-live="polite" aria-atomic="false">
                <MessageBlocks body={streamingBody} />
              </div>
            )}
            {hasPersistedContent && (
              <>
                {hasStreamingContent && (
                  <div className="border-t border-white/[0.06] pt-4" />
                )}
                <MessageBlocks body={persistedBody} />
              </>
            )}
          </SkillResultCard>
        </ThreadAssistantTurn>
      )}

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
                "border border-border-hover bg-hover text-foreground",
                "transition-colors hover:bg-active hover:border-border-hover",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              ].join(" ")}
              aria-label={`Suggest: ${handoff.ctaLabel}`}
            >
              {handoff.ctaLabel}
            </button>
          ))}
        </div>
      )}

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
    </ThreadShell>
  );
}
