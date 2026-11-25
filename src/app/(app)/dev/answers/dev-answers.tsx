"use client";

import { useEffect, useState } from "react";

import { TextResultView, type TextResultState } from "@/components/result/text-result";
import { AccountAnswer } from "@/components/thread-next/account-answer";
import { NextAssistantTurn } from "@/components/thread-next/assistant-label";
import type { GaugeState } from "@/components/thread-next/answer-gauge";
import { AnswerOutline } from "@/components/thread-next/answer-outline";
import { AnswerSheet } from "@/components/thread-next/answer-sheet";
import { PackSentence } from "@/components/thread-next/answer-sentence";
import { FallbackAnswer } from "@/components/thread-next/fallback-answer";
import { FollowupChips } from "@/components/thread-next/followup-chips";
import { LandingGroup } from "@/components/thread-next/landing-group";
import { PackAnswer, packLastLand, type PackQueue, type PackRow } from "@/components/thread-next/pack-answer";
import { RemixAnswer } from "@/components/thread-next/remix-answer";
import { RunStatus } from "@/components/thread-next/run-status";
import { ScriptAnswer } from "@/components/thread-next/script-answer";
import { CopyButton, SaveButton } from "@/components/thread-next/sheet-actions";
import { HookSheetBody, IdeaSheetBody, type SheetGauge } from "@/components/thread-next/sheet-body";
import { NextUserTurn, type UserTurnVideo } from "@/components/thread-next/user-turn";
import { VideoAnswerView, posterOf } from "@/components/thread-next/video-answer";
import { VideoRunning } from "@/components/thread-next/video-running";
import {
  ACCOUNT_READ_BARE,
  ACCOUNT_READ_FULL,
  BLUEPRINT_ANSWER,
  HOOK_1_POPULATION,
  IDEAS_4,
  IDEA_SHEET,
  MEAL_PREP_HOOKS,
  REMIX_CAMERA,
  REMIX_DECODED,
  REMIX_FILMED,
  SCRIPT_AI,
  SCRIPT_FILMED,
  SCRIPT_PLANNED,
  SEALS_DONE,
  composed,
  population,
  proof,
  remix,
} from "@/components/thread-next/__tests__/fixtures/answers";
import middle from "@/lib/result/__tests__/fixtures/middle.json";
import { timecode } from "@/lib/result/format";
import { resultHref } from "@/lib/result/href";
import { textResultOf } from "@/lib/result/text-result";
import type { ResultRow, ResultState } from "@/lib/result/types";
import { videoStateOf } from "@/lib/result/video-model";
import type { HookCardBlock, HookProof } from "@/lib/tools/blocks";
import type { ChatTurnKind } from "@/lib/tools/chat-followups";
import type { RunEvidence } from "@/lib/tools/evidence";
import { fallbackOf } from "@/lib/thread-next/fallback-lines";
import { landStyle } from "@/lib/thread-next/landing";
import { nextFollowups } from "@/lib/thread-next/next-followups";
import { rowProofOf } from "@/lib/thread-next/row-proof";
import { outlineOf, statusWords, usualNote } from "@/lib/thread-next/run-status";
import { stopNumberOf } from "@/lib/thread-next/stop-number";
import { paintTheme, readThemeChoice } from "@/lib/theme/theme";

/**
 * The answer states on fixtures, for /dev/answers (`page.tsx`). The cards, the gauges, the turn,
 * the bubble and the chips are the real parts. Text numbers come from fixture seals through the
 * real `stopNumberOf`; the line under a pack is the thread's own `PackSentence` (Maven's pick before
 * the numbers, the measured sentence once every row has one); the video's numbers come from the
 * recorded run `middle` through the real `videoStateOf`, the model `/simulation/[id]` renders. Every
 * handler does nothing, so the controls look as they do in a thread; nothing is sent.
 *
 * The wait (thread feel §4.2, §4.3): the line and the outlines are the real `RunStatus` and
 * `AnswerOutline`, their words from the real `statusWords` and `usualNote` (the note as it reads at
 * the start of a run). `wl` plays a landing: w3's outline, then the p3 pack in its place inside the
 * real `LandingGroup`, its rows one after another (the page's key replays it on a reload).
 */

