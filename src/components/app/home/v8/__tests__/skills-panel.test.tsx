/** @vitest-environment happy-dom */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { SkillsPanel, PROMISE_BY_TOOL, SkillPill } from "../skills-panel";
import { SKILLS, isSkillVisible } from "@/components/app/home/composer-controls";

// jsdom has no matchMedia — desktop by default; per-test override for the sheet.
let wide = true;
beforeEach(() => {
  wide = true;
  window.matchMedia = ((q: string) => ({
    matches: wide,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

const renderPanel = (onUse = vi.fn()) => {
  render(
    <SkillsPanel
      open
      onClose={vi.fn()}
      active="chat"
      activeMode="socials"
      onUse={onUse}
      anchorRef={createRef<HTMLButtonElement>()}
    />,
  );
  return onUse;
};

describe("SkillsPanel", () => {
  it("renders every enabled, visible registry skill and nothing else", () => {
    renderPanel();
    const visible = SKILLS.filter((s) => s.enabled && isSkillVisible(s, "socials"));
    for (const s of visible) {
      expect(screen.getAllByText(s.label).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText("Offer Validation")).toBeNull(); // enabled:false stays hidden
  });

  it("groups under the real verbs — Make / Test / Ask (not the mock's Research)", () => {
    renderPanel();
    expect(screen.getByText("Make")).toBeInTheDocument();
    expect(screen.getByText("Test")).toBeInTheDocument();
    expect(screen.getByText("Ask")).toBeInTheDocument();
    expect(screen.queryByText("Research")).toBeNull();
  });

  it("Use arms the previewed skill by ToolId", () => {
    const onUse = renderPanel();
    fireEvent.click(screen.getByText("Remix"));
    fireEvent.click(screen.getByRole("button", { name: "Use" }));
    expect(onUse).toHaveBeenCalledWith("remix");
  });

  it("every promise paragraph exists for every registry id", () => {
    for (const s of SKILLS) expect(PROMISE_BY_TOOL[s.id]).toBeTruthy();
  });

  it("mobile renders the same skills as a sheet; a row tap arms directly", () => {
    wide = false;
    const onUse = renderPanel();
    fireEvent.click(screen.getByText("Remix"));
    expect(onUse).toHaveBeenCalledWith("remix");
  });
});

describe("SkillPill", () => {
  it("is a labelled trigger", () => {
    render(
      <SkillPill open={false} onClick={vi.fn()} anchorRef={createRef<HTMLButtonElement>()} />,
    );
    expect(screen.getByRole("button", { name: "Browse skills" })).toBeInTheDocument();
  });
});
