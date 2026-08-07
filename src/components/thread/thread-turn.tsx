'use client';

/**
 * ThreadTurn — THE turn renderer. One component, every skill, live or reloaded.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * Before this file the app did not have one chat. It had a per-skill VIEWPORT plus a migration
 * step: seven surfaces mounted off `activeTool` (showIdeasView / showHooksView / showChatView /
 * showScriptView / showRemixView / showExploreView / showAccountView), a finished run stayed in
 * its own private view, and it entered the unified thread only when the creator LEFT the skill —
 * via a fold effect that missed `account` and `test` entirely, bailed on a mid-stream switch, and
 * could fail silently after the view had already unmounted. That is the "I ask for hooks, then
 * want something else, and sometimes it doesn't work" report, at its root.
 *
 * A turn is a turn. Whether its blocks arrived over SSE a second ago or came out of the database
 * is a property of the TAIL TURN, not a different component:
 *
 *     ThreadUserTurn(userTurn)
 *     → ThreadIntro(skill, audience, platform, hookLine)   ← run-header block, or the live run
 *     → SkillProgress(STAGE_PLANS[skill])                  ← live spine, or collapsed receipt
 *     → MessageBlocks(blocks)                              ← the cards, all 18 types, ungated
 *     → RunWarnings / OutliersOffer
 *     → ThreadOutro(followupText, forward chip, followupsForKind(skill))
 *
 * Nothing here reads `activeTool`. There is no second surface to race with, so the bug class
 * cannot exist.
 *
 * WHERE THE SKILL COMES FROM, in precedence order:
 *   1. `live.skill`      — this turn is the in-flight run; the composer knows what it started.
 *   2. `run-header`      — the persisted stamp (blocks.ts RunHeaderBlockSchema), written by each
 *                          skill route as the first block of its assistant message.
 *   3. `classifyTurn()`  — the legacy fallback: infer from the rendered block types. Pre-existing
 *                          threads carry no stamp and must still get their intro/receipt/outro,
 *                          so this is what makes the change need no backfill migration.
 *
 * ⚠️ The skill id here is the DISPLAY namespace (`ChatTurnKind` — "ideas", PLURAL), never the
 * composer `ToolId` ("idea", singular). The two differ in exactly this one id and a cast between
 * them cannot fail at compile time; that is how F-017 shipped. `classifyTurn` and
 * `followupsForKind` both speak ChatTurnKind, and STAGE_PLANS/SKILL_RUN_META key off it too.
 */

import { MessageBlocks } from '@/components/thread/message-blocks';
import { ThreadAssistantTurn, ThreadUserTurn } from '@/components/thread/thread-shell';
import {
  ThreadIntro,
  ThreadOutro,
  outroFallback,
  type ForwardChip,
  type ThreadSkill,
} from '@/components/thread/conversational-frame';
import { SkillProgress, STAGE_PLANS, type StageState } from '@/components/thread/progress-checklist';
import { SkillRunError, RunWarnings } from '@/components/thread/run-notices';
import { runErrorCopy } from '@/lib/net/run-failure';
import { OutliersOffer } from '@/components/thread/outliers-offer';
import { SKILL_RUN_META } from '@/components/thread/run-capsule';
import { ChatTypingIndicator } from '@/components/thread/thread-loading';
import type { RunEvidence } from '@/lib/tools/evidence';
import { classifyTurn, followupsForKind, type ChatTurnKind } from '@/lib/tools/chat-followups';
import { useOnWriteScriptHook } from '@/lib/hook-test-context';
import type { BlockOrigin } from '@/components/app/home/rehydrate-thread';

/** The four skills that have an authored intro line (conversational-frame `introLine`). */
const SKILLS_WITH_INTRO: readonly string[] = ['hooks', 'ideas', 'script', 'remix'];

/**
 * Per-skill W2 error copy moved to `lib/net/run-failure.ts` (2026-08-07), because keying it by
 * SKILL alone was only half the question. Explore's "Check the handle or niche" is right when the
 * source really was unreachable and a lie when the device was offline — it accuses a handle that
 * is fine, which is the same defect PR #449 fixed in calibrate. `runErrorCopy` resolves cause
 * first, skill second, default last. The per-skill strings moved verbatim.
 */

/**
 * The in-flight half of a turn. Absent ⇒ this is a settled turn (persisted, or just-completed and
 * already swapped into history) and renders from `blocks` alone.
 *
 * Field coverage is deliberately loose because the seven stream hooks are not uniform: `remix` has
 * no `warnings`, `explore`/`chat` have neither `followupText` nor `warnings`, and `account-read`
 * exposes a single `block` rather than `stages`/`toBlocks`. Normalizing at the boundary (see
 * use-active-run.ts) is what lets ONE renderer serve all of them without rewriting the parsers.
 */
