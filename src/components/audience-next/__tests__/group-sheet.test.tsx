/** @vitest-environment happy-dom */
/**
 * GroupSheet — one group of the audience (spec 2026-11-25-audience, 3.3), on the thread's details sheet
 * (`AnswerSheet`): a bottom sheet on a phone, the centred dialog from 768. Rendered for real on the dev
 * preview's groups (made-up audiences through the real model). Stand-ins: the build-time flag (on) and
 * `matchMedia` (phone or desk).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { DEV_PAGES } from "@/app/(app)/dev/audience/fixtures";
import type { PageGroup, Whose } from "@/lib/audience-next/audience-model";
import { AUDIENCE_STRINGS, groupCount, seenIn } from "@/lib/audience-next/audience-words";

import { GroupSheet } from "../group-sheet";

function widthIs(view: "phone" | "desk") {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: view === "desk" && /min-width:\s*768px/.test(query),
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const OWN = DEV_PAGES.own.page;
const SAVERS = OWN.groups.find((g) => g.group === "saver")!;
/** An older read: the groups have no line, no judge and no evidence. */
const BARE = DEV_PAGES.bare.page.groups[0]!;

/** A row that opens the sheet, as the page's rows do. */
function Harness({ group, whose = "your" }: { group: PageGroup; whose?: Whose }) {
  const [open, setOpen] = useState(false);
  const [row, setRow] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <button ref={setRow} type="button" onClick={() => setOpen(true)}>
        Open row
      </button>
      <GroupSheet group={group} whose={whose} open={open} onOpenChange={setOpen} returnFocus={row} />
    </>
  );
}

const openRow = async (group: PageGroup, whose?: Whose) => {
  render(<Harness group={group} whose={whose} />);
  const row = screen.getByRole("button", { name: "Open row" });
  row.focus();
  fireEvent.click(row);
  const dialog = await screen.findByRole("dialog", { name: group.name });
  return { row, dialog };
};

/** The sheet's parts below its heading, in order: each one's own words. */
const partsOf = (dialog: HTMLElement) =>
  Array.from(dialog.querySelectorAll("[data-group-part]")).map((el) => el.getAttribute("data-group-part"));

describe.each(["phone", "desk"] as const)("GroupSheet (%s)", (view) => {
  it("is named by the group; its heading is the group's name and takes the focus on open", async () => {
    widthIs(view);
    const { dialog } = await openRow(SAVERS);
    const heading = within(dialog).getByRole("heading", { level: 2, name: SAVERS.name });
    expect(heading).toHaveFocus();
    expect(dialog).toHaveAttribute("data-sheet", view === "desk" ? "dialog" : "sheet");
  });

  it("says the group's count of 1,000, its line in quotes, how they judge a video and where it is seen", async () => {
    widthIs(view);
    const { dialog } = await openRow(SAVERS);
    expect(within(dialog).getByText(groupCount(SAVERS.count))).toBeInTheDocument();
    expect(within(dialog).getByText(`“${SAVERS.line}”`)).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { level: 3, name: AUDIENCE_STRINGS.judge })).toBeInTheDocument();
    expect(within(dialog).getByText(SAVERS.judge!)).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { level: 3, name: seenIn("your") })).toBeInTheDocument();
    expect(within(dialog).getByText(SAVERS.seen!)).toBeInTheDocument();
    expect(partsOf(dialog)).toEqual(["count", "line", "judge", "seen"]);
  });

  it("names whose numbers: their numbers for another creator, the numbers for a description", async () => {
    widthIs(view);
    const { dialog } = await openRow(SAVERS, "their");
    expect(within(dialog).getByRole("heading", { level: 3, name: seenIn("their") })).toBeInTheDocument();
    cleanup();
    const again = await openRow(SAVERS, "the");
    expect(within(again.dialog).getByRole("heading", { level: 3, name: seenIn("the") })).toBeInTheDocument();
  });

  it("leaves out a part with no text: an older read's group has its name and count only", async () => {
    widthIs(view);
    const { dialog } = await openRow(BARE);
    expect(partsOf(dialog)).toEqual(["count"]);
    expect(within(dialog).queryAllByRole("heading", { level: 3 })).toEqual([]);
    expect(dialog.textContent).not.toMatch(/[“”]/);
  });

  it.each([
    ["no line", { line: null }, ["count", "judge", "seen"]],
    ["no judge", { judge: null }, ["count", "line", "seen"]],
    ["no evidence", { seen: null }, ["count", "line", "judge"]],
  ] as const)("with %s that part alone is left out", async (_what, change, parts) => {
    widthIs(view);
    const { dialog } = await openRow({ ...SAVERS, ...change });
    expect(partsOf(dialog)).toEqual(parts);
  });

  it("a long unbroken word (a handle, an address) wraps in the quote and the two texts, at 320 too", async () => {
    widthIs(view);
    const { dialog } = await openRow(SAVERS);
    for (const part of ["line", "judge", "seen"]) {
      const text = dialog.querySelector(`[data-group-part="${part}"]`);
      const p = text!.tagName === "P" ? text! : text!.querySelector("p")!;
      expect(p, part).toHaveClass("break-words");
    }
  });

  it("nothing in it can be edited or pressed but its hidden Close", async () => {
    widthIs(view);
    const { dialog } = await openRow(SAVERS);
    expect(within(dialog).queryAllByRole("textbox")).toEqual([]);
    expect(within(dialog).getAllByRole("button").map((b) => b.textContent)).toEqual([AUDIENCE_STRINGS.close]);
  });

  it("Escape closes it and the focus goes back to the row that opened it", async () => {
    widthIs(view);
    const { row } = await openRow(SAVERS);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(row).toHaveFocus());
  });

  it("has no axe violations open", async () => {
    widthIs(view);
    const { dialog } = await openRow(SAVERS);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(dialog)).toHaveNoViolations();
  });
});

describe("GroupSheet with no group", () => {
  it("draws nothing", () => {
    widthIs("phone");
    const { container } = render(<GroupSheet group={null} whose="your" open={false} onOpenChange={() => {}} returnFocus={null} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
