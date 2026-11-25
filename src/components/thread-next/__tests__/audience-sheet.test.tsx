/** @vitest-environment happy-dom */

/**
 * AudienceSheet — who the next run is for, and the platform, rendered for real (Radix underneath).
 * The one stand-in is `matchMedia`, which decides phone sheet or desktop popover.
 */

import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import type { Audience } from "@/lib/audience/audience-types";
import { AudienceSheet, type AudienceSheetProps } from "../audience-sheet";

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

const BASE: Audience = {
  id: "base",
  user_id: "u1",
  name: "Base",
  type: "target",
  mode: "socials",
  platform: "tiktok",
  goal_label: null,
  goal_intent: null,
  is_general: false,
  is_preset: false,
  source_account_id: null,
  persona_weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
  personas: [],
  profile: null,
  calibration: null,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
};
const aud = (over: Partial<Audience>): Audience => ({ ...BASE, ...over });

const NIA = aud({ id: "nia", name: "@nia", type: "personal", source_account_id: "x" });
const GYM = aud({ id: "gym", name: "Gym people" });
const GENERAL = aud({ id: "general", name: "General", is_general: true });
const GROWTH = aud({ id: "preset-growth", name: "Growth Audience", is_preset: true });

function props(over: Partial<AudienceSheetProps> = {}): AudienceSheetProps {
  return {
    open: true,
    onOpenChange: vi.fn(),
    audiences: [GENERAL, GROWTH, NIA, GYM],
    selectedId: "nia",
    onSelect: vi.fn(),
    onNewAudience: vi.fn(),
    lens: "tiktok",
    onLensChange: vi.fn(),
    ...over,
  };
}

const dialog = () => screen.getByRole("dialog", { name: "Audience" });
const button = (name: string) => within(dialog()).getByRole("button", { name });
/** Radix hands focus back on a timer once the layer is gone. */
const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });

