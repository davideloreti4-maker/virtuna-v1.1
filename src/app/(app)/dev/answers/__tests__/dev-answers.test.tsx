/** @vitest-environment happy-dom */
/**
 * /dev/answers draws each state of the answer-system drawing from the fixtures, inside the real
 * "Maven" turn, with the real pack. Nothing here sends anything.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/dev/answers",
  useSearchParams: () => new URLSearchParams(),
}));

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
    expect(screen.getAllByRole("button", { name: /^Open: / })).toHaveLength(3);
  });

  it("p4: the queue at 2 of 3", () => {
    render(<DevAnswers state="p4" skin="light" frames={null} />);
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
    // Hook 1 landed: its gauge links to the result page, its number the link's description.
    expect(screen.getByRole("link", { name: /^Open the result: I spent \$40/ })).toHaveAccessibleDescription("30% would stop to watch");
    expect(screen.getByRole("img", { name: "Simulating" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Simulate all/ })).toBeNull();
  });

  it("p5: the seals' numbers, Best on hook 3, the sentence", () => {
    render(<DevAnswers state="p5" skin="light" frames={null} />);
    // Each simulated row's gauge links to the result page (as the sheet's link does here), its number
    // the link's description.
    const links = screen.getAllByRole("link", { name: /^Open the result: / });
    expect(links).toHaveLength(3);
    for (const [i, n] of [30, 22, 45].entries()) {
      expect(links[i]).toHaveAccessibleDescription(`${n}% would stop to watch`);
      expect(links[i]).toHaveAttribute("href", "/dev/answers?state=p7");
    }
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
    expect(screen.getByText("of about a minute")).toBeInTheDocument();
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
    expect(screen.getByText("10× their average · 154K views")).toBeInTheDocument();
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

  it("p7: the hook's result page from the drawing's numbers", () => {
    render(<DevAnswers state="p7" skin="light" frames={null} />);
    expect(screen.getByRole("heading", { level: 1, name: "Hook" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "30% would stop to watch" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Would stop, by group" })).toBeInTheDocument();
    expect(screen.getByText("Quiet watchers")).toBeInTheDocument();
  });

  it("p7l: loading; p7n: not here", () => {
    const { unmount } = render(<DevAnswers state="p7l" skin="light" frames={null} />);
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    unmount();
    render(<DevAnswers state="p7n" skin="light" frames={null} />);
    expect(screen.getByText("This simulation isn't here.")).toBeInTheDocument();
  });

  it("p6: hook 1 opened, simulated: the sheet over the pack, linking to the page", () => {
    render(<DevAnswers state="p6" skin="light" frames={null} />);
    const hook1 = "I spent $40 on meal prep and it tasted like regret. Here is the $5 version that actually keeps me alive during finals.";
    const dialog = screen.getByRole("dialog", { name: hook1 });
    expect(within(dialog).getByRole("link", { name: /^Open the result: / })).toHaveAttribute("href", "/dev/answers?state=p7");
    expect(within(dialog).getByRole("img", { name: "30% would stop to watch" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Save" })).toHaveAttribute("aria-pressed", "false");
    expect(within(dialog).getByRole("button", { name: "Script this one, 2 credits" })).toBeInTheDocument();
  });

  it("p6b: the same hook not simulated: Simulate · 1 credit", () => {
    render(<DevAnswers state="p6b" skin="light" frames={null} />);
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: /^Simulate: I spent \$40/ })).toHaveTextContent("1 credit");
  });

  it("p6i: an idea opened", () => {
    render(<DevAnswers state="p6i" skin="light" frames={null} />);
    const dialog = screen.getByRole("dialog", { name: "The Two-Hour Study Lie" });
    expect(within(dialog).getByText("The take")).toBeInTheDocument();
    expect(within(dialog).getByText("Format")).toBeInTheDocument();
  });

  it("p6: the page holds the sheet open itself, so Escape closes it", async () => {
    render(<DevAnswers state="p6" skin="light" frames={null} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("paints the asked skin on <html>", () => {
    render(<DevAnswers state="p5" skin="dark" frames={null} />);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
