/**
 * What a chat holds and how it did, for its Library row (plan 2026-11-23-library).
 *
 * The inputs are the stored shapes. Message bodies are built from the thread's real block fixtures
 * (`thread-next/__tests__/fixtures/answers.ts`, every block accepted by the registry), both as a bare
 * blocks array and wrapped with the KC stamp the way `insertMessage` stores them. Seals go through the
 * real `readSimSeals`, as the server will read them off `threads.sim_seals`.
 *
 * Built by hand (no fixture exists): the VIDEO seal, in the shape `/api/tools/test/card` writes (step
 * 9b: keyed by the analysis id, the run's own heatmap copied in, the fold's population beside it),
 * around a RECORDED run (`result/__tests__/fixtures`, the rows `GET /api/analysis/[id]` returned).
 *
 * Nothing stands in for our own code.
 */
import { describe, expect, it } from "vitest";
import {
  IDEAS_4,
  MEAL_PREP_HOOKS,
  REMIX_CAMERA,
  SCRIPT_AI,
  broughtCard,
  hook,
  md,
  population,
  remix,
  runHeader,
  script,
  video,
} from "@/components/thread-next/__tests__/fixtures/answers";
import type { HeatmapPayload } from "@/lib/engine/types";
import { kcStamp } from "@/lib/kc/kc-stamp";
import early from "@/lib/result/__tests__/fixtures/early.json";
import ending from "@/lib/result/__tests__/fixtures/ending.json";
import holds from "@/lib/result/__tests__/fixtures/holds.json";
import leak from "@/lib/result/__tests__/fixtures/leak.json";
import middle from "@/lib/result/__tests__/fixtures/middle.json";
import noGroups from "@/lib/result/__tests__/fixtures/no-groups.json";
import opening from "@/lib/result/__tests__/fixtures/opening.json";
import { audienceOf } from "@/lib/result/curve";
import { headlineOf } from "@/lib/result/headline";
import type { ResultRow } from "@/lib/result/types";
import { videoStateOf } from "@/lib/result/video-model";
import { stopNumberOf } from "@/lib/thread-next/stop-number";
import { readSimSeals, type SimSealMap } from "@/lib/threads/sim-seals";
import { chatSummaryOf, insideLabel, measureWords, piecesOf, type ChatSummary } from "../chat-summary";

// ─── Stored shapes ───────────────────────────────────────────────────────────

/** A message body stored without a stamp: the bare blocks array. */
const bare = (...blocks: unknown[]): unknown => blocks;
/** A message body stored with the KC stamp (`insertMessage` with a `kcGenVersion`). */
const stamped = (...blocks: unknown[]): unknown => ({ kcGenVersion: kcStamp().kcGenVersion, blocks });
/** A thread's `sim_seals` as the server reads it. */
const sealsOf = (raw: Record<string, unknown>): SimSealMap => readSimSeals({ sim_seals: raw as never });

const T10 = "2026-11-21T10:00:00.000Z";
const T11 = "2026-11-21T11:00:00.000Z";

/** A text seal as `/api/tools/react` writes it. `pct` is a decoy at 70: it must never be the number. */
const textSeal = (stopPct: number, at = T10) => ({ pct: 70, band: "Mixed", at, population: population(stopPct) });

type RecordedRow = ResultRow & { id: string; heatmap: HeatmapPayload };
const recorded = (r: unknown) => r as RecordedRow;

/**
 * The seal `/api/tools/test/card` writes for a finished run (step 9b), keyed by the analysis id: the
 * row's heatmap column copied in whole, the would-stop hold as `pct`/`stopPct`, and the fold's
 * population beside it (its `stopPct` is a decoy: a video's number is never `stopNumberOf`).
 */
function videoSealOf(row: RecordedRow, at = T11) {
  const hold = row.heatmap.weighted_hook_score ?? row.heatmap.weighted_completion_pct ?? 0;
  const pct = Math.max(0, Math.min(100, Math.round(hold * 100)));
  return {
    pct,
    band: null,
    at,
    population: population(12),
    video: { analysisId: row.id, stopPct: pct, craftScore: null, heatmap: row.heatmap, videoSignals: null, verbatim: null },
  };
}

