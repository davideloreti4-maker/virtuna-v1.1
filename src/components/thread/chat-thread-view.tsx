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

import { Fragment } from 'react';
import { MessageBlocks } from '@/components/thread/message-blocks';
import { ThreadShell, ThreadAssistantTurn, ThreadUserTurn } from '@/components/thread/thread-shell';
import { ChatTypingIndicator } from '@/components/thread/thread-loading';
import { ProgressChecklist, type StageState } from '@/components/thread/progress-checklist';
import type { MarkdownBlock } from '@/lib/tools/blocks';
import type { RehydrateTurn } from '@/components/app/home/rehydrate-thread';
import { handoffsFor } from '@/lib/tools/chain-handoff';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ChatThreadViewProps {
  /** Validated markdown blocks from the persisted open thread (rehydration). */
  persistedBlocks: MarkdownBlock[];
  /**
   * Chat-as-agent reload (CHAT_AGENT_DISPATCH): the thread's ordered TURNS — each the user's question
   * plus the assistant blocks (cards + co-pilot line) it produced. When non-empty it REPLACES the
   * markdown-only `persistedBlocks` as the persisted body, so a reloaded multi-turn chat-run renders
   * as one question-per-card thread here (not one mega-card, and not split into the per-tool views).
   * Empty for a normal chat thread → the markdown-only path is unchanged. Blocks stay loosely typed
   * (MessageBlocks re-validates each on render).
   */
  persistedTurns?: RehydrateTurn[];
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
  /**
   * Chat-as-agent (CHAT_AGENT_DISPATCH) — live pipeline stages from a dispatched skill's real phase
   * boundaries (event: stage), in emit order. Empty on a plain chat turn. While a skill is running
   * (streaming + stages present, before its cards land) these render as the progress SPINE in place
   * of the typing dots, so the ~20–65s generator wait reads like the per-skill views instead of a
   * silent typing cursor. Legacy (no `plan` seed): chat cannot know which of ideas/hooks/script the
   * model will pick, so the spine grows from live events rather than pre-seeding a pipeline that
   * might diverge (e.g. script never emits Ranking → a seeded step would hang `pending`).
   */
  stages?: StageState[];
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
  persistedTurns = [],
  streamingBlocks,
  streamingCardBlocks = [],
  stages = [],
  isStreaming,
  nudgeShown,
  error,
  niche,
  platform,
  onSuggestChain,
  userTurn,
}: ChatThreadViewProps) {
  // Unified chat-agent reload: the ordered TURNS (each question + its cards/co-pilot line) REPLACE the
  // markdown-only persisted body when present. A normal chat thread has no turns → markdown-only path,
  // byte-identical to the shipped chat.
  const hasPersistedTurns = persistedTurns.length > 0;
  // The markdown-only persisted body is the original chat path; it is NOT used when per-turn data is
  // present (the chat-agent thread also populates persistedBlocks with its markdown, but the turns are
  // the complete, correctly-attributed source, so they win — matching the old stream-wins precedence).
  const showMarkdownBody = !hasPersistedTurns && persistedBlocks.length > 0;
  const hasPersistedContent = hasPersistedTurns || persistedBlocks.length > 0;
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

  // Build raw body arrays for MessageBlocks (it expects unknown[]). The markdown-only path maps its
  // blocks; the per-turn path passes each turn's blocks verbatim below. MessageBlocks re-validates
  // every block either way (D-14).
  const persistedMarkdownBody: unknown[] = persistedBlocks.map((b) => ({ type: b.type, props: b.props }));

  const streamingBody: unknown[] = streamingBlocks.map((b) => ({
    type: b.type,
    props: b.props,
  }));

  // The live turn (streaming) renders as a distinct turn AFTER any persisted turns, with its own
  // question bubble. On a pure reload (no streaming) the persisted turns already include the last
  // turn's question, so no live turn renders → no duplicate bubble. The markdown-only reload also
  // renders through this block (its question comes from `userTurn`).
  // A dispatched skill (CHAT_AGENT_DISPATCH) is mid-run when the stream has emitted real pipeline
  // stages but its cards (produced at the END of the run) have not arrived yet. Its live spine
  // replaces the typing dots for the long generator wait; once cards land the run is effectively
  // done and the cards + co-pilot line carry the turn. The pivot is CARDS, not text: the model may
  // stream a short preamble BEFORE it calls the tool, so gating on !hasStreamingContent would
  // suppress the spine for the whole run and silently re-open the very gap this closes.
  const runningSkill = isStreaming && stages.length > 0 && !hasStreamingCards;
  // Pure-chat "thinking" dots: streaming with nothing yet AND no skill running (stages empty). A
  // grounded/plain chat turn emits no stages → this is byte-identical to the shipped behavior.
  const thinking = isStreaming && !hasStreamingContent && !hasStreamingCards && stages.length === 0;
  const showLiveTurn = isStreaming || hasStreamingContent || hasStreamingCards || showMarkdownBody;
  const liveQuestion = userTurn?.trim();

  return (
    // Premium chat surface (Claude/Perplexity-native): assistant answers read as clean prose under a
    // quiet "Maven" label — NO bordered result-card, NO "Chat · General" header. Only real skill
    // outputs (idea/hook/script cards) carry card chrome, and those blocks self-frame. Idle is not this
    // view's business — the starter (home-starter.tsx) owns the empty state; this view owns turns,
    // nudge, error. User bubbles are owned per-turn inside children, so ThreadShell's top bubble is off.
    <ThreadShell userTurn={undefined}>
      {nudgeShown && (
        <p
          className="text-xs text-foreground-muted leading-normal py-1"
          aria-live="polite"
          aria-atomic="true"
        >
          {`Heads up — your profile is light, so I'm leaning on ${nicheLabel}/${platformLabel} baselines. Fill in your profile for sharper, you-specific reads.`}
        </p>
      )}

      {/* PERSISTED: one question-bubble + one clean assistant turn PER turn, in order (multi-turn
          reload fidelity). Turn boundaries preserved → each question sits above only its own answer. */}
      {hasPersistedTurns &&
        persistedTurns.map((turn, i) => (
          <Fragment key={i}>
            {turn.userTurn?.trim() && <ThreadUserTurn text={turn.userTurn.trim()} />}
            {turn.blocks.length > 0 && (
              <ThreadAssistantTurn>
                <MessageBlocks body={turn.blocks} />
              </ThreadAssistantTurn>
            )}
          </Fragment>
        ))}

      {/* LIVE turn (in-flight stream) + the markdown-only reload fallback. Renders its own question
          bubble from `userTurn`, then the assistant turn: a typing indicator while thinking, then the
          streamed cards/prose as they arrive. On a pure reload showLiveTurn is false. */}
      {showLiveTurn && (
        <>
          {liveQuestion && <ThreadUserTurn text={liveQuestion} />}
          <ThreadAssistantTurn>
            {thinking && <ChatTypingIndicator />}
            {runningSkill && (
              // Chat-as-agent (CHAT_AGENT_DISPATCH): the dispatched skill's live progress spine, so
              // the long generator wait reads like the per-skill views instead of silent dots. Legacy
              // mode (no plan seed) — the skill is the model's choice, unknowable at mount.
              <div aria-live="polite" aria-atomic="false">
                <ProgressChecklist stages={stages} />
              </div>
            )}
            {hasStreamingCards && (
              // Chat-as-agent (CHAT_AGENT_DISPATCH): the dispatched skill's real cards, inline in this
              // thread, ABOVE the co-pilot line. The cards self-frame; MessageBlocks re-validates each.
              <div aria-live="polite" aria-atomic="false">
                <MessageBlocks body={streamingCardBlocks} />
              </div>
            )}
            {hasStreamingContent && (
              <div aria-live="polite" aria-atomic="false">
                <MessageBlocks body={streamingBody} />
              </div>
            )}
            {showMarkdownBody && <MessageBlocks body={persistedMarkdownBody} />}
          </ThreadAssistantTurn>
        </>
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