export type DevAnswersState =
  | "p3"
  | "p3v"
  | "p3n"
  | "p4"
  | "p5"
  | "p12"
  | "p8"
  | "p9"
  | "p9b"
  | "p10"
  | "p10b"
  | "p10c"
  | "p10p"
  | "p11"
  | "p11b"
  | "p11c"
  | "p11d"
  | "p13"
  | "p14"
  | "p15"
  | "d3"
  | "p7"
  | "p7l"
  | "p7n"
  | "p6"
  | "p6b"
  | "p6i"
  | "w1"
  | "w2"
  | "w3"
  | "w4"
  | "w5"
  | "w6"
  | "wl";
export type DevAnswersSkin = "light" | "dark";

const empty: GaugeState = { kind: "empty" };
const sealed = (key: string): GaugeState => {
  const value = stopNumberOf(SEALS_DONE[key]);
  return value === null ? empty : { kind: "done", value };
};

/** The result page a simulated text opens here (the drawing's P7): a row's gauge and the sheet's link. */
const RESULT_HREF = "/dev/answers?state=p7";

/** The pack's rows as the thread builds them: a hook's proven video through the real `rowProofOf`, its
 *  rank and plain reason for the line under the pack (Maven's pick). */
const hookRows = (states: (key: string, i: number) => GaugeState, blocks: readonly HookCardBlock[] = MEAL_PREP_HOOKS): PackRow[] =>
  blocks.map((b, i) => {
    const state = states(b.props.hookLine, i);
    return {
      key: b.props.hookLine,
      text: b.props.hookLine,
      state,
      href: state.kind === "done" ? RESULT_HREF : null,
      proof: rowProofOf(b.props.proof),
      rank: b.props.rank,
      why: b.props.why,
    };
  });

const withProof = (block: HookCardBlock, p: HookProof): HookCardBlock => ({ ...block, props: { ...block.props, proof: p } });

/** p3v: the three kinds of proven video a row can show: a cover and views (hook 1's own), views
 *  without a cover, a cover without views. Made-up handles. */
const PROOF_KINDS: readonly HookCardBlock[] = [
  MEAL_PREP_HOOKS[0]!,
  withProof(MEAL_PREP_HOOKS[1]!, proof({ handle: "creator_one", views: 854_000 })),
  withProof(MEAL_PREP_HOOKS[2]!, proof({ handle: "creator_two", coverUrl: "/covers/c9.jpg" })),
];

/** p3n: the same hooks as a pack written before the plain reasons: no `why` on any block. */
const NO_REASONS: readonly HookCardBlock[] = MEAL_PREP_HOOKS.map(({ type, props: { why: _why, ...props } }) => ({ type, props }));

const ideaRows = (): PackRow[] =>
  IDEAS_4.map((b) => ({ key: b.props.title, text: b.props.title, sub: b.props.angle || b.props.take || null, state: empty }));

/** The recorded run, its scenes given `<base>/<index>.jpg` when the page has a frames base. */
function recordedRow(frames: string | null): ResultRow {
  const row = middle as unknown as ResultRow;
  if (!frames || !row.heatmap) return row;
  const base = frames.replace(/\/+$/, "");
  const segments = row.heatmap.segments ?? [];
  return {
    ...row,
    heatmap: { ...row.heatmap, segments: segments.map((s, i) => ({ ...s, keyframe_uri: `${base}/${i}.jpg` })) },
    variants: { ...row.variants, filmstrip_segments: segments.map((s, i) => ({ idx: s.idx, keyframe_uri: `${base}/${i}.jpg` })) },
  };
}

/** The opening simulated: a seal's number, read the real way. */
const OPENING_DONE: GaugeState = { kind: "done", value: stopNumberOf({ population: population(41) }) ?? 0 };

const MORE_REMIXES = [
  REMIX_CAMERA,
  remix("Nobody tells you the cheapest protein is in the freezer aisle", {
    formatBorrowed: "Cold open → List → Payoff",
    proof: proof({ handle: "nia.tests", views: 1_200_000 }),
  }),
  remix("I ate on $20 a week for a month, here is the list", { proof: proof({ handle: "dij.arc", views: 21000 }) }),
];

