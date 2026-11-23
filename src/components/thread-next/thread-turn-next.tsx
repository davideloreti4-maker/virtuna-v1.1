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
 *
 * Step 2: a pack row opens its details sheet (`PackSheet`), which saves with that row's OWN origin;
 * a simulated text links to its result page (`resultLinkOf`) once the thread id (`ThreadIdContext`)
 * and its key (`useSealKeys`) are known: a pack row's gauge as a hook or an idea, a script's opener as
 * an opening line, a remix hook as a hook.
 */

import { useContext, useState } from "react";

import { FollowupRow } from "@/components/thread/followup-row";
import { MarkdownBlockRenderer } from "@/components/thread/markdown-block";
import { MessageBlocks } from "@/components/thread/message-blocks";
import { SKILL_RUN_META } from "@/components/thread/run-capsule";
import { SkillRunError } from "@/components/thread/run-notices";
import { ThreadUserTurn } from "@/components/thread/thread-shell";
import type { LiveRun, ThreadTurnProps } from "@/components/thread/thread-turn";
import { useOnWriteScriptHook } from "@/lib/hook-test-context";
import { runErrorCopy } from "@/lib/net/run-failure";
import { BlockOriginContext, ThreadIdContext } from "@/lib/save-provenance-context";
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
import type { TextResultAs } from "@/lib/result/text-result";

import { NextAssistantTurn } from "./assistant-label";
import { PROSE } from "./answer-card";
import type { GaugeState } from "./answer-gauge";
import { PackSentence } from "./answer-sentence";
import { FallbackAnswer } from "./fallback-answer";
import { PackAnswer, type PackRow } from "./pack-answer";
import { PackSheet } from "./pack-sheet";
import { RemixAnswer } from "./remix-answer";
import { ScriptAnswer } from "./script-answer";
import { useTextSim, type TextKind, type TextSimApi } from "./text-sim";
import { resultLinkOf, useSealKeys } from "./use-seal-keys";
import { useOncePerBurst } from "./use-once-per-burst";
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

