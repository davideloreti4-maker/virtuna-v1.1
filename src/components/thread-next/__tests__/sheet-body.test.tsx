/** @vitest-environment happy-dom */
/**
 * The sheet's bodies (spec §3): a hook's and an idea's, from the drawing's fixtures, and the gauge row
 * in every state. Real parts throughout; nothing is stood in for.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { HookSheetBody, IdeaSheetBody, type SheetGauge } from "../sheet-body";
import { IDEA_SHEET, MEAL_PREP_HOOKS, hook, proof } from "./fixtures/answers";

afterEach(cleanup);

const HOOK = MEAL_PREP_HOOKS[0]!.props;
const gauge = (over: Partial<SheetGauge> = {}): SheetGauge => ({
  state: { kind: "empty" },
  failed: false,
  text: HOOK.hookLine,
  href: null,
  onSimulate: vi.fn(),
  ...over,
});
const actions = <span data-testid="actions" />;
const h3s = () => screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

describe("HookSheetBody", () => {
  it("proven, visual, why it works (trust, then use, then theory), then the one primary", () => {
    const onScript = vi.fn();
    render(<HookSheetBody hook={HOOK} gauge={gauge()} actions={actions} onScript={onScript} />);
    expect(h3s()).toEqual(["Proven", "Visual", "Why it works"]);
    expect(screen.getByText("It breaks the idea that meal prep means expensive wellness culture.")).toBeInTheDocument();
    expect(screen.getByText("Sad grey food next to textbooks")).toBeInTheDocument();
    const proofLink = screen.getByRole("link", { name: /^Proven: @dij\.arc, 50× their followers · 21K views/ });
    expect(proofLink).toHaveAttribute("href", "/clips/dij-arc");
    expect(proofLink).toHaveAttribute("target", "_blank");
    expect(proofLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByTestId("actions")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Script this one, 2 credits" }));
    expect(onScript).toHaveBeenCalledTimes(1);
  });

  it("shows none of the old card's extras", () => {
    const loud = hook("A hook with every extra on its card", {
      fraction: "7/10 stop",
      band: "Strong",
      scrollQuote: "too slow, scrolled",
      rank: 2,
      seedHook: "A different seed line",
      channel: "spoken",
    }).props;
    render(<HookSheetBody hook={loud} gauge={gauge({ text: loud.hookLine })} actions={actions} />);
    for (const gone of ["7/10 stop", "Strong", "too slow, scrolled", "A different seed line", "spoken", "#2"]) {
      expect(screen.queryByText(gone)).toBeNull();
    }
    expect(screen.queryByText(/Made for/)).toBeNull();
  });

  it("'More' opens the rest of why it works in place", () => {
    const long = hook("A hook", { mechanism: "It names a cost. Then it pays it back in the first second." }).props;
    render(<HookSheetBody hook={long} gauge={gauge({ text: "A hook" })} actions={actions} />);
    const more = screen.getByRole("button", { name: "More" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/Then it pays it back/)).toBeNull();
    fireEvent.click(more);
    expect(screen.getByText("It names a cost. Then it pays it back in the first second.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
  });

  it("a why-it-works that is one long sentence is folded at a whole word, and More opens all of it", () => {
    const long =
      "The contrarian prediction error contradicts the mundane expectation of 'meal prep' by introducing an absurd, high-production spectacle (a cooking robot), leveraging the cross-niche curiosity viewer's attraction to scale and weirdness before pivoting to the actual student context.";
    render(<HookSheetBody hook={{ ...HOOK, mechanism: long }} gauge={gauge()} actions={actions} />);
    const section = screen.getByRole("heading", { level: 3, name: "Why it works" }).parentElement!;
    expect(section).not.toHaveTextContent("student context");
    expect(section.textContent).toMatch(/…\s*More$/);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(section).toHaveTextContent("before pivoting to the actual student context.");
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
  });

  it("no visual and no proof: those sections are not drawn; one sentence has no More", () => {
    const bare = hook("A bare hook").props;
    render(<HookSheetBody hook={bare} gauge={gauge({ text: "A bare hook" })} actions={actions} />);
    expect(h3s()).toEqual(["Why it works"]);
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
  });

  it("a proof without a video: the row, no link and no mark", () => {
    const quiet = hook("A hook with a quiet proof", { proof: proof({ handle: "nia.tests", views: 1200 }) }).props;
    render(<HookSheetBody hook={quiet} gauge={gauge({ text: quiet.hookLine })} actions={actions} />);
    expect(screen.getByText("@nia.tests")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Proven:/ })).toBeNull();
  });
});

describe("the gauge row", () => {
  it("simulated, with its page: one link 'would stop to watch' to the result page", () => {
    render(<HookSheetBody hook={HOOK} gauge={gauge({ state: { kind: "done", value: 30 }, href: "/simulation/hook/t/k" })} actions={actions} />);
    const link = screen.getByRole("link", { name: /^Open the result: I spent \$40/ });
    expect(link).toHaveAttribute("href", "/simulation/hook/t/k");
    expect(link).toHaveTextContent("would stop to watch");
    expect(screen.getByRole("img", { name: "30% would stop to watch" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Simulate: / })).toBeNull();
  });

  it("simulated, its key not known yet: the words, no link", () => {
    render(<HookSheetBody hook={HOOK} gauge={gauge({ state: { kind: "done", value: 30 } })} actions={actions} />);
    expect(screen.getByText("would stop to watch")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Open the result/ })).toBeNull();
  });

  it("not simulated: Simulate · 1 credit fires the queue", () => {
    const onSimulate = vi.fn();
    render(<HookSheetBody hook={HOOK} gauge={gauge({ onSimulate })} actions={actions} />);
    const button = screen.getByRole("button", { name: /^Simulate: I spent \$40/ });
    expect(button).toHaveTextContent("Simulate");
    expect(button).toHaveTextContent("1 credit");
    fireEvent.click(button);
    expect(onSimulate).toHaveBeenCalledTimes(1);
  });

  it("failed: Couldn't simulate, and Simulate again", () => {
    render(<HookSheetBody hook={HOOK} gauge={gauge({ failed: true })} actions={actions} />);
    expect(screen.getByText("Couldn't simulate")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /^Simulate: / });
    expect(button).toBeEnabled();
    // Its name replaces its content, so the failure is read as its description, beside the price.
    expect(button).toHaveAccessibleDescription(/1 credit/);
    expect(button).toHaveAccessibleDescription(/Couldn't simulate/);
  });

  it.each([{ kind: "running" }, { kind: "waiting" }] as const)("%o: Simulating, no control, no link", (state) => {
    render(<HookSheetBody hook={HOOK} gauge={gauge({ state })} actions={actions} />);
    expect(screen.getByText("Simulating")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Simulate: / })).toBeNull();
    expect(screen.queryByRole("link", { name: /^Open the result/ })).toBeNull();
  });

  it("without a queue the Simulate button is there and disabled", () => {
    render(<HookSheetBody hook={HOOK} gauge={gauge({ onSimulate: undefined })} actions={actions} />);
    expect(screen.getByRole("button", { name: /^Simulate: / })).toBeDisabled();
  });
});

describe("IdeaSheetBody", () => {
  it("the take whole, why it fits folded, the format, then the primary", () => {
    const onScript = vi.fn();
    const idea = IDEA_SHEET.props;
    render(<IdeaSheetBody idea={idea} gauge={gauge({ text: idea.title })} actions={actions} onScript={onScript} />);
    expect(h3s()).toEqual(["The take", "Why it fits", "Format"]);
    expect(screen.getByText(idea.take)).toBeInTheDocument();
    expect(screen.getByText(/^Your audience saves study advice that admits a habit was wrong\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument();
    // "on-screen" is kept on one line (`keepHyphens`), so the text spans two nodes: read the section whole.
    expect(screen.getByRole("heading", { level: 3, name: "Format" }).closest("section")).toHaveTextContent(
      "Talking head with an on-screen timer",
    );
    fireEvent.click(screen.getByRole("button", { name: "Script this one, 2 credits" }));
    expect(onScript).toHaveBeenCalledTimes(1);
  });

  it("the runner's grounding line (\"Because: …\" and audience tags) is not a reason to read: no Why it fits", () => {
    const idea = { ...IDEA_SHEET.props, whyItFits: "Because: your tiktok audience — warm-leaning · connector · skeptic · scanner" };
    render(<IdeaSheetBody idea={idea} gauge={gauge({ text: idea.title })} actions={actions} />);
    expect(h3s()).toEqual(["The take", "Format"]);
    expect(screen.queryByText(/warm-leaning/)).toBeNull();
  });

  it("the runner's thin-profile line is not a reason either", () => {
    const idea = { ...IDEA_SHEET.props, whyItFits: "Based on TikTok baselines — add your profile for tailored ideas" };
    render(<IdeaSheetBody idea={idea} gauge={gauge({ text: idea.title })} actions={actions} />);
    expect(h3s()).toEqual(["The take", "Format"]);
    expect(screen.queryByText(/baselines/)).toBeNull();
  });

  it("no take, no format: those sections are not drawn", () => {
    const idea = { ...IDEA_SHEET.props, take: "", format: null };
    render(<IdeaSheetBody idea={idea} gauge={gauge({ text: idea.title })} actions={actions} />);
    expect(h3s()).toEqual(["Why it fits"]);
  });
});
