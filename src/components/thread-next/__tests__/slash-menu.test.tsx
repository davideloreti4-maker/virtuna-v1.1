/** @vitest-environment happy-dom */

/**
 * SlashMenu — what "/" in the field offers under the new look, rendered for real (Radix
 * underneath), next to a real textarea that holds the focus, as the composer mounts it. No
 * stand-ins: the price comes from a `priceOf` callback, as the composer passes its own.
 */

import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import type { ToolId } from "@/components/app/home/composer-controls";
import { HOME_SKILLS } from "@/components/home-next/home-screen";
import { MORE_SKILLS } from "../more-sheet";
import { SLASH_SKILLS, SlashMenu, slashMatches, type SlashMenuProps } from "../slash-menu";

const ids = (query: string) => slashMatches(query).map((skill) => skill.id);

describe("slashMatches", () => {
  it('"" matches every skill, the four of Home\'s cards first, then More\'s three', () => {
    expect(ids("")).toEqual(["test", "hooks", "script", "remix", "idea", "explore", "account"]);
  });

  it("matches the start of a word, trimmed and case-blind", () => {
    expect(ids("ho")).toEqual(["hooks"]);
    expect(ids("HO ")).toEqual(["hooks"]);
  });

  it("the old commands still land", () => {
    expect(ids("test")).toEqual(["test"]);
    expect(ids("simulate")).toEqual(["test"]);
    expect(ids("ideas")).toEqual(["idea"]);
    expect(ids("idea")).toEqual(["idea"]);
    expect(ids("account")).toEqual(["account"]);
  });

  it("a name that starts with what was typed comes before one that only contains it", () => {
    // One letter: "i" is in Simulate, Script and Remix too, but it starts Ideas.
    expect(slashMatches("i")[0]!.id).toBe("idea");
    expect(slashMatches("a")[0]!.id).toBe("account");
    expect(slashMatches("e")[0]!.id).toBe("explore");
    expect(slashMatches("s").map((skill) => skill.id).slice(0, 2)).toEqual(["test", "script"]);
    expect(slashMatches("re").map((skill) => skill.id)).toEqual(["remix", "explore"]);
  });

  it("matches nothing for a name no skill has", () => {
    expect(ids("zz")).toEqual([]);
  });

  it("its copy is Home's cards' and More's rows', word for word", () => {
    for (const home of HOME_SKILLS) {
      const skill = SLASH_SKILLS.find((s) => s.id === home.id);
      expect(skill?.label).toBe(home.label);
      expect(skill?.line).toBe(home.line);
    }
    for (const more of MORE_SKILLS) {
      const skill = SLASH_SKILLS.find((s) => s.id === more.id);
      expect(skill?.label).toBe(more.label);
      expect(skill?.line).toBe(more.line);
    }
  });
});

/** Prices as the composer's `priceOf` returns them (a stand-in callback, not the unit). */
const PRICES: Partial<Record<ToolId, number>> = { test: 10, hooks: 1, script: 2, remix: 10, idea: 1, explore: 3, account: 5 };
const priceOf = (id: ToolId) => PRICES[id] ?? null;

/** The field as the composer draws it: an outer element (the anchor) holding the text, and the
 *  menu inside it while the text starts with "/". */
function Field({ open = true, ...over }: Partial<SlashMenuProps> & { open?: boolean }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={anchorRef}>
      <textarea aria-label="Message" />
      {open && <SlashMenu query="" onSelect={() => {}} priceOf={priceOf} anchorRef={anchorRef} side="top" {...over} />}
    </div>
  );
}

/** Opens the menu the way typing "/" does: the text has the focus, then the menu mounts. */
function renderOpen(over: Partial<SlashMenuProps> = {}) {
  const result = render(<Field open={false} {...over} />);
  const textarea = screen.getByRole("textbox", { name: "Message" });
  textarea.focus();
  result.rerender(<Field {...over} />);
  return { ...result, textarea };
}

