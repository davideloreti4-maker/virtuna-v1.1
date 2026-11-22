"use client";

/**
 * ThreadTurnNext — the thread's turn under the new look (spec 2026-11-21 §3, §4; plan Task 5):
 * the ONE renderer of every turn, persisted and live. `ThreadTurn` picks it in the flag-on build
 * (a constant fork at its export), so history, the live tail and `/dev/cards` all draw through it.
 *
 *     the user turn (slice 1's bubble, a reloaded video's tile above it)
 *     → the "Maven" label
 *     → the error and Retry (today's copy), when the run failed
 *     → while the run is live: ONE waiting row ("Writing hooks"; "Thinking" before a run is named),
 *       or a plain chat answer's text as it streams
 *     → after: one part per result (`partsOf`): a card per pack, script, remix and video, a chat
 *       answer's text, the interactive legacy blocks, the fallback card for the rest; under a pack,
 *       the one computed sentence
 *     → the two chips, under the last answer only
 *
 * Not drawn, by rule (spec §3.1): the intro line, the run's live spine and its receipt, warnings,
 * the outliers offer, the closing paragraph and its forward chip, any narration in a turn with a
 * result card, and the room's scroll-spy anchors (the room is off under the flag).
 *
 * Each part sits in `BlockOriginContext` with the origin of its ORIGINAL block (a pack's or a
 * remix run's first item), so a save keeps its message ref however many blocks were dropped.
 *
 * Text simulations go through the thread's one queue (`useTextSim`, provided by the composer):
 * hooks as "hook", ideas as "idea", a script's opening as "script", a remix hook as "remix", keyed
 * by the text itself (`sealKey`). Outside the provider (and without the composer's handoffs) the
 * cards draw their controls disabled.
 */

import { FollowupRow } from "@/components/thread/followup-row";
import { MarkdownBlockRenderer } from "@/components/thread/markdown-block";
import { MessageBlocks } from "@/components/thread/message-blocks";
import { SKILL_RUN_META } from "@/components/thread/run-capsule";
import { SkillRunError } from "@/components/thread/run-notices";
import { ThreadUserTurn } from "@/components/thread/thread-shell";
import type { LiveRun, ThreadTurnProps } from "@/components/thread/thread-turn";
import { useOnWriteScriptHook } from "@/lib/hook-test-context";
import { runErrorCopy } from "@/lib/net/run-failure";
import { BlockOriginContext } from "@/lib/save-provenance-context";
import { useOnTestScript } from "@/lib/script-test-context";
import { scriptBrief } from "@/lib/script-utils";
import { hasResultCard, partsOf, type AnswerPart } from "@/lib/thread-next/answer-parts";
import { fallbackOf } from "@/lib/thread-next/fallback-lines";
import { ideaLineOf } from "@/lib/thread-next/idea-line";
import { nextFollowups } from "@/lib/thread-next/next-followups";
import { sealKey } from "@/lib/threads/sim-seals";
import { blockTypesOf, cardLinesOf, classifyTurn, type ChatTurnKind } from "@/lib/tools/chat-followups";
import type { ScriptCardBlock } from "@/lib/tools/blocks";
import type { BlockOrigin } from "@/components/app/home/rehydrate-thread";

import { NextAssistantTurn } from "./assistant-label";
import { PROSE } from "./answer-card";
import type { GaugeState } from "./answer-gauge";
import { PackSentence } from "./answer-sentence";
import { FallbackAnswer } from "./fallback-answer";
import { PackAnswer, type PackRow } from "./pack-answer";
import { RemixAnswer } from "./remix-answer";
import { ScriptAnswer } from "./script-answer";
import { useTextSim, type TextKind, type TextSimApi } from "./text-sim";
import { videoOfTurn } from "./user-turn";
import { VideoAnswer } from "./video-answer";
import { WaitingRow } from "./waiting-row";

const EMPTY: GaugeState = { kind: "empty" };
const THINKING = "Thinking";

/** The runs whose name the waiting row says. Any other kind (chat; the video's "Testing your
 *  video" among them: "Simulate", never "Test") waits as "Thinking". */
const NAMED_RUNS: ReadonlySet<string> = new Set(["hooks", "ideas", "script", "remix", "explore", "account"]);

function waitingLabelOf(skill: string): string {
  return (NAMED_RUNS.has(skill) && SKILL_RUN_META[skill]?.running) || THINKING;
}

/**
 * The runs the pre-router can guess before `dispatch` names one (`PreRouteGuess`, the keys of the
 * legacy turn's `PRE_GUESS_LABEL`). While such a guess stands, the stream's prose is a preamble.
 */
const GUESSED_RUNS: ReadonlySet<string> = new Set(["ideas", "hooks", "script"]);

/**
 * The persisted run stamp's skill, if the turn has one: the LAST `run-header` that names one. A turn can
 * hold two runs (an old chip-launched run saved no user turn, so it folded into the turn before), and
 * the chips, the waiting row and the error copy all belong to the latest run (Task 7 critic).
 */
