"use client";

/**
 * ThreadTurnNext — the thread's turn under the new look (spec 2026-11-21 §3, §4; plan Task 5):
 * the ONE renderer of every turn, persisted and live. `ThreadTurn` picks it in the flag-on build
 * (a constant fork at its export), so history, the live tail and `/dev/cards` all draw through it.
 *
 *     the user turn (slice 1's bubble, a reloaded video's tile above it)
 *     → the "Maven" label
 *     → the error and Retry (today's copy), when the run failed
 *     → while the run is live (thread feel §4.2): the line that says what it is doing ("Thinking"
 *       before the run is named; then the words of the stage it reports, and how long such a run
 *       takes), and for a run that ends in a card of its own (hooks, ideas, script, remix) that card
 *       drawn at once as its outline with the line as its header (§4.3); what the run reads under
 *       the line. A plain chat answer's text as it streams, word by word (`StreamedAnswer`)
 *     → after: one part per result (`partsOf`): a card per pack, script, remix, video and account
 *       read, a chat answer's text (Copy under the last text part once the turn has ended, rulings
 *       17), the interactive legacy blocks, the fallback card for the rest; under a pack, Maven's
 *       pick before the numbers are in (hooks), then the one computed sentence
 *     → the two chips, under the last answer only
 *
 * The landing (§4.3, rulings 11): a turn that waited in this visit and then shows its cards draws
 * them in one after another (`LandingGroup`, each card's `land` places, the chips 3 after the
 * last), and remembers that moment (`markLanded`, by the answer's key, `landingKeyOf`); the turn drawn
 * in its place within the landing's window (the persisted copy after the fold) carries on from
 * there (`landedAgo`, read once at mount). Every other mount is at rest.
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

import { useContext, useEffect, useState } from "react";

import { FollowupRow } from "@/components/thread/followup-row";
import { MessageBlocks } from "@/components/thread/message-blocks";
import { SKILL_RUN_META } from "@/components/thread/run-capsule";
import type { StageState } from "@/components/thread/progress-checklist";
import { SkillRunError } from "@/components/thread/run-notices";
import { ThreadUserTurn } from "@/components/thread/thread-shell";
import type { LiveRun, ThreadTurnProps } from "@/components/thread/thread-turn";
import { useFollowupHandler } from "@/lib/followup-context";
import { useOnWriteScriptHook } from "@/lib/hook-test-context";
import { runErrorCopy } from "@/lib/net/run-failure";
import { BlockOriginContext, ThreadIdContext } from "@/lib/save-provenance-context";
import { useOnTestScript } from "@/lib/script-test-context";
import { scriptBrief } from "@/lib/script-utils";
import { accountCardOf } from "@/lib/thread-next/account-card";
import { answerIsIn } from "@/lib/thread-next/answer-in";
import { hasResultCard, partsOf, type AnswerPart } from "@/lib/thread-next/answer-parts";
import { fallbackOf } from "@/lib/thread-next/fallback-lines";
import { ideaLineOf } from "@/lib/thread-next/idea-line";
import { landStyle, landedAgo, landingGrew, landingKeyOf, markLanded } from "@/lib/thread-next/landing";
import { nextFollowups } from "@/lib/thread-next/next-followups";
import { rowProofOf } from "@/lib/thread-next/row-proof";
import { USUAL_S, outlineOf, statusWords, usualNote } from "@/lib/thread-next/run-status";
import { sealKey } from "@/lib/threads/sim-seals";
import { blockTypesOf, cardLinesOf, classifyTurn, type ChatTurnKind } from "@/lib/tools/chat-followups";
import type { AccountReadBlock, ScriptCardBlock } from "@/lib/tools/blocks";
import type { RunEvidence } from "@/lib/tools/evidence";
import type { BlockOrigin } from "@/components/app/home/rehydrate-thread";
import type { TextResultAs } from "@/lib/result/text-result";

import { AccountAnswer, accountLands } from "./account-answer";
import { NextAssistantTurn } from "./assistant-label";
import type { GaugeState } from "./answer-gauge";
import { AnswerOutline } from "./answer-outline";
import { PackSentence } from "./answer-sentence";
import { FallbackAnswer } from "./fallback-answer";
import { LandingGroup } from "./landing-group";
import { PackAnswer, packLastLand, type PackRow } from "./pack-answer";
import { PackSheet } from "./pack-sheet";
import { RemixAnswer, remixLands } from "./remix-answer";
import { EvidenceRow, RunStatus } from "./run-status";
import { ScriptAnswer, scriptLastLand } from "./script-answer";
import { StreamedAnswer } from "./streamed-text";
import { useTextSim, type TextKind, type TextSimApi } from "./text-sim";
import { resultLinkOf, useSealKeys } from "./use-seal-keys";
import { useOncePerBurst } from "./use-once-per-burst";
import { videoOfTurn } from "./user-turn";
import { VideoAnswer } from "./video-answer";
import { EditAnswer } from "./edit-answer";

const EMPTY: GaugeState = { kind: "empty" };

/** The wait of a run not named yet: the line "Thinking" (`statusWords` of a kind it does not know). */
const UNNAMED = "chat";