interface DevTurn {
  ask: string;
  video?: UserTurnVideo | null;
  answer: React.ReactNode;
  /** Under the card: the pack's line (`PackSentence`: Maven's pick or the computed sentence), as the thread's turn draws it. */
  sentence?: React.ReactNode;
  chips: ChatTurnKind | null;
}

const HOOKS_ASK = "3 hooks for a video about meal prep for busy students";

const noop = () => {};
const emptyHook = () => ({ state: empty, onSimulate: noop });

function packTurn(ask: string, kind: "hook" | "idea", rows: PackRow[], queue: PackQueue | null, chips: ChatTurnKind | null): DevTurn {
  return {
    ask,
    // `onOpen`: the rows as the thread draws them since step 2, each one button with its chevron.
    answer: <PackAnswer kind={kind} rows={rows} queue={queue} onSimulate={noop} onSimulateAll={noop} onScript={noop} onOpen={noop} />,
    sentence: <PackSentence kind={kind} rows={rows} />,
    chips,
  };
}

const done = (name: string) => ({ name, status: "done" });
const active = (name: string) => ({ name, status: "active" });

/** A grounded run's evidence: three videos without pictures (their covers are plain tiles) and the
 *  topical headline, as `evidenceHeadline` writes it. */
const GROUNDED: RunEvidence = {
  headline: "Reading 3 real videos matched to this subject",
  items: [1, 2, 3].map((n) => ({ kind: "video" as const, label: `creator_${n}`, metric: `${n * 7}K views` })),
};

/** The post a remix run fetched (made up). */
const FETCHED_POST: RunEvidence = {
  headline: "Reworking this video",
  items: [{ kind: "video", image: "/covers/c9.jpg", label: "creator_one", metric: "154K views" }],
};

/** The wait of a run, as the turn draws it: its outline with the line as its header, or the line alone. */
function waitOf(skill: string, stages: { name: string; status: string }[], evidence: RunEvidence | null): React.ReactNode {
  const words = statusWords(skill, stages);
  const note = usualNote(skill, 0);
  const outline = outlineOf(skill);
  return outline ? <AnswerOutline kind={outline} words={words} note={note} evidence={evidence} /> : <RunStatus words={words} note={note} />;
}

/** How long p11c's read takes, so its two ghost rows can be seen. */
const BEATS_READ_MS = 900;

/** p11c's read: the fixed answer, after a moment; nothing is fetched. */
const readFixedBeats = () => new Promise<unknown>((resolve) => setTimeout(() => resolve(BLUEPRINT_ANSWER), BEATS_READ_MS));

/** How long `wl` waits before its pack lands. */
const LANDING_AFTER_MS = 2_500;

