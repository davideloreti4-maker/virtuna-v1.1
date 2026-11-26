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
import { ThreadIdContext } from "@/lib/save-provenance-context";
import { scriptBrief } from "@/lib/script-utils";
import { landingKeyOf, markLanded, resetLanding } from "@/lib/thread-next/landing";
import { nextFollowups } from "@/lib/thread-next/next-followups";
import { sealHashOf } from "@/lib/thread-next/seal-hash";
import type { WireSimSealMap } from "@/lib/onboarding/verdict-seal";
import {
  IDEAS_4,
  IDEA_SHEET,
  MEAL_PREP_HOOKS,
  REMIX_CAMERA,
  SCRIPT_AI,
  SCRIPT_FILMED,
  SEALS_DONE,
  ACCOUNT_READ_FULL,
  composed,
  corpus,
  hook,
  idea,
  inputRequest,
  md,
  population,
  proof,
  remix,
  runHeader,
  script,
  video,
} from "./fixtures/answers";

import { settleClock } from "../answer-sheet";

// A sheet takes no click in its first moment (a double-tap's second tap); that window has its own test
// (answer-sheet.test.tsx). Here its clock jumps a second at every read, so a click right after a
// sheet opens counts.
let settleTick = 0;
beforeEach(() => {
  settleTick = 0;
  settleClock.now = () => (settleTick += 1000);
  // The landing's memory is the page's: one case's landing must not carry into the next.
  resetLanding();
});
afterEach(() => {
  settleClock.now = () => performance.now();
});

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
  threadId?: string | null;
}

