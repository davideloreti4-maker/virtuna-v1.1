/** @vitest-environment happy-dom */

/**
 * The new answer renderer under the flag (plan 2026-11-21, thread answers step 1, Task 5), reached the
 * way the thread reaches it: through the real `ThreadTurn` export, whose constant fork picks
 * `ThreadTurnNext` in the flag-on build.
 *
 * Real components throughout: the turn, the cards, the real `TextSimProvider` holding the seal map
 * the way the composer does, the real card-action contexts. The one stand-in is the network: a
 * `fetch` stub whose every call waits until the test answers it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { ThreadTurn, type ThreadTurnProps } from "@/components/thread/thread-turn";
import { TextSimProvider } from "../text-sim";
import { reactRequestBody } from "@/components/app/home/v8/fire-sim";
import { FollowupContext, type FollowupHandler } from "@/lib/followup-context";
import { HookWriteScriptContext, type OnWriteScriptFn } from "@/lib/hook-test-context";
import { ScriptTestContext, type OnTestScriptFn } from "@/lib/script-test-context";
import { runErrorCopy } from "@/lib/net/run-failure";
import { scriptBrief } from "@/lib/script-utils";
import { nextFollowups } from "@/lib/thread-next/next-followups";
import type { WireSimSealMap } from "@/lib/onboarding/verdict-seal";
import {
  IDEAS_4,
  MEAL_PREP_HOOKS,
  REMIX_CAMERA,
  SCRIPT_AI,
  SEALS_DONE,
  accountRead,
  corpus,
  hook,
  idea,
  inputRequest,
  md,
  population,
  remix,
  runHeader,
  script,
  video,
} from "./fixtures/answers";

// ─── The network stand-in ────────────────────────────────────────────────────

interface Call {
  url: string;
  body: Record<string, unknown> | null;
  resolve: (r: Response) => void;
}

let calls: Call[] = [];

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (url: string, init?: RequestInit) =>
        new Promise<Response>((resolve) => {
          calls.push({ url: String(url), body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null, resolve });
        }),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const reacts = () => calls.filter((c) => c.url.includes("/api/tools/react"));
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
/** The `react` route's 200 body with a population at `stopPct`. */
const reacted = (stopPct: number) => json({ fraction: "6/10 stop", scrollQuote: "", personas: [], population: population(stopPct), slice: null });

// ─── The harness: the composer's half ────────────────────────────────────────

function Seals({ initial, children }: { initial: WireSimSealMap; children: React.ReactNode }) {
  const [seals, setSeals] = useState<WireSimSealMap>(initial);
  return (
    <TextSimProvider seals={seals} onSealed={(key, seal) => setSeals((m) => ({ ...m, [key]: seal }))}>
      {children}
    </TextSimProvider>
  );
}

interface Opts {
  seals?: WireSimSealMap;
  writeScript?: OnWriteScriptFn;
  testScript?: OnTestScriptFn;
  followup?: FollowupHandler;
}

function renderTurn(props: ThreadTurnProps, opts: Opts = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (p: ThreadTurnProps) => (
    <QueryClientProvider client={qc}>
      <FollowupContext.Provider value={opts.followup}>
        <HookWriteScriptContext.Provider value={opts.writeScript ?? null}>
          <ScriptTestContext.Provider value={opts.testScript ?? null}>
            <Seals initial={opts.seals ?? {}}>
              <ThreadTurn {...p} />
            </Seals>
          </ScriptTestContext.Provider>
        </HookWriteScriptContext.Provider>
      </FollowupContext.Provider>
    </QueryClientProvider>
  );
  const r = render(ui(props));
  return { ...r, rerender: (p: ThreadTurnProps) => r.rerender(ui(p)) };
}

const cards = (root: ParentNode = document) => root.querySelectorAll('[data-answer="card"]');
const gauges = () => screen.queryAllByRole("button", { name: /^Simulate: / });
/** Let any stray continuation run, so "no second request" is not a timing accident. */
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
}