/** The same recorded run with a stored frame address on its scene `index` (relative path, invented). */
function withFrame(row: RecordedRow, index: number, address: string): RecordedRow {
  return {
    ...row,
    heatmap: {
      ...row.heatmap,
      segments: row.heatmap.segments.map((s, i) => (i === index ? { ...s, keyframe_uri: address } : s)),
    },
  };
}

const [HOOK_1, HOOK_2] = MEAL_PREP_HOOKS.map((b) => b.props.hookLine) as [string, string, string];
const HOOKS_BODY = stamped(runHeader("hooks"), ...MEAL_PREP_HOOKS, md("#1 is your strongest."));
const ZERO = { hooks: 0, ideas: 0, scripts: 0, remixes: 0, videos: 0, texts: 0 };

// ─── 1. A plain chat ─────────────────────────────────────────────────────────

describe("a chat with no pieces", () => {
  it("only markdown: nothing counted, a chat, nothing simulated, no frame", () => {
    const s = chatSummaryOf([bare(md("How do I start a cooking channel?")), stamped(md("Start with one dish you make every week."))], {});
    expect(s).toEqual<ChatSummary>({ counts: ZERO, lead: "chat", stage: "chat", sim: null, frame: null });
    expect(insideLabel(s)).toBe("Chat");
  });

  it("no messages at all is a chat", () => {
    expect(chatSummaryOf([], {})).toEqual<ChatSummary>({ counts: ZERO, lead: "chat", stage: "chat", sim: null, frame: null });
  });
});

// ─── 2–4. Hooks ──────────────────────────────────────────────────────────────

describe("hooks", () => {
  it("three hook cards and no seals: a draft of 3 hooks", () => {
    const s = chatSummaryOf([bare(md("3 hooks for meal prep")), HOOKS_BODY], {});
    expect(s.counts).toEqual({ ...ZERO, hooks: 3 });
    expect(s.lead).toBe("hooks");
    expect(s.stage).toBe("draft");
    expect(s.sim).toBeNull();
    expect(insideLabel(s)).toBe("3 hooks");
  });

  it("one hook is 1 hook", () => {
    expect(insideLabel(chatSummaryOf([bare(hook("One hook only"))], {}))).toBe("1 hook");
  });

  it("a seal with a number for the second hook: simulated, its number, its text, as a hook", () => {
    const raw = textSeal(22);
    const seals = sealsOf({ [HOOK_2]: raw });
    const s = chatSummaryOf([HOOKS_BODY], seals);
    expect(s.stage).toBe("simulated");
    expect(s.lead).toBe("hooks");
    expect(s.sim).toEqual({
      number: stopNumberOf(seals[HOOK_2]),
      measure: "stop",
      at: T10,
      kind: "hooks",
      link: { type: "text", text: HOOK_2.trim(), as: "hook" },
    });
    expect(s.sim!.number).toBe(22);
    expect(s.frame).toBeNull();
  });

  it("the number is rounded the way stopNumberOf rounds it", () => {
    const seals = sealsOf({ [HOOK_1]: textSeal(29.6) });
    expect(chatSummaryOf([HOOKS_BODY], seals).sim!.number).toBe(stopNumberOf(seals[HOOK_1])!);
    expect(chatSummaryOf([HOOKS_BODY], seals).sim!.number).toBe(30);
  });

  it("a card's text is trimmed into its key, and the link carries the trimmed text", () => {
    const seals = sealsOf({ "A padded hook line.": textSeal(41) });
    const s = chatSummaryOf([bare(hook("   A padded hook line.  "))], seals);
    expect(s.sim?.link).toEqual({ type: "text", text: "A padded hook line.", as: "hook" });
    expect(s.sim?.number).toBe(41);
  });

  it("a seal without a number does not count: no population, a null one, or a stopPct out of range", () => {
    const seals = sealsOf({
      [HOOK_1]: { pct: 70, band: "Strong", at: T10 },
      [HOOK_2]: { pct: 70, band: "Strong", at: T10, population: null },
      [MEAL_PREP_HOOKS[2]!.props.hookLine]: { pct: 70, band: "Strong", at: T10, population: { ...population(50), stopPct: 140 } },
    });
    const s = chatSummaryOf([HOOKS_BODY], seals);
    expect(s.stage).toBe("draft");
    expect(s.sim).toBeNull();
    expect(s.lead).toBe("hooks");
  });

  it("a seal stored under a text with a video depth is not a text's number (the text result page refuses it)", () => {
    const row = recorded(middle);
    const seals = sealsOf({ [HOOK_1]: { ...videoSealOf(row), population: population(40) } });
    expect(chatSummaryOf([HOOKS_BODY], seals).sim).toBeNull();
  });
});