function PackPart({ part, origins }: { part: Extract<AnswerPart, { kind: "hooks" | "ideas" }>; origins: readonly (BlockOrigin | null)[] }) {
  const sim = useTextSim();
  // A script costs 2 credits: a tap that lands twice must write one (`useOncePerBurst`).
  const writeScript = useOncePerBurst(useOnWriteScriptHook());
  const threadId = useContext(ThreadIdContext);
  const kind: TextKind = part.kind === "hooks" ? "hook" : "idea";
  const as: TextResultAs = part.kind === "hooks" ? "hook" : "idea";
  const plain: PackRow[] =
    part.kind === "hooks"
      ? part.items.map(({ block }) => rowOf(sim, block.props.hookLine))
      : part.items.map(({ block }) => ({ ...rowOf(sim, block.props.title), sub: ideaLineOf(block.props) }));
  const texts = plain.map((r) => r.text);
  const keys = useSealKeys(texts);
  const queue = sim?.progress(texts) ?? null;
  // A simulated row's gauge links to its result page, once the thread and its key are known. Not while
  // the pack's queue runs: the page is another route, leaving unmounts the queue, and the rows still
  // waiting would never run ("Simulate all" would stop without a word).
  const rows: PackRow[] = plain.map((r) => ({
    ...r,
    href: queue ? null : resultLinkOf(r.state, threadId, keys.get(r.text.trim()), as),
  }));
  // The row whose sheet is open (kept while it animates closed) and the button that opened it.
  const [sheet, setSheet] = useState<{ index: number; open: boolean; trigger: HTMLElement | null } | null>(null);
  // Every row opened so far keeps its own sheet for the life of the pack: its saved state (a live run's
  // lives only there) and "Copied" survive a visit to another row, and a closing sheet finishes its
  // animation while the next one opens. ("More" does not: it lives in the sheet's content, which
  // Radix removes on close, so a reopened sheet is folded again.)
  const [opened, setOpened] = useState<readonly number[]>([]);

  // What a script starts from: a hook's line and its audience tag; an idea's seed hook, else its title.
  const scriptFrom = (i: number): [string, string] | null => {
    if (part.kind === "hooks") {
      const p = part.items[i]?.block.props;
      return p ? [p.hookLine, p.audienceArchetype ?? ""] : null;
    }
    const p = part.items[i]?.block.props;
    return p ? [p.seedHook || p.title, ""] : null;
  };
  // ONE script call for a row: the card's primary and the sheet's "Script this one" both make it.
  const scriptRow = writeScript
    ? (i: number) => {
        const from = scriptFrom(i);
        if (from) writeScript(...from);
      }
    : undefined;

  return (
    <>
      <PackAnswer
        kind={kind}
        rows={rows}
        queue={queue}
        onSimulate={sim ? (key) => sim.fire(key, kind) : undefined}
        onSimulateAll={sim ? () => sim.fireAll(texts.map((text) => ({ text, kind }))) : undefined}
        onScript={scriptRow}
        onOpen={(index, trigger) => {
          setOpened((o) => (o.includes(index) ? o : [...o, index]));
          setSheet({ index, open: true, trigger });
        }}
      />
      <PackSentence kind={kind} rows={rows} />
      {opened.map((i) => (
        <PackSheet
          key={i}
          part={part}
          index={i}
          origin={origins[i] ?? null}
          open={sheet?.index === i && sheet.open}
          // Set, never toggled, and only for this row: a close can be reported twice (the handle and the shell).
          onOpenChange={(open) => setSheet((s) => (s?.index === i ? { ...s, open } : s))}
          // A sheet closing while another opens hands focus to no one: the new sheet takes it.
          returnFocus={sheet?.index === i ? sheet.trigger : null}
          onScript={scriptRow ? () => scriptRow(i) : undefined}
        />
      ))}
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
  const threadId = useContext(ThreadIdContext);
  const { beats } = block.props;
  const opener = openerOf(block);
  const keys = useSealKeys(opener ? [opener] : []);
  const state = sim?.stateOf(opener) ?? EMPTY;
  return (
    <ScriptAnswer
      block={block}
      opener={{
        state,
        onSimulate: sim && opener ? () => sim.fire(opener, "script") : undefined,
        href: resultLinkOf(state, threadId, keys.get(opener.trim()), "opening"),
      }}
      onAddTake={testScript ? () => testScript(opener, scriptBrief(beats)) : undefined}
    />
  );
}

function RemixPart({ part }: { part: Extract<AnswerPart, { kind: "remix" }> }) {
  const sim = useTextSim();
  // A script costs 2 credits: a tap that lands twice must write one (`useOncePerBurst`).
  const writeScript = useOncePerBurst(useOnWriteScriptHook());
  const threadId = useContext(ThreadIdContext);
  const keys = useSealKeys(part.items.map((i) => i.block.props.adaptedHook));
  return (
    <RemixAnswer
      items={part.items.map((i) => i.block)}
      hookOf={(hook) => {
        const state = sim?.stateOf(hook) ?? EMPTY;
        return {
          state,
          onSimulate: sim ? () => sim.fire(hook, "remix") : undefined,
          href: resultLinkOf(state, threadId, keys.get(hook.trim()), "hook"),
        };
      }}
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

function PartView({
  part,
  origin,
  origins,
  live,
}: {
  part: AnswerPart;
  origin: BlockOrigin | null;
  /** The turn's block origins: a pack's sheet saves with its row's own. */
  origins: readonly BlockOrigin[] | undefined;
  live: boolean;
}) {
  switch (part.kind) {
    case "hooks":
    case "ideas":
      return <PackPart part={part} origins={part.items.map((i) => origins?.[i.index] ?? null)} />;
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
                <PartView part={part} origin={origin} origins={blockOrigins} live={runLive} />
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