const [HOOK_1, HOOK_2, HOOK_3] = MEAL_PREP_HOOKS.map((b) => b.props.hookLine) as [string, string, string];
const ASK = "3 hooks for a video about meal prep for busy students";
const AGENT_LINE = "Five hooks are on screen. The strongest names a real cost.";
const OUTRO = "#1 is your strongest. Want me to turn it into a script?";

/** A reloaded hooks turn: the stamp, the pack, the chat agent's sentence, the closing line. */
const HOOKS_TURN = [runHeader("hooks", "@nia.tests"), ...MEAL_PREP_HOOKS, md(AGENT_LINE, "chat-agent"), md(OUTRO)];

/** None of the old narration, anywhere in the document. */
function expectNoNarration() {
  for (const gone of [/Pulled hooks/, /Pulling hooks/, /Ran your audience/, /Write a script from/, /Find new outliers/, /strongest/]) {
    expect(screen.queryByText(gone)).toBeNull();
  }
  expect(screen.queryByTestId("run-receipt")).toBeNull();
  expect(screen.queryByLabelText("Model follow-up")).toBeNull();
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("a reloaded hooks turn", () => {
  it("shows the bubble, the Maven label and ONE card; no intro, receipt, outro, agent sentence or forward chip", () => {
    const { container } = renderTurn({ userTurn: ASK, blocks: HOOKS_TURN, ambientBaseIndex: 0 });
    expect(screen.getByText(ASK)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Maven" })).toBeInTheDocument();
    expect(cards(container)).toHaveLength(1);
    expect(gauges()).toHaveLength(3);
    expect(screen.queryByText(AGENT_LINE)).toBeNull();
    expectNoNarration();
    // The room is off: no scroll-spy anchors, even with a ledger offset passed.
    expect(container.querySelector("[data-ambient-card]")).toBeNull();
  });

  it("the chips are the kind's two, under the card, and only when the turn is the last answer", () => {
    const { rerender } = renderTurn({ userTurn: ASK, blocks: HOOKS_TURN });
    const row = screen.getByTestId("followup-row");
    expect(within(row).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(
      nextFollowups("hooks").map((f) => `Follow up: ${f.label}`),
    );
    expect(within(row).getAllByRole("button").map((b) => b.textContent)).toEqual(["More hooks", "Punch them up"]);
    expect(cards()[0]!.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    rerender({ userTurn: ASK, blocks: HOOKS_TURN, showFollowups: false });
    expect(screen.queryByTestId("followup-row")).toBeNull();
  });

  it("a rewrite chip carries the pack's lines", () => {
    const followup = vi.fn();
    renderTurn({ userTurn: ASK, blocks: HOOKS_TURN }, { followup });
    fireEvent.click(screen.getByRole("button", { name: "Follow up: Punch them up" }));
    expect(followup).toHaveBeenCalledWith("Rewrite these hooks tighter and more specific.", "hooks", { cards: [HOOK_1, HOOK_2, HOOK_3] });
  });

  it("a turn with no stamp is read from its cards: the same one card, no narration", () => {
    const { container } = renderTurn({ userTurn: ASK, blocks: [...MEAL_PREP_HOOKS, md(OUTRO)] });
    expect(cards(container)).toHaveLength(1);
    expectNoNarration();
    expect(screen.getByRole("button", { name: "Follow up: More hooks" })).toBeInTheDocument();
  });

  it("two runs in one turn are two cards", () => {
    const { container } = renderTurn({
      userTurn: ASK,
      blocks: [runHeader("hooks"), hook("First run, hook one"), hook("First run, hook two"), runHeader("hooks"), hook("Second run, hook one")],
    });
    expect(cards(container)).toHaveLength(2);
    expect(gauges()).toHaveLength(3);
  });
});

describe("the hook pack's numbers and actions", () => {
  it("the sentence shows only when every row has a number", () => {
    const { unmount } = renderTurn({ userTurn: ASK, blocks: HOOKS_TURN }, { seals: SEALS_DONE });
    for (const n of [30, 22, 45]) expect(screen.getByRole("img", { name: `${n}% would stop to watch` })).toBeInTheDocument();
    expect(screen.getByText("Best")).toBeInTheDocument();
    const sentence = screen.getByText("Hook 3 leads by 15 points.");
    // Under the card, above the chips.
    expect(cards()[0]!.compareDocumentPosition(sentence) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sentence.compareDocumentPosition(screen.getByTestId("followup-row")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    unmount();

    const two: WireSimSealMap = { [HOOK_1]: SEALS_DONE[HOOK_1]!, [HOOK_3]: SEALS_DONE[HOOK_3]! };
    renderTurn({ userTurn: ASK, blocks: HOOKS_TURN }, { seals: two });
    expect(screen.getByRole("img", { name: "45% would stop to watch" })).toBeInTheDocument();
    expect(screen.queryByText(/leads by|No clear winner/)).toBeNull();
  });

  it("a gauge tap runs one `react` with the hook's legacy body; a second tap waits its turn", async () => {
    renderTurn({ userTurn: ASK, blocks: HOOKS_TURN });
    fireEvent.click(screen.getByRole("button", { name: `Simulate: ${HOOK_1.slice(0, 59).trimEnd()}…` }));
    fireEvent.click(gauges().find((g) => g.getAttribute("aria-label")!.startsWith(`Simulate: ${HOOK_2.slice(0, 20)}`))!);
    await settle();
    expect(reacts()).toHaveLength(1);
    expect(reacts()[0]!.body).toEqual(reactRequestBody({ text: HOOK_1, kind: "hook" }));
    await act(async () => reacts()[0]!.resolve(reacted(30)));
    expect(await screen.findByRole("img", { name: "30% would stop to watch" })).toBeInTheDocument();
    await waitFor(() => expect(reacts()).toHaveLength(2));
    expect(reacts()[1]!.body).toEqual(reactRequestBody({ text: HOOK_2, kind: "hook" }));
  });

  it("Simulate all queues the rows and shows the progress line in place of the primary", async () => {
    renderTurn({ userTurn: ASK, blocks: HOOKS_TURN });
    fireEvent.click(screen.getByRole("button", { name: "Simulate all 3, 3 credits" }));
    await settle();
    expect(reacts()).toHaveLength(1);
    expect(screen.getByRole("progressbar", { name: "Simulating" })).toHaveAttribute("aria-valuetext", "1 of 3");
    expect(screen.queryByRole("button", { name: /Simulate all/ })).toBeNull();
  });

  it("no chips while the answer's rows simulate (drawing P4); they come back once the batch ends", async () => {
    renderTurn({ userTurn: ASK, blocks: HOOKS_TURN });
    expect(screen.getAllByRole("button", { name: /^Follow up: / })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Simulate all 3, 3 credits" }));
    await settle();
    expect(screen.queryAllByRole("button", { name: /^Follow up: / })).toHaveLength(0);
    for (const [i, pct] of [30, 22, 45].entries()) {
      await waitFor(() => expect(reacts()).toHaveLength(i + 1));
      await act(async () => reacts()[i]!.resolve(reacted(pct)));
    }
    await waitFor(() => expect(screen.getAllByRole("button", { name: /^Follow up: / })).toHaveLength(2));
  });

  it("Script the best hands the best hook and its audience tag to the write-script handoff", () => {
    const writeScript = vi.fn();
    renderTurn({ userTurn: ASK, blocks: HOOKS_TURN }, { seals: SEALS_DONE, writeScript });
    fireEvent.click(screen.getByRole("button", { name: "Script the best, 2 credits" }));
    expect(writeScript).toHaveBeenCalledWith(HOOK_3, "lurker");
  });

  it("outside the provider and the handoff the controls render disabled", () => {
    render(<ThreadTurn userTurn={ASK} blocks={HOOKS_TURN} />);
    for (const g of gauges()) expect(g).toBeDisabled();
    expect(screen.getByRole("button", { name: "Simulate all 3, 3 credits" })).toBeDisabled();
  });
});

describe("the idea pack", () => {
  const IDEAS = [runHeader("ideas"), ...IDEAS_4];

  it("one card: title and its grey line per row; a tap simulates the title as an idea", async () => {
    const { container } = renderTurn({ userTurn: "4 ideas for next week", blocks: IDEAS });
    expect(cards(container)).toHaveLength(1);
    expect(screen.getByText("Short sessions stick better.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Follow up: / }).map((b) => b.textContent)).toEqual(["More ideas", "Sharper angles"]);
    fireEvent.click(screen.getByRole("button", { name: "Simulate: The ‘Productivity Porn’ Trap" }));
    await settle();
    expect(reacts()[0]!.body).toEqual(reactRequestBody({ text: "The ‘Productivity Porn’ Trap", kind: "idea" }));
  });

  it("a turn holding a hooks run and then an ideas run takes the chips of its last run", () => {
    renderTurn({ userTurn: "ideas", blocks: [runHeader("hooks"), ...MEAL_PREP_HOOKS, runHeader("ideas"), ...IDEAS_4] });
    expect(screen.getAllByRole("button", { name: /^Follow up: / }).map((b) => b.textContent)).toEqual(["More ideas", "Sharper angles"]);
  });

  it("a row's line is its take's first sentence, else its angle; scripting an idea sends its seed hook", () => {
    const writeScript = vi.fn();
    const a = idea("Idea A", "A long angle about A. It goes on.", { take: "The first take is short. And more of it.", seedHook: "Seed of A" });
    const b = idea("Idea B", "Angle of B");
    const seals: WireSimSealMap = {
      "Idea A": { pct: 0, band: null, at: "2026-11-21T00:00:00Z", population: population(50) },
      "Idea B": { pct: 0, band: null, at: "2026-11-21T00:00:00Z", population: population(45) },
    };
    renderTurn({ userTurn: "ideas", blocks: [a, b] }, { seals, writeScript });
    expect(screen.getByText("The first take is short.")).toBeInTheDocument();
    expect(screen.queryByText(/A long angle about A/)).toBeNull();
    expect(screen.getByText("Angle of B")).toBeInTheDocument();
    expect(screen.getByText("No clear winner.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Script idea 1, 2 credits" }));
    expect(writeScript).toHaveBeenCalledWith("Seed of A", "");
  });
});

describe("the script", () => {
  const OPENER = SCRIPT_AI.props.openingBeatSeed;

  it("the opening simulates as a script, and its number is looked up by the same text", async () => {
    const { unmount } = renderTurn({ userTurn: "Script an AI simulation video", blocks: [runHeader("script"), SCRIPT_AI] });
    fireEvent.click(screen.getByRole("button", { name: /^Simulate the opening: I fed 10 million/ }));
    await settle();
    expect(reacts()).toHaveLength(1);
    expect(reacts()[0]!.body).toEqual(reactRequestBody({ text: OPENER, kind: "script" }));
    unmount();

    const seals: WireSimSealMap = { [OPENER]: { pct: 0, band: null, at: "2026-11-21T00:00:00Z", population: population(41) } };
    renderTurn({ userTurn: "Script an AI simulation video", blocks: [runHeader("script"), SCRIPT_AI] }, { seals });
    expect(screen.getByRole("img", { name: "41% would stop to watch" })).toBeInTheDocument();
  });

  it("with no seed, the opening is the first beat (fired and looked up alike)", async () => {
    const s = script(undefined, { openingBeatSeed: "" });
    renderTurn({ userTurn: "a script", blocks: [s] });
    fireEvent.click(screen.getByRole("button", { name: "Simulate the opening: Here is the fastest lunch I make." }));
    await settle();
    expect(reacts()[0]!.body).toEqual(reactRequestBody({ text: "Here is the fastest lunch I make.", kind: "script" }));
  });

  it("Add your take hands the opener and the legacy brief to the Simulate handoff", () => {
    const testScript = vi.fn();
    renderTurn({ userTurn: "Script an AI simulation video", blocks: [runHeader("script"), SCRIPT_AI] }, { testScript });
    fireEvent.click(screen.getByRole("button", { name: "Add your take" }));
    expect(testScript).toHaveBeenCalledWith(OPENER, scriptBrief(SCRIPT_AI.props.beats));
    expect(testScript.mock.calls[0]![1]).toMatch(/^\[Hook\] I fed 10 million viral videos .* \/ \[Setup\] It watched my draft/);
    expect(screen.getAllByRole("button", { name: /^Follow up: / }).map((b) => b.textContent)).toEqual(["Make it punchier", "Different angle"]);
  });
});

describe("the remix", () => {
  it("a run of remix cards is one card with a pager; the hook simulates as a remix; Script it writes from it", async () => {
    const writeScript = vi.fn();
    const other = remix("Nobody tells you the cheapest protein is in the freezer aisle");
    const { container } = renderTurn(
      { userTurn: "Remix @lacapture’s video", blocks: [runHeader("remix"), REMIX_CAMERA, other, remix("A third remix")] },
      { writeScript },
    );
    expect(cards(container)).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Remix 1 of 3" })).toBeInTheDocument();
    const hookText = REMIX_CAMERA.props.adaptedHook;
    fireEvent.click(screen.getByRole("button", { name: `Simulate the hook: ${hookText}` }));
    await settle();
    expect(reacts()[0]!.body).toEqual(reactRequestBody({ text: hookText, kind: "remix" }));
    fireEvent.click(screen.getByRole("button", { name: "Script it, 2 credits" }));
    expect(writeScript).toHaveBeenCalledWith(hookText, "");
  });
});

describe("a video turn", () => {
  it("the video card, its link to the result page, and the tile above the bubble", () => {
    const v = video("an-1", { durationLabel: "0:29", filmstrip: [{ idx: 0, label: "Cold open", atMs: 0, mark: null, keyframeUrl: "/frames/first.jpg" }] });
    const { container } = renderTurn({ userTurn: "take.mp4", blocks: [runHeader("test"), v] });
    expect(cards(container)).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Open simulation" })).toHaveAttribute("href", "/simulation/an-1");
    expect(screen.getByRole("img", { name: "Video, 0:29" })).toBeInTheDocument();
    expect(screen.queryByText(/Tested against your audience|Testing your video/)).toBeNull();
  });
});

describe("a chat answer, and the blocks with no card of their own", () => {
  it("a plain answer is its text, no card, with the chat chips", () => {
    const { container } = renderTurn({ userTurn: "Why does the first one work?", blocks: [md("The **$40-to-$5** contrast opens a curiosity gap.")] });
    expect(cards(container)).toHaveLength(0);
    expect(container.querySelector(".md strong")?.textContent).toBe("$40-to-$5");
    expect(screen.getAllByRole("button", { name: /^Follow up: / }).map((b) => b.textContent)).toEqual(["Give me ideas", "Write hooks"]);
  });

  // Drawing `.ax-say p` (P13): 15.5 / 22 in proportional figures. The `.md` layer keeps its size (15)
  // and its measure; the turn sets the leading, and proportional figures so "re-watch" keeps a tight
  // hyphen (the new look sets tabular figures on the body, which widen Inter's hyphen).
  it("a plain answer reads at the drawing's 22 leading, in proportional figures", () => {
    const { container } = renderTurn({ userTurn: "q", blocks: [md("A re-watch is a signal.")] });
    const host = container.querySelector(".md")!.parentElement!;
    expect(host.className.split(/\s+/)).toEqual(expect.arrayContaining(["proportional-nums", "[&_.md]:leading-[22px]"]));
  });

  it("text beside sources: the text, then the sources as the fallback card", () => {
    const { container } = renderTurn({ userTurn: "what works in meal prep?", blocks: [md("Cheap, fast and honest wins."), corpus()] });
    expect(screen.getByText("Cheap, fast and honest wins.")).toBeInTheDocument();
    expect(cards(container)).toHaveLength(1);
    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByText("@lacapture · 154K views")).toBeInTheDocument();
  });

  it("an account read is the fallback card: its title, three lines, Show all", () => {
    renderTurn({ userTurn: "Read my account", blocks: [runHeader("account"), accountRead()] });
    expect(screen.getByText("Your account")).toBeInTheDocument();
    expect(screen.getByText("Mostly talking to camera.")).toBeInTheDocument();
    expect(screen.queryByText("Your first second is often a slow pan.")).toBeNull();
    expect(screen.getByRole("button", { name: "Show all" })).toBeInTheDocument();
  });

  it("a link field keeps its legacy renderer, beside the agent's text", () => {
    renderTurn({ userTurn: "remix something", blocks: [md("Send me the link."), inputRequest()] });
    expect(screen.getByText("Send me the link.")).toBeInTheDocument();
    expect(screen.getByText("Paste the video link and I'll adapt it for your audience.")).toBeInTheDocument();
  });
});

describe("while a run is live", () => {
  const preamble = md("On it, generating a few angles.");

  it("a hooks run shows only \"Writing hooks\" until it settles, then the card and the chips", () => {
    const live = { skill: "hooks" as const, isStreaming: true, stages: [{ name: "Generating", status: "active" as const }] };
    const { container, rerender } = renderTurn({ userTurn: ASK, blocks: [runHeader("hooks"), preamble, ...MEAL_PREP_HOOKS], live });
    expect(screen.getByRole("status")).toHaveTextContent("Writing hooks");
    expect(cards(container)).toHaveLength(0);
    expect(screen.queryByText("On it, generating a few angles.")).toBeNull();
    expect(screen.queryByTestId("followup-row")).toBeNull();
    expectNoNarration();

    // The stages are done: the cards land while the stream stays open for the closing line.
    rerender({
      userTurn: ASK,
      blocks: [runHeader("hooks"), preamble, ...MEAL_PREP_HOOKS],
      live: { ...live, stages: [{ name: "Generating", status: "done" }] },
    });
    expect(screen.queryByRole("status")).toBeNull();
    expect(cards(container)).toHaveLength(1);
    expect(screen.queryByText("On it, generating a few angles.")).toBeNull();

    rerender({ userTurn: ASK, blocks: [runHeader("hooks"), preamble, ...MEAL_PREP_HOOKS, md(OUTRO)], live: { ...live, isStreaming: false, stages: [] } });
    expect(cards(container)).toHaveLength(1);
    expect(screen.getByTestId("followup-row")).toBeInTheDocument();
    expectNoNarration();
  });

  it("stages done but no card in yet: the row stays and no chips show (never an empty flash)", () => {
    renderTurn({ userTurn: ASK, blocks: [runHeader("hooks")], live: { skill: "hooks", isStreaming: true, stages: [{ name: "Generating", status: "done" }] } });
    expect(screen.getByRole("status")).toHaveTextContent("Writing hooks");
    expect(screen.queryByTestId("followup-row")).toBeNull();
  });

  it("a fresh dispatch with no stages yet is live too", () => {
    renderTurn({ userTurn: ASK, blocks: [], live: { skill: "hooks", isStreaming: true, stages: [] } });
    expect(screen.getByRole("status")).toHaveTextContent("Writing hooks");
  });

  it.each([
    ["ideas", "Finding ideas"],
    ["script", "Writing your script"],
    ["remix", "Reworking the video"],
    ["explore", "Scanning for outliers"],
    ["account", "Reading your account"],
    // Not one of the named runs: the honest "Thinking" (never "Testing your video").
    ["test", "Thinking"],
    ["predict", "Thinking"],
  ] as const)("a live %s run says \"%s\"", (skill, label) => {
    renderTurn({ userTurn: "go", blocks: [md("preamble text")], live: { skill, isStreaming: true, stages: [] } });
    expect(screen.getByRole("status")).toHaveTextContent(label);
    expect(screen.queryByText("preamble text")).toBeNull();
    expect(screen.queryByText(/Testing/)).toBeNull();
  });

  it("a plain question (no guess) says \"Thinking\" until its text streams, then streams the text", () => {
    const live = { skill: "chat" as const, isStreaming: true, stages: [] };
    const { rerender } = renderTurn({ userTurn: "hi", blocks: [], live });
    expect(screen.getByRole("status")).toHaveTextContent("Thinking");
    rerender({ userTurn: "hi", blocks: [md("Post three times")], live });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("Post three times")).toBeInTheDocument();
    expect(screen.queryByTestId("followup-row")).toBeNull();
  });

  // Fix round 1 (2), spec §4.8: before `dispatch` names the run, a guessed run's preamble is not an
  // answer. "Thinking" (never the guess itself), no text, no chips, while the stream is open.
  it("a guessed run (preGuess) says only \"Thinking\" while it streams, even with prose in", () => {
    const live = { skill: "chat" as const, isStreaming: true, stages: [], preGuess: "hooks" };
    const { rerender } = renderTurn({ userTurn: "hooks for my app", blocks: [], live });
    expect(screen.getByRole("status")).toHaveTextContent("Thinking");
    expect(screen.queryByText(/Looks like/)).toBeNull();
    rerender({ userTurn: "hooks for my app", blocks: [md("On it, generating a few angles.")], live });
    expect(screen.getByRole("status")).toHaveTextContent("Thinking");
    expect(screen.queryByText("On it, generating a few angles.")).toBeNull();
    expect(screen.queryByTestId("followup-row")).toBeNull();
  });

  it("a guessed run that never dispatched shows its text once the stream ends", () => {
    const live = { skill: "chat" as const, isStreaming: false, stages: [], preGuess: "hooks" };
    renderTurn({ userTurn: "hooks for my app", blocks: [md("Which angle do you want: the price or the speed?")], live });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("Which angle do you want: the price or the speed?")).toBeInTheDocument();
    expect(screen.getByTestId("followup-row")).toBeInTheDocument();
  });

  // Fix round 1 (1): a chat-dispatched run finishes its stages, then bills, then writes its cards,
  // so for a round trip the blocks are only the streamed preamble. No text and no chips flash.
  it.each([
    ["a skill run", [runHeader("hooks"), md("On it, generating a few angles.")]],
    ["a chat-dispatched run (no stamp yet)", [md("On it, generating a few angles.")]],
  ])("%s with every stage done and no card yet: the waiting row only", (_, blocks) => {
    renderTurn({ userTurn: ASK, blocks, live: { skill: "hooks", isStreaming: true, stages: [{ name: "Ranking", status: "done" }] } });
    expect(screen.getByRole("status")).toHaveTextContent("Writing hooks");
    expect(screen.queryByText("On it, generating a few angles.")).toBeNull();
    expect(screen.queryByTestId("followup-row")).toBeNull();
  });

  it("an errored run shows today's error copy and Retry", () => {
    const onRetry = vi.fn();
    renderTurn({ userTurn: ASK, blocks: [], live: { skill: "hooks", isStreaming: false, stages: [], error: "boom", onRetry } });
    const copy = runErrorCopy("boom", "hooks");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(copy.headline);
    fireEvent.click(within(alert).getByRole("button"));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("a reset live run with nothing in it renders nothing", () => {
    const { container } = renderTurn({ userTurn: null, blocks: [], live: { skill: "hooks", isStreaming: false, stages: [] } });
    expect(container.textContent).toBe("");
  });
});