// ─── 5. Ideas, scripts, remixes, brought text ────────────────────────────────

describe("ideas, scripts, remixes and brought text", () => {
  it("ideas link as an idea, by the idea's title", () => {
    const title = IDEAS_4[1]!.props.title;
    const s = chatSummaryOf([stamped(runHeader("ideas"), ...IDEAS_4)], sealsOf({ [title]: textSeal(44) }));
    expect(s.counts).toEqual({ ...ZERO, ideas: 4 });
    expect(s.sim).toMatchObject({ number: 44, kind: "ideas", link: { type: "text", text: title, as: "idea" } });
    expect(insideLabel(s)).toBe("4 ideas");
    expect(insideLabel(chatSummaryOf([bare(IDEAS_4[0]!)], {}))).toBe("1 idea");
  });

  it("a script is keyed by its opening seed and links as an opening line", () => {
    const opener = SCRIPT_AI.props.openingBeatSeed!;
    const s = chatSummaryOf([stamped(runHeader("script"), SCRIPT_AI)], sealsOf({ [opener]: textSeal(41) }));
    expect(s.counts).toEqual({ ...ZERO, scripts: 1 });
    expect(s.sim).toMatchObject({ number: 41, kind: "script", link: { type: "text", text: opener, as: "opening" } });
    expect(insideLabel(s)).toBe("Script");
  });

  it("the seed wins over the first beat when the two differ", () => {
    const seed = "A seed line that is not the first beat.";
    const s = script(undefined, { openingBeatSeed: seed });
    expect(s.props.beats[0]!.content).not.toBe(seed);
    const summary = chatSummaryOf([bare(s)], sealsOf({ [seed]: textSeal(39), [s.props.beats[0]!.content]: textSeal(90) }));
    expect(summary.sim).toMatchObject({ number: 39, link: { type: "text", text: seed, as: "opening" } });
  });

  it("a script with no seed is keyed by its first beat's content", () => {
    const s = script(undefined, { openingBeatSeed: "" });
    const first = s.props.beats[0]!.content;
    const summary = chatSummaryOf([bare(s)], sealsOf({ [first]: textSeal(37) }));
    expect(summary.sim).toMatchObject({ number: 37, kind: "script", link: { type: "text", text: first, as: "opening" } });
  });

  it("a script with no opening at all is a draft piece that can never be numbered", () => {
    const s = script([{ content: "", timing: "0–3s" }], { openingBeatSeed: "" });
    const summary = chatSummaryOf([bare(s)], sealsOf({ "": textSeal(50) }));
    expect(summary.counts).toEqual({ ...ZERO, scripts: 1 });
    expect(summary.stage).toBe("draft");
    expect(summary.sim).toBeNull();
  });

  it("two script cards are 2 scripts", () => {
    expect(insideLabel(chatSummaryOf([bare(SCRIPT_AI), stamped(script())], {}))).toBe("2 scripts");
  });

  it("a remix is keyed by its adapted hook and links as a hook", () => {
    const adapted = REMIX_CAMERA.props.adaptedHook;
    const s = chatSummaryOf([stamped(runHeader("remix"), REMIX_CAMERA)], sealsOf({ [adapted]: textSeal(33) }));
    expect(s.counts).toEqual({ ...ZERO, remixes: 1 });
    expect(s.sim).toMatchObject({ number: 33, kind: "remix", link: { type: "text", text: adapted, as: "hook" } });
    expect(insideLabel(s)).toBe("Remix");
    expect(insideLabel(chatSummaryOf([bare(REMIX_CAMERA, remix("Another adapted hook"))], {}))).toBe("2 remixes");
  });

  it("brought text is keyed by its stimulus and links as a hook", () => {
    const card = broughtCard({ stimulus: "  My own hook about cheap lunches " });
    const s = chatSummaryOf([stamped(card)], sealsOf({ "My own hook about cheap lunches": textSeal(58) }));
    expect(s.counts).toEqual({ ...ZERO, texts: 1 });
    expect(s.sim).toMatchObject({
      number: 58,
      kind: "text",
      link: { type: "text", text: "My own hook about cheap lunches", as: "hook" },
    });
    expect(insideLabel(s)).toBe("Text");
    expect(insideLabel(chatSummaryOf([bare(broughtCard(), broughtCard({ stimulus: "Another" }))], {}))).toBe("2 texts");
  });
});

