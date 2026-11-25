/** @vitest-environment happy-dom */

/**
 * FallbackAnswer — the card for every block type without a card of its own (spec §4.6): a title,
 * the first three lines, and "Show all" when there are more. Fed by the real `fallbackOf` on the
 * drawing's account read (three "working" lines and one "fix").
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { fallbackOf } from "@/lib/thread-next/fallback-lines";
import { FallbackAnswer } from "../fallback-answer";
import { accountRead, composed } from "./fixtures/answers";

afterEach(cleanup);

describe("FallbackAnswer", () => {
  it("shows the title and three lines, then every line after 'Show all'", () => {
    const { title, lines } = fallbackOf(accountRead());
    expect(lines).toHaveLength(4);
    render(<FallbackAnswer title={title} lines={lines} />);
    expect(screen.getByText("Your account")).toBeInTheDocument();
    for (const line of lines.slice(0, 3)) expect(screen.getByText(line)).toBeInTheDocument();
    expect(screen.queryByText("Your first second is often a slow pan.")).toBeNull();

    const more = screen.getByRole("button", { name: "Show all" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(more);
    for (const line of lines) expect(screen.getByText(line)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(screen.queryByText("Your first second is often a slow pan.")).toBeNull();
  });

  it("three lines or fewer: no 'Show all'", () => {
    render(<FallbackAnswer title="Answer" lines={["One line.", "Two lines."]} />);
    expect(screen.getByText("One line.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("folded, a long line shows its first sentence; 'Show all' then shows it whole", () => {
    const long = "Name the situation immediately. No throat-clearing. The viewer needs to know who and where.";
    render(<FallbackAnswer title="Story time" lines={[long, "Add complications."]} />);
    const items = () => screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items()).toEqual(["Name the situation immediately.", "Add complications."]);
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(items()).toEqual([long, "Add complications."]);
  });

  it("a title alone renders the title", () => {
    render(<FallbackAnswer title="Answer" lines={[]} />);
    expect(screen.getByText("Answer")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("works on a composed card's lines", () => {
    const { title, lines } = fallbackOf(composed());
    render(<FallbackAnswer title={title} lines={lines} />);
    expect(screen.getByText("Two hooks compared")).toBeInTheDocument();
    expect(screen.getByText("The $40 hook")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show all" })).toBeInTheDocument();
  });

  it("has no axe violations, collapsed or open", async () => {
    const { title, lines } = fallbackOf(accountRead());
    const { container } = render(<FallbackAnswer title={title} lines={lines} />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});

// Thread feel §4.3: inside a landing the fallback card comes in as one part, first.
describe("FallbackAnswer — its place in a landing", () => {
  it("the card is one `land` at 0", () => {
    const { title, lines } = fallbackOf(accountRead());
    const { container } = render(<FallbackAnswer title={title} lines={lines} />);
    const card = container.querySelector<HTMLElement>('[data-answer="card"]')!;
    expect(card).toHaveClass("land");
    // No index of its own: the landing's CSS reads a missing `--i` as 0.
    expect(card.style.getPropertyValue("--i")).toBe("");
  });
});