export interface LiveRun {
  /** ChatTurnKind — the display namespace, NOT ToolId. */
  skill: ChatTurnKind;
  isStreaming: boolean;
  stages?: StageState[];
  /**
   * The artifacts the run has touched so far (`evidence` SSE frame) — the proven outlier videos a
   * grounded generation is drafting against, the post remix just resolved. Rendered INSIDE the live
   * spine (see progress-checklist.tsx). Ephemeral like stages: never persisted, so a reloaded turn
   * shows the receipt without it, exactly as it shows no stage timings.
   */
  evidence?: RunEvidence | null;
  followupText?: string | null;
  warnings?: string[];
  error?: string | null;
  outliersAvailable?: boolean;
  /** Intro inputs — the run's audience/platform, and the input hook a script was built from. */
  audienceLabel?: string;
  platform?: string;
  hookLine?: string | null;
  onRetry?: () => void;
  onFindOutliers?: () => void;
}

export interface ThreadTurnProps {
  /** The creator's question for this turn. Null ⇒ no bubble (a leading assistant turn). */
  userTurn?: string | null;
  /** Every block this turn produced, in order — INCLUDING its `run-header` (see below). */
  blocks: unknown[];
  /** Present only on the tail turn while a run is in flight or just settled. */
  live?: LiveRun | null;
  /** This turn's offset into the ambient room's flat ledger (positional card ids). */
  ambientBaseIndex?: number;
  /**
   * Per-block provenance aligned with `blocks` — passed straight through to MessageBlocks so a
   * save can record the message row it came from. Optional; absent on live turns, whose blocks are
   * not persisted yet.
   */
  blockOrigins?: BlockOrigin[];
}

/** Read the persisted run stamp off the turn, if it has one. */
function readRunHeader(
  blocks: unknown[],
): { skill: string; audienceLabel?: string; platform?: string; hookLine?: string | null } | null {
  for (const raw of blocks) {
    const b = raw as { type?: string; props?: Record<string, unknown> } | null;
    if (b?.type !== 'run-header') continue;
    const props = b.props ?? {};
    if (typeof props.skill !== 'string') continue;
    return {
      skill: props.skill,
      audienceLabel: typeof props.audienceLabel === 'string' ? props.audienceLabel : undefined,
      platform: typeof props.platform === 'string' ? props.platform : undefined,
      hookLine: typeof props.hookLine === 'string' ? props.hookLine : null,
    };
  }
  return null;
}

/**
 * Split the run's closing markdown off the tail of the block list so it renders as the OUTRO
 * (styled, with chips + follow-up pills) rather than as an anonymous markdown block sitting among
 * the cards. The skill routes persist that line as a trailing `markdown` block (hooks/route.ts:360
 * and siblings), which is why a reloaded turn used to lose the outro treatment even though the text
 * survived.
 *
 * Index-safe: only a TRAILING block is removed, so every earlier block keeps its position and the
 * ambient ledger's positional card ids stay aligned. Applied ONLY to stamped/live skill turns —
 * a chat-agent turn's closing text (`origin: "chat-agent"`) is its whole answer and stays put.
 */
function splitTrailingOutro(blocks: unknown[]): { body: unknown[]; outroText: string | null } {
  const last = blocks[blocks.length - 1] as
    | { type?: string; props?: { text?: unknown; origin?: unknown } }
    | undefined;
  if (last?.type !== 'markdown') return { body: blocks, outroText: null };
  if (last.props?.origin === 'chat-agent') return { body: blocks, outroText: null };
  const text = typeof last.props?.text === 'string' ? last.props.text.trim() : '';
  if (!text) return { body: blocks, outroText: null };
  return { body: blocks.slice(0, -1), outroText: text };
}

/** The rank of the turn's top card, for the outro's forward chip + `outroFallback`. */
function topCard(blocks: unknown[]): { type: string; props: Record<string, unknown> } | null {
  for (const raw of blocks) {
    const b = raw as { type?: string; props?: Record<string, unknown> } | null;
    if (!b?.type || !b.props) continue;
    if (b.type === 'hook-card' || b.type === 'idea-card' || b.type === 'script-card') {
      return { type: b.type, props: b.props };
    }
  }
  return null;
}

