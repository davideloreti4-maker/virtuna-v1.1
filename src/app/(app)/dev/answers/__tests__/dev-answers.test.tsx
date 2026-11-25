/** @vitest-environment happy-dom */
/**
 * /dev/answers draws each state of the answer-system drawing from the fixtures, inside the real
 * "Maven" turn, with the real pack. Nothing here sends anything.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

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
    // The pack's header counts its rows until one is simulated (thread feel §4.7).
    expect(screen.getByText("3 hooks")).toBeInTheDocument();
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
    expect(screen.getByText("4 ideas")).toBeInTheDocument();
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

// Depth one tap away (thread depth §3), for looking at: nothing is sent.
describe("/dev/answers: depth", () => {
  const proven = () => [...document.querySelectorAll<HTMLElement>('[data-part="row-proof"]')];
  const names = () => [...document.querySelectorAll('[data-part="beat-name"]')].map((n) => n.textContent);

  it("p3: hook 1 shows the video it is built on, the other two nothing", () => {
    render(<DevAnswers state="p3" skin="light" frames={null} />);
    const rows = screen.getAllByRole("listitem");
    expect(proven()).toHaveLength(1);
    expect(within(rows[0]!).getByText("@dij.arc · 21K views")).toBeInTheDocument();
    expect(rows[0]!.querySelector('[data-part="row-proof"] img')).toHaveAttribute("src", "/covers/c8.jpg");
  });

  it("p3v: a cover and views, views without a cover, a cover without views", () => {
    render(<DevAnswers state="p3v" skin="light" frames={null} />);
    const [a, b, c] = proven();
    expect(a).toHaveTextContent(/^@dij\.arc · 21K views$/);
    expect(a!.querySelector("img")).not.toBeNull();
    expect(b).toHaveTextContent(/^@creator_one · 854K views$/);
    expect(b!.querySelector("img")).toBeNull();
    expect(c).toHaveTextContent(/^@creator_two$/);
    expect(c!.querySelector("img")).toHaveAttribute("src", "/covers/c9.jpg");
  });

  it("p10: today's script, its beats named, no 'How to film it'", () => {
    render(<DevAnswers state="p10" skin="light" frames={null} />);
    expect(names()).toEqual(["Hook", "Setup", "Turn", "Payoff", "Call to action"]);
    expect(screen.queryByRole("button", { name: "How to film it" })).toBeNull();
  });

  it("p10c: cues and a plan; pressing 'How to film it' opens the sheet, Escape closes it", async () => {
    render(<DevAnswers state="p10c" skin="light" frames={null} />);
    expect(names()).toHaveLength(5);
    const button = screen.getByRole("button", { name: "How to film it" });
    fireEvent.click(button);
    const dialog = await screen.findByRole("dialog", { name: "How to film it" });
    expect([...dialog.querySelectorAll('[data-sheet="film-beat"] h3')].map((h) => h.textContent)).toEqual(["Hook", "Turn", "Call to action"]);
    expect([...dialog.querySelectorAll('[data-sheet="film-plan"] h3')].map((h) => h.textContent)).toEqual(["Shots", "Text on screen", "Setup", "Edit"]);
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(button);
  });

  it("p10p: a plan with no edit and no cues: the plan's three rows alone", async () => {
    render(<DevAnswers state="p10p" skin="light" frames={null} />);
    fireEvent.click(screen.getByRole("button", { name: "How to film it" }));
    const dialog = await screen.findByRole("dialog", { name: "How to film it" });
    expect(dialog.querySelectorAll('[data-sheet="film-beat"]')).toHaveLength(0);
    expect([...dialog.querySelectorAll('[data-sheet="film-plan"] h3')].map((h) => h.textContent)).toEqual(["Shots", "Text on screen", "Setup"]);
  });
});

// The wait, the outline and the landing (thread feel §4.2, §4.3), for looking at: nothing is sent.
describe("/dev/answers: the wait", () => {
  const outline = (kind?: string) => document.querySelector(kind ? `[data-outline="${kind}"]` : "[data-outline]");
  const cards = () => document.querySelectorAll('[data-answer="card"]');
  const TOPICAL = "Reading 3 real videos matched to this subject";

  it("w1: the line \"Thinking\" alone, no card", () => {
    render(<DevAnswers state="w1" skin="light" frames={null} />);
    expect(screen.getByRole("heading", { name: "Maven" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/^Thinking$/);
    expect(outline()).toBeNull();
    expect(cards()).toHaveLength(0);
  });

  it("w2: the hooks outline, its line and the usual length, no evidence", () => {
    render(<DevAnswers state="w2" skin="light" frames={null} />);
    expect(screen.getByText("3 hooks for a video about meal prep for busy students")).toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Writing hooks");
    expect(status).toHaveTextContent("about 20 s");
    expect(outline("pack")!.querySelectorAll('[data-part="ghost-row"]')).toHaveLength(3);
    expect(document.querySelector('[data-part="evidence"]')).toBeNull();
  });

  it("w3: the hooks outline with what the run reads: three covers without pictures and the topical headline", () => {
    render(<DevAnswers state="w3" skin="light" frames={null} />);
    expect(screen.getByRole("status")).toHaveTextContent("Looking for videos on this topic");
    const ghost = outline("pack")!;
    expect(within(ghost as HTMLElement).getByText(TOPICAL)).toBeInTheDocument();
    expect(ghost.querySelectorAll('[data-part="evidence-cover"]')).toHaveLength(3);
    expect(ghost.querySelectorAll('[data-part="evidence-cover"] img')).toHaveLength(0);
  });

  it("w4: the script's outline", () => {
    render(<DevAnswers state="w4" skin="light" frames={null} />);
    expect(screen.getByRole("status")).toHaveTextContent("Writing your script");
    expect(screen.getByRole("status")).toHaveTextContent("about 30 s");
    expect(outline("script")!.querySelectorAll('[data-part="ghost-beat"]')).toHaveLength(5);
  });

  it("w5: the remix's outline with its post in the source row", () => {
    render(<DevAnswers state="w5" skin="light" frames={null} />);
    expect(screen.getByRole("status")).toHaveTextContent("Working out why it worked");
    const ghost = outline("remix")!;
    expect(within(ghost as HTMLElement).getByText("@creator_one")).toBeInTheDocument();
    expect(within(ghost as HTMLElement).getByText("154K views")).toBeInTheDocument();
    expect(ghost.querySelector('[data-part="ghost-source"]')).toBeNull();
  });

  it("w6: explore waits on the line alone", () => {
    render(<DevAnswers state="w6" skin="light" frames={null} />);
    expect(screen.getByRole("status")).toHaveTextContent(/^Scanning for outliers$/);
    expect(outline()).toBeNull();
    expect(cards()).toHaveLength(0);
  });

  it("wl: starts as w3, then the p3 pack lands in its place, rows one after another; nothing is sent", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.useFakeTimers();
    try {
      render(<DevAnswers state="wl" skin="light" frames={null} />);
      expect(outline("pack")).not.toBeNull();
      expect(screen.getByText(TOPICAL)).toBeInTheDocument();
      expect(document.querySelector("[data-thread-landing]")).toBeNull();
      act(() => {
        vi.advanceTimersByTime(2_499);
      });
      expect(outline("pack")).not.toBeNull();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(outline()).toBeNull();
      const group = document.querySelector<HTMLElement>("[data-thread-landing]")!;
      expect(group).not.toBeNull();
      expect(group.style.getPropertyValue("--landed")).toBe("0ms");
      expect(screen.getByText("3 hooks")).toBeInTheDocument();
      const rows = [...group.querySelectorAll<HTMLElement>("li")];
      expect(rows.map((r) => r.style.getPropertyValue("--i"))).toEqual(["0", "1", "2"]);
      expect(screen.getByRole("button", { name: /Simulate all 3/ }).closest<HTMLElement>(".land")!.style.getPropertyValue("--i")).toBe("3");
      expect(screen.getByTestId("followup-row").closest<HTMLElement>(".land")!.style.getPropertyValue("--i")).toBe("6");
      fireEvent.click(screen.getByRole("button", { name: /Simulate all 3/ }));
      fireEvent.click(screen.getByRole("button", { name: "Follow up: More hooks" }));
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});
