/** @vitest-environment happy-dom */

/**
 * ThreadField — the new-look message field, rendered for real.
 *
 * Stand-ins are browser APIs only: the OS file picker (the hidden input's `click`), object URLs
 * and the video element's media events (happy-dom never decodes media), as in
 * `src/hooks/__tests__/use-video-meta.test.ts`. The callbacks are the component's props: they
 * are what the composer passes, so they are spies here.
 */

import { createRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { BILLABLE_BY_TOOL, type ToolId } from "@/components/app/home/composer-controls";
import { creditCost } from "@/lib/pricing";
import { VIDEO_ACCEPT } from "@/lib/video-file";
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
    placeholder: "Message Maven",
    ariaLabel: "Ask anything about your content",
    sendLabel: "Send message",
    onOpenMore: vi.fn(),
    moreOpen: false,
    ...over,
  };
}

const clip = (name = "take.mp4", type = "video/mp4") => new File(["x"], name, { type });
const text = () => screen.getByRole("textbox");
const button = (name: string | RegExp) => screen.getByRole("button", { name });

// Object URLs and the video element: what useVideoMeta needs from a browser.
let videos: HTMLVideoElement[];
beforeEach(() => {
  videos = [];
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:test/1");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(((tag: string, opts?: ElementCreationOptions) => {
    const el = realCreate(tag, opts);
    if (tag === "video") videos.push(el as HTMLVideoElement);
    return el;
  }) as typeof document.createElement);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ThreadField: the four pills", () => {
  it.each([
    ["Simulate", "test"],
    ["Hooks", "hooks"],
    ["Script", "script"],
    ["Remix", "remix"],
  ] as const)("the %s pill selects %s", (label, id) => {
    const p = props();
    render(<ThreadField {...p} />);
    fireEvent.click(button(label));
    expect(p.onSelectTool).toHaveBeenCalledTimes(1);
    expect(p.onSelectTool).toHaveBeenCalledWith(id);
  });

  it("the Simulate pill selects the video test, never the General `simulate` verb", () => {
    const p = props();
    render(<ThreadField {...p} />);
    fireEvent.click(button("Simulate"));
    expect(p.onSelectTool).not.toHaveBeenCalledWith("simulate");
  });

  it("a second tap on the selected pill goes back to chat", () => {
    const p = props({ tool: "hooks" });
    render(<ThreadField {...p} />);
    fireEvent.click(button("Hooks"));
    expect(p.onSelectTool).toHaveBeenCalledWith("chat");
  });

  it("the price shows on the selected pill only, which is filled", () => {
    render(<ThreadField {...props({ tool: "test" })} />);
    expect(button("Simulate")).toHaveAttribute("aria-pressed", "true");
    for (const name of ["Hooks", "Script", "Remix"]) {
      expect(button(name)).toHaveAttribute("aria-pressed", "false");
    }
    expect(screen.getAllByText(/·/)).toHaveLength(1);
  });

  it("a pill keeps its name when pressed; its price is its description", () => {
    const { rerender } = render(<ThreadField {...props({ tool: "chat" })} />);
    expect(button("Hooks")).not.toHaveAccessibleDescription();
    rerender(<ThreadField {...props({ tool: "hooks" })} />);
    expect(button("Hooks")).toHaveAccessibleDescription("1 credit");
    rerender(<ThreadField {...props({ tool: "test" })} />);
    expect(button("Simulate")).toHaveAccessibleDescription("10 credits");
    expect(button("Hooks")).not.toHaveAccessibleDescription();
  });

  it("a pill tap returns focus to the text", () => {
    render(<ThreadField {...props()} />);
    fireEvent.click(button("Script"));
    expect(document.activeElement).toBe(text());
  });

  it("Simulate with no video keeps focus on its pill (the next step is +), with a video the text gets it", () => {
    const { unmount } = render(<ThreadField {...props()} />);
    fireEvent.click(button("Simulate"));
    expect(document.activeElement).toBe(button("Simulate"));
    unmount();
    render(<ThreadField {...props({ video: clip() })} />);
    fireEvent.click(button("Simulate"));
    expect(document.activeElement).toBe(text());
  });
});