/**
 * The persisted run stamp's skill, if the turn has one: the LAST `run-header` that names one. A turn can
 * hold two runs (an old chip-launched run saved no user turn, so it folded into the turn before), and
 * the chips, the wait and the error copy all belong to the latest run (Task 7 critic).
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
  // A hook's row carries the video it is built on (thread depth §3.3), and the writer's rank and plain
  // reason for the line under the pack (Maven's pick); an idea's carries none of them.
  const plain: PackRow[] =
    part.kind === "hooks"
      ? part.items.map(({ block }) => ({
          ...rowOf(sim, block.props.hookLine),
          proof: rowProofOf(block.props.proof),
          rank: block.props.rank,
          why: block.props.why,
        }))
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
  // ONE script call for a row: the card's primary and the sheet's "Script this one" both make it. The
  // primary names the row ("hook 2", 1-based) for the message it sends; the sheet does not (§4.7:
  // "From a sheet, a remix or anywhere with no row number", the message stays "from this hook").
  const scriptRow = writeScript
    ? (i: number, label?: string) => {
        const from = scriptFrom(i);
        if (!from) return;
        if (label) writeScript(from[0], from[1], label);
        else writeScript(...from);
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
        onScript={scriptRow ? (i) => scriptRow(i, `${kind} ${i + 1}`) : undefined}
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

/**
 * The account read's card (thread depth, second part §3). Its one button sends its ask as an Ideas run
 * through the thread's one way to send a follow-up (`useFollowupHandler`: the composer's, which holds
 * it while the last run is still closing). An Ideas run costs a credit: a tap that lands twice sends
 * one (`useOncePerBurst`). Outside the composer (a dev page) the button is drawn and does nothing.
 */
function AccountPart({ block }: { block: AccountReadBlock }) {
  const followup = useOncePerBurst(useFollowupHandler());
  return <AccountAnswer block={block} onIdeas={followup ? (ask) => followup(ask, "ideas") : undefined} />;
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
    case "edit":
    case "account":
      return part.item.index;
    default:
      return part.index;
  }
}

/** The place of a part's last element in a landing (thread feel §4.3): the chips come 3 after it. A
 *  part that comes in whole (a video, a legacy block, the fallback card) is one place, 0. */
function lastLandOf(part: AnswerPart): number {
  switch (part.kind) {
    case "hooks":
    case "ideas":
      return packLastLand(part.items.length);
    case "script":
      return scriptLastLand(part.item.block.props.beats.length);
    case "remix": {
      const first = part.items[0];
      return first ? remixLands(first.block, part.items.length > 1).last : 0;
    }
    case "account":
      return accountLands(accountCardOf(part.item.block.props)).last;
    default:
      return 0;
  }
}

