/** @vitest-environment happy-dom */
/**
 * The thread's turns under the new look (thread feel, step 1, spec 2026-11-25 §4.1): each turn (a
 * persisted one, the live one, the composer's `tail`) is ONE element in the column, `[data-turn]`, so
 * a newly sent turn can be taken to the top of the window and can take the room under it.
 *
 * `ThreadTurn` is a marker here: this is about the stream's elements, not what a turn draws (that
 * is thread-turn-next's own suite). The spacing is asserted as classes: happy-dom does no layout,
 * and the sum (a turn's own gap, a later question's 14 on top) is the drawing's, pinned in
 * user-turn.tsx and thread-shell.tsx.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
vi.mock("@/components/thread/thread-turn", () => ({
  ThreadTurn: (props: { userTurn?: string | null; showFollowups?: boolean; live?: unknown }) => (
    <p
      data-testid="turn"
      data-question={props.userTurn ?? ""}
      data-chips={String(!!props.showFollowups)}
      data-live={props.live ? "yes" : "no"}
    >
      {props.userTurn ?? "answer only"}
    </p>
  ),
}));

import { PersistedThreadStream, type LiveTurn } from "../persisted-thread-stream";
import type { RehydrateTurn } from "@/components/app/home/rehydrate-thread";

afterEach(cleanup);

const answered = (userTurn: string | null): RehydrateTurn => ({
  userTurn,
  blocks: [{ type: "markdown", props: { text: "An answer." } }],
});
const live = (userTurn: string | null, isStreaming = true): LiveTurn => ({
  userTurn,
  blocks: [],
  live: { skill: "chat", isStreaming },
});
const tail = <p data-testid="tail">the video run</p>;

const turnsOf = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>("[data-turn]")];
const column = (container: HTMLElement) => container.firstElementChild as HTMLElement;

describe("PersistedThreadStream, flag on: one element per turn", () => {
  it("each persisted turn, the live turn and the tail sit in their own [data-turn], in that order, as the column's children", () => {
    const { container } = render(
      <PersistedThreadStream
        persistedTurns={[answered("first ask"), answered("second ask")]}
        liveTurn={live("third ask")}
        tail={tail}
      />,
    );
    const turns = turnsOf(container);
    expect(turns).toHaveLength(4);
    expect([...column(container).children]).toEqual(turns);
    expect(turns.map((t) => t.textContent)).toEqual(["first ask", "second ask", "third ask", "the video run"]);
    turns.forEach((t) => expect(t.children).toHaveLength(1));
  });

  it('the first is "first"; a later turn with a question is "later" (14 on top); a later answer alone is neither', () => {
    const { container } = render(
      <PersistedThreadStream
        persistedTurns={[answered("first ask"), answered(null), answered("   "), answered("fourth ask")]}
        liveTurn={live("fifth ask")}
        tail={tail}
      />,
    );
    const turns = turnsOf(container);
    expect(turns.map((t) => t.dataset.turn)).toEqual(["first", "answer", "answer", "later", "later", "later"]);
    // A question further down sits 14 lower than the rhythm, as its bubble did (`mt-3.5`, which the
    // bubble's own `first:mt-0` now drops inside its turn). Only those turns carry it.
    turns.forEach((t) => {
      expect(t.className.split(/\s+/).includes("mt-3.5")).toBe(t.dataset.turn === "later");
    });
  });

  it("a turn keeps its parts the column's gap apart, and a turn that draws nothing takes no place", () => {
    const { container } = render(<PersistedThreadStream persistedTurns={[answered("first ask")]} />);
    const [turn] = turnsOf(container);
    const classes = turn!.className.split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(["flex", "flex-col", "gap-3.5", "md:gap-4", "empty:hidden"]));
    // The column's own gap, the same pair.
    expect(column(container).className.split(/\s+/)).toEqual(expect.arrayContaining(["gap-3.5", "md:gap-4"]));
  });

  it("a tail alone is the first turn; a tail after others is always a turn with a question", () => {
    const alone = render(<PersistedThreadStream persistedTurns={[]} tail={tail} />);
    expect(turnsOf(alone.container).map((t) => t.dataset.turn)).toEqual(["first"]);
    alone.unmount();

    const after = render(<PersistedThreadStream persistedTurns={[answered(null)]} tail={tail} />);
    expect(turnsOf(after.container).map((t) => t.dataset.turn)).toEqual(["first", "later"]);
  });

  it("with `anchored` only the LAST turn takes the room: the tail, else the live turn, else the last persisted one", () => {
    const room = (container: HTMLElement) => turnsOf(container).map((t) => t.hasAttribute("data-room"));
    const ROOM = "min-h-[calc(var(--thread-room,0px)-var(--field-reserve,0px)-var(--thread-room-trim,72px))]";

    const withTail = render(
      <PersistedThreadStream anchored persistedTurns={[answered("a")]} liveTurn={live("b")} tail={tail} />,
    );
    expect(room(withTail.container)).toEqual([false, false, true]);
    const last = turnsOf(withTail.container)[2]!;
    expect(last.className.split(/\s+/)).toContain(ROOM);
    turnsOf(withTail.container)
      .slice(0, 2)
      .forEach((t) => expect(t.className).not.toContain("--thread-room"));
    withTail.unmount();

    const withLive = render(<PersistedThreadStream anchored persistedTurns={[answered("a")]} liveTurn={live("b")} />);
    expect(room(withLive.container)).toEqual([false, true]);
    withLive.unmount();

    const settled = render(<PersistedThreadStream anchored persistedTurns={[answered("a"), answered("b")]} />);
    expect(room(settled.container)).toEqual([false, true]);
    settled.unmount();

    const opened = render(<PersistedThreadStream persistedTurns={[answered("a"), answered("b")]} liveTurn={live("c")} tail={tail} />);
    expect(room(opened.container)).toEqual([false, false, false, false]);
    expect(opened.container.innerHTML).not.toContain("--thread-room");
  });

  it("the wrappers do not change which turn shows the next-step chips", () => {
    const chips = () => screen.getAllByTestId("turn").map((t) => t.dataset.chips);

    // Settled: the last answer only.
    const settled = render(<PersistedThreadStream persistedTurns={[answered("a"), answered("b")]} />);
    expect(chips()).toEqual(["false", "true"]);
    settled.unmount();

    // A live run: the live turn only.
    const running = render(<PersistedThreadStream persistedTurns={[answered("a")]} liveTurn={live("b")} />);
    expect(chips()).toEqual(["false", "true"]);
    running.unmount();

    // A running video tail: nobody.
    const video = render(<PersistedThreadStream persistedTurns={[answered("a")]} tail={tail} tailRunning />);
    expect(chips()).toEqual(["false"]);
    video.unmount();

    // A question saved with no answer at the end: the answer above it keeps them.
    const noAnswer = render(
      <PersistedThreadStream persistedTurns={[answered("a"), { userTurn: "b", blocks: [] }]} anchored />,
    );
    expect(chips()).toEqual(["true", "false"]);
    noAnswer.unmount();
  });

  it("the live turn and the tail each carry the number of the last send made to them (`data-send`); persisted turns never do", () => {
    const { container } = render(
      <PersistedThreadStream liveSendSeq={3} tailSendSeq={4} persistedTurns={[answered("a"), answered("b")]} liveTurn={live(null)} tail={tail} />,
    );
    expect(turnsOf(container).map((t) => t.getAttribute("data-send"))).toEqual([null, null, "3", "4"]);
  });

  it("a send to one slot leaves the other alone: a video sent with a stopped answer in the live slot does not re-stamp or re-mount it, nor the reverse", () => {
    // A stamp on the wrong slot is a turn the hook could take for the send (the first match), and a
    // re-mount loses what the answer had open.
    const { container, rerender } = render(
      <PersistedThreadStream liveSendSeq={1} tailSendSeq={0} persistedTurns={[answered("a")]} liveTurn={live("b", false)} tail={tail} />,
    );
    const [, liveBefore, tailBefore] = turnsOf(container);
    rerender(
      <PersistedThreadStream liveSendSeq={1} tailSendSeq={2} persistedTurns={[answered("a")]} liveTurn={live("b", false)} tail={tail} tailRunning />,
    );
    const [, liveAfter, tailAfter] = turnsOf(container);
    expect(liveAfter).toBe(liveBefore);
    expect(liveAfter!.dataset.send).toBe("1");
    expect(tailAfter).not.toBe(tailBefore);
    expect(tailAfter!.dataset.send).toBe("2");

    rerender(
      <PersistedThreadStream liveSendSeq={3} tailSendSeq={2} persistedTurns={[answered("a")]} liveTurn={live("c")} tail={tail} tailRunning />,
    );
    expect(turnsOf(container)[2]).toBe(tailAfter);
    expect(turnsOf(container)[1]!.dataset.send).toBe("3");
  });

  it("every send is a new live element, by its number: the same question sent again, and a turn with no question", () => {
    // The live slot is re-used by the next send (a chat that has not folded yet, a stopped answer).
    // Keyed by the send's number, the sent turn is a new element whatever its words.
    const { container, rerender } = render(
      <PersistedThreadStream liveSendSeq={1} persistedTurns={[answered("a")]} liveTurn={live("b")} />,
    );
    const first = turnsOf(container)[1]!;
    rerender(<PersistedThreadStream liveSendSeq={1} persistedTurns={[answered("a")]} liveTurn={live("b", false)} />);
    expect(turnsOf(container)[1]).toBe(first); // the same send settling: the same element

    rerender(<PersistedThreadStream liveSendSeq={2} persistedTurns={[answered("a")]} liveTurn={live("b")} />);
    const again = turnsOf(container)[1]!;
    expect(again).not.toBe(first); // the same question, sent again
    expect(again.dataset.send).toBe("2");

    rerender(<PersistedThreadStream liveSendSeq={3} persistedTurns={[answered("a")]} liveTurn={live(null)} />);
    expect(turnsOf(container)[1]).not.toBe(again); // no question at all
    expect(turnsOf(container)[1]!.dataset.send).toBe("3");
  });

  it("a video sent again is a new element; the running one stays one element through its run", () => {
    const failed = <p data-testid="tail">the failed run</p>;
    const running = <p data-testid="tail">the video run</p>;
    const { container, rerender } = render(
      <PersistedThreadStream tailSendSeq={1} persistedTurns={[answered("a")]} tail={failed} />,
    );
    const before = turnsOf(container)[1]!;
    rerender(<PersistedThreadStream tailSendSeq={2} persistedTurns={[answered("a")]} tail={running} tailRunning />);
    const sent = turnsOf(container)[1]!;
    expect(sent).not.toBe(before);
    rerender(<PersistedThreadStream tailSendSeq={2} persistedTurns={[answered("a")]} tail={running} tailRunning />);
    expect(turnsOf(container)[1]).toBe(sent);
    rerender(<PersistedThreadStream tailSendSeq={2} persistedTurns={[answered("a")]} tail={failed} />);
    expect(turnsOf(container)[1]).toBe(sent); // the same send ending: still its element
  });
});