describe("ThreadField: More", () => {
  it("opens More, and says it opens a dialog", () => {
    const p = props();
    render(<ThreadField {...p} />);
    expect(button("More")).toHaveAttribute("aria-haspopup", "dialog");
    fireEvent.click(button("More"));
    expect(p.onOpenMore).toHaveBeenCalledTimes(1);
  });

  it("a skill picked in More is, while selected, exactly a pill: named for it, pressed, priced; a tap goes back to chat", () => {
    const p = props({ tool: "idea", moreArmed: { label: "Ideas", price: 1 } });
    render(<ThreadField {...p} />);
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
    const armed = button("Ideas");
    expect(armed).toHaveAttribute("aria-pressed", "true");
    expect(armed).not.toHaveAttribute("aria-haspopup");
    expect(armed).not.toHaveAttribute("aria-expanded");
    expect(armed).toHaveAccessibleDescription("1 credit");
    fireEvent.click(armed);
    expect(p.onSelectTool).toHaveBeenCalledWith("chat");
    expect(p.onOpenMore).not.toHaveBeenCalled();
  });

  it("not armed, More is a popup button: named More, not pressed", () => {
    render(<ThreadField {...props()} />);
    const more = button("More");
    expect(more).toHaveAttribute("aria-haspopup", "dialog");
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(more).not.toHaveAttribute("aria-pressed");
    expect(more).not.toHaveAccessibleDescription();
  });

  it("says whether More is open, and a tap while it is open does not open it again", () => {
    const p = props({ moreOpen: false });
    const { rerender } = render(<ThreadField {...p} />);
    expect(button("More")).toHaveAttribute("aria-expanded", "false");
    rerender(<ThreadField {...p} moreOpen />);
    expect(button("More")).toHaveAttribute("aria-expanded", "true");
    // The tap's pointerdown is outside the open layer, which closes it; the click must not reopen.
    fireEvent.pointerDown(button("More"));
    fireEvent.click(button("More"), { detail: 1 }); // a pointer click
    expect(p.onOpenMore).not.toHaveBeenCalled();
    rerender(<ThreadField {...p} moreOpen={false} />);
    fireEvent.pointerDown(button("More"));
    fireEvent.click(button("More"), { detail: 1 }); // a pointer click
    expect(p.onOpenMore).toHaveBeenCalledTimes(1);
  });
});

