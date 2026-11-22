/** @vitest-environment happy-dom */

/**
 * The card's parts (spec §3 rule 2): the one ink primary with its price in the `em`, and the
 * waiting row a live run shows under the label (§4.8). Rendered for real.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { AnswerCard, AnswerPrimary, CardHeader } from "../answer-card";
import { WaitingRow } from "../waiting-row";

afterEach(cleanup);

describe("AnswerPrimary", () => {
  it("a price reads 'N credits' in the em, one credit singular", () => {
    const { rerender } = render(<AnswerPrimary icon={null} label="Simulate all 3" price={3} onClick={() => {}} />);
    expect(screen.getByRole("button", { name: /Simulate all 3/ }).querySelector("em")).toHaveTextContent("3 credits");
    rerender(<AnswerPrimary icon={null} label="Simulate all 1" price={1} onClick={() => {}} />);
    expect(screen.getByRole("button", { name: /Simulate all 1/ }).querySelector("em")).toHaveTextContent(/^1 credit$/);
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

describe("WaitingRow", () => {
  it("names the run, politely live, with its dots hidden from screen readers", () => {
    const { container } = render(<WaitingRow label="Writing hooks" />);
    const row = screen.getByText("Writing hooks").closest("[aria-live]");
    expect(row).toHaveAttribute("aria-live", "polite");
    const dots = container.querySelectorAll('[data-part="dot"]');
    expect(dots).toHaveLength(3);
    for (const dot of dots) expect(dot.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("the dots pulse only when motion is allowed", () => {
    const { container } = render(<WaitingRow label="Thinking" />);
    for (const dot of container.querySelectorAll('[data-part="dot"]')) {
      expect(dot.getAttribute("class") ?? "").toMatch(/motion-safe:animate-/);
      expect(dot.getAttribute("class") ?? "").not.toMatch(/(^|\s)animate-/);
    }
  });
});
