/** @vitest-environment happy-dom */
/**
 * ComposerControls — the locked composer control row (UX-01, sketch 006 Variant 1).
 *
 * Asserts the wiring the old tool-chips test covered, adapted to the popover design:
 *  - The verb chip (v6) shows the VERB (Make/Test/Ask) and opens the grouped Creator/Marketing popover.
 *  - Popover rows carry their `/command` label + a MAX badge where the video model fires.
 *  - The active skill is checked; selecting an enabled skill fires onSelectTool.
 *  - Explore is live (P11 / EXPLORE-01); not-yet-shipped skills (Offer/Ad) render disabled ("coming soon").
 *  - ModelTag is a read-only indicator (retired from the composer, still unit-tested): Max for Test/Ad, Flash otherwise.
 *  - SkillRows filters by query (the `/` slash menu reuses it).
 *
 * The intent (Grow/Sell) popover + the `+` attach retired with the v6 clean composer
 * (intent → audience goal; Test absorbs upload) — no longer part of ComposerControls.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
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
  it("shows the active skill on the pill (Test)", () => {
    renderControls({ activeTool: "test" });
    expect(screen.getByRole("button", { name: /skill: test/i })).toBeInTheDocument();
  });

  it("opens a popover grouped Creator / Marketing with /command labels + MAX badges", () => {
    renderControls();
    openSkillPopover();
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Creator")).toBeInTheDocument();
    expect(within(menu).getByText("Marketing")).toBeInTheDocument();
    // /command labels are present
    expect(within(menu).getByText("/test")).toBeInTheDocument();
    expect(within(menu).getByText("/hooks")).toBeInTheDocument();
    // MAX badge appears for the video skills (Test row + Ad row both show MAX)
    expect(within(menu).getAllByText("MAX").length).toBeGreaterThanOrEqual(2);
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

  it("renders not-yet-shipped skills disabled (Offer/Ad) and does not fire on click", () => {
    const onSelectTool = vi.fn();
    renderControls({ onSelectTool });
    openSkillPopover();
    for (const name of [/offer validation/i, /ad creative/i]) {
      const row = screen.getByRole("menuitemradio", { name });
      expect(row).toBeDisabled();
      fireEvent.click(row);
    }
    expect(onSelectTool).not.toHaveBeenCalled();
  });
});

describe("ComposerControls — mode-scoped skill menu (UX-02 / D-01)", () => {
  it("defaults to Socials when no activeMode is passed → Creator + Marketing + always-visible General", () => {
    // No activeMode prop → "socials" default → Creator/Marketing headers + creator skills.
    renderControls();
    openSkillPopover();
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Creator")).toBeInTheDocument();
    expect(within(menu).getByText("Marketing")).toBeInTheDocument();
    expect(within(menu).getByText("/hooks")).toBeInTheDocument();
    expect(within(menu).getByText("/test")).toBeInTheDocument();
    // The General verbs are ALWAYS surfaced (refine lane) — own "General" group,
    // discoverable from a creator context instead of hidden until a General audience.
    expect(within(menu).getByText("General")).toBeInTheDocument();
    expect(within(menu).getByRole("menuitemradio", { name: /profile/i })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitemradio", { name: /simulate/i })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitemradio", { name: /predict/i })).toBeInTheDocument();
  });

  it("shows ONLY Profile/Simulate/Predict when activeMode='general' (no creator skills)", () => {
    renderControls({ activeMode: "general" });
    openSkillPopover();
    const menu = screen.getByRole("menu");
    // The three General verbs are present…
    expect(within(menu).getByRole("menuitemradio", { name: /profile/i })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitemradio", { name: /simulate/i })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitemradio", { name: /predict/i })).toBeInTheDocument();
    // …and the creator skills are gone (only the General group remains).
    expect(within(menu).queryByRole("menuitemradio", { name: /hooks/i })).toBeNull();
    expect(within(menu).queryByText("/hooks")).toBeNull();
    expect(within(menu).queryByText("/test")).toBeNull();
    // General mode hides the Creator/Marketing sub-headers (General is the only group).
    expect(within(menu).queryByText("Creator")).toBeNull();
    expect(within(menu).queryByText("Marketing")).toBeNull();
  });

  it("SkillRows surfaces the General verbs in BOTH modes (the `/` slash menu reuses it)", () => {
    const { rerender } = render(
      <SkillRows active="profile" activeMode="general" onSelect={vi.fn()} />,
    );
    expect(screen.getByRole("menuitemradio", { name: /profile/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitemradio", { name: /hooks/i })).toBeNull();
    // Socials default surfaces creator skills AND the always-visible General verbs.
    rerender(<SkillRows active="hooks" onSelect={vi.fn()} />);
    expect(screen.getByRole("menuitemradio", { name: /hooks/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: /profile/i })).toBeInTheDocument();
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
  // The popover still lists every skill by name (the group collapse is Phase 3); the
  // chip's aria-label keeps "Skill: …" so assistive tech + openSkillPopover reach it.
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