const SEVEN = ["Simulate", "Hooks", "Script", "Remix", "Ideas", "Explore", "Your account"];
const layer = () => screen.getByRole("dialog", { name: "Skills" });
const rows = () => within(layer()).queryAllByRole("button");
const row = (name: string) => within(layer()).getByRole("button", { name });
/** Radix runs its focus work in effects and on a timer. */
const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SlashMenu", () => {
  it("lists the seven skills in order, each described by its line and its price", () => {
    renderOpen();
    expect(rows()).toHaveLength(SEVEN.length);
    SEVEN.forEach((name, i) => expect(rows()[i]).toHaveAccessibleName(name));
    expect(row("Simulate")).toHaveAccessibleDescription("See who keeps watching 10 credits");
    expect(row("Hooks")).toHaveAccessibleDescription("Openings for an idea 1 credit");
    expect(row("Script")).toHaveAccessibleDescription("A full script, timed 2 credits");
    expect(row("Remix")).toHaveAccessibleDescription("Rebuild a proven video 10 credits");
    expect(row("Ideas")).toHaveAccessibleDescription("A few video ideas for your audience 1 credit");
    expect(row("Explore")).toHaveAccessibleDescription("Videos doing well in your niche 3 credits");
    expect(row("Your account")).toHaveAccessibleDescription("What works on your account 5 credits");
  });

  it("carries none of the old menu's words: no group labels, no MAX, no command hints", () => {
    renderOpen();
    const words = layer().textContent ?? "";
    for (const legacy of ["MAKE", "TEST", "MAX", "A real video"]) expect(words).not.toContain(legacy);
    expect(words).not.toMatch(/\/[a-z]/);
  });

  it("filters by the typed query; a query that matches nothing says so", () => {
    const { rerender } = renderOpen({ query: "ho" });
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveAccessibleName("Hooks");

    rerender(<Field query="zz" />);
    expect(rows()).toHaveLength(0);
    expect(within(layer()).getByText("No skill by that name")).toBeInTheDocument();
  });

  it("a click on a row picks that skill; its press leaves the focus in the text", () => {
    const onSelect = vi.fn();
    const { textarea } = renderOpen({ onSelect });
    // A press whose default is cancelled does not move the focus (fireEvent answers false).
    expect(fireEvent.mouseDown(row("Explore"))).toBe(false);
    expect(document.activeElement).toBe(textarea);
    fireEvent.click(row("Explore"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("explore");
  });

  it("a row reached with Tab and picked from the keyboard hands the focus back to the text", () => {
    const onSelect = vi.fn();
    const { textarea } = renderOpen({ onSelect });
    row("Script").focus();
    expect(document.activeElement).toBe(row("Script"));
    fireEvent.click(row("Script"));
    expect(onSelect).toHaveBeenCalledWith("script");
    expect(document.activeElement).toBe(textarea);
  });

  it("marks the first listed row as the one Enter takes, and only that one", () => {
    const { rerender } = renderOpen();
    const [first, ...others] = rows();
    expect(first).toHaveAttribute("data-enter", "true");
    expect(first).toHaveAccessibleName("Simulate");
    for (const row of others) expect(row.getAttribute("data-enter")).not.toBe("true");

    rerender(<Field query="re" />);
    const marked = rows().filter((row) => row.getAttribute("data-enter") === "true");
    expect(marked).toHaveLength(1);
    expect(marked[0]).toBe(rows()[0]);
    expect(marked[0]).toHaveAccessibleName("Remix");
  });

  it("opening it leaves the focus in the field's text", async () => {
    const { textarea } = renderOpen();
    await settle();
    expect(layer()).toBeInTheDocument();
    expect(document.activeElement).toBe(textarea);
  });

  it("is a layer named Skills, standing on the side it is asked for", async () => {
    const { rerender } = renderOpen({ side: "top" });
    expect(layer()).toHaveAttribute("data-side", "top");
    rerender(<Field side="bottom" />);
    await settle();
    expect(layer()).toHaveAttribute("data-side", "bottom");
  });
});