// ─── 6. Videos ───────────────────────────────────────────────────────────────

describe("a video", () => {
  const RUNS = { early, middle, opening, leak, holds, ending } as const;

  for (const [name, fixture] of Object.entries(RUNS)) {
    it(`${name}: the number is the result page's "watch to the end", computed from the seal alone`, () => {
      const row = recorded(fixture);
      const seals = sealsOf({ [row.id]: videoSealOf(row) });
      const s = chatSummaryOf([bare(md("take.mp4")), stamped(runHeader("test"), video(row.id))], seals);

      // The brief's equality: the same function over the seal's own copy of the data.
      const fromSeal = headlineOf(audienceOf({ id: row.id, heatmap: seals[row.id]!.video!.heatmap })!).value;
      // And the result page's: `videoStateOf` over the whole stored row (variants and all).
      const page = videoStateOf(row);
      if (page.kind !== "result") throw new Error(`${name} has no result`);

      expect(s.sim).toEqual({
        number: fromSeal,
        measure: "end",
        at: T11,
        kind: "video",
        link: { type: "video", analysisId: row.id },
      });
      expect(s.sim!.number).toBe(page.model.headline.value);
      // Never the seal's other numbers: the hold, nor the fold population's stop rate.
      expect(s.sim!.number).not.toBe(stopNumberOf(seals[row.id]));
      expect(s.stage).toBe("simulated");
      expect(s.lead).toBe("video");
      expect(insideLabel(s)).toBe("Video");
    });
  }

  it("a video card with no seal is a draft video", () => {
    const s = chatSummaryOf([stamped(runHeader("test"), video("an-unsealed-run"))], {});
    expect(s.counts).toEqual({ ...ZERO, videos: 1 });
    expect(s.stage).toBe("draft");
    expect(s.lead).toBe("video");
    expect(s.sim).toBeNull();
    expect(s.frame).toBeNull();
  });

  it("a verdict-only seal under the analysis id (no video depth) leaves the video unnumbered", () => {
    const seals = sealsOf({ "an-1": { pct: 64, band: null, at: T11, population: population(64) } });
    expect(chatSummaryOf([bare(video("an-1"))], seals).sim).toBeNull();
  });

  it("a run whose audience the result page cannot draw (no groups) stays unnumbered", () => {
    const row = recorded(noGroups);
    expect(audienceOf(row)).toBeNull();
    const s = chatSummaryOf([bare(video(row.id))], sealsOf({ [row.id]: videoSealOf(row) }));
    expect(s.sim).toBeNull();
    expect(s.stage).toBe("draft");
  });

  it("two videos are 2 videos", () => {
    expect(insideLabel(chatSummaryOf([bare(video("an-1")), bare(video("an-2"))], {}))).toBe("2 videos");
  });
});

// ─── 7. Several pieces ───────────────────────────────────────────────────────

describe("a chat with several pieces", () => {
  const row = recorded(middle);
  const bodies = [HOOKS_BODY, bare(md("take.mp4")), stamped(runHeader("test"), video(row.id))];

  it("the piece simulated last is the row's: the video at 11:00 over the hooks at 10:00", () => {
    const s = chatSummaryOf(bodies, sealsOf({ [HOOK_1]: textSeal(30, T10), [row.id]: videoSealOf(row, T11) }));
    expect(s.sim?.kind).toBe("video");
    expect(s.lead).toBe("video");
    expect(s.counts).toEqual({ ...ZERO, hooks: 3, videos: 1 });
    expect(insideLabel(s)).toBe("Video");
  });

  it("swap the times: the hooks are the row's", () => {
    const s = chatSummaryOf(bodies, sealsOf({ [HOOK_1]: textSeal(30, T11), [row.id]: videoSealOf(row, T10) }));
    expect(s.sim).toMatchObject({ kind: "hooks", number: 30, at: T11 });
    expect(s.lead).toBe("hooks");
    expect(insideLabel(s)).toBe("3 hooks");
  });

  it("the latest time wins, whatever the message order", () => {
    const s = chatSummaryOf([HOOKS_BODY], sealsOf({ [HOOK_1]: textSeal(30, T11), [HOOK_2]: textSeal(22, T10) }));
    expect(s.sim).toMatchObject({ number: 30, link: { text: HOOK_1 } });
  });

  it("a numbered seal with no stored time is still simulated, but any timed one beats it", () => {
    const untimed = { pct: 70, band: null, population: population(51) };
    expect(chatSummaryOf([HOOKS_BODY], sealsOf({ [HOOK_2]: untimed })).sim).toMatchObject({ number: 51, at: "" });
    const s = chatSummaryOf([HOOKS_BODY], sealsOf({ [HOOK_1]: textSeal(30, T10), [HOOK_2]: untimed }));
    expect(s.sim).toMatchObject({ number: 30, at: T10 });
  });

  it("with nothing simulated, the lead is the last piece in message order", () => {
    expect(chatSummaryOf(bodies, {}).lead).toBe("video");
    expect(chatSummaryOf([...bodies].reverse(), {}).lead).toBe("hooks");
    expect(chatSummaryOf([bare(SCRIPT_AI), bare(md("Nice, and a remix?")), bare(REMIX_CAMERA)], {}).lead).toBe("remix");
  });
});