function stampedSkillOf(blocks: readonly unknown[]): string | null {
  let skill: string | null = null;
  for (const raw of blocks) {
    const b = raw as { type?: unknown; props?: { skill?: unknown } } | null;
    if (b?.type === "run-header" && typeof b.props?.skill === "string") skill = b.props.skill;
  }
  return skill;
}

/** The turn's display kind, in the legacy turn's precedence: the live run, the stamp, the cards. */
function skillOf(blocks: readonly unknown[], live: LiveRun | null | undefined): ChatTurnKind {
  return live?.skill ?? ((stampedSkillOf(blocks) as ChatTurnKind | null) || classifyTurn(blockTypesOf(blocks)));
}

/** A row's gauge, read from the thread's one queue (empty, and no control, outside it). */
function rowOf(sim: TextSimApi | null, text: string): PackRow {
  return { key: sealKey(text), text, state: sim?.stateOf(text) ?? EMPTY, failed: sim?.failed(text) ?? false };
}

// ─── The parts ───────────────────────────────────────────────────────────────

function PackPart({ part }: { part: Extract<AnswerPart, { kind: "hooks" | "ideas" }> }) {
  const sim = useTextSim();
  const writeScript = useOnWriteScriptHook();
  const kind: TextKind = part.kind === "hooks" ? "hook" : "idea";
  const rows: PackRow[] =
    part.kind === "hooks"
      ? part.items.map(({ block }) => rowOf(sim, block.props.hookLine))
      : part.items.map(({ block }) => ({ ...rowOf(sim, block.props.title), sub: ideaLineOf(block.props) }));
  const texts = rows.map((r) => r.text);

  // What a script starts from: a hook's line and its audience tag; an idea's seed hook, else its title.
  const scriptFrom = (i: number): [string, string] | null => {
    if (part.kind === "hooks") {
      const p = part.items[i]?.block.props;
      return p ? [p.hookLine, p.audienceArchetype ?? ""] : null;
    }
    const p = part.items[i]?.block.props;
    return p ? [p.seedHook || p.title, ""] : null;
  };

  return (
    <>
      <PackAnswer
        kind={kind}
        rows={rows}
        queue={sim?.progress(texts) ?? null}
        onSimulate={sim ? (key) => sim.fire(key, kind) : undefined}
        onSimulateAll={sim ? () => sim.fireAll(texts.map((text) => ({ text, kind }))) : undefined}
        onScript={
          writeScript
            ? (i) => {
                const from = scriptFrom(i);
                if (from) writeScript(...from);
              }
            : undefined
        }
      />
      <PackSentence kind={kind} rows={rows} />
    </>
  );
}

/** A script's opening line: the text its slot fires AND looks up (what the legacy card's door fired). */
function openerOf(block: ScriptCardBlock): string {
  return block.props.openingBeatSeed || block.props.beats[0]?.content || "";
}

function ScriptPart({ block }: { block: ScriptCardBlock }) {
  const sim = useTextSim();
  const testScript = useOnTestScript();
  const { beats } = block.props;
  const opener = openerOf(block);
  return (
    <ScriptAnswer
      block={block}
      opener={{ state: sim?.stateOf(opener) ?? EMPTY, onSimulate: sim && opener ? () => sim.fire(opener, "script") : undefined }}
      onAddTake={testScript ? () => testScript(opener, scriptBrief(beats)) : undefined}
    />
  );
}

function RemixPart({ part }: { part: Extract<AnswerPart, { kind: "remix" }> }) {
  const sim = useTextSim();
  const writeScript = useOnWriteScriptHook();
  return (
    <RemixAnswer
      items={part.items.map((i) => i.block)}
      hookOf={(hook) => ({ state: sim?.stateOf(hook) ?? EMPTY, onSimulate: sim ? () => sim.fire(hook, "remix") : undefined })}
      onScript={writeScript ? (hook) => writeScript(hook, "") : undefined}
    />
  );
}

/** Every text this turn's rows can simulate: the same strings they fire (pack rows, the script's
 *  opener, the remix hooks). */
function simTextsOf(parts: readonly AnswerPart[]): string[] {
  return parts.flatMap((part) => {
    switch (part.kind) {
      case "hooks":
        return part.items.map((i) => i.block.props.hookLine);
      case "ideas":
        return part.items.map((i) => i.block.props.title);
      case "script": {
        const opener = openerOf(part.item.block);
        return opener ? [opener] : [];
      }
      case "remix":
        return part.items.map((i) => i.block.props.adaptedHook);
      default:
        return [];
    }
  });
}

/** The index of the ORIGINAL block a part stands for (a pack's or a remix run's: its first item). */
function originalIndexOf(part: AnswerPart): number {
  switch (part.kind) {
    case "hooks":
    case "ideas":
    case "remix":
      return part.items[0]?.index ?? -1;
    case "script":
    case "video":
      return part.item.index;
    default:
      return part.index;
  }
}

