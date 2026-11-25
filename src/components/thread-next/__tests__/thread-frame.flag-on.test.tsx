/** @vitest-environment happy-dom */

/**
 * The thread frame under the new look (plan 2026-11-20, thread field, Task 4): the user's message
 * as a bubble with an optional video tile above it, the "Maven" label above each answer, and the
 * next-step chips as quiet pills under the last answer only.
 *
 * Real components throughout. Stand-ins are browser APIs only: object URLs and the video element's
 * media events (happy-dom decodes no media), as in `src/hooks/__tests__/use-video-meta.test.ts`.
 * The flag-off half lives in `src/components/thread/__tests__/thread-frame.flag-off.test.tsx`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The flag is a build-time constant; this file is the flag-on build.
vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { ThreadAssistantTurn, ThreadShell, ThreadUserTurn } from "@/components/thread/thread-shell";
import { FollowupRow } from "@/components/thread/followup-row";
import { ThreadTurn } from "@/components/thread/thread-turn";
import { PersistedThreadStream } from "@/components/thread/persisted-thread-stream";
import { FollowupContext } from "@/lib/followup-context";
import { followupsForKind } from "@/lib/tools/chat-followups";
import { nextFollowups } from "@/lib/thread-next/next-followups";

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

/** A settled hooks turn, as a reloaded thread carries it (run stamp, two cards, closing line). */
const hookCard = (line: string, rank: number) => ({
  type: "hook-card",
  props: {
    hookLine: line,
    audienceArchetype: "the sceptic",
    mechanism: "pattern-break",
    seedHook: line,
    rank,
    band: "Strong",
    fraction: "6/10 stop",
    scrollQuote: "wait, what?",
    model: "sim1-flash",
    scored: true,
    channel: null,
  },
});
const hooksTurn = (ask: string, line: string) => ({
  userTurn: ask,
  blocks: [
    { type: "run-header", props: { skill: "hooks", audienceLabel: "@mrbeast", platform: "tiktok", hookLine: null } },
    hookCard(line, 1),
    { type: "markdown", props: { text: "#1 is your strongest." } },
  ],
});

/** A settled video simulation, as the seal writes it: the card carries the frames and the length. */
const videoCard = (keyframeUrl: string | null, durationLabel: string | null) => ({
  type: "video-test-card",
  props: {
    craftScore: 77,
    drivers: [{ name: "Hook", score: 82, band: "strong" }],
    filmstrip: [
      { idx: 0, label: "Cold open", atMs: 0, mark: "asset", keyframeUrl },
      { idx: 1, label: "Payoff", atMs: 9000, mark: null, keyframeUrl: "https://frames.example/second.jpg" },
    ],
    dropLabel: null,
    durationLabel,
    working: ["The cold open lands"],
    notWorking: [],
    fixes: [],
    audienceName: "Your audience",
    analysisId: "an-1",
    model: "sim1-max",
    tier: "Validated",
  },
});

