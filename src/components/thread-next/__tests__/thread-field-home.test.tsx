/** @vitest-environment happy-dom */

/**
 * ThreadField on Home (spec 2026-11-25 §2.4): the thread's own field, same layout and same parts
 * (row 1: +, the text, send; row 2: Simulate, Hooks, Script, Remix, More). One difference: on Home
 * it is a solid card with the resting shadow, not glass. And one behaviour the thread has no use
 * for: on Home a skill is also picked outside the field (a card, "/", More), and focus then moves to
 * the next step. Rendered for real.
 *
 * Stand-ins are browser APIs only, as in `thread-field.test.tsx`: the OS file picker (the hidden
 * input's `click`), object URLs and the video element. The callbacks are the component's props:
 * they are what the composer passes, so they are spies here.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { BILLABLE_BY_TOOL, type ToolId } from "@/components/app/home/composer-controls";
import { creditCost } from "@/lib/pricing";
import { HOME_PLACEHOLDER, NEXT_PLACEHOLDER_BY_TOOL, NEXT_SIMULATE_PLACEHOLDER } from "../field-copy";
import { ThreadField, type ThreadFieldProps } from "../thread-field";

const priceOf = (tool: ToolId): number | null => {
  const action = BILLABLE_BY_TOOL[tool];
  return action ? creditCost(action) : null;
};

function props(over: Partial<ThreadFieldProps> = {}): ThreadFieldProps {
  return {
    value: "",
    onChange: vi.fn(),
    onKeyDown: vi.fn(),
    onSubmit: vi.fn((e: React.FormEvent<HTMLFormElement>) => e.preventDefault()),
    tool: "chat",
    onSelectTool: vi.fn(),
    priceOf,
    canSend: false,
    busy: false,
    online: true,
    streaming: false,
    onStop: vi.fn(),
    video: null,
    onVideoChange: vi.fn(),
    evidence: null,
    onRemoveEvidence: vi.fn(),
    onDropFile: vi.fn(),
    errors: [],
    placeholder: "Ask anything",
    ariaLabel: "Ask anything about your content",
    sendLabel: "Send message",
    onOpenMore: vi.fn(),
    moreOpen: false,
    home: true,
    ...over,
  };
}

function renderField(over: Partial<ThreadFieldProps> = {}) {
  const p = props(over);
  return { p, ...render(<ThreadField {...p} />) };
}

const clip = (name = "take.mp4", type = "video/mp4") => new File(["x"], name, { type });
const form = () => screen.getByTestId("thread-field");
const text = () => screen.getByRole("textbox") as HTMLTextAreaElement;
const button = (name: string | RegExp) => screen.getByRole("button", { name });
/** Every button's name, in document order. */
const names = () => within(form()).getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent ?? "");

beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:test/1");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ThreadField on Home: the thread's layout", () => {
  const PILLS = ["Simulate", "Hooks", "Script", "Remix", "More"];

  it("has the row of skill buttons and More", () => {
    renderField();
    for (const name of PILLS) expect(within(form()).getByRole("button", { name })).toBeInTheDocument();
  });

  it("the same controls in the same order as in a thread, at rest and with a skill picked and a video staged", () => {
    for (const over of [{}, { tool: "test" as const, video: clip() }]) {
      const { unmount } = renderField(over);
      const onHome = names();
      unmount();
      renderField({ ...over, home: false });
      expect(onHome).toEqual(names());
      cleanup();
    }
  });

  it("the text is one line at rest, as in a thread", () => {
    renderField();
    expect(text()).toHaveAttribute("rows", "1");
  });

  it("is the solid card with the resting shadow, not glass; the thread's is glass", () => {
    const { unmount } = renderField();
    expect(form().style.backdropFilter).toBe("");
    expect(form()).toHaveClass("bg-surface", "shadow-[var(--shadow-rest)]");
    expect(form()).not.toHaveClass("bg-glass");
    unmount();
    renderField({ home: false });
    expect(form().style.backdropFilter).not.toBe("");
    expect(form()).toHaveClass("bg-glass", "shadow-[var(--shadow-float)]");
  });

  it("the card keeps the thread's geometry: only the surface and the shadow differ", () => {
    const { unmount } = renderField();
    const onHome = form().className.split(/\s+/);
    unmount();
    renderField({ home: false });
    const inThread = form().className.split(/\s+/);
    const only = (a: string[], b: string[]) => a.filter((c) => !b.includes(c)).sort();
    expect(only(onHome, inThread)).toEqual(["bg-surface", "shadow-[var(--shadow-rest)]"]);
    expect(only(inThread, onHome)).toEqual(["bg-glass", "shadow-[var(--shadow-float)]"]);
  });

  it("there is no audience control in it, and no Add video pill", () => {
    renderField({ tool: "test" });
    expect(within(form()).queryByRole("button", { name: /audience/i })).toBeNull();
    expect(screen.queryByText("Add video")).toBeNull();
    expect(button("Add a video")).not.toHaveClass("bg-action");
  });
});