// ─── 8. Seals with no card ───────────────────────────────────────────────────

describe("a seal with no card", () => {
  it("a seal whose text matches no block is ignored", () => {
    const s = chatSummaryOf([HOOKS_BODY], sealsOf({ "A hook the creator did not keep": textSeal(80) }));
    expect(s.stage).toBe("draft");
    expect(s.sim).toBeNull();
  });

  it("a card the registry refuses is neither counted nor matched", () => {
    const broken = { type: "hook-card", props: { hookLine: "A broken hook" } };
    const s = chatSummaryOf([bare(broken)], sealsOf({ "A broken hook": textSeal(80) }));
    expect(s).toEqual<ChatSummary>({ counts: ZERO, lead: "chat", stage: "chat", sim: null, frame: null });
  });
});

// ─── 9. The frame ────────────────────────────────────────────────────────────

describe("the frame", () => {
  const FRAME = "/frames/scene-2.jpg";

  it("the first stored frame address in the simulated video's seal, as the result page's poster rule finds it", () => {
    const row = withFrame(withFrame(recorded(middle), 1, FRAME), 3, "/frames/scene-4.jpg");
    const seals = sealsOf({ [row.id]: videoSealOf(row) });
    const s = chatSummaryOf([bare(video(row.id))], seals);
    expect(s.frame).toBe(FRAME);
    // `posterOf` (video-answer.tsx): the first scene with a frame.
    const scenes = audienceOf({ id: row.id, heatmap: seals[row.id]!.video!.heatmap })!.scenes;
    expect(scenes.find((scene) => scene.frame)?.frame).toBe(s.frame);
  });

  it("none when the seal stores no address (every recorded run: the heatmap's addresses are null)", () => {
    const row = recorded(middle);
    expect(chatSummaryOf([bare(video(row.id))], sealsOf({ [row.id]: videoSealOf(row) })).frame).toBeNull();
  });

  it("never the card's own filmstrip address (signed for an hour at card time)", () => {
    const card = video("an-1", { filmstrip: [{ idx: 0, label: "Cold open", atMs: 0, mark: null, keyframeUrl: "/frames/card.jpg" }] });
    expect(chatSummaryOf([bare(card)], {}).frame).toBeNull();
  });

  it("none when the piece simulated last is a text, even with a framed video in the chat", () => {
    const row = withFrame(recorded(middle), 0, FRAME);
    const s = chatSummaryOf(
      [bare(video(row.id)), HOOKS_BODY],
      sealsOf({ [row.id]: videoSealOf(row, T10), [HOOK_1]: textSeal(30, T11) }),
    );
    expect(s.sim?.kind).toBe("hooks");
    expect(s.frame).toBeNull();
  });

  it("with nothing simulated, the last video's stored frame", () => {
    const framed = withFrame(recorded(noGroups), 2, FRAME);
    const s = chatSummaryOf(
      [bare(video("an-earlier")), bare(video(framed.id))],
      sealsOf({ [framed.id]: videoSealOf(framed) }),
    );
    expect(s.sim).toBeNull();
    expect(s.lead).toBe("video");
    expect(s.frame).toBe(FRAME);
  });
});

