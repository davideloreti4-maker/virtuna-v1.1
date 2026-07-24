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

import { MessageBlocks } from '@/components/thread/message-blocks';
import { ThreadShell, ThreadAssistantTurn, ThreadUserTurn } from '@/components/thread/thread-shell';
import { ChatTypingIndicator } from '@/components/thread/thread-loading';
import { type StageState } from '@/components/thread/progress-checklist';
import { SkillRunCapsule } from '@/components/thread/run-capsule';
import type { MarkdownBlock } from '@/lib/tools/blocks';
import type { RehydrateTurn } from '@/components/app/home/rehydrate-thread';
import { followupsForTurn, blockTypesOf } from '@/lib/tools/chat-followups';
import { FollowupRow } from '@/components/thread/followup-row';

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
   * silent typing cursor. With a `dispatchedSkill` the capsule seeds that skill's real plan; without
   * one (legacy stream) the spine grows from live events rather than pre-seeding a pipeline that
   * might diverge (e.g. script never emits Ranking → a seeded step would hang `pending`).
   */
  stages?: StageState[];
  /**
   * The skill the agent committed to this turn (the `dispatch` SSE event — display key
   * 'ideas' | 'hooks' | 'script' | …), or null before any dispatch / on a plain chat turn.
   * Labels the run capsule ("Writing hooks — for {audience}") + seeds its stage plan, and keeps
   * the collapsed ✓ receipt above the cards after the run — the same run grammar as the
   * per-skill thread views.
   */
  dispatchedSkill?: string | null;
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
  dispatchedSkill = null,
  isStreaming,
  nudgeShown,
  error,
  niche,
  platform,
  onFollowup,
  userTurn,
  audienceLabel,
}: ChatThreadViewProps) {
  // Unified chat-agent reload: the ordered TURNS (each question + its cards/co-pilot line) REPLACE the
  // markdown-only persisted body when present. A normal chat thread has no turns → markdown-only path,
  // byte-identical to the shipped chat.
  const hasPersistedTurns = persistedTurns.length > 0;
  // Thread-unification Phase 2: this view NO LONGER renders persisted history — PersistedThreadStream
  // owns it, once, for every thread. persistedTurns/persistedBlocks survive here ONLY to (a) key the
  // follow-up chips off the last completed turn and (b) gate the "a completed turn exists" signal, so
  // the chips still render after the live turn swaps into the persisted stream.
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

  // ── The ambient room's scroll-spy anchor offset for the LIVE streaming cards ────────────────
  // The room's chat ledger (composer.tsx → buildAmbientDescriptors) is the FLAT concat, in DOM
  // order: [...persistedTurns.flatMap(t => t.blocks), ...streamingCardBlocks]. The persisted turns
  // are rendered (and anchored) by PersistedThreadStream now; this view renders only the live turn,
  // whose streamed cards sit AFTER every persisted block — so their base offset is the total count
  // of persisted blocks. Keeping this offset (not zero) preserves each live card's ledger id.
  const streamingCardsBaseIndex = persistedTurns.reduce((n, t) => n + t.blocks.length, 0);

  const streamingBody: unknown[] = streamingBlocks.map((b) => ({
    type: b.type,
    props: b.props,
  }));

  // The live turn (streaming) renders as a distinct turn AFTER any persisted turns, with its own
  // question bubble. On a pure reload (no streaming) the persisted turns already include the last
  // turn's question, so no live turn renders → no duplicate bubble. The markdown-only reload also
  // renders through this block (its question comes from `userTurn`).
  // The RUN CAPSULE (run-capsule.tsx) — a skill was involved this turn when the agent announced a
  // dispatch OR stage events arrived (legacy streams have no dispatch frame). The capsule is LIVE
  // (label + spine) until this run's stages all land `done` — the beat where the pipeline hands
  // over to cards — then collapses to the ✓ receipt that stays above the cards for the turn.
  // stages.length === 0 counts as live because a fresh dispatch CLEARS the stage list (a second
  // run in one turn starts its own spine) and the first stage event is still in flight.
  const skillInvolved = dispatchedSkill != null || stages.length > 0;
  const runLive =
    isStreaming && (stages.length === 0 || stages.some((s) => s.status !== 'done'));
  const showCapsule = skillInvolved && (runLive || stages.length > 0);
  // Pure-chat "thinking" dots: streaming with nothing yet AND no skill involved. A grounded/plain
  // chat turn emits no stages and no dispatch → this is byte-identical to the shipped behavior.
  const thinking = isStreaming && !hasStreamingContent && !hasStreamingCards && !skillInvolved;
  const showLiveTurn = isStreaming || hasStreamingContent || hasStreamingCards;
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

      {/* Persisted history is rendered by PersistedThreadStream (thread-unification Phase 2), once, for
          every thread — NOT here. This view owns only the live/in-flight turn plus the nudge, error, and
          follow-up chips. */}

      {/* LIVE turn (in-flight stream). Renders its own question
          bubble from `userTurn`, then the assistant turn: a typing indicator while thinking, then the
          streamed cards/prose as they arrive. On a pure reload showLiveTurn is false. */}
      {showLiveTurn && (
        <>
          {liveQuestion && <ThreadUserTurn text={liveQuestion} />}
          <ThreadAssistantTurn>
            {thinking && <ChatTypingIndicator />}
            {showCapsule && (
              // Chat-as-agent (CHAT_AGENT_DISPATCH): the dispatched skill's run capsule — labeled,
              // plan-seeded spine while live; the collapsed ✓ receipt above the cards after. The
              // same run grammar as the per-skill thread views (run-capsule.tsx).
              <SkillRunCapsule
                skill={dispatchedSkill}
                stages={stages}
                isRunning={runLive}
                audienceLabel={audienceLabel}
              />
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
          </ThreadAssistantTurn>
        </>
      )}

      {followups.length > 0 && (
        <div className="pt-1" data-testid="chat-followups">
          <FollowupRow followups={followups} onFollowup={onFollowup} />
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
