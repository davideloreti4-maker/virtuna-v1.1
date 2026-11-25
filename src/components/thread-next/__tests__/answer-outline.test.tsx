/** @vitest-environment happy-dom */

/**
 * AnswerOutline (thread feel §4.3): while a named run waits, its answer's own card with what is known
 * and grey bars for what is not. Rendered for real.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import type { RunEvidence } from "@/lib/tools/evidence";
import { AnswerOutline } from "../answer-outline";

afterEach(cleanup);

const TOPICAL = "Reading 3 real videos matched to this subject";
const GROUNDED: RunEvidence = {
  headline: TOPICAL,
  items: [1, 2, 3].map((n) => ({ kind: "video" as const, label: `creator_${n}`, metric: `${n}K views` })),
};
const POST: RunEvidence = {
  headline: "Reworking this video",
  items: [{ kind: "video", image: "/covers/c9.jpg", label: "creator_one", metric: "154K views" }],
};

const card = () => document.querySelector<HTMLElement>('[data-answer="card"]')!;
const bars = (root: ParentNode) => [...root.querySelectorAll(".ghost-bar")];

function expectHidden(root: ParentNode) {
  const ghosts = [...root.querySelectorAll(".ghost-bar, [data-part='ghost-ring']")];
  expect(ghosts.length).toBeGreaterThan(0);
  for (const ghost of ghosts) expect(ghost.closest('[aria-hidden="true"]')).not.toBeNull();
}

describe("the pack's outline (hooks, ideas)", () => {
  it("the answer's card: the header line, three rows of a pale ring and three bars, no button", () => {
    render(<AnswerOutline kind="pack" words="Writing hooks" note="about 20 s" evidence={null} />);
    const outline = card();
    expect(outline.closest('[data-outline="pack"]')).not.toBeNull();
    const status = within(outline).getByRole("status");
    expect(status).toHaveTextContent("Writing hooks");
    expect(status).toHaveTextContent("about 20 s");
    // The line takes the header's place: it is the card's first part.
    expect(outline.firstElementChild).toBe(status);

    const rows = outline.querySelectorAll('[data-part="ghost-row"]');
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      const ring = row.querySelector('[data-part="ghost-ring"]')!;
      expect(ring).toHaveClass("size-[46px]", "rounded-full", "border-[4.5px]", "border-gauge-track");
      expect(bars(row)).toHaveLength(3);
    }
    // Where the button will be: nothing. Nothing to press, nothing to read but the line.
    expect(within(outline).queryAllByRole("button")).toHaveLength(0);
    expect(within(outline).queryAllByRole("img")).toHaveLength(0);
    expectHidden(outline);
  });

  it("each ghost row asks for a least height of 93 (85 from md), with a real row's top rule and padding", () => {
    render(<AnswerOutline kind="pack" words="Writing hooks" note={null} evidence={null} />);
    // A real row with a three-line hook is 81 (1 + 10 + 60 + 10) and the real card adds its button
    // (58 on a phone, 70 on a desk). Rows of 93 (85 from md) keep the change within 24 either way.
    // Those are the classes only: the height kept on landing is a browser's to measure (it was, at
    // +17 on a phone and -15 on a desk), not this test's.
    for (const row of card().querySelectorAll('[data-part="ghost-row"]')) {
      expect(row).toHaveClass("min-h-[93px]", "md:min-h-[85px]", "border-t", "border-border", "py-2.5");
    }
  });

  it("the evidence row under the line when the run sends one; none without", () => {
    const { unmount } = render(<AnswerOutline kind="pack" words="Looking for videos on this topic" note="about 20 s" evidence={GROUNDED} />);
    const outline = card();
    const headline = within(outline).getByText(TOPICAL);
    expect(outline.querySelectorAll('[data-part="evidence-cover"]')).toHaveLength(3);
    // Under the line, above the rows.
    expect(within(outline).getByRole("status").compareDocumentPosition(headline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(headline.compareDocumentPosition(outline.querySelector('[data-part="ghost-row"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    unmount();

    render(<AnswerOutline kind="pack" words="Writing hooks" note="about 20 s" evidence={null} />);
    expect(screen.queryByText(TOPICAL)).toBeNull();
    expect(document.querySelector('[data-part="evidence"]')).toBeNull();
  });
});

describe("the script's outline", () => {
  it("the header line, five beats on the time rail with bars for their words, no button", () => {
    render(<AnswerOutline kind="script" words="Writing your script" note="about 30 s" evidence={null} />);
    const outline = card();
    expect(outline.closest('[data-outline="script"]')).not.toBeNull();
    expect(within(outline).getByRole("status")).toHaveTextContent("Writing your script");
    const beats = [...outline.querySelectorAll('[data-part="ghost-beat"]')];
    expect(beats).toHaveLength(5);
    // The film's rhythm: a short opening, two long beats, two shorter (the words' bars; the name's
    // bar comes on top of them, tested below).
    expect(beats.map((b) => bars(b).filter((bar) => bar.getAttribute("data-part") !== "ghost-name").length)).toEqual([1, 3, 3, 2, 2]);
    for (const beat of beats) {
      expect(beat).toHaveClass("grid", "grid-cols-[28px_3px_minmax(0,1fr)]");
      expect(beat.querySelector('[data-part="rail"]')).not.toBeNull();
    }
    expect(within(outline).queryAllByRole("button")).toHaveLength(0);
    expectHidden(outline);
  });

  it("each ghost beat carries the name's bar first: about a fifth of the line, 9 tall, on the name's 16 line", () => {
    render(<AnswerOutline kind="script" words="Writing your script" note={null} evidence={null} />);
    for (const beat of card().querySelectorAll('[data-part="ghost-beat"]')) {
      const name = beat.querySelector<HTMLElement>('[data-part="ghost-name"]')!;
      expect(name).toHaveClass("ghost-bar", "h-[9px]");
      expect(name.style.width).toBe("20%");
      // First in the beat's text box, above the words' bars; hidden from a screen reader like them.
      expect(bars(beat)[0]).toBe(name);
      expect(name.closest('[aria-hidden="true"]')).not.toBeNull();
      // The box starts 9 down (rounded from the 9.5 that centres it), so the beat is 17 taller:
      // 9 + 9 + 10 to the words' first bar, against 11 before it today.
      expect(name.parentElement).toHaveClass("pt-[9px]", "gap-2.5", "pb-[13px]");
    }
  });

  it("a grounded script shows what it reads under the line too", () => {
    render(<AnswerOutline kind="script" words="Looking for videos on this topic" note="about 30 s" evidence={GROUNDED} />);
    expect(within(card()).getByText(TOPICAL)).toBeInTheDocument();
  });
});

describe("the remix's outline", () => {
  it("before the post is fetched: the header line, a grey tile and two bars, two bars for the hook", () => {
    render(<AnswerOutline kind="remix" words="Getting the video" note={null} evidence={null} />);
    const outline = card();
    expect(outline.closest('[data-outline="remix"]')).not.toBeNull();
    expect(within(outline).getByRole("status")).toHaveTextContent("Getting the video");
    const source = outline.querySelector('[data-part="ghost-source"]')!;
    expect(source.querySelector('[data-part="ghost-tile"]')).toHaveClass("ghost-bar");
    expect(bars(source)).toHaveLength(3);
    expect(bars(outline.querySelector('[data-part="ghost-hook"]')!)).toHaveLength(2);
    expect(outline.querySelector('[data-part="cover"]')).toBeNull();
    expectHidden(outline);
  });

  it("once the post is there: the real source row (cover, handle, views), not the evidence row", () => {
    render(<AnswerOutline kind="remix" words="Working out why it worked" note={null} evidence={POST} />);
    const outline = card();
    expect(outline.querySelector('[data-part="ghost-source"]')).toBeNull();
    expect(outline.querySelector('[data-part="cover"] img')).toHaveAttribute("src", "/covers/c9.jpg");
    expect(within(outline).getByText("@creator_one")).toBeInTheDocument();
    expect(within(outline).getByText("154K views")).toBeInTheDocument();
    // Its one post is not drawn as the evidence row.
    expect(screen.queryByText("Reworking this video")).toBeNull();
    expect(outline.querySelector('[data-part="evidence"]')).toBeNull();
    // The hook is still to come.
    expect(bars(outline.querySelector('[data-part="ghost-hook"]')!)).toHaveLength(2);
  });
});
