/** @vitest-environment happy-dom */
/**
 * /dev/answers draws each state of the answer-system drawing from the fixtures, inside the real
 * "Maven" turn, with the real pack. Nothing here sends anything.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { DevAnswers } from "../dev-answers";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

describe("/dev/answers states", () => {
  it("p3: three hooks, not simulated", () => {
    render(<DevAnswers state="p3" skin="light" frames={null} />);
    expect(screen.getByRole("heading", { name: "Maven" })).toBeInTheDocument();
    expect(screen.getByText("3 hooks for a video about meal prep for busy students")).toBeInTheDocument();
    expect(screen.getByText("1 credit each")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Simulate all 3/ })).toHaveTextContent("3 credits");
    expect(screen.getByRole("button", { name: "Follow up: More hooks" })).toBeInTheDocument();
  });

  it("p4: the queue at 2 of 3", () => {
    render(<DevAnswers state="p4" skin="light" frames={null} />);
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "30% would stop to watch" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Simulating" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Simulate all/ })).toBeNull();
  });

  it("p5: the seals' numbers, Best on hook 3, the sentence", () => {
    render(<DevAnswers state="p5" skin="light" frames={null} />);
    for (const n of [30, 22, 45]) expect(screen.getByRole("img", { name: `${n}% would stop to watch` })).toBeInTheDocument();
    expect(screen.getByText("Best")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Script the best/ })).toHaveTextContent("2 credits");
    expect(screen.getByText("Hook 3 leads by 15 points.")).toBeInTheDocument();
  });

  it("p12: four ideas, not simulated", () => {
    render(<DevAnswers state="p12" skin="light" frames={null} />);
    expect(screen.getByText("4 ideas for next week")).toBeInTheDocument();
    expect(screen.getByText("Short sessions stick better.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Simulate all 4/ })).toHaveTextContent("4 credits");
  });

  it("p8: the video run, uploading done, the clock and 'Watch it run'", () => {
    render(<DevAnswers state="p8" skin="light" frames={null} />);
    expect(screen.getByText("Simulate this")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Watch it run" })).toHaveAttribute("href", "/simulation/fixture-middle");
  });

  it.each(["p9", "d3"] as const)("%s: the recorded run's result through videoStateOf", (state) => {
    render(<DevAnswers state={state} skin="light" frames={null} />);
    expect(screen.getByRole("img", { name: "46% watch to the end" })).toBeInTheDocument();
    expect(screen.getByText("Half leave by 0:17.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open simulation" })).toHaveAttribute("href", "/simulation/fixture-middle");
  });

  it("p9 with frames: the first scene's frame is the poster", () => {
    const { container } = render(<DevAnswers state="p9" skin="light" frames="/dev-frames" />);
    expect(container.querySelector('[data-part="thumb"] img')).toHaveAttribute("src", "/dev-frames/0.jpg");
  });

  it("p9b: the run still loading shows no number", () => {
    render(<DevAnswers state="p9b" skin="light" frames={null} />);
    expect(screen.queryByRole("img", { name: /%/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Open simulation" })).toBeInTheDocument();
  });

  it("p10: the script, its opening not simulated", () => {
    render(<DevAnswers state="p10" skin="light" frames={null} />);
    expect(screen.getByText("Script an AI simulation video")).toBeInTheDocument();
    expect(screen.getByText("0:24")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Simulate the opening: / })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add your take" })).toBeInTheDocument();
  });

  it("p10b: the opening simulated", () => {
    render(<DevAnswers state="p10b" skin="light" frames={null} />);
    expect(screen.getByRole("img", { name: /% would stop to watch$/ })).toBeInTheDocument();
  });

  it("p11: the remix", () => {
    render(<DevAnswers state="p11" skin="light" frames={null} />);
    expect(screen.getByText("Remix @lacapture’s video")).toBeInTheDocument();
    expect(screen.getByText("10.4× their average · 154K views")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Script it/ })).toHaveTextContent("2 credits");
  });

  it("p11b: three remixes on a pager", () => {
    render(<DevAnswers state="p11b" skin="light" frames={null} />);
    expect(screen.getByRole("region", { name: "Remix 1 of 3" })).toBeInTheDocument();
  });

  it("p13: the fallback card (the account read)", () => {
    render(<DevAnswers state="p13" skin="light" frames={null} />);
    expect(screen.getByText("Read my account")).toBeInTheDocument();
    expect(screen.getByText("Your account")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show all" })).toHaveAttribute("aria-expanded", "false");
  });

  it("paints the asked skin on <html>", () => {
    render(<DevAnswers state="p5" skin="dark" frames={null} />);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