function PartView({
  part,
  origin,
  origins,
  live,
  copyText,
}: {
  part: AnswerPart;
  origin: BlockOrigin | null;
  /** The turn's block origins: a pack's sheet saves with its row's own. */
  origins: readonly BlockOrigin[] | undefined;
  live: boolean;
  /** The turn's whole text, for the Copy under its last text part (rulings 17). */
  copyText: string | null;
}) {
  switch (part.kind) {
    case "hooks":
    case "ideas":
      return <PackPart part={part} origins={part.items.map((i) => origins?.[i.index] ?? null)} />;
    case "script":
      return <ScriptPart block={part.item.block} />;
    case "remix":
      return <RemixPart part={part} />;
    case "account":
      return <AccountPart block={part.item.block} />;
    case "video":
      // In a landing it comes in whole, first; the video's card is not touched (rulings 9).
      return (
        <div className="land">
          <VideoAnswer block={part.item.block} />
        </div>
      );
    case "edit":
      // The door to the editor: in a landing it comes in whole, as a video's card does.
      return (
        <div className="land">
          <EditAnswer block={part.item.block} />
        </div>
      );
    case "text":
      // A plain chat answer (thread feel §4.5): word by word while it streams, read politely; today's
      // markdown once it has ended, with Copy under the turn's last text part.
      return <StreamedAnswer text={part.text} live={live} copyText={copyText} />;
    case "legacy":
      // Interactive (a link field, the outlier grid): today's renderer, with its own origin; in a
      // landing it comes in whole.
      return (
        <div className="land">
          <MessageBlocks body={[part.block]} blockOrigins={[origin]} />
        </div>
      );
    case "fallback":
      return <FallbackAnswer {...fallbackOf(part.block)} />;
  }
}

// ─── The wait ────────────────────────────────────────────────────────────────

/**
 * The usual length's note (§4.2), from the seconds since the wait began: one timer, set for the one
 * moment the note changes ("about 20 s" to "taking longer", past twice the usual length in whole
 * seconds), and none for a run whose length is not known. No counting clock (rulings 4).
 */