function renderTurn(props: ThreadTurnProps, opts: Opts = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (p: ThreadTurnProps) => (
    <QueryClientProvider client={qc}>
      <FollowupContext.Provider value={opts.followup}>
        <HookWriteScriptContext.Provider value={opts.writeScript ?? null}>
          <ScriptTestContext.Provider value={opts.testScript ?? null}>
            <ThreadIdContext.Provider value={opts.threadId ?? null}>
              <Seals initial={opts.seals ?? {}}>
                <ThreadTurn {...p} />
              </Seals>
            </ThreadIdContext.Provider>
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
    expect(screen.queryByText(/leads by|is ahead by|a tie/)).toBeNull();
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

  it("while 'Simulate all' runs a landed number is not a link yet (leaving would stop the rows still waiting); it is once the batch ends", async () => {
    renderTurn({ userTurn: ASK, blocks: HOOKS_TURN }, { threadId: "00000000-0000-4000-8000-0000000000bb" });
    fireEvent.click(screen.getByRole("button", { name: "Simulate all 3, 3 credits" }));
    await settle();
    await act(async () => reacts()[0]!.resolve(reacted(30)));
    await waitFor(() => expect(reacts()).toHaveLength(2));
    // The first number is in; its key has had time to resolve; the queue still runs.
    await settle();
    expect(document.querySelector('[data-gauge="done"][data-value="30"]')).not.toBeNull();
    expect(screen.queryByRole("link", { name: /^Open the result: / })).toBeNull();
    await act(async () => reacts()[1]!.resolve(reacted(22)));
    await waitFor(() => expect(reacts()).toHaveLength(3));
    await act(async () => reacts()[2]!.resolve(reacted(45)));
    await waitFor(() => expect(screen.getAllByRole("link", { name: /^Open the result: / })).toHaveLength(3));
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

  it("Script the best hands the best hook, its audience tag and its row (\"hook 3\") to the write-script handoff", () => {
    const writeScript = vi.fn();
    renderTurn({ userTurn: ASK, blocks: HOOKS_TURN }, { seals: SEALS_DONE, writeScript });
    fireEvent.click(screen.getByRole("button", { name: "Script the best, 2 credits" }));
    expect(writeScript).toHaveBeenCalledWith(HOOK_3, "lurker", "hook 3");
  });

  it("Script hook K names its row, 1-based (thread feel §4.7)", () => {
    const writeScript = vi.fn();
    const near = (n: number) => ({ pct: 70, band: null, at: "2026-11-25T00:00:00Z", population: population(n) });
    // Hook 2 leads by 5: no clear best, so the primary names it.
    renderTurn({ userTurn: ASK, blocks: HOOKS_TURN }, { seals: { [HOOK_1]: near(30), [HOOK_2]: near(35), [HOOK_3]: near(28) }, writeScript });
    fireEvent.click(screen.getByRole("button", { name: "Script hook 2, 2 credits" }));
    expect(writeScript).toHaveBeenCalledWith(HOOK_2, "lurker", "hook 2");
  });

  it("outside the provider and the handoff the controls render disabled", () => {
    render(<ThreadTurn userTurn={ASK} blocks={HOOKS_TURN} />);
    for (const g of gauges()) expect(g).toBeDisabled();
    expect(screen.getByRole("button", { name: "Simulate all 3, 3 credits" })).toBeDisabled();
  });
});

// Maven's pick (spec 2026-11-25-maven-pick-design.md §3.1): the line comes from the stored blocks'
// `rank` and `why`, in the measured line's place.
describe("Maven's pick under a stored pack", () => {
  const pick = () => document.querySelector<HTMLElement>('[data-part="pack-pick"]');
  const WHY_1 = MEAL_PREP_HOOKS[0]!.props.why!;

  it("a stored pack with reasons: the line under the card, above the chips, naming the first-ranked hook", () => {
    renderTurn({ userTurn: ASK, blocks: HOOKS_TURN });
    expect(pick()).toHaveTextContent(`Maven would post hook 1. ${WHY_1}`);
    expect(cards()[0]!.compareDocumentPosition(pick()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pick()!.compareDocumentPosition(screen.getByTestId("followup-row")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("the writer's first choice stored in row 2: the line names hook 2", () => {
    const [a, b, c] = MEAL_PREP_HOOKS as [typeof MEAL_PREP_HOOKS[0], typeof MEAL_PREP_HOOKS[0], typeof MEAL_PREP_HOOKS[0]];
    renderTurn({ userTurn: ASK, blocks: [runHeader("hooks"), b, a, c] });
    expect(pick()).toHaveTextContent(`Maven would post hook 2. ${WHY_1}`);
  });

  it("an old stored pack, written before the reasons: no line, as before", () => {
    const old = MEAL_PREP_HOOKS.map(({ type, props: { why: _why, ...props } }) => ({ type, props }));
    renderTurn({ userTurn: ASK, blocks: [runHeader("hooks"), ...old, md(OUTRO)] });
    expect(pick()).toBeNull();
    expect(screen.queryByText(/Maven would post/)).toBeNull();
  });

  it("every row simulated: the measured line in its place, though it names another hook", () => {
    renderTurn({ userTurn: ASK, blocks: HOOKS_TURN }, { seals: SEALS_DONE });
    expect(pick()).toBeNull();
    expect(screen.getByText("Hook 3 leads by 15 points.")).toBeInTheDocument();
  });

  it("a hooks run that lands in this visit brings the line in after the card's button (3), before the chips (6)", () => {
    const waiting = { skill: "hooks" as const, isStreaming: true, stages: [{ name: "Generating", status: "active" as const }] };
    const { rerender } = renderTurn({ userTurn: ASK, blocks: [runHeader("hooks")], live: waiting });
    expect(pick()).toBeNull();
    rerender({ userTurn: ASK, blocks: [runHeader("hooks"), ...MEAL_PREP_HOOKS], live: { ...waiting, stages: [{ name: "Generating", status: "done" }] } });
    expect(pick()!.closest("[data-thread-landing]")).not.toBeNull();
    expect(pick()).toHaveClass("land");
    expect(pick()!.style.getPropertyValue("--i")).toBe("4");
  });
});

// Thread depth §3.3: the rows are built from the blocks, a hook's `proof` included; an idea's is not.
describe("a hook's row shows the video it is built on", () => {
  const proven = () => [...document.querySelectorAll<HTMLElement>('[data-part="row-proof"]')];

  it("from the hook's own proof: '@handle · 21K views' and its cover, on that row only", () => {
    renderTurn({ userTurn: ASK, blocks: HOOKS_TURN });
    const rows = screen.getAllByRole("listitem");
    expect(proven()).toHaveLength(1);
    const line = within(rows[0]!).getByText("@dij.arc · 21K views");
    expect(line.closest('[data-part="row-proof"]')!.querySelector("img")).toHaveAttribute("src", "/covers/c8.jpg");
    expect(within(rows[0]!).getByRole("button", { name: /^Open: I spent \$40/ })).toHaveAccessibleDescription("@dij.arc · 21K views");
    for (const row of rows.slice(1)) expect(row.querySelector('[data-part="row-proof"]')).toBeNull();
  });

  it("ideas are unchanged: an idea's proof shows nothing on its row", () => {
    renderTurn({
      userTurn: "ideas",
      blocks: [runHeader("ideas"), idea("Idea A", "Angle of A", { proof: proof({ handle: "creator_one", coverUrl: "/covers/c8.jpg", views: 854_000 }) })],
    });
    expect(proven()).toHaveLength(0);
    expect(screen.queryByText(/@creator_one/)).toBeNull();
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
    expect(screen.getByText("It's close. Idea 1 is ahead by 5 points.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Script idea 1, 2 credits" }));
    expect(writeScript).toHaveBeenCalledWith("Seed of A", "", "idea 1");
  });
});

describe("the script", () => {
  const OPENER = SCRIPT_AI.props.openingBeatSeed;

  it("its beats named; 'How to film it' only for a script that has cues or a plan, and it opens the sheet", async () => {
    const { unmount } = renderTurn({ userTurn: "script", blocks: [runHeader("script"), SCRIPT_AI] });
    expect([...document.querySelectorAll('[data-part="beat-name"]')].map((n) => n.textContent)).toEqual(["Hook", "Setup", "Turn", "Payoff", "Call to action"]);
    expect(screen.queryByRole("button", { name: "How to film it" })).toBeNull();
    unmount();
    renderTurn({ userTurn: "script", blocks: [runHeader("script"), SCRIPT_FILMED] });
    fireEvent.click(screen.getByRole("button", { name: "How to film it" }));
    const dialog = await screen.findByRole("dialog", { name: "How to film it" });
    expect(dialog.querySelectorAll('[data-sheet="film-beat"]')).toHaveLength(3);
    expect(dialog.querySelectorAll('[data-sheet="film-plan"]')).toHaveLength(4);
  });

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

describe("step 2: a pack row opens its details", () => {
  const THREAD = "00000000-0000-4000-8000-0000000000bb";
  const HOOK_1 = MEAL_PREP_HOOKS[0]!.props.hookLine;
  const seal = (n: number) => ({ pct: 70, band: null, at: "2026-11-22T00:00:00Z", population: population(n) });
  const hooksTurn = (): ThreadTurnProps => ({ userTurn: "3 hooks", blocks: [runHeader("hooks"), ...MEAL_PREP_HOOKS] });
  const rowButton = (text: string) => screen.getByRole("button", { name: (name) => name.startsWith(`Open: ${text.slice(0, 30)}`) });

  it("a double click on the card's primary writes one script (2 credits), not two", () => {
    const writeScript = vi.fn();
    const seals: WireSimSealMap = Object.fromEntries(MEAL_PREP_HOOKS.map((b, k) => [b.props.hookLine, seal([30, 22, 45][k]!)]));
    renderTurn(hooksTurn(), { seals, writeScript });
    const primary = screen.getByRole("button", { name: "Script the best, 2 credits" });
    fireEvent.click(primary);
    fireEvent.click(primary);
    expect(writeScript).toHaveBeenCalledTimes(1);
  });

  it("a tap on a row opens its sheet: the hook large, why, visual, proof; none of the old card's numbers", () => {
    renderTurn(hooksTurn());
    fireEvent.click(rowButton(HOOK_1));
    const dialog = screen.getByRole("dialog", { name: HOOK_1 });
    expect(within(dialog).getByRole("heading", { level: 2, name: HOOK_1 })).toBeInTheDocument();
    expect(within(dialog).getByText("Why it works")).toBeInTheDocument();
    expect(within(dialog).getByText("Sad grey food next to textbooks")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /^Proven: @dij\.arc/ })).toHaveAttribute("target", "_blank");
    expect(within(dialog).queryByText("5/10 stop")).toBeNull();
    expect(within(dialog).queryByText("Mixed")).toBeNull();
  });

  it("Simulate in the sheet runs the thread's one queue once (1 credit); the number lands and the link names the thread and the key", async () => {
    renderTurn(hooksTurn(), { threadId: THREAD });
    const row = rowButton(HOOK_1);
    fireEvent.click(row);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^Simulate: I spent \$40/ }));
    expect(reacts()).toHaveLength(1);
    expect(reacts()[0]!.body).toEqual(reactRequestBody({ text: HOOK_1, kind: "hook" }));
    expect(within(dialog).getByText("Simulating")).toBeInTheDocument();
    // The row's own gauge runs too: one queue (`hidden`: the open dialog hides the thread behind it).
    expect(within(row.closest("li")!).getByRole("img", { name: "Simulating", hidden: true })).toBeInTheDocument();
    await act(async () => reacts()[0]!.resolve(reacted(30)));
    const link = await within(dialog).findByRole("link", { name: /^Open the result: I spent \$40/ });
    expect(link).toHaveAttribute("href", `/simulation/hook/${THREAD}/${await sealHashOf(HOOK_1)}`);
    // The name replaces the content, so the number is read as the link's description (fix round 1).
    expect(link).toHaveAccessibleDescription("30% would stop to watch");
    expect(within(dialog).getByRole("img", { name: "30% would stop to watch" })).toBeInTheDocument();
    expect(reacts()).toHaveLength(1);
  });

  it("no dead link: a simulated text's link appears only once its key is known", async () => {
    const fresh = "A hook no other test hashes, for the link's first tick.";
    renderTurn({ userTurn: "x", blocks: [runHeader("hooks"), hook(fresh)] }, { threadId: THREAD, seals: { [fresh]: seal(41) } });
    fireEvent.click(rowButton(fresh));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("would stop to watch")).toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: /^Open the result/ })).toBeNull();
    expect(await within(dialog).findByRole("link", { name: /^Open the result/ })).toHaveAttribute(
      "href",
      `/simulation/hook/${THREAD}/${await sealHashOf(fresh)}`,
    );
  });

  it("without a thread id the number shows and nothing links", async () => {
    renderTurn(hooksTurn(), { seals: SEALS_DONE });
    fireEvent.click(rowButton(HOOK_1));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(within(screen.getByRole("dialog")).queryByRole("link", { name: /^Open the result/ })).toBeNull();
  });

  it("Save keeps the row's own ref and the thread", async () => {
    renderTurn(
      { ...hooksTurn(), blockOrigins: [0, 1, 2, 3].map((index) => ({ messageId: "m1", index })) },
      { threadId: THREAD },
    );
    fireEvent.click(rowButton(MEAL_PREP_HOOKS[1]!.props.hookLine));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.some((c) => c.url === "/api/saved" && c.body)).toBe(true));
    expect(calls.find((c) => c.url === "/api/saved" && c.body)!.body).toMatchObject({
      item_type: "hook",
      ref_id: "m1:2",
      thread_id: THREAD,
      title: MEAL_PREP_HOOKS[1]!.props.hookLine,
    });
  });

  // Controller ruling: the pack's context is its FIRST item's origin; the sheet must save the open row's own.
  describe("Save acts on the open row's own item", () => {
    const ORIGINS = [0, 1, 2, 3].map((index) => ({ messageId: "m1", index }));
    const HOOK_3 = MEAL_PREP_HOOKS[2]!.props.hookLine;
    const posts = () => calls.filter((c) => c.url === "/api/saved" && c.body);
    const lists = () => calls.filter((c) => c.url.startsWith("/api/saved") && !c.body);
    const saveIn = () => within(screen.getByRole("dialog")).getByRole("button", { name: "Save" });
    async function close() {
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    }

    it("hook 3 open: Save sends hook 3's ref, not hook 1's", async () => {
      renderTurn({ ...hooksTurn(), blockOrigins: ORIGINS }, { threadId: THREAD });
      fireEvent.click(rowButton(HOOK_3));
      fireEvent.click(saveIn());
      await waitFor(() => expect(posts()).toHaveLength(1));
      expect(posts()[0]!.body).toMatchObject({ item_type: "hook", ref_id: "m1:3", thread_id: THREAD, title: HOOK_3 });
    });

    it("hook 3 saved elsewhere: its sheet shows saved, hook 1's does not", async () => {
      renderTurn({ ...hooksTurn(), blockOrigins: ORIGINS }, { threadId: THREAD });
      fireEvent.click(rowButton(HOOK_3));
      await waitFor(() => expect(lists().length).toBeGreaterThan(0));
      const shelf = {
        items: [
          { id: "row-3", user_id: "u1", item_type: "hook", ref_id: "m1:3", thread_id: THREAD, project_id: null, title: HOOK_3, snapshot: {}, created_at: "2026-11-22T00:00:00Z" },
        ],
      };
      await act(async () => {
        for (const c of lists()) c.resolve(json(shelf));
      });
      await waitFor(() => expect(saveIn()).toHaveAttribute("aria-pressed", "true"));
      await close();
      fireEvent.click(rowButton(HOOK_1));
      expect(saveIn()).toHaveAttribute("aria-pressed", "false");
    });

    it("a live run (no message yet): each row keeps its own saved state across visits, and nothing saves twice", async () => {
      const HOOK_2 = MEAL_PREP_HOOKS[1]!.props.hookLine;
      renderTurn(hooksTurn(), { threadId: THREAD });
      fireEvent.click(rowButton(HOOK_1));
      fireEvent.click(saveIn());
      await waitFor(() => expect(posts()).toHaveLength(1));
      expect(posts()[0]!.body).toMatchObject({ ref_id: null, title: HOOK_1 });
      await act(async () => posts()[0]!.resolve(json({ item: { id: "row-1", item_type: "hook", ref_id: null } })));
      await waitFor(() => expect(saveIn()).toHaveAttribute("aria-pressed", "true"));
      await close();
      // Hook 2 is not saved.
      fireEvent.click(rowButton(HOOK_2));
      expect(saveIn()).toHaveAttribute("aria-pressed", "false");
      await close();
      // Back to hook 1: still saved, and a second tap writes no duplicate.
      fireEvent.click(rowButton(HOOK_1));
      expect(saveIn()).toHaveAttribute("aria-pressed", "true");
      fireEvent.click(saveIn());
      await settle();
      expect(posts()).toHaveLength(1);
      await close();
      // Hook 2 saves as itself.
      fireEvent.click(rowButton(HOOK_2));
      fireEvent.click(saveIn());
      await waitFor(() => expect(posts()).toHaveLength(2));
      expect(posts()[1]!.body).toMatchObject({ ref_id: null, title: HOOK_2 });
    });
  });

  // Fix round 1, design ruling: a simulated row's gauge links to its result page; the row opens the sheet.
  it("once a row is simulated and its key known, its gauge links to the result; the row still opens the sheet", async () => {
    renderTurn(hooksTurn(), { threadId: THREAD });
    fireEvent.click(screen.getByRole("button", { name: /^Simulate: I spent \$40/ }));
    expect(reacts()).toHaveLength(1);
    expect(screen.queryByRole("link", { name: /^Open the result/ })).toBeNull();
    await act(async () => reacts()[0]!.resolve(reacted(30)));
    const link = await screen.findByRole("link", { name: /^Open the result: I spent \$40/ });
    expect(link).toHaveAttribute("href", `/simulation/hook/${THREAD}/${await sealHashOf(HOOK_1)}`);
    expect(link).toHaveAccessibleDescription("30% would stop to watch");
    fireEvent.click(rowButton(HOOK_1));
    expect(screen.getByRole("dialog", { name: HOOK_1 })).toBeInTheDocument();
  });

  it("an idea row's gauge links with ?as=idea", async () => {
    const title = IDEA_SHEET.props.title;
    renderTurn({ userTurn: "ideas", blocks: [runHeader("ideas"), IDEA_SHEET, IDEAS_4[0]!] }, { threadId: THREAD, seals: { [title]: seal(44) } });
    expect(await screen.findByRole("link", { name: /^Open the result: The Two-Hour Study Lie/ })).toHaveAttribute(
      "href",
      `/simulation/hook/${THREAD}/${await sealHashOf(title)}?as=idea`,
    );
    expect(screen.getAllByRole("link", { name: /^Open the result/ })).toHaveLength(1);
  });

  it("without a thread id a simulated row's gauge is its number, not a link", async () => {
    renderTurn(hooksTurn(), { seals: SEALS_DONE });
    await settle();
    expect(screen.queryAllByRole("link", { name: /^Open the result/ })).toHaveLength(0);
    for (const n of [30, 22, 45]) expect(screen.getByRole("img", { name: `${n}% would stop to watch` })).toBeInTheDocument();
  });

  it("Script this one writes the script from this hook, closes the sheet and gives focus back to the row", async () => {
    const writeScript = vi.fn();
    renderTurn(hooksTurn(), { writeScript });
    const row = rowButton(HOOK_1);
    fireEvent.click(row);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Script this one, 2 credits" }));
    expect(writeScript).toHaveBeenCalledWith(HOOK_1, "lurker");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(row);
  });

  it("Escape closes it and focus goes back to the row", async () => {
    renderTurn(hooksTurn());
    const row = rowButton(HOOK_1);
    fireEvent.click(row);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(row);
  });

  it("an idea row: the take, why it fits, format; Script this one starts from its seed hook; its link says ?as=idea", async () => {
    const writeScript = vi.fn();
    const title = IDEA_SHEET.props.title;
    renderTurn({ userTurn: "ideas", blocks: [runHeader("ideas"), IDEA_SHEET, IDEAS_4[0]!] }, { writeScript, threadId: THREAD, seals: { [title]: seal(44) } });
    fireEvent.click(rowButton(title));
    const dialog = screen.getByRole("dialog", { name: title });
    expect(within(dialog).getByText("The take")).toBeInTheDocument();
    expect(within(dialog).getByText("Why it fits")).toBeInTheDocument();
    expect(within(dialog).getByText("Format")).toBeInTheDocument();
    expect(await within(dialog).findByRole("link", { name: /^Open the result/ })).toHaveAttribute(
      "href",
      `/simulation/hook/${THREAD}/${await sealHashOf(title)}?as=idea`,
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Script this one, 2 credits" }));
    expect(writeScript).toHaveBeenCalledWith(IDEA_SHEET.props.seedHook, "");
  });

  it("a simulated script opener links as an opening line; a simulated remix hook as a hook", async () => {
    const opener = SCRIPT_AI.props.openingBeatSeed!;
    const adapted = REMIX_CAMERA.props.adaptedHook;
    renderTurn(
      { userTurn: "both", blocks: [runHeader("script"), SCRIPT_AI, REMIX_CAMERA] },
      { threadId: THREAD, seals: { [opener]: seal(41), [adapted]: seal(33) } },
    );
    expect(await screen.findByRole("link", { name: /^Open the result: I fed 10 million/ })).toHaveAttribute(
      "href",
      `/simulation/hook/${THREAD}/${await sealHashOf(opener)}?as=opening`,
    );
    expect(await screen.findByRole("link", { name: /^Open the result: I’m gonna show/ })).toHaveAttribute(
      "href",
      `/simulation/hook/${THREAD}/${await sealHashOf(adapted)}`,
    );
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

  // Thread feel §4.5 and rulings 17: through `StreamedAnswer`. While it streams each word is its own
  // fading span and nothing is offered; once ended, today's markup and one Copy of the whole answer.
  it("a plain answer streams word by word with no Copy; once ended, one Copy of its text", async () => {
    const live = { skill: "chat" as const, isStreaming: true, stages: [] };
    const { container, rerender } = renderTurn({ userTurn: "hi", blocks: [md("Post three")], live });
    expect([...container.querySelectorAll(".word-in")].map((w) => w.textContent)).toEqual(["Post", "three"]);
    expect(container.querySelector(".md")!.closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();

    rerender({ userTurn: "hi", blocks: [md("Post three times a week.")], live: { ...live, isStreaming: false } });
    expect(container.querySelectorAll(".word-in")).toHaveLength(0);
    expect(container.querySelector("[aria-live]")).toBeNull();
    const writeText = vi.fn(async (_text: string) => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    try {
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Copy" }));
      });
      expect(writeText).toHaveBeenCalledWith("Post three times a week.");
    } finally {
      Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    }
  });

  it("an answer in two text parts has one Copy, under the last, and it copies both, a blank line between", async () => {
    const { container } = renderTurn({ userTurn: "remix something", blocks: [md("First part."), inputRequest(), md("Second part.")] });
    const copies = screen.getAllByRole("button", { name: "Copy" });
    expect(copies).toHaveLength(1);
    const second = screen.getByText("Second part.");
    expect(second.compareDocumentPosition(copies[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.textContent).toContain("First part.");
    const writeText = vi.fn(async (_text: string) => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    try {
      await act(async () => {
        fireEvent.click(copies[0]!);
      });
      expect(writeText).toHaveBeenCalledWith("First part.\n\nSecond part.");
    } finally {
      Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    }
  });

  it("text beside sources: the text, then the sources as the fallback card", () => {
    const { container } = renderTurn({ userTurn: "what works in meal prep?", blocks: [md("Cheap, fast and honest wins."), corpus()] });
    expect(screen.getByText("Cheap, fast and honest wins.")).toBeInTheDocument();
    expect(cards(container)).toHaveLength(1);
    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByText("@lacapture · 154K views")).toBeInTheDocument();
  });

  // Thread depth, second part §3: the account read draws its own card; the old fallback ("Your
  // account" and loose lines) is gone. Was: the fallback card, its title, three lines, Show all.
  it("an account read draws its own card, not the 'Your account' fallback", () => {
    const { container } = renderTurn({ userTurn: "Read my account", blocks: [runHeader("account"), ACCOUNT_READ_FULL, md(OUTRO)] });
    expect(cards(container)).toHaveLength(1);
    expect(container.querySelector('[data-part="account-who"]')).toHaveTextContent("@creator_one12.4K followers · 86 videos");
    expect(within(container.querySelector<HTMLElement>('[data-part="account-works"]')!).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("The middle loses people. Tighten it and cut the dead air.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ideas from what works, 1 credit" })).toBeInTheDocument();
    expect(screen.queryByText("Your account")).toBeNull();
    expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();
    expect(screen.queryByText(OUTRO)).toBeNull();
    // Under it, the account's chip: none that starts an Ideas run, the card's button does (fix round 1).
    expect(within(screen.getByTestId("followup-row")).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual([
      "Follow up: Where am I weakest?",
    ]);
    expect(screen.queryByRole("button", { name: "Follow up: Ideas that fit me" })).toBeNull();
  });

  it("its button sends the ask as an Ideas run through the thread's follow-up, once for a tap that lands twice", () => {
    const followup = vi.fn();
    renderTurn({ userTurn: "Read my account", blocks: [runHeader("account"), ACCOUNT_READ_FULL] }, { followup });
    const button = screen.getByRole("button", { name: "Ideas from what works, 1 credit" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(followup).toHaveBeenCalledTimes(1);
    expect(followup).toHaveBeenCalledWith(
      "Give me ideas built on what already works on my account:\n" +
        "- How I meal prep a week for $12 (854K views)\n" +
        "- Stop buying protein bars, make these (146K views)",
      "ideas",
    );
  });

  it("without a follow-up handler its button is drawn and a press does nothing", () => {
    renderTurn({ userTurn: "Read my account", blocks: [runHeader("account"), ACCOUNT_READ_FULL] });
    const button = screen.getByRole("button", { name: "Ideas from what works, 1 credit" });
    expect(() => fireEvent.click(button)).not.toThrow();
  });

  it("a link field keeps its legacy renderer, beside the agent's text", () => {
    renderTurn({ userTurn: "remix something", blocks: [md("Send me the link."), inputRequest()] });
    expect(screen.getByText("Send me the link.")).toBeInTheDocument();
    expect(screen.getByText("Paste the video link and I'll adapt it for your audience.")).toBeInTheDocument();
  });
});

describe("while a run is live", () => {
  const preamble = md("On it, generating a few angles.");
  const outline = (kind?: string) => document.querySelector(kind ? `[data-outline="${kind}"]` : "[data-outline]");

  it("a hooks run shows the pack's outline, its line \"Writing hooks\", no card rows and no chips; then the card", () => {
    const live = { skill: "hooks" as const, isStreaming: true, stages: [{ name: "Generating", status: "active" as const }] };
    const { container, rerender } = renderTurn({ userTurn: ASK, blocks: [runHeader("hooks"), preamble, ...MEAL_PREP_HOOKS], live });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Writing hooks");
    expect(status).toHaveTextContent("about 20 s");
    // The answer's card, drawn at once as its outline: the line is its header.
    expect(outline("pack")!.querySelectorAll('[data-part="ghost-row"]')).toHaveLength(3);
    expect(cards(container)).toHaveLength(1);
    expect(cards(container)[0]!.contains(status)).toBe(true);
    // No card rows: no hook, no gauge, no primary.
    expect(container.querySelectorAll("li")).toHaveLength(0);
    expect(gauges()).toHaveLength(0);
    expect(screen.queryByText(HOOK_1)).toBeNull();
    expect(screen.queryByRole("button", { name: /Simulate all/ })).toBeNull();
    expect(screen.queryByText("On it, generating a few angles.")).toBeNull();
    expect(screen.queryByTestId("followup-row")).toBeNull();
    expectNoNarration();

    // The stages are done: the card takes the outline's place while the stream stays open for the closing line.
    rerender({
      userTurn: ASK,
      blocks: [runHeader("hooks"), preamble, ...MEAL_PREP_HOOKS],
      live: { ...live, stages: [{ name: "Generating", status: "done" }] },
    });
    expect(screen.queryByRole("status")).toBeNull();
    expect(outline()).toBeNull();
    expect(cards(container)).toHaveLength(1);
    expect(gauges()).toHaveLength(3);
    expect(screen.getByText("3 hooks")).toBeInTheDocument();
    expect(screen.queryByText("On it, generating a few angles.")).toBeNull();

    rerender({ userTurn: ASK, blocks: [runHeader("hooks"), preamble, ...MEAL_PREP_HOOKS, md(OUTRO)], live: { ...live, isStreaming: false, stages: [] } });
    expect(cards(container)).toHaveLength(1);
    expect(screen.getByTestId("followup-row")).toBeInTheDocument();
    expectNoNarration();
  });

  it("the line takes the words of the stage the run reports, in the same status element", () => {
    const live = (stages: { name: string; status: "active" | "done" }[]) => ({ skill: "hooks" as const, isStreaming: true, stages });
    const { rerender } = renderTurn({ userTurn: ASK, blocks: [runHeader("hooks")], live: live([{ name: "Finding proven outliers", status: "active" }]) });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Looking for videos on this topic");
    rerender({ userTurn: ASK, blocks: [runHeader("hooks")], live: live([{ name: "Finding proven outliers", status: "done" }, { name: "Generating", status: "active" }]) });
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent("Writing hooks");
    // "Ranking" says nothing of its own.
    rerender({
      userTurn: ASK,
      blocks: [runHeader("hooks")],
      live: live([{ name: "Finding proven outliers", status: "done" }, { name: "Generating", status: "done" }, { name: "Ranking", status: "active" }]),
    });
    expect(status).toHaveTextContent("Writing hooks");
  });

  it("what the run reads shows under the line, its headline word for word", () => {
    const evidence = {
      headline: "Reading 3 real videos matched to this subject",
      items: [1, 2, 3].map((n) => ({ kind: "video" as const, image: `/covers/c${n}.jpg`, label: `creator_${n}`, metric: `${n}K views` })),
    };
    renderTurn({
      userTurn: ASK,
      blocks: [runHeader("hooks")],
      live: { skill: "hooks", isStreaming: true, stages: [{ name: "Finding proven outliers", status: "done" }], evidence },
    });
    const ghost = outline("pack")!;
    expect(within(ghost as HTMLElement).getByText("Reading 3 real videos matched to this subject")).toBeInTheDocument();
    expect(ghost.querySelectorAll('[data-part="evidence-cover"] img')).toHaveLength(3);
    expect(screen.queryByText(/creator_/)).toBeNull();
  });

  it("the note turns to \"taking longer\" at twice the usual length, not before", () => {
    vi.useFakeTimers({ now: new Date("2026-11-25T10:00:00Z") });
    try {
      renderTurn({ userTurn: ASK, blocks: [], live: { skill: "hooks", isStreaming: true, stages: [] } });
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("about 20 s");
      act(() => {
        vi.advanceTimersByTime(40_999);
      });
      expect(status).toHaveTextContent("about 20 s");
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(status).toHaveTextContent("taking longer");
      expect(status).not.toHaveTextContent("about 20 s");
    } finally {
      vi.useRealTimers();
    }
  });

  it("stages done but no card in yet: the outline stays and no chips show (never an empty flash)", () => {
    renderTurn({ userTurn: ASK, blocks: [runHeader("hooks")], live: { skill: "hooks", isStreaming: true, stages: [{ name: "Generating", status: "done" }] } });
    expect(screen.getByRole("status")).toHaveTextContent("Writing hooks");
    expect(outline("pack")).not.toBeNull();
    expect(screen.queryByTestId("followup-row")).toBeNull();
  });

  it("a fresh dispatch with no stages yet is live too", () => {
    renderTurn({ userTurn: ASK, blocks: [], live: { skill: "hooks", isStreaming: true, stages: [] } });
    expect(screen.getByRole("status")).toHaveTextContent("Writing hooks");
    expect(outline("pack")).not.toBeNull();
  });

  it.each([
    ["ideas", "Finding ideas", "about 30 s", "pack"],
    ["script", "Writing your script", "about 30 s", "script"],
    ["remix", "Reworking the video", null, "remix"],
    // The other kinds wait on the line alone.
    ["explore", "Scanning for outliers", null, null],
    ["account", "Reading your account", null, null],
    // Not one of the named runs: the honest "Thinking" (never "Testing your video").
    ["test", "Thinking", null, null],
    ["predict", "Thinking", null, null],
  ] as const)("a live %s run says \"%s\"", (skill, words, note, kind) => {
    const { container } = renderTurn({ userTurn: "go", blocks: [md("preamble text")], live: { skill, isStreaming: true, stages: [] } });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(new RegExp(`^${words}${note ?? ""}$`));
    if (kind) {
      expect(outline(kind)).not.toBeNull();
      expect(cards(container)).toHaveLength(1);
    } else {
      expect(outline()).toBeNull();
      expect(cards(container)).toHaveLength(0);
    }
    expect(screen.queryByText("preamble text")).toBeNull();
    expect(screen.queryByText(/Testing/)).toBeNull();
  });

  it("a plain question (no guess) says \"Thinking\" on the line alone until its text streams, then streams the text", () => {
    const live = { skill: "chat" as const, isStreaming: true, stages: [] };
    const { container, rerender } = renderTurn({ userTurn: "hi", blocks: [], live });
    expect(screen.getByRole("status")).toHaveTextContent(/^Thinking$/);
    expect(outline()).toBeNull();
    expect(cards(container)).toHaveLength(0);
    rerender({ userTurn: "hi", blocks: [md("Post three times")], live });
    expect(screen.queryByRole("status")).toBeNull();
    // Streamed word by word (each word its own fading span), so read as the answer's text.
    expect(container.querySelector(".md")).toHaveTextContent("Post three times");
    expect(screen.queryByTestId("followup-row")).toBeNull();
  });

  // Spec §4.2 item 1 and §4.5: a guess names nothing. The guess pin is off in production, so most
  // guessed asks are answered in plain words: "Thinking" before the first word (never the guess
  // itself, no outline), then the words stream like any plain answer, not all at once at the end.
  it("a guessed ask (preGuess) answered in plain words: \"Thinking\" before its first word, then its text streams", () => {
    const live = { skill: "chat" as const, isStreaming: true, stages: [], preGuess: "hooks" };
    const { container, rerender } = renderTurn({ userTurn: "hooks for my app", blocks: [], live });
    expect(screen.getByRole("status")).toHaveTextContent(/^Thinking$/);
    expect(outline()).toBeNull();
    expect(screen.queryByText(/Looks like/)).toBeNull();
    rerender({ userTurn: "hooks for my app", blocks: [md("Which angle do you want: the price or the speed?")], live });
    expect(screen.queryByText("Thinking")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(outline()).toBeNull();
    expect(container.querySelector(".md")).toHaveTextContent("Which angle do you want: the price or the speed?");
    expect(screen.queryByTestId("followup-row")).toBeNull();
  });

  // Once `dispatch` names the run, the named-run wait takes over: the prose that streamed before it
  // was a preamble and leaves, the outline shows.
  it("a guessed ask whose prose streamed, then the run is named: the preamble leaves for the run's outline", () => {
    const preamble = md("On it, generating a few angles.");
    const { container, rerender } = renderTurn({
      userTurn: ASK,
      blocks: [preamble],
      live: { skill: "chat", isStreaming: true, stages: [], preGuess: "hooks" },
    });
    expect(container.querySelector(".md")).toHaveTextContent("On it, generating a few angles.");
    rerender({ userTurn: ASK, blocks: [preamble], live: { skill: "hooks", isStreaming: true, stages: [] } });
    expect(screen.getByRole("status")).toHaveTextContent("Writing hooks");
    expect(outline("pack")).not.toBeNull();
    expect(container.querySelector(".md")).toBeNull();
    expect(screen.queryByText("Thinking")).toBeNull();
  });

  it("a typed ask, then the run is named: the line becomes the run's outline", () => {
    const { rerender } = renderTurn({ userTurn: ASK, blocks: [], live: { skill: "chat", isStreaming: true, stages: [], preGuess: "hooks" } });
    expect(screen.getByRole("status")).toHaveTextContent(/^Thinking$/);
    rerender({ userTurn: ASK, blocks: [], live: { skill: "hooks", isStreaming: true, stages: [] } });
    expect(screen.getByRole("status")).toHaveTextContent("Writing hooks");
    expect(outline("pack")).not.toBeNull();
    expect(screen.queryByText("Thinking")).toBeNull();
  });

  it("a guessed run that never dispatched shows its text once the stream ends", () => {
    const live = { skill: "chat" as const, isStreaming: false, stages: [], preGuess: "hooks" };
    renderTurn({ userTurn: "hooks for my app", blocks: [md("Which angle do you want: the price or the speed?")], live });
    // No wait: neither the line nor an outline. The one status left is the Copy's own confirmation.
    expect(screen.queryByText("Thinking")).toBeNull();
    expect(outline()).toBeNull();
    expect(document.querySelector('[data-part="run-status"]')).toBeNull();
    const statuses = screen.getAllByRole("status");
    expect(statuses).toHaveLength(1);
    expect(statuses[0]!.parentElement!.contains(screen.getByRole("button", { name: "Copy" }))).toBe(true);
    expect(statuses[0]).toHaveTextContent(/^$/);
    expect(screen.getByText("Which angle do you want: the price or the speed?")).toBeInTheDocument();
    expect(screen.getByTestId("followup-row")).toBeInTheDocument();
  });

  // Fix round 1 (1): a chat-dispatched run finishes its stages, then bills, then writes its cards,
  // so for a round trip the blocks are only the streamed preamble. No text and no chips flash.
  it.each([
    ["a skill run", [runHeader("hooks"), md("On it, generating a few angles.")]],
    ["a chat-dispatched run (no stamp yet)", [md("On it, generating a few angles.")]],
  ])("%s with every stage done and no card yet: the outline only", (_, blocks) => {
    renderTurn({ userTurn: ASK, blocks, live: { skill: "hooks", isStreaming: true, stages: [{ name: "Ranking", status: "done" }] } });
    expect(screen.getByRole("status")).toHaveTextContent("Writing hooks");
    expect(outline("pack")).not.toBeNull();
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
    expect(outline()).toBeNull();
  });

  it("a reset live run with nothing in it renders nothing", () => {
    const { container } = renderTurn({ userTurn: null, blocks: [], live: { skill: "hooks", isStreaming: false, stages: [] } });
    expect(container.textContent).toBe("");
  });
});

describe("the landing (thread feel §4.3, rulings 11)", () => {
  const iOf = (el: Element | null) => (el as HTMLElement | null)?.style.getPropertyValue("--i") ?? null;
  const landedOf = (el: Element | null) => (el as HTMLElement | null)?.style.getPropertyValue("--landed") ?? null;
  const waiting = { skill: "hooks" as const, isStreaming: true, stages: [{ name: "Generating", status: "active" as const }] };
  const landed = { ...waiting, stages: [{ name: "Generating", status: "done" as const }] };
  const LIVE_BLOCKS = [runHeader("hooks"), ...MEAL_PREP_HOOKS];

  it("cards that arrive after a wait come in one after another: rows 0, 1, 2, the button 3, the chips 6", () => {
    const { container, rerender } = renderTurn({ userTurn: ASK, blocks: [runHeader("hooks")], live: waiting });
    expect(container.querySelector("[data-thread-landing]")).toBeNull();
    rerender({ userTurn: ASK, blocks: LIVE_BLOCKS, live: landed });
    const group = container.querySelector("[data-thread-landing]")!;
    expect(group).not.toBeNull();
    expect(landedOf(group)).toBe("0ms");
    const card = cards(container)[0]!;
    expect(group.contains(card)).toBe(true);
    // The card itself takes its height at once; its rows fade in.
    expect(card).not.toHaveClass("land");
    const rows = [...card.querySelectorAll("li")];
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row).toHaveClass("land");
    expect(rows.map(iOf)).toEqual(["0", "1", "2"]);
    expect(iOf(screen.getByRole("button", { name: "Simulate all 3, 3 credits" }).closest(".land"))).toBe("3");
    const chips = screen.getByTestId("followup-row").closest(".land")!;
    expect(group.contains(chips)).toBe(true);
    expect(iOf(chips)).toBe("6");
  });

  it("the same landing is drawn once: a rerender of the landed turn keeps its group and its start", () => {
    const { container, rerender } = renderTurn({ userTurn: ASK, blocks: [runHeader("hooks")], live: waiting });
    rerender({ userTurn: ASK, blocks: LIVE_BLOCKS, live: landed });
    const group = container.querySelector("[data-thread-landing]")!;
    rerender({ userTurn: ASK, blocks: [...LIVE_BLOCKS, md(OUTRO)], live: { ...landed, isStreaming: false, stages: [] } });
    expect(container.querySelector("[data-thread-landing]")).toBe(group);
    expect(landedOf(group)).toBe("0ms");
  });

  it("a second pack in the same turn (a chat turn that runs twice) lands too, from its own moment, after its own wait", () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    try {
      const { container, rerender } = renderTurn({ userTurn: ASK, blocks: [runHeader("hooks")], live: waiting });
      rerender({ userTurn: ASK, blocks: LIVE_BLOCKS, live: landed });
      expect(landedOf(container.querySelector("[data-thread-landing]"))).toBe("0ms");

      // 5 s later the turn dispatches again: a fresh dispatch clears the stages, so it waits again.
      clock.mockReturnValue(now + 5_000);
      rerender({ userTurn: ASK, blocks: LIVE_BLOCKS, live: { ...waiting, stages: [] } });
      expect(container.querySelector("[data-thread-landing]")).toBeNull();
      const more = [runHeader("hooks"), hook("A fourth hook about meal prep."), hook("A fifth hook about meal prep.")];
      rerender({ userTurn: ASK, blocks: [...LIVE_BLOCKS, ...more], live: landed });
      expect(cards(container)).toHaveLength(2);
      // Not the first landing's age (-5000ms, drawn at rest in one frame): this answer's own start.
      expect(landedOf(container.querySelector("[data-thread-landing]"))).toBe("0ms");
    } finally {
      clock.mockRestore();
    }
  });

  it("cards that arrive one by one (a dispatched pack): the persisted copy that holds them all still carries on the landing", () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    try {
      const first = renderTurn({ userTurn: ASK, blocks: [runHeader("hooks")], live: waiting });
      first.rerender({ userTurn: ASK, blocks: [runHeader("hooks"), MEAL_PREP_HOOKS[0]!], live: landed });
      expect(landedOf(first.container.querySelector("[data-thread-landing]"))).toBe("0ms");
      clock.mockReturnValue(now + 40);
      first.rerender({ userTurn: ASK, blocks: [runHeader("hooks"), MEAL_PREP_HOOKS[0]!, MEAL_PREP_HOOKS[1]!], live: landed });
      first.rerender({ userTurn: ASK, blocks: LIVE_BLOCKS, live: landed });
      first.unmount();

      clock.mockReturnValue(now + 300);
      const { container } = renderTurn({ userTurn: ASK, blocks: HOOKS_TURN });
      expect(landedOf(container.querySelector("[data-thread-landing]"))).toBe("-300ms");
    } finally {
      clock.mockRestore();
    }
  });

  it("a turn that mounts with its cards and no landing to carry on is drawn at rest", () => {
    const { container } = renderTurn({ userTurn: ASK, blocks: HOOKS_TURN });
    expect(cards(container)).toHaveLength(1);
    expect(container.querySelector("[data-thread-landing]")).toBeNull();
  });

  it("the turn drawn in its place right after (the persisted copy at the fold) carries on where the landing is", () => {
    const first = renderTurn({ userTurn: ASK, blocks: [runHeader("hooks")], live: waiting });
    first.rerender({ userTurn: ASK, blocks: LIVE_BLOCKS, live: landed });
    first.unmount();
    // The fold: a new element for the same answer, 300 ms into its landing.
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now + 300);
    try {
      const { container } = renderTurn({ userTurn: ASK, blocks: HOOKS_TURN });
      const group = container.querySelector("[data-thread-landing]")!;
      expect(group).not.toBeNull();
      expect(Number.parseInt(landedOf(group)!, 10)).toBeLessThanOrEqual(-300);
      expect(landedOf(group)).toMatch(/^-\d+ms$/);
      expect([...cards(container)[0]!.querySelectorAll("li")].map(iOf)).toEqual(["0", "1", "2"]);
    } finally {
      clock.mockRestore();
    }
  });

  it("a turn that mounts within the window of a marked landing lands from there; after it, at rest", () => {
    markLanded(landingKeyOf(HOOKS_TURN)!, Date.now() - 500);
    const { container, unmount } = renderTurn({ userTurn: ASK, blocks: HOOKS_TURN });
    expect(Number.parseInt(landedOf(container.querySelector("[data-thread-landing]"))!, 10)).toBeLessThanOrEqual(-500);
    unmount();

    resetLanding();
    markLanded(landingKeyOf(HOOKS_TURN)!, Date.now() - 1_700);
    const later = renderTurn({ userTurn: ASK, blocks: HOOKS_TURN });
    expect(later.container.querySelector("[data-thread-landing]")).toBeNull();
  });

  it("a landing for another answer leaves this one at rest", () => {
    markLanded("A hook from another answer.", Date.now());
    const { container } = renderTurn({ userTurn: ASK, blocks: HOOKS_TURN });
    expect(container.querySelector("[data-thread-landing]")).toBeNull();
  });

  it("a live turn that never waited (mounted with its cards in) is at rest", () => {
    const { container } = renderTurn({ userTurn: ASK, blocks: LIVE_BLOCKS, live: landed });
    expect(cards(container)).toHaveLength(1);
    expect(container.querySelector("[data-thread-landing]")).toBeNull();
  });

  it("a script lands beat by beat, then its button, then the chips", () => {
    const live = { skill: "script" as const, isStreaming: true, stages: [{ name: "Generating", status: "active" as const }] };
    const { container, rerender } = renderTurn({ userTurn: "a script", blocks: [runHeader("script")], live });
    expect(document.querySelector('[data-outline="script"]')).not.toBeNull();
    rerender({ userTurn: "a script", blocks: [runHeader("script"), SCRIPT_AI], live: { ...live, stages: [{ name: "Generating", status: "done" }] } });
    const group = container.querySelector("[data-thread-landing]")!;
    const beats = [...group.querySelectorAll('[data-part="beat"]')];
    expect(beats.map(iOf)).toEqual(["0", "1", "2", "3", "4"]);
    expect(iOf(screen.getByRole("button", { name: "Add your take" }).closest(".land"))).toBe("5");
    expect(iOf(screen.getByTestId("followup-row").closest(".land"))).toBe("8");
  });

  // Fix round 1: a remix has no card line; its landing is still remembered (by its adapted hook), so
  // the persisted copy at the fold carries on instead of snapping a part that is still fading.
  it("a remix that waited lands, and its persisted copy mounted 300 ms later carries on", () => {
    const live = { skill: "remix" as const, isStreaming: true, stages: [{ name: "Decoding", status: "active" as const }] };
    const first = renderTurn({ userTurn: "Remix this video", blocks: [runHeader("remix")], live });
    expect(document.querySelector('[data-outline="remix"]')).not.toBeNull();
    first.rerender({ userTurn: "Remix this video", blocks: [runHeader("remix"), REMIX_CAMERA], live: { ...live, stages: [{ name: "Adapting", status: "done" }] } });
    const group = first.container.querySelector("[data-thread-landing]")!;
    expect(group).not.toBeNull();
    expect(landedOf(group)).toBe("0ms");
    expect(iOf(screen.getByRole("button", { name: /^Script it/ }).closest(".land"))).toBe("4");
    first.unmount();

    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now + 300);
    try {
      const { container } = renderTurn({ userTurn: "Remix this video", blocks: [runHeader("remix"), REMIX_CAMERA, md(OUTRO)] });
      const copy = container.querySelector("[data-thread-landing]");
      expect(copy).not.toBeNull();
      expect(landedOf(copy)).toMatch(/^-\d+ms$/);
      expect(Number.parseInt(landedOf(copy)!, 10)).toBeLessThanOrEqual(-300);
    } finally {
      clock.mockRestore();
    }
  });

  it("another remix's landing leaves this one at rest", () => {
    markLanded("remix-card:A different adapted hook", Date.now());
    const { container } = renderTurn({ userTurn: "Remix this video", blocks: [runHeader("remix"), REMIX_CAMERA] });
    expect(container.querySelector("[data-thread-landing]")).toBeNull();
  });

  // Was: the account read's answer came in as one part (the fallback card at 0, the chips at 3). Its
  // own card lands as the others do (thread depth, second part §3): its parts one after another.
  it("the account read waits on the line alone, then its card's parts come in one after another, the chips 3 after", () => {
    const live = { skill: "account" as const, isStreaming: true, stages: [] };
    const { container, rerender } = renderTurn({ userTurn: "Read my account", blocks: [runHeader("account")], live });
    expect(screen.getByRole("status")).toHaveTextContent("Reading your account");
    expect(container.querySelector("[data-outline]")).toBeNull();
    rerender({ userTurn: "Read my account", blocks: [runHeader("account"), ACCOUNT_READ_FULL], live: { ...live, isStreaming: false } });
    const group = container.querySelector("[data-thread-landing]")!;
    expect(group).not.toBeNull();
    expect(landedOf(group)).toBe("0ms");
    const card = cards(container)[0]!;
    expect(card).not.toHaveClass("land");
    const places = ["account-who", "account-works", "account-fix", "account-habits"].map((p) => iOf(card.querySelector(`[data-part="${p}"]`)));
    expect(places).toEqual(["0", "1", "2", "3"]);
    expect(iOf(screen.getByRole("button", { name: "Ideas from what works, 1 credit" }).closest(".land"))).toBe("4");
    expect(iOf(screen.getByTestId("followup-row").closest(".land"))).toBe("7");
  });

  it("a fallback answer still comes in as one part", () => {
    const live = { skill: "chat" as const, isStreaming: true, stages: [] };
    const { container, rerender } = renderTurn({ userTurn: "Compare my two hooks", blocks: [], live });
    rerender({ userTurn: "Compare my two hooks", blocks: [composed()], live: { ...live, isStreaming: false } });
    expect(container.querySelector("[data-thread-landing]")).not.toBeNull();
    const card = cards(container)[0]!;
    expect(card).toHaveClass("land");
    expect(iOf(card)).toBe("");
  });

  it("a plain answer does not land: its words fade in as they stream, and the turn stays at rest", () => {
    const live = { skill: "chat" as const, isStreaming: true, stages: [] };
    const { container, rerender } = renderTurn({ userTurn: "hi", blocks: [], live });
    rerender({ userTurn: "hi", blocks: [md("Post three times")], live });
    rerender({ userTurn: "hi", blocks: [md("Post three times a week.")], live: { ...live, isStreaming: false } });
    expect(container.querySelector("[data-thread-landing]")).toBeNull();
  });
});