export function ThreadTurn({
  userTurn,
  blocks,
  live,
  ambientBaseIndex,
  blockOrigins,
}: ThreadTurnProps) {
  const onWriteScript = useOnWriteScriptHook();

  const header = readRunHeader(blocks);
  // Precedence: the live run knows best, then the persisted stamp, then infer from block types.
  const blockTypes = blocks
    .map((b) => (b as { type?: string } | null)?.type)
    .filter((t): t is string => typeof t === 'string');
  const skill: ChatTurnKind =
    live?.skill ?? ((header?.skill as ChatTurnKind | undefined) || classifyTurn(blockTypes));

  const isSkillRun = !!live || !!header || skill !== 'chat';
  const isStreaming = live?.isStreaming ?? false;
  const stages = live?.stages ?? [];
  const plan = (STAGE_PLANS as Record<string, string[] | undefined>)[skill];
  const meta = SKILL_RUN_META[skill];

  // The run is LIVE (label + spine) until its stages all land `done` — the beat where the pipeline
  // hands over to cards — then it collapses to the ✓ receipt that stays above them for the turn.
  // `stages.length === 0` counts as live because a fresh dispatch CLEARS the stage list and the
  // first stage event is still in flight.
  //
  // ⚠️ This pivots on the RUN, not on `isStreaming`. A chat-dispatched skill produces its cards at
  // the END of the pipeline while the SSE stream is still open (the route keeps it open to stream
  // the closing line), so gating on `isStreaming` would hold those cards back until the socket
  // closed.
  const runLive = isStreaming && (stages.length === 0 || stages.some((s) => s.status !== 'done'));

  // Pull the closing line out of the card list ONLY once the run has settled. While it is live,
  // streamed markdown is PROSE — the agent's "on it, generating a few angles" preamble, or a plain
  // answer arriving token by token — and yanking the last block into the outro slot (which only
  // renders on settle) would make the whole wait look silent.
  const { body, outroText: persistedOutro } =
    isSkillRun && !runLive ? splitTrailingOutro(blocks) : { body: blocks, outroText: null };

  // The intro orients the turn from its INPUTS (copy floor §2) — it never cites a result, so it is
  // honest at submit time AND on reload. Only the four authored skills have one.
  const introSkill = SKILLS_WITH_INTRO.includes(skill) ? (skill as ThreadSkill) : null;
  const audienceLabel = live?.audienceLabel ?? header?.audienceLabel ?? 'General';
  const platform = live?.platform ?? header?.platform ?? 'tiktok';
  const hookLine = live?.hookLine ?? header?.hookLine ?? null;

  const top = topCard(body);
  const topRank = typeof top?.props.rank === 'number' ? (top.props.rank as number) : undefined;
  // The outro's forward chip is the single next step, derived from a REAL card handoff — never a
  // chip without a destination. Hooks→script is the one chain with a live context handler.
  const chips: ForwardChip[] =
    skill === 'hooks' && top?.type === 'hook-card' && typeof top.props.hookLine === 'string'
      ? [
          {
            label: `Write a script from #${topRank ?? 1} →`,
            primary: true,
            onClick: onWriteScript
              ? () =>
                  onWriteScript(
                    top.props.hookLine as string,
                    String(top.props.audienceArchetype ?? ''),
                  )
              : undefined,
          },
        ]
      : [];

  const outroText =
    live?.followupText ??
    persistedOutro ??
    (introSkill ? outroFallback(introSkill, topRank) : null);

  const warnings = live?.warnings ?? [];
  const hasError = !!live?.error && !isStreaming;

  // ── What is visible WHILE the run is still live ────────────────────────────
  // Scored CARDS land in one clean beat once the run settles — never half-drawn mid-stream, which
  // is the rule the per-skill views enforced and the reason a card never flickers between an
  // interim band and its real one. PROSE is the opposite: a chat answer that withheld its markdown
  // until `done`, or a "on it — generating a few angles" preamble held back until the pipeline
  // finished, would read as a dead app for the whole wait.
  const visible = runLive
    ? body.filter((b) => (b as { type?: string } | null)?.type === 'markdown')
    : body;

  // Provenance has to survive the SAME two transforms the body just went through, or every saved
  // ref shifts: splitTrailingOutro drops the trailing block, and the live filter drops every
  // non-markdown one. Tracked as INDICES into the original `blocks` rather than by slicing a
  // parallel array, so the two can never drift apart. The outro split only ever removes the last
  // element, which is what makes `slice(0, body.length)` an exact inverse of it.
  const visibleOrigins = blockOrigins
    ? (runLive
        ? blocks
            .map((_, i) => i)
            .slice(0, body.length)
            .filter((i) => (blocks[i] as { type?: string } | null)?.type === 'markdown')
        : blocks.map((_, i) => i).slice(0, body.length)
      ).map((i) => blockOrigins[i] ?? null)
    : undefined;

  // A skill was involved when the run names one (the chat agent's `dispatch` frame does) or stages
  // arrived (legacy streams carry no dispatch frame and must NOT be labeled with a guess).
  const skillInvolved = (!!live && skill !== 'chat') || stages.length > 0;
  // Pure-chat "thinking" dots: streaming with nothing yet AND no skill involved. A grounded/plain
  // chat turn emits no stages and no dispatch, so this is the honest wait for a conversational answer.
  const thinking = isStreaming && visible.length === 0 && !skillInvolved;

  // ── The receipt on a RELOADED turn ─────────────────────────────────────────
  // `SkillProgress` renders NOTHING for a settled run with no recorded stages, and stage events are
  // ephemeral — they are never persisted. So a reloaded thread used to lose every run's receipt,
  // leaving a bare card dump where the live turn had shown "✓ Ran your audience · 3 steps".
  //
  // A persisted turn that carries this skill's cards is a run that COMPLETED — that is what
  // producing cards means — so its canonical plan (STAGE_PLANS, the real phase boundaries each
  // runner emits) is replayed as done. Reconstruction, not fabrication: the steps are the ones that
  // actually ran, and nothing is claimed about a run that produced nothing.
  const settledStages =
    stages.length === 0 && !live && plan && body.length > 0
      ? plan.map((name) => ({ name, status: 'done' as const }))
      : stages;

  // A settled turn with nothing in it renders nothing (a bare rehydrate slot, a reset live run).
  const hasAssistantContent =
    body.length > 0 || isStreaming || stages.length > 0 || !!outroText || hasError;

  return (
    <>
      {userTurn?.trim() ? <ThreadUserTurn text={userTurn.trim()} /> : null}
      {hasAssistantContent && (
        <ThreadAssistantTurn>
          {hasError && (() => {
            // Cause first, skill second, default last (lib/net/run-failure.ts). The `meta`
            // fallback survives for skills with no override and no cause: it names the run.
            const copy = runErrorCopy(live?.error, skill);
            const isDefaultLabel = copy.retryLabel === 'Retry the run';
            return (
              <SkillRunError
                onRetry={live?.onRetry}
                retryLabel={isDefaultLabel && meta ? `Retry the ${skill} run` : copy.retryLabel}
                headline={copy.headline}
                body={copy.body}
              />
            );
          })()}

          {introSkill && (
            <ThreadIntro
              skill={introSkill}
              audienceLabel={audienceLabel}
              platform={platform}
              hookLine={hookLine}
              // Past tense once the run is over — the intro persists now, so it is read long after
              // the run it describes (see introLine's `settled`).
              settled={!runLive && !isStreaming}
            />
          )}

          {/* The honest wait for a plain conversational answer — no skill, so no spine to show. */}
          {thinking && <ChatTypingIndicator />}

          {/* The loading state: a live spine while the run is in flight, the collapsed receipt
              after. A reloaded turn shows the same receipt — see settledStages above. */}
          {(skillInvolved || settledStages.length > 0) && (
            <SkillProgress
              stages={settledStages}
              plan={plan ?? settledStages.map((s) => s.name)}
              isStreaming={runLive}
              summaryLabel={meta?.done ?? 'Ran the skill'}
              runningLabel={meta?.running}
              tookLabel={meta?.took}
              evidence={live?.evidence ?? null}
            />
          )}

          {visible.length > 0 && (
            <div
              className={runLive ? 'flex flex-col gap-3' : 'reading-reveal flex flex-col gap-3'}
              aria-live={runLive ? 'polite' : undefined}
              aria-atomic={runLive ? false : undefined}
            >
              <MessageBlocks
                body={visible}
                ambientBaseIndex={ambientBaseIndex}
                blockOrigins={visibleOrigins}
              />
            </div>
          )}

          {!runLive && warnings.length > 0 && <RunWarnings warnings={warnings} />}

          {!runLive && live?.outliersAvailable && live.onFindOutliers && (
            <OutliersOffer onFindOutliers={live.onFindOutliers} />
          )}

          {!runLive && (
            <ThreadOutro text={outroText} chips={chips} followups={followupsForKind(skill)} />
          )}
        </ThreadAssistantTurn>
      )}
    </>
  );
}