function useUsualNote(skill: string): string | null {
  const [startedAt] = useState(() => Date.now());
  const [elapsedS, setElapsedS] = useState(0);
  const usual = USUAL_S[skill];
  useEffect(() => {
    if (usual === undefined) return;
    const changeAtS = 2 * usual + 1;
    if (elapsedS >= changeAtS) return;
    const timer = setTimeout(
      () => setElapsedS(Math.floor((Date.now() - startedAt) / 1000)),
      Math.max(0, startedAt + changeAtS * 1000 - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [usual, elapsedS, startedAt]);
  return usualNote(skill, elapsedS);
}

/**
 * The wait under the label: for a run that ends in a card of its own, that card as its outline with
 * the line as its header; for the others the line alone, with what the run reads under it. Mounted
 * from the send until the answer shows, so its note counts from the send (the usual lengths were
 * measured from it), across the moment a typed ask is named.
 */
function RunWait({ skill, stages, evidence }: { skill: string; stages: readonly StageState[]; evidence: RunEvidence | null | undefined }) {
  const note = useUsualNote(skill);
  const words = statusWords(skill, stages);
  const outline = outlineOf(skill);
  if (outline) return <AnswerOutline kind={outline} words={words} note={note} evidence={evidence} />;
  return (
    <>
      <RunStatus words={words} note={note} />
      <EvidenceRow evidence={evidence} />
    </>
  );
}

/**
 * Whether this turn's answer lands (§4.3, rulings 11), as the ms since it landed, or null at rest.
 *
 * - A turn that waits remembers it; on the render where its answer (a card) first shows after the
 *   wait, it lands now and says so (`markLanded`, by the answer's key as it stands: its first card
 *   line, else its first result block, and how many result blocks it holds; every answer with a card
 *   has one, and one without would land unremembered). A second wait in the same turn (a chat turn
 *   that runs twice) lands its answer again, from its own moment: its key holds more blocks.
 * - An answer that grows in place once landed (a dispatched pack's cards arriving one by one) is the
 *   same landing: the memory follows its key (`landingGrew`), so the persisted copy still matches.
 * - A turn that never waited reads the memory once, at mount (`landedAgo`): the persisted copy drawn
 *   in the landed turn's place within the window carries on from there; anything else is at rest.
 * - A plain answer does not land: its words fade in as they stream.
 *
 * Kept as state compared during render, not a ref read in render (the repo's `react-hooks/refs`
 * rule; the same pattern as the gauge's count-up), so the first frame the cards are committed in
 * already knows its landing.
 */
function useLanding(waiting: boolean, answerIn: boolean, key: string | null): number | null {
  const [landing, setLanding] = useState<{ waited: boolean; since: number | null; key: string | null }>(() => ({
    waited: waiting,
    since: !waiting && answerIn && key ? landedAgo(key) : null,
    key,
  }));
  if (waiting && (!landing.waited || landing.since !== null)) {
    // A wait (again): whatever landed before is over; the next answer lands from its own moment.
    setLanding({ waited: true, since: null, key: null });
  } else if (!waiting && landing.waited && landing.since === null && answerIn) {
    setLanding({ waited: true, since: key ? markLanded(key) : 0, key });
  } else if (!waiting && landing.waited && landing.since !== null && key && landing.key && key !== landing.key) {
    landingGrew(landing.key, key);
    setLanding({ ...landing, key });
  }
  return landing.since;
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
  // The pre-router's guess (`live.preGuess`) is not read: it names nothing in this look (spec §4.2,
  // §4.5). Most guessed asks are answered in plain words, so a guessed turn streams like any plain
  // answer until `dispatch` names a run, which then shows its wait in the named-run branch below.
  const chatText = skill === "chat" && !cardsIn;

  // What the wait is for: the run's kind, or `UNNAMED` ("Thinking", no outline) before it is named.
  // The answer is in by the rule the composer's settle and field read too (`answerIsIn`): its cards
  // once every stage it reported is done, though the stream stays open for the closing line; else
  // when the stream has ended. Until then the turn shows its wait, except a plain answer's words.
  let shown: AnswerPart[] = parts;
  let waitFor: string | null = null;
  if (isStreaming && !answerIsIn({ isStreaming, stages, blocks })) {
    if (chatText) {
      // A plain chat answer: its text as it streams (while the run is live), "Thinking" before its
      // first word, and the wait kept rather than an empty flash.
      if (runLive) shown = parts.filter((p) => p.kind === "text");
      if (shown.length === 0) waitFor = UNNAMED;
    } else {
      // A named run shows its wait and nothing else: no preamble, no half-landed cards. A
      // chat-dispatched run finishes its stages, then bills, then writes its cards, so for a round
      // trip its blocks are only the streamed preamble.
      shown = [];
      waitFor = skill;
    }
  }

  // The chips follow the answer: none while it is still on its way, nor while its rows simulate (P4).
  const sim = useTextSim();
  const simulating = !!sim && sim.progress(simTextsOf(parts)) !== null;
  const followups = nextFollowups(skill);
  // An edit's card is the whole answer: the next step is in the editor, not in the chat (plan 2026-11-24-editor-screens-a).
  const chips =
    showFollowups && !runLive && waitFor === null && !simulating && followups.length > 0 && !parts.some((part) => part.kind === "edit");
  const hasAssistantContent = shown.length > 0 || waitFor !== null || hasError;

  const landedMs = useLanding(waitFor !== null, cardsIn && shown.length > 0, landingKeyOf(blocks));
  const chipsLand = Math.max(0, ...shown.map(lastLandOf)) + 3;

  // Copy sits under the last text part only, and takes the turn's whole text; none while it is live.
  const texts = shown.filter((p): p is Extract<AnswerPart, { kind: "text" }> => p.kind === "text");
  const lastText = texts[texts.length - 1] ?? null;
  const copyText = !isStreaming && lastText ? texts.map((p) => p.text.trim()).filter(Boolean).join("\n\n") : null;

  return (
    <>
      {userTurn?.trim() ? <ThreadUserTurn text={userTurn.trim()} video={videoOfTurn(blocks)} /> : null}
      {hasAssistantContent && (
        <NextAssistantTurn>
          {hasError && <RunError live={live} skill={skill} />}
          {waitFor !== null && <RunWait skill={waitFor} stages={stages} evidence={live?.evidence} />}
          {(shown.length > 0 || chips) && (
            <LandingGroup sinceMs={landedMs}>
              {shown.map((part) => {
                const index = originalIndexOf(part);
                const origin = blockOrigins?.[index] ?? null;
                return (
                  <BlockOriginContext.Provider key={`${part.kind}-${index}`} value={origin}>
                    <PartView
                      part={part}
                      origin={origin}
                      origins={blockOrigins}
                      live={runLive}
                      copyText={part === lastText ? copyText : null}
                    />
                  </BlockOriginContext.Provider>
                );
              })}
              {chips && (
                // The legacy row is not this look's to change: its place in a landing rides on a wrapper.
                <div className="land -mt-0.5" style={landStyle(chipsLand)}>
                  <FollowupRow followups={followups} cardLines={cardLinesOf(blocks)} />
                </div>
              )}
            </LandingGroup>
          )}
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
