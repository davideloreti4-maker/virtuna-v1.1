/** @vitest-environment happy-dom */
/**
 * ComposerControls — the locked composer control row (UX-01, sketch 006 Variant 1).
 *
 * Asserts the wiring the old tool-chips test covered, adapted to the popover design:
 *  - The skill pill shows the active skill and opens a grouped Creator/Marketing popover.
 *  - Popover rows carry their `/command` label + a MAX badge where the video model fires.
 *  - The active skill is checked; selecting an enabled skill fires onSelectTool.
 *  - Explore is live (P11 / EXPLORE-01); not-yet-shipped skills (Offer/Ad) render disabled ("coming soon").
 *  - ModelTag is a read-only indicator: SIM-1 Max for Test/Ad, SIM-1 Flash otherwise.
 *  - Audience + intent popovers fire their change handlers.
 *  - SkillRows filters by query (the `/` slash menu reuses it).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import type { Audience } from "@/lib/audience/audience-types";
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

const GENERAL: Audience = {
  id: "general",
  is_general: true,
  name: "General",
  platform: "tiktok",
  goal_label: null,
} as unknown as Audience;

const GYM: Audience = {
  id: "gym",
  is_general: false,
  name: "Gym Beginners",
  platform: "tiktok",
  goal_label: "grow",
} as unknown as Audience;

function renderControls(over: Partial<React.ComponentProps<typeof ComposerControls>> = {}) {
  const props: React.ComponentProps<typeof ComposerControls> = {
    activeTool: "test",
    onSelectTool: vi.fn(),
    audiences: [GENERAL, GYM],
    selectedAudienceId: null,
    onSelectAudience: vi.fn(),
    intent: "grow",
    onIntentChange: vi.fn(),
    onUploadClick: vi.fn(),
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

describe("ComposerControls — audience + intent popovers", () => {
  it("lists audiences and fires onSelectAudience on pick", () => {
    const onSelectAudience = vi.fn();
    renderControls({ onSelectAudience });
    fireEvent.click(screen.getByRole("button", { name: /audience:/i }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /gym beginners/i }));
    expect(onSelectAudience).toHaveBeenCalledWith(GYM);
  });

  it("fires onIntentChange when Sell is chosen", () => {
    const onIntentChange = vi.fn();
    renderControls({ onIntentChange });
    fireEvent.click(screen.getByRole("button", { name: /intent:/i }));
    fireEvent.click(screen.getByRole("button", { name: /sell/i }));
    expect(onIntentChange).toHaveBeenCalledWith("sell");
  });
});

describe("SkillRows — filterable (the `/` slash menu reuses it)", () => {
  it("narrows the list by query", () => {
    render(<SkillRows active="test" filter="hook" onSelect={vi.fn()} />);
    expect(screen.getByRole("menuitemradio", { name: /hooks/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitemradio", { name: /^remix/i })).toBeNull();
  });
});