const HOOKS_CHIPS = followupsForKind("hooks").map((f) => f.label);
/** The new turn's pair under a hooks answer (spec 2026-11-21 §4.7, `nextFollowups`). */
const HOOKS_PAIR = nextFollowups("hooks").map((f) => f.label);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("flag on: the bubble", () => {
  it("is the new bubble, right-aligned, and keeps the turn's sr-only heading", () => {
    render(<ThreadUserTurn text="Hooks for a video about meal prep" />);
    const heading = screen.getByRole("heading", { level: 2, name: "You" });
    expect(heading.className).toContain("sr-only");
    const bubble = screen.getByText("Hooks for a video about meal prep");
    expect(bubble.className).toContain("bg-surface-sunken");
    expect(bubble.className).not.toContain("bg-white/[0.055]");
    // Right-aligned: the turn stacks to its end edge.
    expect((bubble.parentElement as HTMLElement).className).toContain("items-end");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("a video shows as a tile above the bubble, with its first frame and its length", () => {
    render(
      <ThreadUserTurn text="take.mp4" video={{ posterUrl: "https://frames.example/first.jpg", durationLabel: "0:29" }} />,
    );
    const tile = screen.getByRole("img", { name: "Video, 0:29" });
    expect(tile.querySelector("img")?.getAttribute("src")).toBe("https://frames.example/first.jpg");
    expect(within(tile).getByText("0:29")).toBeTruthy();
    // Above the bubble, in reading order.
    const bubble = screen.getByText("take.mp4");
    expect(tile.compareDocumentPosition(bubble) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("a frame that fails to load leaves the tile with its length, never a broken image", () => {
    render(
      <ThreadUserTurn text="take.mp4" video={{ posterUrl: "https://frames.example/expired.jpg", durationLabel: "0:29" }} />,
    );
    const tile = screen.getByRole("img", { name: "Video, 0:29" });
    fireEvent.error(tile.querySelector("img")!);
    expect(tile.querySelector("img")).toBeNull();
    expect(within(tile).getByText("0:29")).toBeTruthy();
  });

  it("a video with neither a frame nor a length shows no tile", () => {
    render(<ThreadUserTurn text="take.mp4" video={{ posterUrl: null, durationLabel: null }} />);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("the offer page's opt-out keeps the legacy bubble", () => {
    render(<ThreadUserTurn text="test this video for me" legacyLook />);
    expect(screen.getByText("test this video for me").className).toContain("bg-white/[0.055]");
    expect(screen.getByRole("heading", { level: 2, name: "You" })).toBeTruthy();
  });
});

describe("flag on: the live turn's tile (the composer's staged file)", () => {
  let videos: HTMLVideoElement[];
  beforeEach(() => {
    videos = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:test/1");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string, opts?: ElementCreationOptions) => {
      const el = realCreate(tag, opts);
      if (tag === "video") videos.push(el as HTMLVideoElement);
      if (tag === "canvas") {
        (el as HTMLCanvasElement).getContext = (() => ({ drawImage: () => {} })) as never;
        (el as HTMLCanvasElement).toDataURL = () => "data:image/jpeg;base64,frame";
      }
      return el;
    }) as typeof document.createElement);
  });

  it("ThreadShell passes the file to the bubble: the tile shows its frame and length once read", () => {
    const take = new File(["video-bytes"], "take.mp4", { type: "video/mp4" });
    render(
      <ThreadShell userTurn="take.mp4" userVideoFile={take}>
        <ThreadAssistantTurn>
          <p>Simulating</p>
        </ThreadAssistantTurn>
      </ThreadShell>,
    );
    // The tile is there at once (the file is a video); its length arrives with the metadata.
    expect(screen.getByRole("img", { name: "Video" })).toBeTruthy();
    const video = videos[0]!;
    Object.defineProperty(video, "duration", { value: 29.4, configurable: true });
    act(() => {
      video.onloadeddata?.(new Event("loadeddata"));
    });
    Object.defineProperty(video, "videoWidth", { value: 1080, configurable: true });
    Object.defineProperty(video, "videoHeight", { value: 1920, configurable: true });
    act(() => {
      video.onseeked?.(new Event("seeked"));
    });
    const tile = screen.getByRole("img", { name: "Video, 0:29" });
    expect(tile.querySelector("img")?.getAttribute("src")).toBe("data:image/jpeg;base64,frame");
  });

  it("no file, no tile", () => {
    render(<ThreadShell userTurn="https://www.tiktok.com/@a/video/1" userVideoFile={null} />);
    expect(screen.queryByRole("img")).toBeNull();
  });

  // Fix round 1 (3): a webm recorded in the browser reports no length (Infinity) until played.
  it("a video with no finite length shows its frame and no length (never \"Infinity:NaN\")", () => {
    const take = new File(["video-bytes"], "take.webm", { type: "video/webm" });
    render(<ThreadShell userTurn="take.webm" userVideoFile={take} />);
    const video = videos[0]!;
    Object.defineProperty(video, "duration", { value: Infinity, configurable: true });
    act(() => {
      video.onloadeddata?.(new Event("loadeddata"));
    });
    Object.defineProperty(video, "videoWidth", { value: 1080, configurable: true });
    Object.defineProperty(video, "videoHeight", { value: 1920, configurable: true });
    act(() => {
      video.onseeked?.(new Event("seeked"));
    });
    const tile = screen.getByRole("img", { name: "Video" });
    expect(tile.textContent).toBe("");
    expect(tile.querySelector("img")?.getAttribute("src")).toBe("data:image/jpeg;base64,frame");
  });

  // Fix round 1 (4): a link turn is a link, live or reloaded.
  it("a link turn shows no tile even with a file passed", () => {
    const take = new File(["video-bytes"], "take.mp4", { type: "video/mp4" });
    render(<ThreadShell userTurn="https://www.tiktok.com/@creator/video/7300000000000000000" userVideoFile={take} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("https://www.tiktok.com/@creator/video/7300000000000000000")).toBeTruthy();
  });
});

describe("flag on: the thread column", () => {
  // Thread answers step 1 (Task 6): the desktop thread header now sits above the column, so the
  // column starts 22 under it (`.desk .thread` padding-top), and its parts sit as the answer-system
  // drawing spaces them: a question ends 12 above the "Maven" label on a phone (`.ax-msgs` gap), 14
  // from md (`.desk .thread` gap). The bubble's own -2 bottom margin (`NextUserTurn`) is why the
  // column's gap is 14 / 16.
  it("is the field's column: 720 at most, its edges on the field's (6 inside the composer's 10 on the phone, none from 640), 12 / 22 above, 16 below, parts 14 / 16 apart", () => {
    const { container } = render(<ThreadShell userTurn="hi" />);
    const column = container.firstElementChild as HTMLElement;
    const classes = column.className.split(/\s+/);
    expect(classes).toEqual(
      expect.arrayContaining(["max-w-[720px]", "px-1.5", "sm:px-0", "pt-3", "md:pt-[22px]", "pb-4", "gap-3.5", "md:gap-4"]),
    );
    expect(classes).not.toContain("gap-5");
    expect(classes).not.toContain("md:pt-8");
    expect(classes).not.toContain("max-w-[760px]");
    expect(classes).not.toContain("px-4");
    expect(classes).not.toContain("py-6");
  });

  it("a question ends 12 above the answer's label on a phone, 14 from md (the column's gap less the bubble's -2)", () => {
    const { container } = render(
      <ThreadShell userTurn="3 hooks for a video about meal prep">
        <ThreadAssistantTurn>
          <p>An answer</p>
        </ThreadAssistantTurn>
      </ThreadShell>,
    );
    const column = container.firstElementChild as HTMLElement;
    const question = screen.getByText("3 hooks for a video about meal prep").parentElement as HTMLElement;
    expect(question.parentElement).toBe(column);
    const px = (cls: string) =>
      ({ "gap-3": 12, "gap-3.5": 14, "gap-4": 16, "gap-5": 20, "-mb-0.5": -2, "mt-2": 8, "mt-3": 12, "mt-3.5": 14 })[cls] ?? NaN;
    const colClasses = column.className.split(/\s+/);
    const turnClasses = question.className.split(/\s+/);
    const mb = turnClasses.find((c) => c.startsWith("-mb-"))!;
    const gap = px(colClasses.find((c) => /^gap-/.test(c))!);
    const mdGap = px(colClasses.find((c) => c.startsWith("md:gap-"))!.slice(3));
    expect(gap + px(mb)).toBe(12);
    expect(mdGap + px(mb)).toBe(14);
    // A later question sits 16 further down than the label rhythm (`.ax-t2` margin-top 16): 28 under
    // the answer above on a phone (12 + 16), 30 from md (14 + 16). The first one does not.
    const mt = px(turnClasses.find((c) => /^mt-/.test(c))!);
    expect(gap + mt).toBe(28);
    expect(mdGap + mt).toBe(30);
    expect(turnClasses).toContain("first:mt-0");
  });

  it("a caller's className still wins", () => {
    const { container } = render(<ThreadShell userTurn="hi" className="pt-0" />);
    expect((container.firstElementChild as HTMLElement).className).toContain("pt-0");
  });
});

describe("flag on: the Maven label", () => {
  it("keeps the turn's h2 \"Maven\" and drops the legacy caps", () => {
    render(
      <ThreadAssistantTurn>
        <p>Pulled hooks for @mrbeast.</p>
      </ThreadAssistantTurn>,
    );
    const heading = screen.getByRole("heading", { level: 2, name: "Maven" });
    expect(heading.className).not.toContain("uppercase");
    expect(heading.className).toContain("text-foreground-secondary");
    // Untracked, as drawn: the app-wide `h2` rule (-0.02em, unlayered) would beat a utility.
    expect(heading.style.letterSpacing).toBe("0px");
    // The mark is the brand's coral (answer-system drawing 2026-11-21, `.who .ic`); the word stays grey.
    expect(heading.querySelector("svg")?.getAttribute("class")).toContain("text-accent");
    expect(screen.getByText("Pulled hooks for @mrbeast.")).toBeTruthy();
  });

  // Answer-system drawing 2026-11-21 (`.ax-msgs` gap 12 with `.tq-card` margin -4 on a phone,
  // `.desk .thread` gap 14 on a desk): the answer starts 8 under the label, 14 from md; its parts
  // (card, sentence, chips) sit 12 apart, 14 from md.
  it("the answer starts 8 under the label (14 from md), its parts 12 apart (14 from md)", () => {
    render(
      <ThreadAssistantTurn>
        <p>An answer</p>
      </ThreadAssistantTurn>,
    );
    const heading = screen.getByRole("heading", { level: 2, name: "Maven" });
    expect((heading.parentElement as HTMLElement).className.split(/\s+/)).toEqual(expect.arrayContaining(["gap-2", "md:gap-3.5"]));
    expect((heading.nextElementSibling as HTMLElement).className.split(/\s+/)).toEqual(expect.arrayContaining(["gap-3", "md:gap-3.5"]));
  });

  it("the offer page's opt-out keeps the legacy label", () => {
    render(
      <ThreadAssistantTurn legacyLook>
        <p>On it.</p>
      </ThreadAssistantTurn>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Maven" }).className).toContain("uppercase");
  });
});

describe("flag on: the next-step chips", () => {
  it("each chip is a quiet pill named \"Follow up: …\", in the row the tests find", () => {
    render(<FollowupRow followups={followupsForKind("hooks")} onFollowup={vi.fn()} />);
    const row = screen.getByTestId("followup-row");
    const chips = within(row).getAllByRole("button");
    expect(chips.map((c) => c.getAttribute("aria-label"))).toEqual(HOOKS_CHIPS.map((l) => `Follow up: ${l}`));
    expect(chips.map((c) => c.textContent)).toEqual(HOOKS_CHIPS);
    // Outlined, 32 tall (answer-system drawing 2026-11-21, `.ax .tq-nx > span`): no fill, an inset
    // ring of the ink at 16%, so a chip never looks like the field's filled skill pills.
    for (const chip of chips) {
      const classes = chip.className.split(/\s+/);
      expect(classes).toEqual(expect.arrayContaining(["bg-transparent", "inset-ring", "inset-ring-foreground/16", "h-8"]));
      expect(classes).not.toContain("bg-surface-sunken");
    }
  });

  it("a tap sends the chip's prompt; a rewrite chip carries the cards above it", () => {
    const onFollowup = vi.fn();
    render(
      <FollowupRow followups={followupsForKind("hooks")} onFollowup={onFollowup} cardLines={["Line one", "Line two"]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Follow up: Which is strongest?" }));
    expect(onFollowup).toHaveBeenLastCalledWith("Which of these hooks is strongest for my audience, and why?", undefined);
    fireEvent.click(screen.getByRole("button", { name: "Follow up: Punch them up" }));
    expect(onFollowup).toHaveBeenLastCalledWith("Rewrite these hooks tighter and more specific.", "hooks", {
      cards: ["Line one", "Line two"],
    });
  });

  it("with no handler passed, the composer's context sends", () => {
    const onFollowup = vi.fn();
    render(
      <FollowupContext.Provider value={onFollowup}>
        <FollowupRow followups={followupsForKind("hooks")} />
      </FollowupContext.Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Follow up: More hooks" }));
    expect(onFollowup).toHaveBeenCalledWith("Give me a few more hook options.", "hooks");
  });
});

describe("flag on: a turn", () => {
  it("a reloaded simulation turn shows the card's first frame and length above the bubble", () => {
    renderWithClient(
      <ThreadTurn userTurn="take.mp4" blocks={[videoCard("https://frames.example/first.jpg", "0:29")]} />,
    );
    const tile = screen.getByRole("img", { name: "Video, 0:29" });
    expect(tile.querySelector("img")?.getAttribute("src")).toBe("https://frames.example/first.jpg");
  });

  // Fix round 1 (4): the same card under a link turn: no tile, so the turn reads the same reloaded.
  it("a reloaded link simulation shows no tile (the bubble is the link)", () => {
    renderWithClient(
      <ThreadTurn
        userTurn="https://www.tiktok.com/@creator/video/7300000000000000000"
        blocks={[videoCard("https://frames.example/first.jpg", "0:29")]}
      />,
    );
    expect(screen.queryByRole("img", { name: /^Video/ })).toBeNull();
  });

  // Thread answers step 1 (Task 5): the new turn draws no outro text at all (the closing line is
  // narration), with or without its chips.
  it("showFollowups={false} hides the chips; the closing line shows in neither case", () => {
    const turn = hooksTurn("give me hooks", "Everyone lied about 5am");
    const { rerender } = renderWithClient(<ThreadTurn userTurn={turn.userTurn} blocks={turn.blocks} showFollowups={false} />);
    expect(screen.queryByTestId("followup-row")).toBeNull();
    expect(screen.queryByText("#1 is your strongest.")).toBeNull();
    expect(screen.getByRole("button", { name: /^Simulate: Everyone lied about 5am/ })).toBeTruthy();
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ThreadTurn userTurn={turn.userTurn} blocks={turn.blocks} />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("followup-row")).toBeTruthy();
    expect(screen.queryByText("#1 is your strongest.")).toBeNull();
  });
});

describe("flag on: chips under the last answer only", () => {
  const turns = [hooksTurn("first ask", "First hook line"), hooksTurn("second ask", "Second hook line")];

  it("two settled turns: one row, under the second answer", () => {
    renderWithClient(<PersistedThreadStream persistedTurns={turns} />);
    const rows = screen.getAllByTestId("followup-row");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]!).getAllByRole("button").map((b) => b.textContent)).toEqual(HOOKS_PAIR);
    const secondAsk = screen.getByText("second ask");
    expect(secondAsk.compareDocumentPosition(rows[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("with a settled live turn, the live turn is the last answer and alone has the row", () => {
    renderWithClient(
      <PersistedThreadStream
        persistedTurns={turns}
        liveTurn={{
          userTurn: "third ask",
          blocks: hooksTurn("third ask", "Third hook line").blocks,
          live: { skill: "hooks", isStreaming: false, stages: [] },
        }}
      />,
    );
    const rows = screen.getAllByTestId("followup-row");
    expect(rows).toHaveLength(1);
    const thirdAsk = screen.getByText("third ask");
    expect(thirdAsk.compareDocumentPosition(rows[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("while the live turn streams, no earlier answer shows chips", () => {
    renderWithClient(
      <PersistedThreadStream
        persistedTurns={turns}
        liveTurn={{ userTurn: "third ask", blocks: [], live: { skill: "hooks", isStreaming: true, stages: [] } }}
      />,
    );
    expect(screen.queryByTestId("followup-row")).toBeNull();
  });

  // Fix round 1 (1): the last ANSWER, not the last turn. A failed Simulate (or a stopped chat) saves
  // its question with no blocks; reloaded, that bare question is the last turn and draws no answer.
  it("a saved question with no answer after them: the row stays under the last answer", () => {
    renderWithClient(<PersistedThreadStream persistedTurns={[...turns, { userTurn: "take.mp4", blocks: [] }]} />);
    const rows = screen.getAllByTestId("followup-row");
    expect(rows).toHaveLength(1);
    expect(screen.getByText("second ask").compareDocumentPosition(rows[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rows[0]!.compareDocumentPosition(screen.getByText("take.mp4")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("a live turn that ended with no answer (a failed run): the row stays under the last answer", () => {
    renderWithClient(
      <PersistedThreadStream
        persistedTurns={turns}
        liveTurn={{ userTurn: "third ask", blocks: [], live: { skill: "hooks", isStreaming: false, stages: [], error: "boom" } }}
      />,
    );
    const rows = screen.getAllByTestId("followup-row");
    expect(rows).toHaveLength(1);
    expect(screen.getByText("second ask").compareDocumentPosition(rows[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rows[0]!.compareDocumentPosition(screen.getByText("third ask")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// Thread answers step 1 (Task 6): the composer's video run is not a stream turn (it is not in
// `useActiveRun`), so it rides the stream's `tail`: after the history, in the same column, so it is
// spaced like every other turn and sits where the thread's end is.
describe("flag on: the stream's tail (the live video turn)", () => {
  const history = [
    { userTurn: "first ask", blocks: [{ type: "markdown", props: { text: "First answer." } }] },
  ];
  const tail = (
    <>
      <ThreadUserTurn text="take.mp4" />
      <ThreadAssistantTurn>
        <p>The video runs.</p>
      </ThreadAssistantTurn>
    </>
  );

  it("renders after the history, inside the history's column", () => {
    const { container } = renderWithClient(<PersistedThreadStream persistedTurns={history} tail={tail} />);
    const column = container.firstElementChild as HTMLElement;
    expect(container.children).toHaveLength(1);
    const answer = screen.getByText("First answer.");
    const video = screen.getByText("The video runs.");
    expect(answer.compareDocumentPosition(screen.getByText("take.mp4")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(column.contains(video)).toBe(true);
    expect(screen.getByText("take.mp4").parentElement?.parentElement).toBe(column);
  });

  it("a new chat (no history, no live turn): the tail alone still renders", () => {
    renderWithClient(<PersistedThreadStream persistedTurns={[]} tail={tail} />);
    expect(screen.getByText("The video runs.")).toBeInTheDocument();
  });

  // Task 6, fix round 1: a running video is the thread's answer on its way, as a live skill run is.
  // No turn shows the next-step chips while it runs (a live skill turn hides every row the same
  // way); once it is gone the chips are back under the last answer.
  it("a running video tail: no chips anywhere; with the tail gone, the chips are back under the last answer", () => {
    const turns = [hooksTurn("first ask", "First hook line")];
    const { rerender } = renderWithClient(<PersistedThreadStream persistedTurns={turns} tail={tail} tailRunning />);
    expect(screen.queryByTestId("followup-row")).toBeNull();
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <PersistedThreadStream persistedTurns={turns} />
      </QueryClientProvider>,
    );
    const rows = screen.getAllByTestId("followup-row");
    expect(rows).toHaveLength(1);
    expect(screen.getByText("first ask").compareDocumentPosition(rows[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("a running video tail after a settled live turn: the live turn shows no chips either", () => {
    renderWithClient(
      <PersistedThreadStream
        persistedTurns={[hooksTurn("first ask", "First hook line")]}
        liveTurn={{ userTurn: "second ask", blocks: hooksTurn("second ask", "Second hook line").blocks, live: { skill: "hooks", isStreaming: false, stages: [] } }}
        tail={tail}
        tailRunning
      />,
    );
    expect(screen.queryByTestId("followup-row")).toBeNull();
  });

  // The failed video turn keeps slice 1's rule for a question with no answer: it never takes the
  // chips, so they stay under the last answer above it (as for a failed live run).
  it("a failed video tail (not running): the chips stay under the last answer above it", () => {
    renderWithClient(<PersistedThreadStream persistedTurns={[hooksTurn("first ask", "First hook line")]} tail={tail} />);
    const rows = screen.getAllByTestId("followup-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.compareDocumentPosition(screen.getByText("take.mp4")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
