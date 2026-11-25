/** @vitest-environment happy-dom */

/**
 * ThreadField's Home layout — the same field drawn as a card in the page: no pills and no More
 * (four cards under it are the skills), a two-line text, a bottom row of "+", the audience and
 * send, and a picked skill as a dark pill above the text. Rendered for real.
 *
 * Stand-ins are browser APIs only, as in `thread-field.test.tsx`: the OS file picker (the hidden
 * input's `click`), object URLs and the video element. The callbacks are the component's props:
 * they are what the composer passes, so they are spies here.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { BILLABLE_BY_TOOL, type ToolId } from "@/components/app/home/composer-controls";
import { creditCost } from "@/lib/pricing";
import { fieldSkillLabel, HOME_PLACEHOLDER_BY_TOOL } from "../field-copy";
import { ThreadField, type FieldHome, type ThreadFieldProps } from "../thread-field";

const priceOf = (tool: ToolId): number | null => {
  const action = BILLABLE_BY_TOOL[tool];
  return action ? creditCost(action) : null;
};

function home(over: Partial<FieldHome> = {}): FieldHome {
  return {
    audience: { label: "@nia.tests", open: false, onOpen: vi.fn() },
    picked: null,
    onClearPicked: vi.fn(),
    ...over,
  };
}

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
    placeholder: "Ask anything, or pick a skill",
    ariaLabel: "Ask anything about your content",
    sendLabel: "Send message",
    onOpenMore: vi.fn(),
    moreOpen: false,
    home: home(),
    ...over,
  };
}

function renderField(over: Partial<ThreadFieldProps> = {}) {
  const p = props(over);
  return { p, ...render(<ThreadField {...p} />) };
}

const clip = (name = "take.mp4", type = "video/mp4") => new File(["x"], name, { type });
const text = () => screen.getByRole("textbox") as HTMLTextAreaElement;
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const picked = () => document.querySelector('[data-part="picked-skill"]');

beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:test/1");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ThreadField on Home: the skills are not in the field", () => {
  const PILLS = ["Simulate", "Hooks", "Script", "Remix", "More"];

  it("with `home`, no pills and no More", () => {
    renderField();
    for (const name of PILLS) expect(screen.queryByRole("button", { name })).toBeNull();
  });

  it("without `home`, the pills and More are there (the thread's field is unchanged)", () => {
    renderField({ home: null });
    for (const name of PILLS) expect(button(name)).toBeInTheDocument();
    renderField({ home: undefined });
    expect(screen.getAllByRole("button", { name: "More" })).toHaveLength(2);
  });
});

describe("ThreadField on Home: the audience", () => {
  it("is a button named for the audience that opens a dialog, and says whether it is open", () => {
    const onOpen = vi.fn();
    const p = props({ home: home({ audience: { label: "@nia.tests", open: false, onOpen } }) });
    const { rerender } = render(<ThreadField {...p} />);
    const audience = button("Audience: @nia.tests");
    expect(audience).toHaveAttribute("aria-haspopup", "dialog");
    expect(audience).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(audience);
    expect(onOpen).toHaveBeenCalledTimes(1);
    rerender(<ThreadField {...p} home={home({ audience: { label: "@nia.tests", open: true, onOpen } })} />);
    expect(button("Audience: @nia.tests")).toHaveAttribute("aria-expanded", "true");
  });
});

describe("ThreadField on Home: the picked skill", () => {
  it("shows as a pill above the text with its price in words", () => {
    const { p, rerender } = renderField({ tool: "hooks", home: home({ picked: { label: "Hooks", price: 1 } }) });
    expect(picked()).toHaveTextContent(/^Hooks · 1 credit$/);
    rerender(<ThreadField {...p} tool="test" home={home({ picked: { label: "Simulate", price: 10 } })} />);
    expect(picked()).toHaveTextContent(/^Simulate · 10 credits$/);
    rerender(<ThreadField {...p} tool="chat" home={home({ picked: { label: "Chat", price: null } })} />);
    expect(picked()).toHaveTextContent(/^Chat$/);
  });

  it("is not there when nothing is picked", () => {
    renderField();
    expect(picked()).toBeNull();
  });

  it("its cross is named for the skill, clears it and puts focus in the text", () => {
    const onClearPicked = vi.fn();
    renderField({ tool: "hooks", home: home({ picked: { label: "Hooks", price: 1 }, onClearPicked }) });
    const cross = button("Remove Hooks");
    expect(picked()).toContainElement(cross);
    fireEvent.click(cross);
    expect(onClearPicked).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(text());
  });

  it("Backspace in an empty text clears the picked skill and is not passed on", () => {
    const onClearPicked = vi.fn();
    const { p } = renderField({ tool: "hooks", home: home({ picked: { label: "Hooks", price: 1 }, onClearPicked }) });
    const notCancelled = fireEvent.keyDown(text(), { key: "Backspace" });
    expect(onClearPicked).toHaveBeenCalledTimes(1);
    expect(p.onKeyDown).not.toHaveBeenCalled();
    expect(notCancelled).toBe(false);
  });

  it("Backspace with text typed is a normal key: passed on, the skill stays", () => {
    const onClearPicked = vi.fn();
    const { p } = renderField({ value: "a", tool: "hooks", home: home({ picked: { label: "Hooks", price: 1 }, onClearPicked }) });
    fireEvent.keyDown(text(), { key: "Backspace" });
    expect(p.onKeyDown).toHaveBeenCalledTimes(1);
    expect(onClearPicked).not.toHaveBeenCalled();
  });

  it("a held Backspace that ran out of text does not take the picked skill with it", () => {
    const onClearPicked = vi.fn();
    const { p } = renderField({ tool: "hooks", home: home({ picked: { label: "Hooks", price: 1 }, onClearPicked }) });
    fireEvent.keyDown(text(), { key: "Backspace", repeat: true });
    expect(onClearPicked).not.toHaveBeenCalled();
    expect(p.onKeyDown).toHaveBeenCalledTimes(1);
  });

  it("Backspace with no skill picked is passed on", () => {
    const { p } = renderField();
    fireEvent.keyDown(text(), { key: "Backspace" });
    expect(p.onKeyDown).toHaveBeenCalledTimes(1);
    expect(p.home!.onClearPicked).not.toHaveBeenCalled();
  });

  it("other keys in an empty text with a skill picked are passed on", () => {
    const onClearPicked = vi.fn();
    const { p } = renderField({ tool: "hooks", home: home({ picked: { label: "Hooks", price: 1 }, onClearPicked }) });
    fireEvent.keyDown(text(), { key: "Enter" });
    expect(p.onKeyDown).toHaveBeenCalledTimes(1);
    expect(onClearPicked).not.toHaveBeenCalled();
  });
});

describe("ThreadField on Home: picking a skill moves focus to the next step", () => {
  it("a skill that takes words: the text", () => {
    const { p, rerender } = renderField();
    expect(document.activeElement).not.toBe(text());
    rerender(<ThreadField {...p} tool="hooks" home={home({ picked: { label: "Hooks", price: 1 } })} />);
    expect(document.activeElement).toBe(text());
  });

  it("Simulate with no video: + (the text would open the phone's keyboard)", () => {
    const { p, rerender } = renderField();
    rerender(<ThreadField {...p} tool="test" home={home({ picked: { label: "Simulate", price: 10 } })} />);
    expect(document.activeElement).toBe(button("Add a video"));
  });

  it("Simulate with a video already staged: the text", () => {
    const { p, rerender } = renderField({ video: clip() });
    rerender(<ThreadField {...p} tool="test" home={home({ picked: { label: "Simulate", price: 10 } })} />);
    expect(document.activeElement).toBe(text());
  });

  it("a rerender that keeps the same skill does not take focus back", () => {
    const { p, rerender } = renderField({ tool: "hooks", home: home({ picked: { label: "Hooks", price: 1 } }) });
    button("Audience: @nia.tests").focus();
    rerender(<ThreadField {...p} value="m" tool="hooks" home={home({ picked: { label: "Hooks", price: 1 } })} />);
    expect(document.activeElement).toBe(button("Audience: @nia.tests"));
  });
});

describe("ThreadField on Home: the card", () => {
  it("the text is two lines at rest (the thread's is one)", () => {
    const { unmount } = renderField();
    expect(text()).toHaveAttribute("rows", "2");
    unmount();
    renderField({ home: null });
    expect(text()).toHaveAttribute("rows", "1");
  });

  it("is not glass (the thread's field is)", () => {
    const { unmount } = renderField();
    expect(screen.getByTestId("thread-field").style.backdropFilter).toBe("");
    unmount();
    renderField({ home: null });
    expect(screen.getByTestId("thread-field").style.backdropFilter).not.toBe("");
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

  it("errors show under the field as alerts", () => {
    renderField({ errors: [null, "Upload failed. Try again."] });
    expect(screen.getAllByRole("alert").map((a) => a.textContent)).toEqual(["Upload failed. Try again."]);
  });

  it("the hook brief, dismissed with no video, hands focus to + (there is no Simulate pill here)", () => {
    const onDismissBrief = vi.fn();
    renderField({ tool: "test", brief: { hookLine: "This is $5 of food." }, onDismissBrief });
    fireEvent.click(button("Dismiss hook brief"));
    expect(onDismissBrief).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(button("Add a video"));
  });
});

describe("ThreadField on Home: names", () => {
  it("every control has a name, with a skill picked and a video staged", () => {
    renderField({ tool: "test", video: clip(), home: home({ picked: { label: "Simulate", price: 10 } }) });
    for (const b of screen.getAllByRole("button")) {
      expect((b.getAttribute("aria-label") ?? b.textContent ?? "").trim()).not.toBe("");
    }
  });
});

// ── Final fix round (brief 2026-11-23) ───────────────────────────────────────
const simulatePicked = () => home({ picked: { label: "Simulate", price: 10 } });
const audiencePrefix = () => {
  const span = Array.from(button("Audience: @nia.tests").querySelectorAll("span")).find((s) => s.textContent === "Audience: ");
  if (!span) throw new Error("no prefix span");
  return span;
};

describe("ThreadField on Home: Simulate with no video says what to do (A2)", () => {
  it("+ is an ink pill reading Add video, same name, same picker, and focus lands on it after the pick", () => {
    const { p, rerender } = renderField();
    rerender(<ThreadField {...p} tool="test" home={simulatePicked()} />);
    const add = button("Add a video");
    expect(add).toHaveTextContent(/^Add video$/);
    expect(add).toHaveClass("bg-action", "text-action-foreground", "rounded-full", "h-9", "tap-44");
    expect(document.activeElement).toBe(add);
    const input = screen.getByLabelText("Choose a video file") as HTMLInputElement;
    const click = vi.spyOn(input, "click").mockImplementation(() => {});
    fireEvent.click(add);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("a staged video brings the round + back", () => {
    renderField({ tool: "test", video: clip(), home: simulatePicked() });
    expect(button("Add a video")).not.toHaveTextContent("Add video");
    expect(screen.queryByText("Add video")).toBeNull();
  });

  it("the pill turning back into the circle keeps a keyboard user's focus on it", () => {
    const { p, rerender } = renderField({ tool: "test", home: simulatePicked() });
    button("Add a video").focus();
    rerender(<ThreadField {...p} tool="test" video={clip()} home={simulatePicked()} />);
    expect(screen.queryByText("Add video")).toBeNull();
    expect(document.activeElement).toBe(button("Add a video"));
  });

  it.each([
    ["chat", null],
    ["hooks", { label: "Hooks", price: 1 }],
  ] as const)("another skill (%s) keeps the round +", (tool, pick) => {
    renderField({ tool, home: home({ picked: pick }) });
    expect(screen.queryByText("Add video")).toBeNull();
    expect(button("Add a video")).not.toHaveClass("bg-action");
  });

  it("the thread's field is untouched: Simulate with no video is the round + there", () => {
    renderField({ tool: "test", home: null });
    expect(screen.queryByText("Add video")).toBeNull();
  });
});

describe("ThreadField on Home: the audience control keeps the handle whole (A3)", () => {
  it("the prefix is its own span, hidden under 360 px; the name is unchanged", () => {
    renderField();
    expect(audiencePrefix()).toHaveClass("max-[359px]:hidden");
    expect(audiencePrefix()).not.toHaveClass("max-md:hidden");
    expect(button("Audience: @nia.tests")).toHaveAccessibleName("Audience: @nia.tests");
  });

  it("while the Add video pill shows it is hidden under 768 px too", () => {
    renderField({ tool: "test", home: simulatePicked() });
    expect(audiencePrefix()).toHaveClass("max-[359px]:hidden", "max-md:hidden");
    expect(button("Audience: @nia.tests")).toHaveAccessibleName("Audience: @nia.tests");
  });
});

describe("ThreadField on Home: the picked pill's cross answers the pointer (A10)", () => {
  it("has a hover and a pressed tint, from the pill's own ink", () => {
    renderField({ tool: "hooks", home: home({ picked: { label: "Hooks", price: 1 } }) });
    expect(button("Remove Hooks")).toHaveClass("hover:bg-action-foreground/15", "active:bg-action-foreground/25");
  });
});

describe("ThreadField on Home: the messages line up with the text (A5)", () => {
  const messages = () => screen.getByRole("alert").parentElement;
  it("on Home the block takes the text's left padding; the thread's is unchanged", () => {
    const { unmount } = renderField({ errors: ["That upload didn't go through."] });
    expect(messages()).toHaveClass("px-1");
    expect(messages()).not.toHaveClass("px-2");
    unmount();
    renderField({ home: null, errors: ["That upload didn't go through."] });
    expect(messages()).toHaveClass("px-2");
  });
});

describe("ThreadField on Home: a tap on the audience while its popover is open only closes it (B6)", () => {
  it("pointerdown then click with the popover open does not reopen it; a keyboard click does", () => {
    const onOpen = vi.fn();
    renderField({ home: home({ audience: { label: "@nia.tests", open: true, onOpen } }) });
    fireEvent.pointerDown(button("Audience: @nia.tests"));
    fireEvent.click(button("Audience: @nia.tests"), { detail: 1 }); // a pointer click
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(button("Audience: @nia.tests"), { detail: 0 }); // the keyboard
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("with the popover closed a pointer tap opens it", () => {
    const onOpen = vi.fn();
    renderField({ home: home({ audience: { label: "@nia.tests", open: false, onOpen } }) });
    fireEvent.pointerDown(button("Audience: @nia.tests"));
    fireEvent.click(button("Audience: @nia.tests"), { detail: 1 });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe("ThreadField on Home: send says what the picked skill costs (B6)", () => {
  it("while a skill is picked, send is described by the pill's text", () => {
    renderField({ tool: "hooks", canSend: true, value: "meal prep", sendLabel: "Generate hooks", home: home({ picked: { label: "Hooks", price: 1 } }) });
    expect(button("Generate hooks")).toHaveAccessibleDescription("Hooks · 1 credit");
  });

  it("with nothing picked send has no description", () => {
    renderField({ canSend: true, value: "hello" });
    expect(button("Send message")).not.toHaveAttribute("aria-describedby");
  });
});

describe("field copy for Home", () => {
  it("the placeholders, verbatim", () => {
    expect(HOME_PLACEHOLDER_BY_TOOL.chat).toBe("Ask anything, or pick a skill");
    expect(HOME_PLACEHOLDER_BY_TOOL.hooks).toBe("What's the video about?");
    expect(HOME_PLACEHOLDER_BY_TOOL.script).toBe("What's the video about?");
  });

  it("Ideas asks a question too (final fix A8)", () => {
    expect(HOME_PLACEHOLDER_BY_TOOL.idea).toBe("What do you want ideas about?");
  });

  it.each([
    ["test", "Simulate"],
    ["hooks", "Hooks"],
    ["script", "Script"],
    ["remix", "Remix"],
    ["account", "Account"],
    ["idea", "Ideas"],
    ["explore", "Explore"],
  ] as const)("a skill's name in the field: %s is %s", (tool, label) => {
    expect(fieldSkillLabel(tool)).toBe(label);
  });
});
