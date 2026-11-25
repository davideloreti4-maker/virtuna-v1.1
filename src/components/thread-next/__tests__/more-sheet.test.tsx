/** @vitest-environment happy-dom */

/**
 * MoreSheet — the other skills, the profile read and the audience, rendered for real (Radix
 * underneath). The one stand-in is `matchMedia`, which decides phone sheet or desktop popover.
 * The last block wires the sheet to the real ThreadField the way the composer will.
 */

import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import type { ToolId } from "@/components/app/home/composer-controls";
import { MORE_SKILLS, MoreSheet, type MoreSheetProps } from "../more-sheet";
import { ThreadField } from "../thread-field";

/** The viewport, as `matchMedia` reports it: desktop is 768 and wider. */
function viewport(wide: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: wide && /min-width:\s*768px/.test(query),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

const SKILLS: MoreSheetProps["skills"] = [
  { id: "idea", label: "Ideas", line: "A few video ideas for your audience", price: 1 },
  { id: "explore", label: "Explore", line: "Videos doing well in your niche", price: 1 },
  { id: "account", label: "Read my account", line: "What works on your account", price: 5 },
];

function props(over: Partial<MoreSheetProps> = {}): MoreSheetProps {
  return {
    open: true,
    onOpenChange: vi.fn(),
    skills: SKILLS,
    onSelectSkill: vi.fn(),
    onReadFile: vi.fn(),
    readFilePrice: 2,
    audienceLabel: "Your TikTok audience",
    onOpenAudience: vi.fn(),
    lens: "tiktok",
    onLensChange: vi.fn(),
    ...over,
  };
}

const dialog = () => screen.getByRole("dialog", { name: "More" });
const row = (name: RegExp) => within(dialog()).getByRole("button", { name });

beforeEach(() => viewport(false));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MoreSheet on the phone", () => {
  it("is a bottom sheet named More, with each skill's line and price", () => {
    render(<MoreSheet {...props()} />);
    expect(dialog()).toBeInTheDocument();
    expect(document.querySelector('[data-slot="sheet-handle"]')).not.toBeNull();
    expect(row(/^Ideas/)).toHaveTextContent("A few video ideas for your audience");
    expect(row(/^Ideas/)).toHaveTextContent("1 credit");
    expect(row(/^Explore/)).toHaveTextContent("1 credit");
    expect(row(/^Read my account/)).toHaveTextContent("5 credits");
    expect(row(/^Read a file/)).toHaveTextContent("Describes a person from a screenshot or notes");
    expect(row(/^Read a file/)).toHaveTextContent("2 credits");
  });

  it("is not there while closed", () => {
    render(<MoreSheet {...props({ open: false })} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("a skill without a price shows none", () => {
    render(<MoreSheet {...props({ skills: [{ id: "chat", label: "Chat", line: "Ask anything", price: null }] })} />);
    expect(row(/^Chat/)).not.toHaveTextContent(/credit/);
  });

  it.each([
    [/^Ideas/, "idea"],
    [/^Explore/, "explore"],
    [/^Read my account/, "account"],
  ] as const)("the %s row selects its skill and closes the sheet", (name, id) => {
    const p = props();
    render(<MoreSheet {...p} />);
    fireEvent.click(row(name));
    expect(p.onSelectSkill).toHaveBeenCalledWith(id);
    expect(p.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Read a file asks for the file inside the tap, before the sheet closes", () => {
    const calls: string[] = [];
    const p = props({
      onReadFile: vi.fn(() => calls.push("read")),
      onOpenChange: vi.fn((open: boolean) => calls.push(`open:${open}`)),
    });
    render(<MoreSheet {...p} />);
    fireEvent.click(row(/^Read a file/));
    expect(calls).toEqual(["read", "open:false"]);
    expect(p.onSelectSkill).not.toHaveBeenCalled();
  });

  it("the audience row names today's audience and opens its sheet", () => {
    const p = props();
    render(<MoreSheet {...p} />);
    fireEvent.click(row(/^Audience: Your TikTok audience/));
    expect(p.onOpenAudience).toHaveBeenCalledTimes(1);
    expect(p.onOpenChange).toHaveBeenCalledWith(false);
  });

  // Final review (6): the names a screen reader reads.
  it("Audience is a heading one level under the sheet's title", () => {
    render(<MoreSheet {...props()} />);
    expect(within(dialog()).getByRole("heading", { level: 2, name: "More" })).toBeInTheDocument();
    expect(within(dialog()).getByRole("heading", { level: 3, name: "Audience" })).toBeInTheDocument();
  });

  it('the audience row is named "Audience: <the audience>"', () => {
    render(<MoreSheet {...props({ audienceLabel: "General" })} />);
    expect(within(dialog()).getByRole("button", { name: "Audience: General" })).toBeInTheDocument();
  });

  it.each([
    ["Ideas", "A few video ideas for your audience 1 credit"],
    ["Explore", "Videos doing well in your niche 1 credit"],
    ["Read my account", "What works on your account 5 credits"],
    ["Read a file", "Describes a person from a screenshot or notes 2 credits"],
  ])("the %s row is named for the skill; its line and price are its description", (name, description) => {
    render(<MoreSheet {...props()} />);
    const button = within(dialog()).getByRole("button", { name });
    expect(button).toHaveAccessibleName(name);
    expect(button).toHaveAccessibleDescription(description);
  });

  it("a row without a price is described by its line alone", () => {
    render(<MoreSheet {...props({ skills: [{ id: "chat", label: "Chat", line: "Ask anything", price: null }] })} />);
    expect(within(dialog()).getByRole("button", { name: "Chat" })).toHaveAccessibleDescription("Ask anything");
  });

  it("the lens shows the current platform and changes it", () => {
    const p = props({ lens: "tiktok" });
    render(<MoreSheet {...p} />);
    const lens = within(dialog()).getByRole("group", { name: "Platform" });
    expect(within(lens).getByRole("button", { name: "TikTok" })).toHaveAttribute("aria-pressed", "true");
    expect(within(lens).getByRole("button", { name: "Instagram" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(within(lens).getByRole("button", { name: "Instagram" }));
    expect(p.onLensChange).toHaveBeenCalledWith("instagram");
    fireEvent.click(within(lens).getByRole("button", { name: "YouTube" }));
    expect(p.onLensChange).toHaveBeenCalledWith("youtube");
  });

  it("Escape closes it", () => {
    const p = props();
    render(<MoreSheet {...p} />);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(p.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Close closes it", () => {
    const p = props();
    render(<MoreSheet {...p} />);
    fireEvent.click(within(dialog()).getByRole("button", { name: "Close" }));
    expect(p.onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("MoreSheet on desktop", () => {
  function WithField(over: Partial<MoreSheetProps>) {
    const anchorRef = useRef<HTMLDivElement>(null);
    return (
      <>
        <div ref={anchorRef} data-testid="field-anchor" />
        <MoreSheet {...props(over)} anchorRef={anchorRef} />
      </>
    );
  }

  beforeEach(() => viewport(true));

  it("is a popover over the field, not a bottom sheet: no handle, no scrim", () => {
    render(<WithField />);
    expect(dialog()).toBeInTheDocument();
    expect(document.querySelector('[data-slot="sheet-handle"]')).toBeNull();
    expect(document.querySelector('[data-slot="sheet-overlay"]')).toBeNull();
    expect(dialog()).toHaveAttribute("data-side", "top");
    expect(row(/^Read my account/)).toHaveTextContent("5 credits");
  });

  it("on Home it opens below the field (`side`), where the field sits near the top of the page", () => {
    render(<WithField side="bottom" />);
    expect(dialog()).toHaveAttribute("data-side", "bottom");
  });

  it("Escape closes it", () => {
    const p = props();
    render(<WithField onOpenChange={p.onOpenChange} />);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(p.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("without a field to stand on it falls back to the bottom sheet", () => {
    render(<MoreSheet {...props()} />);
    expect(document.querySelector('[data-slot="sheet-handle"]')).not.toBeNull();
  });
});

describe("More with the field, wired as the composer wires it", () => {
  const PRICES: Partial<Record<ToolId, number>> = { idea: 1, explore: 1, account: 5, hooks: 1, test: 10, script: 2, remix: 10 };

  function Composer() {
    const anchorRef = useRef<HTMLDivElement>(null);
    const [tool, setTool] = useState<ToolId>("chat");
    const [open, setOpen] = useState(false);
    const picked = SKILLS.find((s) => s.id === tool);
    return (
      <>
        <ThreadField
          value=""
          onChange={() => {}}
          onKeyDown={() => {}}
          onSubmit={(e) => e.preventDefault()}
          tool={tool}
          onSelectTool={setTool}
          priceOf={(t) => PRICES[t] ?? null}
          canSend
          busy={false}
          online
          streaming={false}
          onStop={() => {}}
          video={null}
          onVideoChange={() => {}}
          evidence={null}
          onRemoveEvidence={() => {}}
          onDropFile={() => {}}
          errors={[]}
          placeholder="Message Maven"
          ariaLabel="Ask anything about your content"
          sendLabel="Send message"
          anchorRef={anchorRef}
          moreArmed={picked ? { label: picked.label, price: picked.price } : null}
          moreOpen={open}
          onOpenMore={() => setOpen(true)}
        />
        <MoreSheet {...props({ open, onOpenChange: setOpen, onSelectSkill: setTool })} anchorRef={anchorRef} />
      </>
    );
  }

  it.each([
    ["phone", false],
    ["desktop", true],
  ] as const)("on the %s: a pick shows on the More button and the text has focus again", async (_view, wide) => {
    viewport(wide);
    render(<Composer />);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(row(/^Explore/));
    // Radix hands focus back on a timer once the layer is gone.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    const armed = screen.getByRole("button", { name: "Explore" });
    expect(armed).toHaveAttribute("aria-pressed", "true");
    expect(armed).toHaveAccessibleDescription("1 credit");
    expect(document.activeElement).toBe(screen.getByRole("textbox"));
  });

  it.each([
    ["phone", false],
    ["desktop", true],
  ] as const)("on the %s: closed without a pick, focus goes back to More, not to the page", async (_view, wide) => {
    viewport(wide);
    render(<Composer />);
    const more = screen.getByRole("button", { name: "More" });
    more.focus();
    fireEvent.click(more);
    expect(dialog()).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "More" }));
  });

  /** Radix listens for an outside pointerdown from the next tick after it opens. */
  const settle = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

  it("on the desktop: a second tap on More closes it, and More says so", async () => {
    viewport(true);
    render(<Composer />);
    const more = () => screen.getByRole("button", { name: "More" });
    fireEvent.pointerDown(more());
    fireEvent.click(more(), { detail: 1 }); // a pointer click
    expect(dialog()).toBeInTheDocument();
    expect(more()).toHaveAttribute("aria-expanded", "true");
    await settle();
    fireEvent.pointerDown(more());
    fireEvent.click(more(), { detail: 1 }); // a pointer click
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(more()).toHaveAttribute("aria-expanded", "false");
  });

  // Final review (5): the audience row opens today's audience sheet, which takes focus itself
  // (the composer moves it there); More must not pull it back behind that sheet.
  it.each([
    ["phone", false],
    ["desktop", true],
  ] as const)("on the %s: after the audience row, focus is not handed back to More", async (_view, wide) => {
    viewport(wide);
    render(<Composer />);
    const more = screen.getByRole("button", { name: "More" });
    more.focus();
    fireEvent.click(more);
    fireEvent.click(within(dialog()).getByRole("button", { name: /^Audience: / }));
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).not.toBe(screen.getByRole("button", { name: "More" }));
  });

  it("on the desktop: a tap outside closes it without pulling focus to More", async () => {
    viewport(true);
    render(<Composer />);
    const more = screen.getByRole("button", { name: "More" });
    more.focus();
    fireEvent.click(more);
    expect(dialog()).toBeInTheDocument();
    await settle();
    fireEvent.pointerDown(document.body);
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).not.toBe(screen.getByRole("button", { name: "More" }));
  });
});

describe("MORE_SKILLS", () => {
  it("names the account read as an action, so it is not mistaken for the accounts on the You page", () => {
    expect(MORE_SKILLS.map((skill) => skill.label)).toEqual(["Ideas", "Explore", "Read my account"]);
  });
});
