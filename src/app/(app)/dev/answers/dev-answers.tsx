"use client";

import { useEffect, useState } from "react";

import { NextAssistantTurn } from "@/components/thread-next/assistant-label";
import type { GaugeState } from "@/components/thread-next/answer-gauge";
import { PackSentence } from "@/components/thread-next/answer-sentence";
import { FallbackAnswer } from "@/components/thread-next/fallback-answer";
import { FollowupChips } from "@/components/thread-next/followup-chips";
import { PackAnswer, type PackQueue, type PackRow } from "@/components/thread-next/pack-answer";
import { RemixAnswer } from "@/components/thread-next/remix-answer";
import { ScriptAnswer } from "@/components/thread-next/script-answer";
import { NextUserTurn, type UserTurnVideo } from "@/components/thread-next/user-turn";
import { VideoAnswerView, posterOf } from "@/components/thread-next/video-answer";
import { VideoRunning } from "@/components/thread-next/video-running";
import {
  IDEAS_4,
  MEAL_PREP_HOOKS,
  REMIX_CAMERA,
  SCRIPT_AI,
  SEALS_DONE,
  accountRead,
  population,
  proof,
  remix,
} from "@/components/thread-next/__tests__/fixtures/answers";
import middle from "@/lib/result/__tests__/fixtures/middle.json";
import { timecode } from "@/lib/result/format";
import { resultHref } from "@/lib/result/href";
import type { ResultRow, ResultState } from "@/lib/result/types";
import { videoStateOf } from "@/lib/result/video-model";
import type { ChatTurnKind } from "@/lib/tools/chat-followups";
import { fallbackOf } from "@/lib/thread-next/fallback-lines";
import { nextFollowups } from "@/lib/thread-next/next-followups";
import { stopNumberOf } from "@/lib/thread-next/stop-number";
import { paintTheme, readThemeChoice } from "@/lib/theme/theme";

/**
 * The answer states on fixtures, for /dev/answers (`page.tsx`). The cards, the gauges, the turn,
 * the bubble and the chips are the real parts. Text numbers come from fixture seals through the
 * real `stopNumberOf`; the sentence under a simulated pack is the thread's own `PackSentence`; the
 * video's numbers come from the recorded run `middle` through the real `videoStateOf`, the model
 * `/simulation/[id]` renders. Every handler does nothing, so the
 * controls look as they do in a thread; nothing is sent.
 */

export type DevAnswersState =
  | "p3"
  | "p4"
  | "p5"
  | "p12"
  | "p8"
  | "p9"
  | "p9b"
  | "p10"
  | "p10b"
  | "p11"
  | "p11b"
  | "p13"
  | "d3";
export type DevAnswersSkin = "light" | "dark";

const empty: GaugeState = { kind: "empty" };
const sealed = (key: string): GaugeState => {
  const value = stopNumberOf(SEALS_DONE[key]);
  return value === null ? empty : { kind: "done", value };
};

const hookRows = (states: (key: string, i: number) => GaugeState): PackRow[] =>
  MEAL_PREP_HOOKS.map((b, i) => ({ key: b.props.hookLine, text: b.props.hookLine, state: states(b.props.hookLine, i) }));

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
  /** Under the card: the pack's computed sentence (`PackSentence`), as the thread's turn draws it. */
  sentence?: React.ReactNode;
  chips: ChatTurnKind | null;
}

const HOOKS_ASK = "3 hooks for a video about meal prep for busy students";

const noop = () => {};
const emptyHook = () => ({ state: empty, onSimulate: noop });

function packTurn(ask: string, kind: "hook" | "idea", rows: PackRow[], queue: PackQueue | null, chips: ChatTurnKind | null): DevTurn {
  return {
    ask,
    answer: <PackAnswer kind={kind} rows={rows} queue={queue} onSimulate={noop} onSimulateAll={noop} onScript={noop} />,
    sentence: <PackSentence kind={kind} rows={rows} />,
    chips,
  };
}

function turnOf(state: DevAnswersState, ctx: { frames: string | null; startedAt: number }): DevTurn {
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
      return packTurn(HOOKS_ASK, "hook", hookRows(() => empty), null, "hooks");
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
      return packTurn(HOOKS_ASK, "hook", hookRows(sealed), null, "hooks");
    case "p12":
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
    case "p13": {
      const { title, lines } = fallbackOf(accountRead());
      return { ask: "Read my account", answer: <FallbackAnswer title={title} lines={lines} />, chips: null };
    }
  }
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

  const s = turnOf(state, { frames, startedAt });

  return (
    <div className="min-h-full bg-background">
      {/* The drawing's thread starts 110 from the top on a phone (under the 46 band <main> keeps)
          and 90 on a desk; the column is the drawing's (16 gutters on a phone, 720 on a desk). */}
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-4 pb-16 pt-16 md:px-0 md:pt-[90px]">
        <NextUserTurn text={s.ask} video={s.video} />
        <NextAssistantTurn>
          {s.answer}
          {s.sentence}
          {s.chips && <FollowupChips followups={nextFollowups(s.chips)} onPick={noop} className="-mt-0.5" />}
        </NextAssistantTurn>
      </div>
    </div>
  );
}