function turnOf(state: DevAnswersState, ctx: { frames: string | null; startedAt: number }): DevTurn | null {
  const row = recordedRow(ctx.frames);
  const firstFrame = ctx.frames ? `${ctx.frames.replace(/\/+$/, "")}/0.jpg` : null;
  const recorded = videoStateOf(row);
  const tile: UserTurnVideo = {
    posterUrl: firstFrame,
    durationLabel: recorded.kind === "result" ? timecode(recorded.model.clipS) : null,
  };
  const videoTurn = (view: ResultState, chips: ChatTurnKind | null): DevTurn => ({
    ask: "Simulate this",
    video: tile,
    answer: <VideoAnswerView state={view} posterUrl={posterOf(view, firstFrame)} href={resultHref(row.id)} />,
    chips,
  });

  switch (state) {
    case "p3":
    case "p6b":
      return packTurn(HOOKS_ASK, "hook", hookRows(() => empty), null, "hooks");
    case "p3v":
      return packTurn(HOOKS_ASK, "hook", hookRows(() => empty, PROOF_KINDS), null, "hooks");
    case "p3n":
      return packTurn(HOOKS_ASK, "hook", hookRows(() => empty, NO_REASONS), null, "hooks");
    // Hook 1 landed (its seal), hook 2 runs, hook 3 waits its turn: "2 of 3". The drawing shows no chips here.
    case "p4":
      return packTurn(
        HOOKS_ASK,
        "hook",
        hookRows((key, i) => (i === 0 ? sealed(key) : i === 1 ? { kind: "running" } : { kind: "waiting" })),
        { done: 1, total: 3 },
        null,
      );
    case "p5":
    case "p6":
      return packTurn(HOOKS_ASK, "hook", hookRows(sealed), null, "hooks");
    case "p12":
    case "p6i":
      return packTurn("4 ideas for next week", "idea", ideaRows(), null, "ideas");
    case "p8":
      return {
        ask: "Simulate this",
        video: tile,
        answer: <VideoRunning file={null} analysisId={row.id} startedAt={ctx.startedAt} />,
        chips: null,
      };
    case "p9":
    case "d3":
      return videoTurn(recorded, "test");
    case "p9b":
      return videoTurn({ kind: "loading" }, null);
    case "p10":
    case "p10b":
      return {
        ask: "Script an AI simulation video",
        answer: (
          <ScriptAnswer block={SCRIPT_AI} opener={{ state: state === "p10" ? empty : OPENING_DONE, onSimulate: noop }} onAddTake={noop} />
        ),
        chips: "script",
      };
    // "How to film it" (thread depth §3.2): cues on three beats and a plan with its edit; a plan alone.
    // The card holds the sheet's state itself, so pressing the button opens it here as in a thread.
    case "p10c":
    case "p10p":
      return {
        ask: "Script an AI simulation video",
        answer: <ScriptAnswer block={state === "p10c" ? SCRIPT_FILMED : SCRIPT_PLANNED} opener={{ state: empty, onSimulate: noop }} onAddTake={noop} />,
        chips: "script",
      };
    case "p11":
      return {
        ask: "Remix @lacapture’s video",
        answer: <RemixAnswer items={[REMIX_CAMERA]} hookOf={emptyHook} onScript={noop} />,
        chips: "remix",
      };
    case "p11b":
      return {
        ask: "Remix @lacapture’s video",
        answer: <RemixAnswer items={MORE_REMIXES} hookOf={emptyHook} onScript={noop} />,
        chips: "remix",
      };
    // "How to film it" on a remix (thread depth, second part §4): a decode, beats and a plan (the beats
    // from a fixed answer, after a moment); a decode only. The card holds the sheet's state itself.
    case "p11c":
    case "p11d":
      return {
        ask: "Remix @creator_one’s video",
        answer: <RemixAnswer items={[state === "p11c" ? REMIX_FILMED : REMIX_DECODED]} hookOf={emptyHook} onScript={noop} loadBeats={readFixedBeats} />,
        chips: "remix",
      };
    // The fallback card, on a block that still falls back (the drawing's account read has its own card now).
    case "p13": {
      const { title, lines } = fallbackOf(composed());
      return { ask: "Compare my two hooks", answer: <FallbackAnswer title={title} lines={lines} />, chips: null };
    }
    // The account read's own card (thread depth, second part §3): everything; no fix, covers or picture.
    case "p14":
    case "p15":
      return {
        ask: "Read my account",
        answer: <AccountAnswer block={state === "p14" ? ACCOUNT_READ_FULL : ACCOUNT_READ_BARE} onIdeas={noop} />,
        chips: "account",
      };
    case "w1":
      return { ask: "What should I post this week?", answer: waitOf("chat", [], null), chips: null };
    case "w2":
      return { ask: HOOKS_ASK, answer: waitOf("hooks", [], null), chips: null };
    case "w3":
    case "wl":
      return { ask: HOOKS_ASK, answer: waitOf("hooks", [done("Finding proven outliers")], GROUNDED), chips: null };
    case "w4":
      return { ask: "Write the script for hook 2.", answer: waitOf("script", [active("Generating")], null), chips: null };
    case "w5":
      return { ask: "Remix this video", answer: waitOf("remix", [done("Resolving"), active("Decoding")], FETCHED_POST), chips: null };
    case "w6":
      return { ask: "Find outliers in my niche", answer: waitOf("explore", [], null), chips: null };
    case "p7":
    case "p7l":
    case "p7n":
      return null;
  }
}

/**
 * wl: w3's wait, then after `LANDING_AFTER_MS` the p3 pack in its place, landing as a live turn's
 * does: inside `LandingGroup` from 0 ms, the rows one after another, the button, the chips 3 after.
 */
