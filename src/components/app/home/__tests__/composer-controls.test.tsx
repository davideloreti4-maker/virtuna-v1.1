/** @vitest-environment happy-dom */
/**
 * ComposerControls + the skill SSOT, after the pill was deleted (Lane 2 step 3).
 *
 * ⚠️ THE SKILL PILL IS GONE. Most of this file used to drive it — open the popover, read the
 * chip face, click a row. The rows themselves did NOT go: `SkillRows` is still the body of the
 * `/` slash menu (owner call: keep), so every assertion about grouping, /command labels, MAX
 * badges, checked state, mode scoping and filtering moved onto SkillRows directly. That is the
 * component that still ships them.
 *
 * What ComposerControls is now: the Explore params popover, and nothing else. The two tests at
 * the top pin exactly that — it renders NOTHING under any other skill, and it offers no picker.
 *
 * Still asserted here:
 *  - SkillRows groups under the intent verbs (Make/Test), carries /command labels + a MAX badge.
 *  - The active row is checked and spends its one right slot on the check, not the command.
 *  - Explore is live (P11 / EXPLORE-01); not-yet-shipped skills (Offer/Ad) are HIDDEN.
 *  - The horizontal (GSI) verbs stay behind HORIZONTAL_ENABLED in BOTH doors.
 *  - SimModelSelector is a Claude-style Flash/Max picker (UI-only; skill-synced default).
 *  - `ask` is not a skill any more (step 4) — the "Ask" group is Chat alone.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { HORIZONTAL_ENABLED } from "@/lib/flags/horizontal";
import {
  ComposerControls,
  SimModelSelector,
  SkillRows,
  SKILLS,
  VERB_BY_TOOL,
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
    ...over,
  };
  return { props, ...render(<ComposerControls {...props} />) };
}

/** The surviving picker: the `/` slash menu's body. Renders the same rows the pill used to. */
function renderRows(over: Partial<React.ComponentProps<typeof SkillRows>> = {}) {
  const onSelect = vi.fn();
  const props: React.ComponentProps<typeof SkillRows> = {
    active: "test",
    onSelect,
    ...over,
  };
  render(<SkillRows {...props} />);
  return { onSelect };
}

beforeEach(() => cleanup());