// ─── 10. Malformed input ─────────────────────────────────────────────────────

describe("malformed stored data", () => {
  it("odd bodies and odd blocks contribute nothing and do not throw", () => {
    const bodies: unknown[] = [
      null,
      undefined,
      "a string",
      42,
      {},
      { blocks: "not an array" },
      { kcGenVersion: "gen.1.1.0", blocks: [{ type: "no-such-block", props: {} }] },
      [null, 7, "s", { props: {} }, { type: 5, props: {} }, { type: "hook-card" }, { type: "hook-card", props: { hookLine: 3 } }],
    ];
    expect(() => chatSummaryOf(bodies, {})).not.toThrow();
    expect(chatSummaryOf(bodies, {})).toEqual<ChatSummary>({ counts: ZERO, lead: "chat", stage: "chat", sim: null, frame: null });
  });

  it("good blocks beside bad ones still count", () => {
    const s = chatSummaryOf([null, bare(null, MEAL_PREP_HOOKS[0], { type: 9 }), "x"], {});
    expect(s.counts).toEqual({ ...ZERO, hooks: 1 });
  });

  it("a video seal whose heatmap passes the parser but is broken inside does not throw and has no number", () => {
    const row = recorded(middle);
    const brokenPersonas = { ...row, heatmap: { ...row.heatmap, personas: "nobody" as never } };
    const brokenSegments = { ...row, heatmap: { ...row.heatmap, segments: [null, 3] as never } };
    for (const broken of [brokenPersonas, brokenSegments]) {
      const seals = sealsOf({ [row.id]: videoSealOf(broken) });
      expect(seals[row.id]!.video).toBeTruthy();
      expect(() => chatSummaryOf([bare(video(row.id))], seals)).not.toThrow();
      expect(chatSummaryOf([bare(video(row.id))], seals)).toMatchObject({ stage: "draft", sim: null, frame: null });
    }
  });

  it("only the map's own entries count: a numbered seal reached through its prototype is no seal", () => {
    const line = "A hook whose seal is only inherited";
    const inherited = Object.create(sealsOf({ [line]: textSeal(80) })) as SimSealMap;
    // A plain lookup reaches it, and it carries a number: only the own-entry rule keeps it out.
    expect(stopNumberOf(inherited[line])).toBe(80);
    expect(Object.keys(inherited)).toEqual([]);
    const s = chatSummaryOf([bare(hook(line), hook("constructor"), hook("toString"))], inherited);
    expect(s).toMatchObject({ counts: { ...ZERO, hooks: 3 }, stage: "draft", sim: null });
  });

  it("a missing seal map or bodies that are not a list do not throw", () => {
    expect(chatSummaryOf([HOOKS_BODY], null as never).stage).toBe("draft");
    expect(chatSummaryOf("nope" as never, {}).stage).toBe("chat");
  });
});

// ─── 11. Words ───────────────────────────────────────────────────────────────

describe("measureWords", () => {
  it("names each measure", () => {
    expect(measureWords("stop")).toBe("would stop to watch");
    expect(measureWords("end")).toBe("watch to the end");
  });

  it('"watch to the end" is the result page\'s own label', () => {
    const audience = audienceOf(recorded(middle))!;
    expect(measureWords("end")).toBe(headlineOf(audience).label);
  });
});

// ─── The pieces, in order ────────────────────────────────────────────────────

describe("piecesOf", () => {
  it("lists every piece in message and block order, with the key its seal is stored under", () => {
    const opener = SCRIPT_AI.props.openingBeatSeed!;
    expect(
      piecesOf([HOOKS_BODY, bare(SCRIPT_AI), stamped(video(" an-1 ")), bare(REMIX_CAMERA, broughtCard()), bare(IDEAS_4[0]!)]),
    ).toEqual([
      ...MEAL_PREP_HOOKS.map((b) => ({ kind: "hooks", key: b.props.hookLine.trim(), as: "hook" })),
      { kind: "script", key: opener, as: "opening" },
      { kind: "video", key: "an-1", analysisId: "an-1" },
      { kind: "remix", key: REMIX_CAMERA.props.adaptedHook, as: "hook" },
      { kind: "text", key: broughtCard().props.stimulus, as: "hook" },
      { kind: "ideas", key: IDEAS_4[0]!.props.title, as: "idea" },
    ]);
  });
});
