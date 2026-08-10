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
    // `chat` renders as AUTO, not under its registry label — see the Auto tests below.
    const visible = SKILLS.filter(
      (s) => s.enabled && isSkillVisible(s, "socials") && s.id !== "chat",
    );
    for (const s of visible) {
      expect(screen.getAllByText(s.label).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText("Offer Validation")).toBeNull(); // enabled:false stays hidden
  });

  it("groups under the real verbs — Make / Test (not the mock's Research)", () => {
    renderPanel();
    expect(screen.getByText("Make")).toBeInTheDocument();
    expect(screen.getByText("Test")).toBeInTheDocument();
    expect(screen.queryByText("Research")).toBeNull();
  });

  // ── The taxonomy ruling (owner 2026-08-11: "chat shouldn't be a skill right?") ──────
  // `chat` IS `DEFAULT_TOOL` — the lane you are in until you pick, and the one arming it
  // returns you to. It leads the panel as AUTO instead of sitting under Ask as a peer.

  it("chat is not a skill: it leads as AUTO and the empty Ask group is gone", () => {
    renderPanel();
    // Twice, correctly: the pinned row, and the preview pane it seeds (active="chat").
    expect(screen.getAllByText("Auto").length).toBe(2);
    expect(screen.queryByText("Chat")).toBeNull();
    // Ask had exactly one member; with it promoted the verb has nothing left to name.
    expect(screen.queryByText("Ask")).toBeNull();
  });

  it("AUTO carries the check while nothing is armed — the routing promise, shown not stated", () => {
    renderPanel();
    const autoRow = document.querySelector("[data-auto-row]");
    expect(autoRow).not.toBeNull();
    expect(autoRow!.textContent).toContain("Maven picks the skill");
    // active="chat" ⇒ nothing armed ⇒ the default lane reads as a choice already made.
    expect(autoRow!.querySelector("svg[aria-hidden]")).not.toBeNull();
    // The disclaimer paragraph it replaced must not come back.
    expect(screen.queryByText(/You never have to pick/i)).toBeNull();
  });

  it("the selected skill prints its slash command — how `/` gets taught", () => {
    renderPanel();
    fireEvent.click(screen.getByText("Remix"));
    // Twice by design: on the selected row (so it is visible while scanning the list) and
    // beside the name in the preview pane. Neither is a paragraph explaining the shortcut.
    expect(screen.getAllByText("/remix").length).toBe(2);
    // Auto has no command — it is not something you type a word for.
    expect(screen.queryByText("/chat")).toBeNull();
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
