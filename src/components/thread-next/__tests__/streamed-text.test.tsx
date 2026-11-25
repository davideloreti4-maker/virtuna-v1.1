/** @vitest-environment happy-dom */

/**
 * A plain answer (thread feel §4.5), rendered for real through react-markdown: while it streams each
 * word is its own `.word-in` span, so a new word fades in and a word already shown keeps its node
 * (and does not fade again); once it has ended, today's markdown markup and one quiet Copy under it.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { AnswerActions, StreamedAnswer, rehypeWords } from "../streamed-text";

afterEach(cleanup);

const words = (root: ParentNode) => [...root.querySelectorAll(".word-in")];

describe("rehypeWords", () => {
  it("wraps each word of a paragraph and of a strong in its own span, keeps the spaces, leaves code whole", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "p",
          properties: {},
          children: [
            { type: "text", value: "Hook two " },
            { type: "element", tagName: "strong", properties: {}, children: [{ type: "text", value: "leads  by" }] },
            { type: "text", value: " 9: " },
            { type: "element", tagName: "code", properties: {}, children: [{ type: "text", value: "stop rate" }] },
          ],
        },
        { type: "text", value: "\n" },
        {
          type: "element",
          tagName: "pre",
          properties: {},
          children: [{ type: "element", tagName: "code", properties: {}, children: [{ type: "text", value: "a b" }] }],
        },
      ],
    };
    rehypeWords()(tree);

    const word = (value: string) => ({
      type: "element",
      tagName: "span",
      properties: { className: ["word-in"] },
      children: [{ type: "text", value }],
    });
    const space = (value = " ") => ({ type: "text", value });
    expect(tree.children[0]).toEqual({
      type: "element",
      tagName: "p",
      properties: {},
      children: [
        word("Hook"),
        space(),
        word("two"),
        space(),
        { type: "element", tagName: "strong", properties: {}, children: [word("leads"), space("  "), word("by")] },
        space(),
        word("9:"),
        space(),
        { type: "element", tagName: "code", properties: {}, children: [{ type: "text", value: "stop rate" }] },
      ],
    });
    // Between blocks: a line break, no word in it.
    expect(tree.children[1]).toEqual({ type: "text", value: "\n" });
    // Inside `pre`, nothing is wrapped.
    expect(tree.children[2]).toEqual({
      type: "element",
      tagName: "pre",
      properties: {},
      children: [{ type: "element", tagName: "code", properties: {}, children: [{ type: "text", value: "a b" }] }],
    });
  });
});

describe("StreamedAnswer — live", () => {
  it("one fading span per word, read politely, in the turn's wrapper and today's measure", () => {
    const { container } = render(<StreamedAnswer text="Hook two is **ahead** because it names the cost." live />);
    expect(words(container).map((w) => w.textContent)).toEqual(["Hook", "two", "is", "ahead", "because", "it", "names", "the", "cost."]);
    expect(container.querySelector("strong")).toHaveTextContent("ahead");
    const wrapper = container.firstElementChild!;
    expect(wrapper).toHaveAttribute("aria-live", "polite");
    expect(wrapper).toHaveClass("proportional-nums", "[&_.md]:leading-[22px]");
    expect(wrapper.querySelector(".md")).toHaveClass("max-w-[68ch]", "text-prose");
    expect(container).toHaveTextContent("Hook two is ahead because it names the cost.");
  });

  it("as the text grows, the words already shown keep their nodes and the new ones are added", () => {
    const { container, rerender } = render(<StreamedAnswer text="Hook two is ahead" live />);
    const before = words(container);
    expect(before).toHaveLength(4);
    rerender(<StreamedAnswer text={"Hook two is ahead because it names the cost.\n\nTry it first."} live />);
    const after = words(container);
    expect(after).toHaveLength(12);
    for (const [i, node] of before.entries()) expect(after[i]).toBe(node);
    expect(after.slice(4).map((w) => w.textContent)).toEqual(["because", "it", "names", "the", "cost.", "Try", "it", "first."]);
  });

  it("code keeps its text whole", () => {
    const { container } = render(<StreamedAnswer text="Run `stop rate` first." live />);
    expect(container.querySelector("code")).toHaveTextContent("stop rate");
    expect(container.querySelector("code .word-in")).toBeNull();
    expect(words(container).map((w) => w.textContent)).toEqual(["Run", "first."]);
  });

  it("no Copy while it streams", () => {
    render(<StreamedAnswer text="Hook two is ahead" live />);
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
  });
});

describe("StreamedAnswer — ended", () => {
  const TEXT = "Hook two is **ahead** because it names the cost.";

  it("today's markdown markup, no word spans, not live, and Copy under it when it is given the text to copy", () => {
    const { container } = render(<StreamedAnswer text={TEXT} live={false} copyText={TEXT} />);
    expect(words(container)).toHaveLength(0);
    const wrapper = container.firstElementChild!;
    expect(wrapper).not.toHaveAttribute("aria-live");
    expect(wrapper).toHaveClass("proportional-nums", "[&_.md]:leading-[22px]");
    expect(wrapper.querySelector(".md")).toHaveClass("max-w-[68ch]", "text-prose");
    expect(wrapper.querySelector(".md p")!.innerHTML).toBe("Hook two is <strong>ahead</strong> because it names the cost.");
    const copy = screen.getByRole("button", { name: "Copy" });
    // Under the answer, not inside its text.
    expect(wrapper.contains(copy)).toBe(false);
    expect(wrapper.compareDocumentPosition(copy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // Rulings 17: the Copy under a turn's last text part copies the whole turn's text, not its own part.
  it("Copy takes the text it is given (the turn's whole text), then a check and 'Copied' for a moment", async () => {
    const writeText = vi.fn(async (_text: string) => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const WHOLE = `First part.\n\n${TEXT}`;
    try {
      render(<StreamedAnswer text={TEXT} live={false} copyText={WHOLE} />);
      expect(document.querySelector('[data-part="copied-mark"]')).toBeNull();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Copy" }));
      });
      expect(writeText).toHaveBeenCalledWith(WHOLE);
      expect(screen.getByRole("status")).toHaveTextContent("Copied");
      expect(document.querySelector('[data-part="copied-mark"]')).toBeInTheDocument();
    } finally {
      Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    }
  });

  it("not given a text to copy (a part that is not the turn's last): no Copy", () => {
    const { container } = render(<StreamedAnswer text={TEXT} live={false} />);
    expect(container.querySelector(".md p")).toHaveTextContent("Hook two is ahead because it names the cost.");
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
    const nulled = render(<StreamedAnswer text={TEXT} live={false} copyText={null} />);
    expect(within(nulled.container).queryByRole("button", { name: "Copy" })).toBeNull();
  });

  it("live, even given a text to copy: no Copy", () => {
    render(<StreamedAnswer text={TEXT} live copyText={TEXT} />);
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
  });
});

describe("AnswerActions", () => {
  it("one quiet Copy in the muted ink, a 34 target pulled 8 to the left and 4 up into the chips' rhythm", () => {
    const { container } = render(<AnswerActions text="An answer." />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    const copy = screen.getByRole("button", { name: "Copy" });
    expect(copy).toHaveClass("h-[34px]", "w-[34px]", "text-foreground-muted");
    expect(copy).not.toHaveClass("text-foreground-secondary");
    expect(container.firstElementChild).toHaveClass("-ml-2", "-mt-1");
    expect(screen.queryByText(/Try again/)).toBeNull();
  });
});