describe("ThreadField on Home: a picked skill is the selected button with its price", () => {
  it("Hooks picked: its button is pressed and reads Hooks · 1, its price the description", () => {
    renderField({ tool: "hooks" });
    const hooks = button("Hooks");
    expect(hooks).toHaveAttribute("aria-pressed", "true");
    expect(hooks).toHaveTextContent(/^Hooks · 1$/);
    expect(hooks).toHaveAccessibleDescription("1 credit");
    for (const name of ["Simulate", "Script", "Remix"]) expect(button(name)).toHaveAttribute("aria-pressed", "false");
  });

  it("Simulate picked: Simulate · 10", () => {
    renderField({ tool: "test" });
    expect(button("Simulate")).toHaveTextContent(/^Simulate · 10$/);
    expect(button("Simulate")).toHaveAccessibleDescription("10 credits");
  });

  it("a second tap lets it go", () => {
    const { p } = renderField({ tool: "hooks" });
    fireEvent.click(button("Hooks"));
    expect(p.onSelectTool).toHaveBeenCalledWith("chat");
  });

  it("More names an armed skill", () => {
    renderField({ tool: "idea", moreArmed: { label: "Ideas", price: 1 } });
    expect(button("Ideas")).toHaveTextContent(/^Ideas · 1$/);
    expect(button("Ideas")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
  });

  it("More opens More", () => {
    const { p } = renderField();
    fireEvent.click(button("More"));
    expect(p.onOpenMore).toHaveBeenCalledTimes(1);
  });

  it("nothing is drawn above the text for it", () => {
    renderField({ tool: "hooks" });
    expect(document.querySelector('[data-part="picked-skill"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove Hooks" })).toBeNull();
  });

  it("Backspace in an empty text is the thread's: passed on, the skill stays", () => {
    const { p } = renderField({ tool: "hooks" });
    fireEvent.keyDown(text(), { key: "Backspace" });
    expect(p.onKeyDown).toHaveBeenCalledTimes(1);
    expect(p.onSelectTool).not.toHaveBeenCalled();
  });
});

describe("ThreadField on Home: a skill picked outside the field moves focus to the next step", () => {
  it("a skill that takes words: the text", () => {
    const { p, rerender } = renderField();
    expect(document.activeElement).not.toBe(text());
    rerender(<ThreadField {...p} tool="hooks" />);
    expect(document.activeElement).toBe(text());
  });

  it("Simulate with no video: + (the text would open the phone's keyboard)", () => {
    const { p, rerender } = renderField();
    rerender(<ThreadField {...p} tool="test" />);
    expect(document.activeElement).toBe(button("Add a video"));
  });

  it("Simulate with a video already staged: the text", () => {
    const { p, rerender } = renderField({ video: clip() });
    rerender(<ThreadField {...p} tool="test" />);
    expect(document.activeElement).toBe(text());
  });

  it("a rerender that keeps the same skill does not take focus back", () => {
    const { p, rerender } = renderField({ tool: "hooks" });
    button("More").focus();
    rerender(<ThreadField {...p} value="m" tool="hooks" />);
    expect(document.activeElement).toBe(button("More"));
  });

  it("back to chat (a skill let go, a New chat): focus stays where it is", () => {
    const { p, rerender } = renderField({ tool: "hooks" });
    button("More").focus();
    rerender(<ThreadField {...p} tool="chat" />);
    expect(document.activeElement).toBe(button("More"));
  });

  it("a skill already picked when the field mounts (the launch address) takes no focus", () => {
    renderField({ tool: "test" });
    expect(document.activeElement).toBe(document.body);
  });

  it("a pill tap is the thread's rule: Simulate with no video keeps focus on its pill", () => {
    const { p, rerender } = renderField();
    fireEvent.click(button("Simulate"));
    expect(p.onSelectTool).toHaveBeenCalledWith("test");
    expect(document.activeElement).toBe(button("Simulate"));
    // The composer's answer to that tap: the same field, Simulate selected. Focus stays.
    rerender(<ThreadField {...p} tool="test" />);
    expect(document.activeElement).toBe(button("Simulate"));
  });

  it("a pill tap for a skill that takes words: the text, as in a thread", () => {
    const { p, rerender } = renderField();
    fireEvent.click(button("Script"));
    rerender(<ThreadField {...p} tool="script" />);
    expect(document.activeElement).toBe(text());
  });

  it("after a pill's own pick, a later pick from outside moves focus again", () => {
    const { p, rerender } = renderField();
    fireEvent.click(button("Simulate"));
    rerender(<ThreadField {...p} tool="test" />);
    button("More").focus();
    rerender(<ThreadField {...p} tool="hooks" />);
    expect(document.activeElement).toBe(text());
  });

  // Review minor 2: a pill tap the composer does not take up leaves nothing behind.
  it.each([
    ["Simulate", "test", "Add a video"],
    ["Hooks", "hooks", null],
  ] as const)("a %s tap the composer ignores, then the same skill picked outside: focus moves as for any outside pick", (name, tool, to) => {
    const { p, rerender } = renderField();
    fireEvent.click(button(name)); // the spy changes nothing: the field stays on chat
    button("More").focus();
    rerender(<ThreadField {...p} tool={tool} />);
    expect(document.activeElement).toBe(to ? button(to) : text());
  });

  it("in a thread a skill changed from outside moves nothing (the thread's field is unchanged)", () => {
    const { p, rerender } = renderField({ home: false });
    button("More").focus();
    rerender(<ThreadField {...p} tool="hooks" />);
    expect(document.activeElement).toBe(button("More"));
  });
});

describe("ThreadField on Home: what it shares with the thread's field", () => {
  it("+ opens the video picker", () => {
    renderField();
    const input = screen.getByLabelText("Choose a video file") as HTMLInputElement;
    const click = vi.spyOn(input, "click").mockImplementation(() => {}); // the OS picker
    fireEvent.click(button("Add a video"));
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("send is a submit named by sendLabel, and submits when it can", () => {
    const { p } = renderField({ canSend: true, value: "meal prep", sendLabel: "Generate hooks" });
    const send = button("Generate hooks");
    expect(send).toHaveAttribute("type", "submit");
    fireEvent.click(send);
    expect(p.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("a staged video shows its tile", () => {
    renderField({ tool: "test", video: clip() });
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    expect(button("Remove video")).toBeInTheDocument();
  });

  it("errors show under the field as alerts, in the thread's block", () => {
    renderField({ errors: [null, "Upload failed. Try again."] });
    expect(screen.getAllByRole("alert").map((a) => a.textContent)).toEqual(["Upload failed. Try again."]);
    expect(screen.getByRole("alert").parentElement).toHaveClass("px-2", "pt-2");
  });

  it("the hook brief, dismissed with no video, hands focus to the Simulate pill, as in a thread", () => {
    const onDismissBrief = vi.fn();
    renderField({ tool: "test", brief: { hookLine: "This is $5 of food." }, onDismissBrief });
    fireEvent.click(button("Dismiss hook brief"));
    expect(onDismissBrief).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(button("Simulate"));
  });
});

describe("ThreadField on Home: names", () => {
  it("every control has a name, with a skill picked and a video staged", () => {
    renderField({ tool: "test", video: clip() });
    for (const b of screen.getAllByRole("button")) {
      expect((b.getAttribute("aria-label") ?? b.textContent ?? "").trim()).not.toBe("");
    }
  });
});

describe("field copy for Home", () => {
  it("the placeholder with no skill picked, verbatim", () => {
    expect(HOME_PLACEHOLDER).toBe("Ask anything");
  });

  // With a skill picked Home shows the thread's own words for it (the composer's choice, pinned in
  // `composer-home.flag-on.test.tsx`); these are those words, verbatim.
  it.each([
    ["hooks", "A topic for your hooks"],
    ["script", "What the script is about"],
    ["remix", "Paste a TikTok link"],
    ["idea", "A topic for ideas"],
    ["explore", "A niche to explore"],
    ["account", "Read your account"],
  ] as const)("a skill picked (%s): %s", (tool, words) => {
    expect(NEXT_PLACEHOLDER_BY_TOOL[tool]).toBe(words);
  });

  it("Simulate picked: its own pair", () => {
    expect(NEXT_SIMULATE_PLACEHOLDER).toEqual({ empty: "Add a video or paste a link", video: "Send to simulate this video" });
  });
});