describe("ThreadField: +", () => {
  function picker() {
    const input = screen.getByLabelText("Choose a video file") as HTMLInputElement;
    const click = vi.spyOn(input, "click").mockImplementation(() => {}); // the OS picker
    return { input, click };
  }

  it("opens the picker for videos, and a valid file goes to onVideoChange", () => {
    const p = props();
    render(<ThreadField {...p} />);
    const { input, click } = picker();
    expect(input.type).toBe("file");
    expect(input.accept).toBe(VIDEO_ACCEPT);
    fireEvent.click(button("Add a video"));
    expect(click).toHaveBeenCalledTimes(1);
    const f = clip();
    fireEvent.change(input, { target: { files: [f] } });
    expect(p.onVideoChange).toHaveBeenCalledWith(f);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("refuses a file that is not a video, says why, and passes nothing on", () => {
    const p = props();
    render(<ThreadField {...p} />);
    const { input } = picker();
    fireEvent.change(input, { target: { files: [new File(["x"], "notes.txt", { type: "text/plain" })] } });
    expect(p.onVideoChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Please select a video file (MP4, MOV, WebM)");
  });
});

describe("ThreadField: a refused file's message does not stick", () => {
  function refused(over: Partial<ThreadFieldProps> = {}) {
    const p = props(over);
    const view = render(<ThreadField {...p} />);
    const big = clip("long-take.mp4");
    Object.defineProperty(big, "size", { value: 300 * 1024 * 1024 });
    fireEvent.drop(screen.getByTestId("thread-field"), { dataTransfer: { files: [big], types: ["Files"] } });
    expect(screen.getByRole("alert")).toHaveTextContent(/File too large/);
    return { p, ...view };
  }

  it("clears on a pill tap", () => {
    refused();
    fireEvent.click(button("Hooks"));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears when the text changes", () => {
    refused();
    fireEvent.change(text(), { target: { value: "meal prep" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears on a More pick, and stays gone when the field is back on chat", () => {
    const { p, rerender } = refused();
    rerender(<ThreadField {...p} tool="idea" moreArmed={{ label: "Ideas", price: 1 }} />);
    expect(screen.queryByRole("alert")).toBeNull();
    rerender(<ThreadField {...p} tool="chat" moreArmed={null} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears on submit, and the composer's submit still gets the event", () => {
    const { p } = refused({ canSend: true, value: "hi" });
    fireEvent.click(button("Send message"));
    expect(p.onSubmit).toHaveBeenCalledTimes(1);
    expect((p.onSubmit as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toHaveProperty("type", "submit");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("ThreadField: the video tile", () => {
  it("shows the video's length, and Remove video clears it and returns focus to the text", () => {
    const p = props({ tool: "test", video: clip() });
    render(<ThreadField {...p} />);
    const video = videos[0]!;
    Object.defineProperty(video, "duration", { value: 29.4, configurable: true });
    act(() => {
      video.onloadeddata?.(new Event("loadeddata"));
    });
    expect(screen.getByText("0:29")).toBeInTheDocument();
    fireEvent.click(button("Remove video"));
    expect(p.onVideoChange).toHaveBeenCalledWith(null);
    expect(document.activeElement).toBe(text());
  });

  // Task 4, fix round 2: a webm recorded in the browser reports no length (Infinity) until played.
  it("a video with no finite length shows no length (never \"Infinity:NaN\")", () => {
    render(<ThreadField {...props({ tool: "test", video: clip() })} />);
    const video = videos[0]!;
    Object.defineProperty(video, "duration", { value: Infinity, configurable: true });
    act(() => {
      video.onloadeddata?.(new Event("loadeddata"));
    });
    const tile = screen.getByTestId("field-video");
    expect(tile.textContent).not.toMatch(/\d|Infinity|NaN/);
    expect(button("Remove video")).toBeInTheDocument();
  });

  it("is not there without a video", () => {
    render(<ThreadField {...props({ tool: "test" })} />);
    expect(screen.queryByRole("button", { name: "Remove video" })).toBeNull();
  });
});

describe("ThreadField: drop", () => {
  const drop = (file: File) =>
    fireEvent.drop(screen.getByTestId("thread-field"), { dataTransfer: { files: [file], types: ["Files"] } });

  it("a dropped video becomes the video", () => {
    const p = props();
    render(<ThreadField {...p} />);
    const f = clip("take.mov", "video/quicktime");
    drop(f);
    expect(p.onVideoChange).toHaveBeenCalledWith(f);
    expect(p.onDropFile).not.toHaveBeenCalled();
  });

  it("any other dropped file goes to onDropFile", () => {
    const p = props();
    render(<ThreadField {...p} />);
    const f = new File(["hello"], "chat.txt", { type: "text/plain" });
    drop(f);
    expect(p.onDropFile).toHaveBeenCalledWith(f);
    expect(p.onVideoChange).not.toHaveBeenCalled();
  });

  // One attachment at a time (Task 3, fix round 1): a drop that holds a video stages the video
  // only; the other files are not handed on.
  it("several files with a video: the first video becomes the video, nothing else is staged", () => {
    const p = props();
    render(<ThreadField {...p} />);
    const notes = new File(["a"], "notes.txt", { type: "text/plain" });
    const shot = new File(["b"], "shot.png", { type: "image/png" });
    const take = clip("take.mp4");
    const second = clip("second.mov", "video/quicktime");
    fireEvent.drop(screen.getByTestId("thread-field"), {
      dataTransfer: { files: [notes, take, shot, second], types: ["Files"] },
    });
    expect(p.onVideoChange).toHaveBeenCalledTimes(1);
    expect(p.onVideoChange).toHaveBeenCalledWith(take);
    expect(p.onDropFile).not.toHaveBeenCalled();
  });

  it("several files without a video: the first goes on, the rest are ignored", () => {
    const p = props();
    render(<ThreadField {...p} />);
    const notes = new File(["a"], "notes.txt", { type: "text/plain" });
    const shot = new File(["b"], "shot.png", { type: "image/png" });
    fireEvent.drop(screen.getByTestId("thread-field"), {
      dataTransfer: { files: [notes, shot], types: ["Files"] },
    });
    expect(p.onDropFile).toHaveBeenCalledTimes(1);
    expect(p.onDropFile).toHaveBeenCalledWith(notes);
    expect(p.onVideoChange).not.toHaveBeenCalled();
  });

  it("stays highlighted while a drag moves over its children (Safari sends no relatedTarget)", () => {
    render(<ThreadField {...props()} />);
    const form = screen.getByTestId("thread-field");
    const files = { dataTransfer: { files: [], types: ["Files"] } };
    fireEvent.dragEnter(form, files);
    expect(form).toHaveAttribute("data-dragging", "true");
    fireEvent.dragEnter(text(), files);
    fireEvent.dragLeave(form, { ...files, relatedTarget: null });
    expect(form).toHaveAttribute("data-dragging", "true");
    fireEvent.dragLeave(text(), { ...files, relatedTarget: null });
    expect(form).not.toHaveAttribute("data-dragging");
  });
});

describe("ThreadField: send and Stop", () => {
  it("send is a submit, named by sendLabel, disabled while canSend is false", () => {
    render(<ThreadField {...props({ canSend: false })} />);
    const send = button("Send message");
    expect(send).toHaveAttribute("type", "submit");
    expect(send).toBeDisabled();
  });

  it("send is disabled offline, and while busy it is disabled and shows a spinner", () => {
    const { rerender } = render(<ThreadField {...props({ canSend: true, online: false })} />);
    expect(button("Send message")).toBeDisabled();
    rerender(<ThreadField {...props({ canSend: true, busy: true })} />);
    const send = button("Send message");
    expect(send).toBeDisabled();
    expect(send).toHaveAttribute("aria-busy", "true");
    // Button draws its spinner hidden from the accessibility tree (aria-busy says it instead).
    expect(send.querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it("send submits the form when it can", () => {
    const p = props({ canSend: true, value: "meal prep" });
    render(<ThreadField {...p} />);
    fireEvent.click(button("Send message"));
    expect(p.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("while a run streams the button is Stop: not a submit, even when Stop flips it back", () => {
    const onSubmit = vi.fn((e: React.FormEvent<HTMLFormElement>) => e.preventDefault());
    const onStop = vi.fn();
    // The composer's Stop ends the stream at once, so in a browser the same button is a submit
    // again before the click's default action runs (composer-stop-disc.test.tsx: the second
    // billed run). happy-dom cannot stage that timing, so, as that test does, this asserts the
    // click's default action is cancelled.
    function Composer() {
      const [streaming, setStreaming] = useState(true);
      return (
        <ThreadField
          {...props({
            canSend: true,
            value: "more hooks",
            streaming,
            onSubmit,
            onStop: (e) => {
              onStop(e);
              setStreaming(false);
            },
          })}
        />
      );
    }
    render(<Composer />);
    const stop = button("Stop the run");
    expect(stop).toHaveAttribute("type", "button");
    expect(stop).toBeEnabled();
    const notCancelled = fireEvent.click(stop);
    expect(notCancelled).toBe(false); // defaultPrevented: the click can never submit
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(button("Send message")).toHaveAttribute("type", "submit");
  });
});

describe("ThreadField: the text", () => {
  it("is the value, named by ariaLabel, with the placeholder; typing and keys go to the composer", () => {
    const p = props({ value: "meal prep", placeholder: "A topic for your hooks", ariaLabel: "Hook topic (leave empty for Auto)" });
    render(<ThreadField {...p} />);
    const field = screen.getByRole("textbox", { name: "Hook topic (leave empty for Auto)" });
    expect(field).toHaveValue("meal prep");
    expect(field).toHaveAttribute("placeholder", "A topic for your hooks");
    fireEvent.change(field, { target: { value: "meal prep for students" } });
    expect(p.onChange).toHaveBeenCalledWith("meal prep for students");
    fireEvent.keyDown(field, { key: "Enter" });
    expect(p.onKeyDown).toHaveBeenCalledTimes(1);
  });

  it("`invalid` marks the text invalid, and the errors describe it", () => {
    const { rerender } = render(<ThreadField {...props()} />);
    expect(text()).not.toHaveAttribute("aria-invalid");
    expect(text()).not.toHaveAccessibleDescription();
    rerender(<ThreadField {...props({ invalid: true, errors: ["That is not a TikTok link."] })} />);
    expect(text()).toHaveAttribute("aria-invalid", "true");
    expect(text()).toHaveAccessibleDescription("That is not a TikTok link.");
  });
});

describe("ThreadField: the hook brief", () => {
  it("shows only while Simulate is selected, and can be dismissed", () => {
    const onDismissBrief = vi.fn();
    const brief = { hookLine: "This is $5 of food. It fed me for three days." };
    const { rerender } = render(<ThreadField {...props({ tool: "test", video: clip(), brief, onDismissBrief })} />);
    expect(screen.getByText(/It fed me for three days/)).toBeInTheDocument();
    fireEvent.click(button("Dismiss hook brief"));
    expect(onDismissBrief).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(text());
    rerender(<ThreadField {...props({ tool: "hooks", brief, onDismissBrief })} />);
    expect(screen.queryByText(/It fed me for three days/)).toBeNull();
  });

  it("dismissed with Simulate selected and no video, focus goes to the Simulate pill (the next step is +)", () => {
    render(<ThreadField {...props({ tool: "test", brief: { hookLine: "This is $5 of food." }, onDismissBrief: vi.fn() })} />);
    fireEvent.click(button("Dismiss hook brief"));
    expect(document.activeElement).toBe(button("Simulate"));
  });
});

describe("ThreadField: evidence, errors, slots", () => {
  it("shows the staged evidence as a chip that can be removed", () => {
    const p = props({ evidence: new File(["a"], "chat-export.txt", { type: "text/plain" }) });
    render(<ThreadField {...p} />);
    expect(screen.getByText("chat-export.txt")).toBeInTheDocument();
    fireEvent.click(button("Remove attachment"));
    expect(p.onRemoveEvidence).toHaveBeenCalledTimes(1);
  });

  it("shows each error under the field, nulls skipped", () => {
    render(<ThreadField {...props({ errors: [null, "Upload failed. Try again.", null, "Session expired."] })} />);
    expect(screen.getAllByRole("alert").map((a) => a.textContent)).toEqual(["Upload failed. Try again.", "Session expired."]);
  });

  it("forwards anchorRef to its outer element and renders the slash menu", () => {
    const anchorRef = createRef<HTMLDivElement>();
    render(<ThreadField {...props({ anchorRef, slashMenu: <div role="menu" aria-label="Skills" /> })} />);
    expect(anchorRef.current).toBeInstanceOf(HTMLDivElement);
    expect(anchorRef.current).toContainElement(screen.getByTestId("thread-field"));
    expect(screen.getByRole("menu", { name: "Skills" })).toBeInTheDocument();
  });
});

describe("ThreadField: names", () => {
  it("the text and every control have a name, with everything shown at once", async () => {
    const { container } = render(
      <ThreadField
        {...props({
          tool: "test",
          video: clip(),
          evidence: new File(["a"], "chat.txt", { type: "text/plain" }),
          brief: { hookLine: "This is $5 of food." },
          onDismissBrief: vi.fn(),
          errors: ["Upload failed. Try again."],
          sendLabel: "Simulate",
        })}
      />,
    );
    expect(screen.getByRole("textbox", { name: "Ask anything about your content" })).toBeInTheDocument();
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(10);
    // axe's button-name rule computes each name; this says which one, should one be missing.
    for (const b of buttons) expect((b.getAttribute("aria-label") ?? b.textContent ?? "").trim()).not.toBe("");
    const results = await axe(container);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(results).toHaveNoViolations();
  });
});