beforeEach(() => viewport(false));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AudienceSheet on the phone", () => {
  it("is a bottom sheet named Audience: one row per audience, named for it, described by what it is modeled on", () => {
    render(<AudienceSheet {...props()} />);
    expect(dialog()).toBeInTheDocument();
    expect(document.querySelector('[data-slot="sheet-content"]')).not.toBeNull();
    expect(within(dialog()).getByRole("heading", { level: 2, name: "Audience" })).toBeInTheDocument();

    expect(button("@nia")).toHaveAccessibleDescription("TikTok");
    expect(button("Gym people")).toHaveAccessibleDescription("Described by you");
    expect(button("@nia")).toHaveAttribute("aria-pressed", "true");
    expect(button("Gym people")).toHaveAttribute("aria-pressed", "false");
    // The creator has their own and uses one of them: the shipped ones are not offered.
    expect(within(dialog()).queryByRole("button", { name: "General" })).toBeNull();
    expect(within(dialog()).queryByRole("button", { name: "Growth Audience" })).toBeNull();
  });

  it("is not there while closed", () => {
    render(<AudienceSheet {...props({ open: false })} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("a tap on a row hands that audience to the caller, and nothing else", () => {
    const p = props();
    render(<AudienceSheet {...p} />);
    fireEvent.click(button("Gym people"));
    expect(p.onSelect).toHaveBeenCalledTimes(1);
    expect(p.onSelect).toHaveBeenCalledWith(GYM);
    expect(p.onOpenChange).not.toHaveBeenCalled();
    expect(p.onNewAudience).not.toHaveBeenCalled();
  });

  it("New audience, the last row, opens the new-audience flow", () => {
    const p = props();
    render(<AudienceSheet {...p} />);
    const row = button("New audience");
    expect(row).toHaveAccessibleDescription("Connect an account or describe one");
    fireEvent.click(row);
    expect(p.onNewAudience).toHaveBeenCalledTimes(1);
    expect(p.onSelect).not.toHaveBeenCalled();
  });

  it("the platform control shows the lens and changes it", () => {
    const p = props({ lens: "instagram" });
    render(<AudienceSheet {...p} />);
    const group = within(dialog()).getByRole("group", { name: "Platform" });
    const lenses = within(group).getAllByRole("button");
    expect(lenses.map((b) => b.textContent)).toEqual(["TikTok", "Instagram", "YouTube"]);
    expect(within(group).getByRole("button", { name: "Instagram" })).toHaveAttribute("aria-pressed", "true");
    expect(within(group).getByRole("button", { name: "TikTok" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(within(group).getByRole("button", { name: "YouTube" }));
    expect(p.onLensChange).toHaveBeenCalledWith("youtube");
    // Final fix A6: every audience row above already names a platform (where it was modelled), so
    // the heading says what the control is for, not "Platform", which read as a filter.
    expect(within(dialog()).getByRole("heading", { level: 3, name: "Simulating for" })).toBeInTheDocument();
    expect(within(dialog()).queryByRole("heading", { name: "Platform" })).toBeNull();
  });

  it("shows the quiet note under the platform, and none without one", () => {
    const { unmount } = render(<AudienceSheet {...props({ note: "Simulating for TikTok" })} />);
    expect(within(dialog()).getByText("Simulating for TikTok")).toBeInTheDocument();
    unmount();
    render(<AudienceSheet {...props({ note: null })} />);
    expect(within(dialog()).queryByText("Simulating for TikTok")).toBeNull();
    expect(dialog().querySelector("p")).toBeNull();
  });

  it("Close closes it", () => {
    const p = props();
    render(<AudienceSheet {...p} />);
    fireEvent.click(button("Close"));
    expect(p.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Escape closes it", () => {
    const p = props();
    render(<AudienceSheet {...p} />);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(p.onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("AudienceSheet on desktop", () => {
  function WithField(over: Partial<AudienceSheetProps>) {
    const anchorRef = useRef<HTMLDivElement>(null);
    return (
      <>
        <div ref={anchorRef} data-testid="field-anchor" />
        <AudienceSheet {...props(over)} anchorRef={anchorRef} />
      </>
    );
  }

  beforeEach(() => viewport(true));

  it("is a popover on the field, not a bottom sheet, with the same rows", () => {
    render(<WithField />);
    expect(dialog()).toBeInTheDocument();
    expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull();
    expect(document.querySelector('[data-slot="sheet-overlay"]')).toBeNull();
    expect(dialog()).toHaveAttribute("data-side", "top");
    expect(button("@nia")).toHaveAttribute("aria-pressed", "true");
    expect(button("Gym people")).toHaveAccessibleDescription("Described by you");
    expect(button("New audience")).toBeInTheDocument();
  });

  it("opens downward when asked (Home)", () => {
    render(<WithField side="bottom" />);
    expect(dialog()).toHaveAttribute("data-side", "bottom");
  });

  it("Escape closes it", () => {
    const onOpenChange = vi.fn();
    render(<WithField onOpenChange={onOpenChange} />);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("without a field to stand on it is the bottom sheet", () => {
    render(<AudienceSheet {...props()} />);
    expect(document.querySelector('[data-slot="sheet-content"]')).not.toBeNull();
  });
});

describe("AudienceSheet focus", () => {
  /** Opened from a plain button, as the field and More open it. The field holds the text. */
  function Opener({ hideOpener = false }: { hideOpener?: boolean }) {
    const anchorRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    return (
      <>
        <div ref={anchorRef}>
          <textarea aria-label="Message" />
        </div>
        {!hideOpener && (
          <button type="button" onClick={() => setOpen(true)}>
            Open audience
          </button>
        )}
        <AudienceSheet {...props({ open, onOpenChange: setOpen })} anchorRef={anchorRef} />
      </>
    );
  }

  it.each([
    ["phone", false],
    ["desktop", true],
  ] as const)("on the %s: closed with Escape, focus goes back to what opened it", async (_view, wide) => {
    viewport(wide);
    render(<Opener />);
    const opener = screen.getByRole("button", { name: "Open audience" });
    opener.focus();
    fireEvent.click(opener);
    expect(dialog()).toBeInTheDocument();
    await settle();
    expect(dialog().contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open audience" }));
  });

  it.each([
    ["phone", false],
    ["desktop", true],
  ] as const)("on the %s: if what opened it left the page, focus goes to the field's text", async (_view, wide) => {
    viewport(wide);
    const { rerender } = render(<Opener />);
    const opener = screen.getByRole("button", { name: "Open audience" });
    opener.focus();
    fireEvent.click(opener);
    expect(dialog()).toBeInTheDocument();
    await settle();
    rerender(<Opener hideOpener />);
    expect(screen.queryByRole("button", { name: "Open audience", hidden: true })).toBeNull();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Message" }));
  });

  // More's audience row: when More's layer leaves at once (no exit animation), nothing has focus
  // as this sheet opens. The page is not a place to hand focus back to: the field's text is.
  it.each([
    ["phone", false],
    ["desktop", true],
  ] as const)("on the %s: if nothing had focus when it opened, focus goes to the field's text", async (_view, wide) => {
    viewport(wide);
    function Closed({ open }: { open: boolean }) {
      const anchorRef = useRef<HTMLDivElement>(null);
      return (
        <>
          <div ref={anchorRef}>
            <textarea aria-label="Message" />
          </div>
          <AudienceSheet {...props({ open })} anchorRef={anchorRef} />
        </>
      );
    }
    const { rerender } = render(<Closed open={false} />);
    expect(document.activeElement).toBe(document.body);
    rerender(<Closed open />);
    await settle();
    expect(dialog().contains(document.activeElement)).toBe(true);
    rerender(<Closed open={false} />);
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Message" }));
  });
});
