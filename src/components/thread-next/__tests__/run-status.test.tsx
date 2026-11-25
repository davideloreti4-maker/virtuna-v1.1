/** @vitest-environment happy-dom */

/**
 * The wait's line and the row of what the run reads (thread feel §4.2, §7), rendered for real: the
 * line is a polite status that is read when its words change; the covers are hidden from a screen
 * reader and the run's own headline is shown word for word.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import type { EvidenceItem, RunEvidence } from "@/lib/tools/evidence";
import { EvidenceRow, RunStatus } from "../run-status";

afterEach(cleanup);

const TOPICAL = "Reading 3 real videos matched to this subject";

const video = (n: number, image: string | null = `/covers/c${n}.jpg`): EvidenceItem => ({
  kind: "video",
  ...(image ? { image } : {}),
  label: `creator_${n}`,
  metric: `${n}K views`,
});

const evidenceOf = (items: EvidenceItem[], headline = TOPICAL): RunEvidence => ({ headline, items });

describe("RunStatus", () => {
  it("announces its words and its note, politely", () => {
    render(<RunStatus words="Writing hooks" note="about 20 s" inCard />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Writing hooks");
    expect(status).toHaveTextContent("about 20 s");
    // The words carry the light that passes over them; the note sits after them, in the muted ink.
    expect(screen.getByText("Writing hooks")).toHaveClass("run-words");
    const note = screen.getByText("about 20 s");
    expect(note).toHaveClass("text-foreground-muted", "text-meta");
    expect(screen.getByText("Writing hooks").compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("a change of words rerenders the same status element (so it is read again)", () => {
    const { rerender } = render(<RunStatus words="Looking for videos on this topic" note="about 20 s" inCard />);
    const status = screen.getByRole("status");
    rerender(<RunStatus words="Writing hooks" note="about 20 s" inCard />);
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent("Writing hooks");
    expect(status).not.toHaveTextContent("Looking for videos");
  });

  it("no note: nothing at the end", () => {
    render(<RunStatus words="Thinking" />);
    expect(screen.getByRole("status")).toHaveTextContent(/^Thinking$/);
  });

  it("outside a card the words are 15 / 21; inside a card's header 13 / 21 at 540, in the header's place", () => {
    const { unmount } = render(<RunStatus words="Thinking" />);
    const outside = screen.getByRole("status");
    expect(outside).toHaveClass("text-ui", "leading-[21px]");
    expect(outside).not.toHaveClass("text-meta");
    unmount();
    render(<RunStatus words="Writing hooks" inCard />);
    const inside = screen.getByRole("status");
    expect(inside).toHaveClass("text-meta", "font-[540]", "leading-[21px]", "pt-2.5", "pb-2", "px-0.5");
    expect(inside).not.toHaveClass("text-ui");
  });
});

describe("EvidenceRow", () => {
  it("up to five covers, then the headline word for word", () => {
    const { container } = render(<EvidenceRow evidence={evidenceOf([1, 2, 3, 4, 5, 6, 7].map((n) => video(n)))} />);
    const covers = container.querySelectorAll('[data-part="evidence-cover"]');
    expect(covers).toHaveLength(5);
    expect([...container.querySelectorAll('[data-part="evidence-cover"] img')].map((img) => img.getAttribute("src"))).toEqual(
      [1, 2, 3, 4, 5].map((n) => `/covers/c${n}.jpg`),
    );
    const headline = screen.getByText(TOPICAL);
    expect(headline.textContent).toBe(TOPICAL);
    expect(headline).toHaveClass("line-clamp-2", "text-meta", "leading-[18px]", "text-foreground-secondary");
    // No handle, no number: the row says that real videos are read, the cards say which.
    expect(container).not.toHaveTextContent(/creator_|views/);
  });

  it("the covers are hidden from a screen reader; only the headline is read", () => {
    const { container } = render(<EvidenceRow evidence={evidenceOf([video(1), video(2)])} />);
    for (const cover of container.querySelectorAll('[data-part="evidence-cover"]')) {
      expect(cover.closest('[aria-hidden="true"]')).not.toBeNull();
    }
    expect(screen.getByText(TOPICAL).closest('[aria-hidden="true"]')).toBeNull();
  });

  it("each cover is 16 × 22 on the scale's radius, every one after the first 4 over the one before", () => {
    const { container } = render(<EvidenceRow evidence={evidenceOf([video(1), video(2), video(3)])} />);
    const covers = [...container.querySelectorAll('[data-part="evidence-cover"]')];
    for (const cover of covers) expect(cover).toHaveClass("w-4", "h-[22px]", "rounded-xs", "ring-[1.5px]");
    expect(covers[0]).not.toHaveClass("-ml-1");
    expect(covers[1]).toHaveClass("-ml-1");
    expect(covers[2]).toHaveClass("-ml-1");
  });

  it("a cover with no image, or one that fails to load, is a plain tile", () => {
    const { container } = render(<EvidenceRow evidence={evidenceOf([video(1), video(2, null)])} />);
    const covers = [...container.querySelectorAll('[data-part="evidence-cover"]')];
    expect(covers).toHaveLength(2);
    for (const cover of covers) expect(cover).toHaveClass("bg-surface-sunken");
    expect(covers[1]!.querySelector("img")).toBeNull();
    fireEvent.error(covers[0]!.querySelector("img")!);
    expect(covers[0]!.querySelector("img")).toBeNull();
    expect(container.querySelectorAll('[data-part="evidence-cover"]')).toHaveLength(2);
  });

  it("an account's picture counts as a cover; a frame of the creator's own video does not", () => {
    const profile: EvidenceItem = { kind: "profile", image: "/covers/p.jpg", label: "creator_one" };
    const frame: EvidenceItem = { kind: "frame", image: "/frames/0.jpg", idx: 0 };
    const { container } = render(<EvidenceRow evidence={evidenceOf([frame, profile, frame], "Reading your account")} />);
    expect(container.querySelectorAll('[data-part="evidence-cover"]')).toHaveLength(1);
    expect(container.querySelector('[data-part="evidence-cover"] img')).toHaveAttribute("src", "/covers/p.jpg");
  });

  it("nothing for an evidence without usable items, or none at all", () => {
    const frames = evidenceOf([{ kind: "frame", image: "/frames/0.jpg", idx: 0 }], "Your recent posts");
    const { container, rerender } = render(<EvidenceRow evidence={frames} />);
    expect(container.innerHTML).toBe("");
    rerender(<EvidenceRow evidence={evidenceOf([])} />);
    expect(container.innerHTML).toBe("");
    rerender(<EvidenceRow evidence={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("in a card the ring is the card's surface; outside, the thread's", () => {
    const { container, unmount } = render(<EvidenceRow evidence={evidenceOf([video(1)])} inCard />);
    expect(container.querySelector('[data-part="evidence-cover"]')).toHaveClass("ring-surface");
    unmount();
    const outside = render(<EvidenceRow evidence={evidenceOf([video(1)])} />);
    expect(outside.container.querySelector('[data-part="evidence-cover"]')).toHaveClass("ring-background");
  });
});
