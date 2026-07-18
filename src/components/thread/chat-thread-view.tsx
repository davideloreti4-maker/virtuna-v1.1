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
 *  - FOLLOW-UP CHIPS (chat-followups.ts): after a completed chat turn, renders 2–3 tappable
 *    suggestions keyed off WHAT ACTUALLY RAN this turn (a script turn offers script moves, a plain
 *    answer offers the generative entry points). Tapping SENDS A NEW CHAT MESSAGE into the SAME
 *    thread (onFollowup) — the agent routes it. This replaces the retired chain-handoff CTA that
 *    always showed the idea handoff and switched the active tool away from chat (losing the topic).
 *    CRITICAL: a chip NEVER auto-fires on render — it only fires on explicit tap (onClick), D-05.
 *
 * Column: max-w-[760px] mx-auto gap-6, THEME-06 flat-warm, no glow.
 * Muted/secondary cream only for nudge + error — never coral (UI-SPEC §Color).
 * Markdown turns render through MarkdownBlockRenderer via MessageBlocks (not plain text).
 */

import { Fragment } from 'react';
import { MessageBlocks } from '@/components/thread/message-blocks';
import { ThreadShell, ThreadAssistantTurn, ThreadUserTurn } from '@/components/thread/thread-shell';
import { ChatTypingIndicator } from '@/components/thread/thread-loading';
import { ProgressChecklist, type StageState } from '@/components/thread/progress-checklist';
import type { MarkdownBlock } from '@/lib/tools/blocks';
import type { RehydrateTurn } from '@/components/app/home/rehydrate-thread';
import { followupsForTurn, blockTypesOf } from '@/lib/tools/chat-followups';

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
   * Called when the user taps a follow-up chip (chat-followups.ts). Receives the PROMPT to send
   * into the chat thread (e.g. "Give me a few more ideas along these lines.") — the composer wires
   * this to chat.start, so the turn continues in the SAME thread and the agent routes it.
   * CRITICAL: this handler fires ONLY on user tap (onClick), NEVER on render (D-05).
   */
  onFollowup?: (prompt: string) => void;
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
  onFollowup,
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

  // Follow-up chips (D-05): show after a chat turn completes, keyed off WHAT RAN this turn.
  // Only show when there is content (a completed chat turn) and not currently streaming.
  // CRITICAL: chips are NEVER auto-fired — they only render as tappable buttons.
  const hasCompletedTurn = !isStreaming && (hasStreamingContent || hasStreamingCards || hasPersistedContent);
  // The just-completed turn's blocks: prefer the live turn's streamed cards/prose when still present
  // (the window before the isDone effect swaps it into persistedTurns); else the LAST persisted turn;
  // else the markdown-only bucket. Its block types decide which follow-ups fit (script vs ideas vs
  // a plain answer) — the retired CTA ignored this and always showed the idea handoff.
  const lastTurnBlocks: unknown[] =
    hasStreamingCards || hasStreamingContent
      ? [...streamingCardBlocks, ...streamingBlocks]
      : hasPersistedTurns
        ? persistedTurns[persistedTurns.length - 1]?.blocks ?? []
        : persistedBlocks;
  const followups = hasCompletedTurn && onFollowup ? followupsForTurn(blockTypesOf(lastTurnBlocks)) : [];

  // Interpolate niche/platform into the nudge copy, falling back to literal words
  const nicheLabel = niche && niche.trim() ? niche.trim() : 'your niche';
  const platformLabel = platform && platform.trim() ? platform.trim() : 'your platform';

  // Build raw body arrays for MessageBlocks (it expects unknown[]). The markdown-only path maps its
  // blocks; the per-turn path passes each turn's blocks verbatim below. MessageBlocks re-validates
  // every block either way (D-14).
  const persistedMarkdownBody: unknown[] = persistedBlocks.map((b) => ({ type: b.type, props: b.props }));

  // ── The ambient room's scroll-spy anchor offsets ────────────────────────────────────────────
  // The room's chat ledger (composer.tsx → buildAmbientDescriptors) is the FLAT concat, in DOM
  // order: [...persistedTurns.flatMap(t => t.blocks), ...streamingCardBlocks]. Card ids are that
  // array's indices, so each body below must render with its own offset into it — otherwise a card
  // carries another card's id and the room reads out the wrong reaction.
  // `persistedBlocks` (the markdown-only reload path) is NOT in the ledger and gets no offset.
  const persistedBaseIndex = (turnIndex: number) =>
    persistedTurns.slice(0, turnIndex).reduce((n, t) => n + t.blocks.length, 0);
  const streamingCardsBaseIndex = persistedBaseIndex(persistedTurns.length);

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
                {/* Scroll-spy anchors: the room's chat ledger is the FLAT concat
                    `[...persistedTurns.flatMap(t => t.blocks), ...streamingCardBlocks]`, so this
                    turn's blocks start after every earlier turn's. */}
                <MessageBlocks body={turn.blocks} ambientBaseIndex={persistedBaseIndex(i)} />
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
                <MessageBlocks
                  body={streamingCardBlocks}
                  ambientBaseIndex={streamingCardsBaseIndex}
                />
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

      {followups.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1" data-testid="chat-followups">
          {followups.map((followup) => (
            <button
              key={followup.label}
              type="button"
              onClick={() => onFollowup?.(followup.prompt)}
              className={[
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5",
                "text-xs font-semibold leading-snug",
                "border border-border-hover bg-hover text-foreground",
                "transition-colors hover:bg-active hover:border-border-hover",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              ].join(" ")}
              aria-label={`Follow up: ${followup.label}`}
            >
              {followup.label}
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