describe("ComposerControls — the pill is GONE; only the Explore popover is left", () => {
  /**
   * The guard that holds step 3. `document.body` (not the render container) because the pill's
   * popover PORTALED to body — asserting on the container alone would have passed even if the
   * pill were still mounted and open.
   */
  it("offers NO skill picker, under any skill", () => {
    for (const tool of ["chat", "hooks", "test", "explore"] as const) {
      cleanup();
      renderControls({ activeTool: tool });
      expect(document.getElementById("composer-skill-pill")).toBeNull();
      expect(screen.queryByRole("button", { name: /skill:/i })).toBeNull();
      expect(screen.queryByRole("menuitemradio")).toBeNull();
    }
  });

  it("renders literally nothing unless Explore is armed", () => {
    const { container } = renderControls({ activeTool: "hooks" });
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the Explore params trigger when Explore is armed", () => {
    renderControls({ activeTool: "explore" });
    expect(screen.getByRole("button", { name: /^search$/i })).toBeInTheDocument();
  });

  it("lifts the Explore params through onRunExplore and closes", () => {
    const onRunExplore = vi.fn();
    renderControls({ activeTool: "explore", onRunExplore });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    fireEvent.change(screen.getByPlaceholderText(/gym beginners/i), {
      target: { value: "cold plunge" },
    });
    fireEvent.click(screen.getByRole("button", { name: /run explore/i }));
    expect(onRunExplore).toHaveBeenCalledWith(
      expect.objectContaining({ niche: "cold plunge", timeWindow: "today" }),
    );
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("SkillRows — the surviving picker (the `/` slash menu's body)", () => {
  it("groups under the intent verbs with /command labels + MAX badge", () => {
    renderRows();
    expect(screen.getByText("Make")).toBeInTheDocument();
    expect(screen.getByText("Test")).toBeInTheDocument();
    // /command labels ride the inactive rows (the active one wears the check instead).
    expect(screen.getByText("/hooks")).toBeInTheDocument();
    expect(screen.getByText("/chat")).toBeInTheDocument();
    // MAX badge appears for the video skill (Test row); Ad is hidden until enabled.
    expect(screen.getAllByText("MAX").length).toBeGreaterThanOrEqual(1);
  });

  /**
   * ONE right slot per row, never two. The rail used to hold the /command AND a permanently
   * reserved (nearly always empty) check column beside it — every row paying for a slot that
   * only one row ever used. The check REPLACES the command on the active row.
   */
  it("gives the active row a check INSTEAD of its slash command — one slot, not two", () => {
    renderRows({ active: "test" });
    expect(screen.queryByText("/test")).toBeNull();
    expect(screen.getByText("/hooks")).toBeInTheDocument();
    const active = screen.getByRole("menuitemradio", { name: /a real video/i });
    expect(active).toHaveAttribute("aria-checked", "true");
  });

  it("marks the active skill with aria-checked", () => {
    renderRows({ active: "hooks" });
    expect(screen.getByRole("menuitemradio", { name: /hooks/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("fires onSelect when an enabled skill is clicked", () => {
    const { onSelect } = renderRows();
    fireEvent.click(screen.getByRole("menuitemradio", { name: /hooks/i }));
    expect(onSelect).toHaveBeenCalledWith("hooks");
  });

  it("renders Explore enabled and fires onSelect on click (P11 / EXPLORE-01)", () => {
    const { onSelect } = renderRows();
    const explore = screen.getByRole("menuitemradio", { name: /explore/i });
    expect(explore).not.toBeDisabled();
    fireEvent.click(explore);
    expect(onSelect).toHaveBeenCalledWith("explore");
  });

  it("hides not-yet-shipped skills (Offer/Ad) until enabled", () => {
    renderRows();
    expect(screen.queryByRole("menuitemradio", { name: /offer validation/i })).toBeNull();
    expect(screen.queryByRole("menuitemradio", { name: /ad creative/i })).toBeNull();
  });

  it("narrows the list by query", () => {
    renderRows({ filter: "hook" });
    expect(screen.getByRole("menuitemradio", { name: /hooks/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitemradio", { name: /^remix/i })).toBeNull();
  });
});

/**
 * Step 4, pinned at the SSOT. "Ask the room" was a composer verb that POSTed the (now priced)
 * /api/tools/react and rendered nowhere — see the deleted SKILLS entry for the probe results.
 * Removing it from the ToolId union is what makes tsc catch a resurrection; this catches the
 * softer one, where the id comes back as a string in a registry.
 */
describe("`ask` is not a skill (step 4)", () => {
  it("is absent from SKILLS, VERB_BY_TOOL and MODEL_LABEL", () => {
    expect(SKILLS.map((s) => s.id)).not.toContain("ask");
    expect(Object.keys(VERB_BY_TOOL)).not.toContain("ask");
    expect(Object.keys(MODEL_LABEL)).not.toContain("ask");
  });

  it("leaves Chat as the only skill under the Ask verb", () => {
    const underAsk = SKILLS.filter((s) => s.enabled && VERB_BY_TOOL[s.id] === "Ask");
    expect(underAsk.map((s) => s.id)).toEqual(["chat"]);
  });

  it("offers no /ask row and no /ask command", () => {
    renderRows();
    expect(screen.queryByRole("menuitemradio", { name: /ask the room/i })).toBeNull();
    expect(screen.queryByText("/ask")).toBeNull();
  });
});

describe("SkillRows — mode-scoped (UX-02 / D-01)", () => {
  it("defaults to Socials when no activeMode is passed → the creator verbs", () => {
    renderRows();
    expect(screen.getByText("Make")).toBeInTheDocument();
    expect(screen.getByText("Test")).toBeInTheDocument();
    // Slash hints ride the INACTIVE rows; the active row spends its slot on the check.
    expect(screen.getByText("/hooks")).toBeInTheDocument();
    expect(screen.getByText("/ideas")).toBeInTheDocument();
  });

  // ── The horizontal (GSI) verbs — HIDDEN behind HORIZONTAL_ENABLED (owner call
  //    2026-07-13: the product commits to the creator vertical for MVP). These specs are
  //    NOT deleted; they describe real behavior that returns the day the flag flips back.
  describe.skipIf(!HORIZONTAL_ENABLED)("the General verbs — while the horizontal is ON", () => {
    it("surfaces them alongside the creator skills in Socials mode", () => {
      renderRows();
      expect(screen.getByText("General")).toBeInTheDocument();
      expect(screen.getByRole("menuitemradio", { name: /profile/i })).toBeInTheDocument();
      expect(screen.getByRole("menuitemradio", { name: /simulate/i })).toBeInTheDocument();
      expect(screen.getByRole("menuitemradio", { name: /predict/i })).toBeInTheDocument();
    });

    it("shows ONLY Profile/Simulate/Predict when activeMode='general' (no creator skills)", () => {
      renderRows({ activeMode: "general" });
      expect(screen.getByRole("menuitemradio", { name: /profile/i })).toBeInTheDocument();
      expect(screen.getByRole("menuitemradio", { name: /simulate/i })).toBeInTheDocument();
      expect(screen.getByRole("menuitemradio", { name: /predict/i })).toBeInTheDocument();
      expect(screen.queryByRole("menuitemradio", { name: /hooks/i })).toBeNull();
      expect(screen.queryByText("/hooks")).toBeNull();
      expect(screen.queryByText("/test")).toBeNull();
      expect(screen.queryByText("Make")).toBeNull();
      expect(screen.queryByText("Test")).toBeNull();
    });

    it("surfaces the General verbs in BOTH modes (the `/` slash menu reuses this list)", () => {
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
  //    `/` slash menu AND Enter-to-select, so this covers every composer door that remains.
  it.skipIf(HORIZONTAL_ENABLED)("hides the horizontal verbs while HORIZONTAL_ENABLED is off", () => {
    renderRows();
    // The creator vertical is untouched…
    expect(screen.getByText("/hooks")).toBeInTheDocument();
    // …and the horizontal is gone entirely — no group, no rows.
    expect(screen.queryByText("General")).toBeNull();
    expect(screen.queryByRole("menuitemradio", { name: /profile/i })).toBeNull();
    expect(screen.queryByRole("menuitemradio", { name: /simulate/i })).toBeNull();
    expect(screen.queryByRole("menuitemradio", { name: /predict/i })).toBeNull();
  });
});

describe("SimModelSelector — Claude-style tier picker", () => {
  function renderSelector(over: Partial<React.ComponentProps<typeof SimModelSelector>> = {}) {
    const onChange = vi.fn();
    const props: React.ComponentProps<typeof SimModelSelector> = {
      value: "Flash",
      onChange,
      ...over,
    };
    return { props, onChange, ...render(<SimModelSelector {...props} />) };
  }

  it("renders the current tier in the trigger", () => {
    renderSelector({ value: "Max" });
    expect(screen.getByTestId("sim-model-selector").textContent).toContain("SIM-1 Max");
  });

  it("opens a popover with both tiers and descriptions", () => {
    renderSelector();
    fireEvent.click(screen.getByTestId("sim-model-selector"));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("SIM-1 Flash")).toBeInTheDocument();
    expect(within(menu).getByText("SIM-1 Max")).toBeInTheDocument();
    expect(within(menu).getByText(/text-only runs/i)).toBeInTheDocument();
    expect(within(menu).getByText(/with-video runs/i)).toBeInTheDocument();
  });

  it("calls onChange and closes when a tier is selected", () => {
    const { onChange } = renderSelector({ value: "Flash" });
    fireEvent.click(screen.getByTestId("sim-model-selector"));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /sim-1 max/i }));
    expect(onChange).toHaveBeenCalledWith("Max");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("marks the active tier with a check", () => {
    renderSelector({ value: "Flash" });
    fireEvent.click(screen.getByTestId("sim-model-selector"));
    const active = screen.getByRole("menuitemradio", { name: /sim-1 flash/i });
    expect(active).toHaveAttribute("aria-checked", "true");
  });

  it("MODEL_LABEL maps Ad Creative to Max and the rest of marketing/creator correctly", () => {
    expect(MODEL_LABEL.test).toBe("SIM-1 Max");
    expect(MODEL_LABEL.ad).toBe("SIM-1 Max");
    expect(MODEL_LABEL.offer).toBe("SIM-1 Flash");
    expect(MODEL_LABEL.idea).toBe("SIM-1 Flash");
  });
});
