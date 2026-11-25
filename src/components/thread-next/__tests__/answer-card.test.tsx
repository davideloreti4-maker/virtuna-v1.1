/** @vitest-environment happy-dom */

/**
 * The card's parts (spec §3 rule 2): the one ink primary with its price in the `em`, the card and
 * its header. Rendered for real. (The waiting row is gone: the wait is `run-status.test.tsx`'s.)
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { AnswerCard, AnswerPrimary, CardHeader } from "../answer-card";

afterEach(cleanup);

describe("AnswerPrimary", () => {
  it("a price reads 'N credits' in the em, one credit singular", () => {
    const { rerender } = render(<AnswerPrimary icon={null} label="Simulate all 3" price={3} onClick={() => {}} />);
    expect(screen.getByRole("button", { name: /Simulate all 3/ }).querySelector("em")).toHaveTextContent("3 credits");
    rerender(<AnswerPrimary icon={null} label="Simulate all 1" price={1} onClick={() => {}} />);
    expect(screen.getByRole("button", { name: /Simulate all 1/ }).querySelector("em")).toHaveTextContent(/^1 credit$/);
  });

  it("the card's width on a phone; in a thread card from md, its content's width (248 at least)", () => {
    render(<AnswerPrimary icon={null} label="Script the best" price={2} onClick={() => {}} />);
    const classes = screen.getByRole("button", { name: /Script the best/ }).className.split(/\s+/);
    expect(classes).toContain("w-full");
    expect(classes).toEqual(
      expect.arrayContaining(["md:[[data-answer=card]_&]:w-auto", "md:[[data-answer=card]_&]:min-w-[248px]"]),
    );
  });

  it("a free action carries no price", () => {
    render(<AnswerPrimary icon={null} label="Add your take" onClick={() => {}} trailingArrow />);
    const button = screen.getByRole("button", { name: "Add your take" });
    expect(button.querySelector("em")).toBeNull();
    expect(button).not.toHaveTextContent(/credit/);
  });

  it("calls onClick", () => {
    const onClick = vi.fn();
    render(<AnswerPrimary icon={null} label="Script the best" price={2} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: /Script the best/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("with an href it is a link", () => {
    render(<AnswerPrimary icon={null} label="Open simulation" href="/simulation/fixture-1" trailingArrow />);
    const link = screen.getByRole("link", { name: "Open simulation" });
    expect(link).toHaveAttribute("href", "/simulation/fixture-1");
  });

  it("with neither it is disabled", () => {
    render(<AnswerPrimary icon={null} label="Script the best" price={2} />);
    const button = screen.getByRole("button", { name: /Script the best/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
  });
});

describe("AnswerCard and CardHeader", () => {
  it("render their content", () => {
    render(
      <AnswerCard>
        <CardHeader left="Would stop to watch" right="1 credit each" />
        <p>Row</p>
      </AnswerCard>,
    );
    expect(screen.getByText("Would stop to watch")).toBeInTheDocument();
    expect(screen.getByText("1 credit each")).toBeInTheDocument();
    expect(screen.getByText("Row")).toBeInTheDocument();
  });
});