function PartView({ part, origin, live }: { part: AnswerPart; origin: BlockOrigin | null; live: boolean }) {
  switch (part.kind) {
    case "hooks":
    case "ideas":
      return <PackPart part={part} />;
    case "script":
      return <ScriptPart block={part.item.block} />;
    case "remix":
      return <RemixPart part={part} />;
    case "video":
      return <VideoAnswer block={part.item.block} />;
    case "text":
      // A plain chat answer, through today's markdown renderer (its 15 px and its 68ch measure), at
      // the drawing's 22 leading (`.ax-say p`), in proportional figures so a hyphen stays tight
      // (the new look's body is tabular, which widens Inter's hyphen); read politely while it streams.
      return (
        <div aria-live={live ? "polite" : undefined} className={`${PROSE} [&_.md]:leading-[22px]`}>
          <MarkdownBlockRenderer block={{ type: "markdown", props: { text: part.text } }} />
        </div>
      );
    case "legacy":
      // Interactive (a link field, the outlier grid): today's renderer, with its own origin.
      return <MessageBlocks body={[part.block]} blockOrigins={[origin]} />;
    case "fallback":
      return <FallbackAnswer {...fallbackOf(part.block)} />;
  }
}

// ─── The turn ────────────────────────────────────────────────────────────────

export function ThreadTurnNext({ userTurn, blocks, live, blockOrigins, showFollowups = true }: ThreadTurnProps) {
  const skill = skillOf(blocks, live);
  const isStreaming = live?.isStreaming ?? false;
  const stages = live?.stages ?? [];
  // The legacy turn's definition (thread-turn.tsx): live until every stage is done. A fresh dispatch
  // clears the stages, so none yet counts as live; once they are done the cards land, even while the
  // stream stays open for the closing line.
  const runLive = isStreaming && (stages.length === 0 || stages.some((s) => s.status !== "done"));
  const hasError = !!live?.error && !isStreaming;

  // `partsOf` runs on this turn's assistant blocks only (a user turn's blocks live in its message).
  const parts = partsOf(blocks);
  const cardsIn = hasResultCard(blocks);
  // A plain chat answer: no skill named and no result card. Only its text streams while live.
  const chatText = skill === "chat" && !cardsIn;
  // The pre-router guessed a run that `dispatch` has not named yet (spec §4.8: "Thinking" before the
  // run is named, no live preamble).
  const guessedRun = skill === "chat" && !!live?.preGuess && GUESSED_RUNS.has(live.preGuess);

  let shown: AnswerPart[] = parts;
  let waiting: string | null = null;
  if (isStreaming && skill !== "chat" && !cardsIn) {
    // A named run with no card in yet shows its name and nothing else, whatever its stages say: a
    // chat-dispatched run finishes its stages, then bills, then writes its cards, so for a round
    // trip its blocks are only the streamed preamble.
    shown = [];
    waiting = waitingLabelOf(skill);
  } else if (isStreaming && guessedRun) {
    // A guessed run's prose is a preamble until the stream ends; a turn that never dispatched shows
    // its text once it settles.
    shown = [];
    waiting = THINKING;
  } else if (runLive) {
    if (chatText) {
      shown = parts.filter((p) => p.kind === "text");
      if (shown.length === 0) waiting = THINKING;
    } else {
      // A named run shows its name and nothing else: no preamble, no half-landed cards.
      shown = [];
      waiting = waitingLabelOf(skill);
    }
  } else if (isStreaming && parts.length === 0) {
    // Streaming with nothing to show (no named run left here): keep the row rather than flash empty.
    waiting = waitingLabelOf(skill);
  }

  // The chips follow the answer: none while it is still on its way, nor while its rows simulate (P4).
  const sim = useTextSim();
  const simulating = !!sim && sim.progress(simTextsOf(parts)) !== null;
  const chips = showFollowups && !runLive && waiting === null && !simulating;
  const hasAssistantContent = shown.length > 0 || waiting !== null || hasError;

  return (
    <>
      {userTurn?.trim() ? <ThreadUserTurn text={userTurn.trim()} video={videoOfTurn(blocks)} /> : null}
      {hasAssistantContent && (
        <NextAssistantTurn>
          {hasError && <RunError live={live} skill={skill} />}
          {waiting !== null && <WaitingRow label={waiting} />}
          {shown.map((part) => {
            const index = originalIndexOf(part);
            const origin = blockOrigins?.[index] ?? null;
            return (
              <BlockOriginContext.Provider key={`${part.kind}-${index}`} value={origin}>
                <PartView part={part} origin={origin} live={runLive} />
              </BlockOriginContext.Provider>
            );
          })}
          {chips && <FollowupRow followups={nextFollowups(skill)} cardLines={cardLinesOf(blocks)} className="-mt-0.5" />}
        </NextAssistantTurn>
      )}
    </>
  );
}

/** The failed run: today's copy (cause first, skill second, default last) and its Retry. */
function RunError({ live, skill }: { live: LiveRun | null | undefined; skill: ChatTurnKind }) {
  const copy = runErrorCopy(live?.error, skill);
  const isDefaultLabel = copy.retryLabel === "Retry the run";
  return (
    <SkillRunError
      onRetry={live?.onRetry}
      retryLabel={isDefaultLabel && SKILL_RUN_META[skill] ? `Retry the ${skill} run` : copy.retryLabel}
      headline={copy.headline}
      body={copy.body}
    />
  );
}