function DevLanding({ wait }: { wait: DevTurn }) {
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLanded(true), LANDING_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);
  const pack = packTurn(HOOKS_ASK, "hook", hookRows(() => empty), null, "hooks");
  return (
    <>
      <NextUserTurn text={wait.ask} />
      <NextAssistantTurn>
        {landed ? (
          <LandingGroup sinceMs={0}>
            {pack.answer}
            {pack.sentence}
            <div className="land -mt-0.5" style={landStyle(packLastLand(MEAL_PREP_HOOKS.length) + 3)}>
              <FollowupChips followups={nextFollowups("hooks")} onPick={noop} />
            </div>
          </LandingGroup>
        ) : (
          wait.answer
        )}
      </NextAssistantTurn>
    </>
  );
}

/** The sheet, open when the page opens; it holds its own state, so Escape, the scrim and the handle close it. */
function DevSheet({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <AnswerSheet open={open} onOpenChange={setOpen} title={title}>
      {children}
    </AnswerSheet>
  );
}

/** The sheet open over its pack (P6): presentational, so nothing is sent, copied or saved. */
function sheetOf(state: DevAnswersState): React.ReactNode {
  const actions = (
    <>
      <CopyButton copied={false} onCopy={noop} />
      <SaveButton saved={false} onToggle={noop} />
    </>
  );
  if (state === "p6" || state === "p6b") {
    const hook = MEAL_PREP_HOOKS[0]!.props;
    const gauge: SheetGauge = {
      state: state === "p6" ? sealed(hook.hookLine) : empty,
      failed: false,
      text: hook.hookLine,
      href: state === "p6" ? RESULT_HREF : null,
      onSimulate: noop,
    };
    return (
      <DevSheet title={hook.hookLine}>
        <HookSheetBody hook={hook} gauge={gauge} actions={actions} onScript={noop} />
      </DevSheet>
    );
  }
  if (state === "p6i") {
    const idea = IDEA_SHEET.props;
    return (
      <DevSheet title={idea.title}>
        <IdeaSheetBody idea={idea} gauge={{ state: empty, failed: false, text: idea.title, href: null, onSimulate: noop }} actions={actions} onScript={noop} />
      </DevSheet>
    );
  }
  return null;
}

export function DevAnswers({ state, skin, frames }: { state: DevAnswersState; skin: DevAnswersSkin; frames: string | null }) {
  // The skin for this page only: painted, not stored; the stored choice comes back on leaving.
  useEffect(() => {
    paintTheme(skin);
    return () => {
      paintTheme(readThemeChoice());
    };
  }, [skin]);
  // The running card's clock, as drawn: 41 seconds in when the page opens.
  const [startedAt] = useState(() => Date.now() - 41_000);

  if (state === "p7" || state === "p7l" || state === "p7n") {
    const view: TextResultState =
      state === "p7"
        ? { kind: "result", text: MEAL_PREP_HOOKS[0]!.props.hookLine, model: textResultOf(HOOK_1_POPULATION)! }
        : state === "p7l"
          ? { kind: "loading" }
          : { kind: "not-found" };
    return (
      <div className="min-h-full bg-background">
        <TextResultView state={view} as="hook" onScript={noop} />
      </div>
    );
  }
  const s = turnOf(state, { frames, startedAt })!;

  return (
    <div className="min-h-full bg-background">
      {/* The drawing's thread starts 110 from the top on a phone (under the 46 band <main> keeps)
          and 90 on a desk; the column is the drawing's (16 gutters on a phone, 720 on a desk). */}
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-4 pb-16 pt-16 md:px-0 md:pt-[90px]">
        {state === "wl" ? (
          <DevLanding wait={s} />
        ) : (
          <>
            <NextUserTurn text={s.ask} video={s.video} />
            <NextAssistantTurn>
              {s.answer}
              {s.sentence}
              {s.chips && <FollowupChips followups={nextFollowups(s.chips)} onPick={noop} className="-mt-0.5" />}
            </NextAssistantTurn>
          </>
        )}
      </div>
      {sheetOf(state)}
    </div>
  );
}
