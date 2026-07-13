/** @vitest-environment happy-dom */
/**
 * ComposerControls — the locked composer control row (UX-01, sketch 006 Variant 1).
 *
 * Asserts the wiring the old tool-chips test covered, adapted to the popover design:
 *  - The verb chip (v6) shows the VERB (Make/Test/Ask) and opens the popover grouped under the same three verbs (Phase 3).
 *  - Popover rows carry their `/command` label + a MAX badge where the video model fires.
 *  - The active skill is checked; selecting an enabled skill fires onSelectTool.
 *  - Explore is live (P11 / EXPLORE-01); not-yet-shipped skills (Offer/Ad) are HIDDEN until enabled.
 *  - ModelTag is a read-only indicator (retired from the composer, still unit-tested): Max for Test/Ad, Flash otherwise.
 *  - SkillRows filters by query (the `/` slash menu reuses it).
 *
 * The intent (Grow/Sell) popover + the `+` attach retired with the v6 clean composer
 * (intent → audience goal; Test absorbs upload) — no longer part of ComposerControls.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { HORIZONTAL_ENABLED } from "@/lib/flags/horizontal";
import {
  ComposerControls,
  ModelTag,
  SkillRows,
  MODEL_LABEL,
} from "../composer-controls";

// next/link → plain anchor (no app-router context under happy-dom)
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function renderControls(over: Partial<React.ComponentProps<typeof ComposerControls>> = {}) {
  const props: React.ComponentProps<typeof ComposerControls> = {
    activeTool: "test",
    onSelectTool: vi.fn(),
    ...over,
  };
  return { props, ...render(<ComposerControls {...props} />) };
}

function openSkillPopover() {
  fireEvent.click(screen.getByRole("button", { name: /skill:/i }));
}

beforeEach(() => cleanup());

describe("ComposerControls — skill pill + popover", () => {
  it("shows the active skill on the pill (Test verb + aria)", () => {
    renderControls({ activeTool: "test" });
    // The chip face shows the VERB (Test); the aria-label carries the skill's row label
    // ("A real video" under the Test verb — a "Test" row under a "Test" header is redundant).
    const pill = screen.getByRole("button", { name: /skill: a real video/i });
    expect(pill).toHaveTextContent("Test");
  });

  it("opens a popover grouped Make / Test / Ask with /command labels + MAX badge", () => {
    renderControls();
    openSkillPopover();
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Make")).toBeInTheDocument();
    expect(within(menu).getByText("Test")).toBeInTheDocument();
    expect(within(menu).getByText("Ask")).toBeInTheDocument();
    // /command labels are present (the id + command stay stable under the relabeled rows)
    expect(within(menu).getByText("/test")).toBeInTheDocument();
    expect(within(menu).getByText("/hooks")).toBeInTheDocument();
    // MAX badge appears for the video skill (Test row); Ad is hidden until enabled.
    expect(within(menu).getAllByText("MAX").length).toBeGreaterThanOrEqual(1);
  });

  it("marks the active skill with aria-checked", () => {
    renderControls({ activeTool: "hooks" });
    openSkillPopover();
    const hooks = screen.getByRole("menuitemradio", { name: /hooks/i });
    expect(hooks).toHaveAttribute("aria-checked", "true");
  });

  it("fires onSelectTool when an enabled skill is clicked", () => {
    const onSelectTool = vi.fn();
    renderControls({ onSelectTool });
    openSkillPopover();
    fireEvent.click(screen.getByRole("menuitemradio", { name: /hooks/i }));
    expect(onSelectTool).toHaveBeenCalledWith("hooks");
  });

  it("renders Explore enabled and fires onSelectTool on click (P11 / EXPLORE-01)", () => {
    const onSelectTool = vi.fn();
    renderControls({ onSelectTool });
    openSkillPopover();
    const explore = screen.getByRole("menuitemradio", { name: /explore/i });
    expect(explore).not.toBeDisabled();
    fireEvent.click(explore);
    expect(onSelectTool).toHaveBeenCalledWith("explore");
  });

  it("hides not-yet-shipped skills (Offer/Ad) until enabled", () => {
    renderControls();
    openSkillPopover();
    const menu = screen.getByRole("menu");
    // enabled:false → SkillRows never renders them (no "coming soon" rows in v6).
    expect(within(menu).queryByRole("menuitemradio", { name: /offer validation/i })).toBeNull();
    expect(within(menu).queryByRole("menuitemradio", { name: /ad creative/i })).toBeNull();
  });
});

describe("ComposerControls — mode-scoped skill menu (UX-02 / D-01)", () => {
  it("defaults to Socials when no activeMode is passed → Make/Test/Ask", () => {
    // No activeMode prop → "socials" default → the three verb headers + creator skills.
    renderControls();
    openSkillPopover();
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Make")).toBeInTheDocument();
    expect(within(menu).getByText("Test")).toBeInTheDocument();
    expect(within(menu).getByText("Ask")).toBeInTheDocument();
    expect(within(menu).getByText("/hooks")).toBeInTheDocument();
    expect(within(menu).getByText("/test")).toBeInTheDocument();
  });

  // ── The horizontal (GSI) verbs — HIDDEN behind HORIZONTAL_ENABLED (owner call
  //    2026-07-13: the product commits to the creator vertical for MVP). These specs are
  //    NOT deleted; they describe real behavior that returns the day the flag flips back.
  describe.skipIf(!HORIZONTAL_ENABLED)("the General verbs — while the horizontal is ON", () => {
    it("surfaces them alongside the creator skills in Socials mode", () => {
      renderControls();
      openSkillPopover();
      const menu = screen.getByRole("menu");
      // Own "General" group — discoverable from a creator context.
      expect(within(menu).getByText("General")).toBeInTheDocument();
      expect(within(menu).getByRole("menuitemradio", { name: /profile/i })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitemradio", { name: /simulate/i })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitemradio", { name: /predict/i })).toBeInTheDocument();
    });

    it("shows ONLY Profile/Simulate/Predict when activeMode='general' (no creator skills)", () => {
      renderControls({ activeMode: "general" });
      openSkillPopover();
      const menu = screen.getByRole("menu");
      expect(within(menu).getByRole("menuitemradio", { name: /profile/i })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitemradio", { name: /simulate/i })).toBeInTheDocument();
      expect(within(menu).getByRole("menuitemradio", { name: /predict/i })).toBeInTheDocument();
      // …and the creator skills are gone (only the General group remains).
      expect(within(menu).queryByRole("menuitemradio", { name: /hooks/i })).toBeNull();
      expect(within(menu).queryByText("/hooks")).toBeNull();
      expect(within(menu).queryByText("/test")).toBeNull();
      expect(within(menu).queryByText("Make")).toBeNull();
      expect(within(menu).queryByText("Test")).toBeNull();
      expect(within(menu).queryByText("Ask")).toBeNull();
    });

    it("SkillRows surfaces the General verbs in BOTH modes (the `/` slash menu reuses it)", () => {
      const { rerender } = render(
        <SkillRows active="profile" activeMode="general" onSelect={vi.fn()} />,
      );
      expect(screen.getByRole("menuitemradio", { name: /profile/i })).toBeInTheDocument();
      expect(screen.queryByRole("menuitemradio", { name: /hooks/i })).toBeNull();
      rerender(<SkillRows active="hooks" onSelect={vi.fn()} />);
      expect(screen.getByRole("menuitemradio", { name: /hooks/i })).toBeInTheDocument();
      expect(screen.getByRole("menuitemradio", { name: /profile/i })).toBeInTheDocument();
    });
  });

  // ── …and the gate that holds the cut. `enabled: HORIZONTAL_ENABLED` is filtered by the
  //    skill pill, the `/` slash menu AND Enter-to-select, so this covers every composer door.
  it.skipIf(HORIZONTAL_ENABLED)("hides the horizontal verbs while HORIZONTAL_ENABLED is off", () => {
    renderControls();
    openSkillPopover();
    const menu = screen.getByRole("menu");
    // The creator vertical is untouched…
    expect(within(menu).getByText("/hooks")).toBeInTheDocument();
    // …and the horizontal is gone from the menu entirely — no group, no rows.
    expect(within(menu).queryByText("General")).toBeNull();
    expect(within(menu).queryByRole("menuitemradio", { name: /profile/i })).toBeNull();
    expect(within(menu).queryByRole("menuitemradio", { name: /simulate/i })).toBeNull();
    expect(within(menu).queryByRole("menuitemradio", { name: /predict/i })).toBeNull();
    // SkillRows is the shared list behind the `/` slash menu — same result there.
    render(<SkillRows active="hooks" onSelect={vi.fn()} />);
    expect(screen.queryByRole("menuitemradio", { name: /simulate/i })).toBeNull();
  });
});

describe("ModelTag — read-only model indicator (D-09)", () => {
  it("reads SIM-1 Max for the Test skill", () => {
    render(<ModelTag activeTool="test" />);
    expect(screen.getByTestId("active-model-label").textContent).toContain("SIM-1 Max");
  });

  it("reads SIM-1 Flash for Idea / Hooks / Chat", () => {
    for (const t of ["idea", "hooks", "chat"] as const) {
      cleanup();
      render(<ModelTag activeTool={t} />);
      expect(screen.getByTestId("active-model-label").textContent).toContain("SIM-1 Flash");
    }
  });

  it("MODEL_LABEL maps Ad Creative to Max and the rest of marketing/creator correctly", () => {
    expect(MODEL_LABEL.test).toBe("SIM-1 Max");
    expect(MODEL_LABEL.ad).toBe("SIM-1 Max");
    expect(MODEL_LABEL.offer).toBe("SIM-1 Flash");
    expect(MODEL_LABEL.idea).toBe("SIM-1 Flash");
  });
});

describe("ComposerControls — verb chip (v6 clean composer)", () => {
  // The pill collapses ~13 skills → three verbs on the chip face (Make / Test / Ask).
  // The popover groups every skill under those same three verbs (Phase 3); the chip's
  // aria-label keeps "Skill: …" so assistive tech + openSkillPopover reach it.
  it("labels the chip Make for a generation skill", () => {
    renderControls({ activeTool: "hooks" });
    expect(screen.getByRole("button", { name: /skill:/i })).toHaveTextContent("Make");
  });
  it("labels the chip Test for the Test skill", () => {
    renderControls({ activeTool: "test" });
    expect(screen.getByRole("button", { name: /skill:/i })).toHaveTextContent("Test");
  });
  it("labels the chip Ask for the Chat skill", () => {
    renderControls({ activeTool: "chat" });
    expect(screen.getByRole("button", { name: /skill:/i })).toHaveTextContent("Ask");
  });
});

describe("SkillRows — filterable (the `/` slash menu reuses it)", () => {
  it("narrows the list by query", () => {
    render(<SkillRows active="test" filter="hook" onSelect={vi.fn()} />);
    expect(screen.getByRole("menuitemradio", { name: /hooks/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitemradio", { name: /^remix/i })).toBeNull();
  });
});
