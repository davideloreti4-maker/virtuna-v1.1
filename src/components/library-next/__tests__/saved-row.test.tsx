/** @vitest-environment happy-dom */

/**
 * One saved piece under the Saved chip (spec 2026-11-23 §3.4), rendered for real: the
 * three ways a row can be (it opens its chat; a video saved in Discover opens its own address in a
 * new tab; neither, a plain row) and its "Remove from saved". Every value comes in as a prop, so
 * nothing is stubbed.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { axe } from "vitest-axe";

import { SavedRow, type SavedRowData } from "../saved-row";

afterEach(() => {
  cleanup();
});

const HOOK: SavedRowData = {
  id: "sv-hook",
  kind: "hooks",
  text: "Stop scrolling if you lift at 5am",
  line: "Hook · from Gym hooks",
  canOpen: true,
};

const DISCOVER: SavedRowData = {
  id: "sv-video",
  kind: "video",
  text: "There's a wave of $100,000 challenges",
  line: "Video · saved in Discover",
  canOpen: false,
  href: "https://videos.example/nia.tests/1",
};

/** An old piece with neither a chat nor an address, as the container draws it: just its kind. */
const PLAIN: SavedRowData = {
  id: "sv-old",
  kind: "hooks",
  text: "A hook saved before pieces knew their chat",
  line: "Hook",
  canOpen: false,
};

function renderRow(item: SavedRowData) {
  const onOpen = vi.fn();
  const onRemove = vi.fn();
  const onUndo = vi.fn();
  const view = render(
    <ul>
      <SavedRow item={item} onOpen={onOpen} onRemove={onRemove} onUndo={onUndo} />
    </ul>,
  );
  return { onOpen, onRemove, onUndo, ...view };
}

// "Removed. Undo" is a line in the list, in the piece's place.
describe("SavedRow — a piece just removed", () => {
  const REMOVED: SavedRowData = { ...HOOK, state: "removed" };

  it("is a quiet line in its place: \"Removed.\", announced, and Undo named for the piece", () => {
    const { container, onUndo, onOpen, onRemove } = renderRow(REMOVED);
    expect(screen.getByRole("status")).toHaveTextContent("Removed.");
    expect(screen.getByText("Removed.", { ignore: '[role="status"]' })).toBeInTheDocument();
    const undo = screen.getByRole("button", { name: "Undo: Stop scrolling if you lift at 5am" });
    expect(undo).toHaveTextContent("Undo");
    // 44 to tap, drawn 44 tall.
    expect(undo.className).toContain("tap-44");
    expect(undo.className).toContain("h-11");
    // The piece is not offered while it is going: no opening, no second Remove.
    expect(screen.queryByRole("button", { name: "Stop scrolling if you lift at 5am" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove from saved" })).toBeNull();
    expect(container.querySelector('[data-part="mark"]')).toBeNull();

    fireEvent.click(undo);
    expect(onUndo).toHaveBeenCalledWith("sv-hook");
    expect(onOpen).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("keeps a row's height, so the list does not move under the creator", () => {
    const { container } = renderRow(REMOVED);
    expect(container.querySelector('[data-part="removed"]')!.className).toContain("min-h-[72px]");
  });

  it("has no axe violations", async () => {
    const { container } = renderRow(REMOVED);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("SavedRow — a piece whose removal failed", () => {
  const FAILED: SavedRowData = { ...HOOK, state: "failed" };

  it("is back as it was, with its quiet line reading \"Couldn't remove it.\", announced", () => {
    const { onOpen } = renderRow(FAILED);
    const row = screen.getByRole("button", { name: "Stop scrolling if you lift at 5am" });
    expect(row).toHaveAccessibleDescription("Couldn't remove it.");
    expect(screen.getByRole("status")).toHaveTextContent("Couldn't remove it.");
    expect(screen.getByRole("button", { name: "Remove from saved" })).toBeInTheDocument();
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledWith("sv-hook");
  });

  it("has no axe violations", async () => {
    const { container } = renderRow(FAILED);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("SavedRow — its announcements", () => {
  it("a row's status region is there before anything is said, so a change is announced", () => {
    renderRow(HOOK);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("it stays the same element whichever way the row is drawn (a new one would not be announced)", () => {
    const { rerender, onOpen, onRemove, onUndo } = renderRow(HOOK);
    const region = screen.getByRole("status");
    const draw = (item: SavedRowData) =>
      rerender(
        <ul>
          <SavedRow item={item} onOpen={onOpen} onRemove={onRemove} onUndo={onUndo} />
        </ul>,
      );
    draw({ ...HOOK, state: "removed" });
    expect(screen.getByRole("status")).toBe(region);
    expect(region).toHaveTextContent("Removed.");
    draw({ ...HOOK, state: "failed" });
    expect(screen.getByRole("status")).toBe(region);
    expect(region).toHaveTextContent("Couldn't remove it.");
  });

  // A row whose delete was refused comes back as a new element. Its region is drawn
  // empty and says its line only once it is on the page: a region that appears already holding its
  // text is often not announced.
  it("a row that appears saying something draws its region empty, and says it once it is on the page", () => {
    const drawn = renderToStaticMarkup(
      <ul>
        <SavedRow item={{ ...HOOK, state: "failed" }} onOpen={() => {}} onRemove={() => {}} />
      </ul>,
    );
    expect(drawn).toContain('<span role="status" class="sr-only"></span>');
    // Its visible line says it from the start.
    expect(drawn).toContain("Couldn&#x27;t remove it.");

    renderRow({ ...HOOK, state: "failed" });
    expect(screen.getByRole("status")).toHaveTextContent("Couldn't remove it.");
  });
});

describe("SavedRow — a piece that opens its chat", () => {
  it("is one button, named by the piece's text and described by its line; a tap opens it", () => {
    const { onOpen } = renderRow(HOOK);
    const row = screen.getByRole("button", { name: "Stop scrolling if you lift at 5am" });
    expect(row).toHaveAccessibleDescription("Hook · from Gym hooks");
    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledWith("sv-hook");
  });
});

describe("SavedRow — a video saved in Discover with its address", () => {
  it("is one link to the video's address, in a new tab, named by its caption", () => {
    const { onOpen } = renderRow(DISCOVER);
    const link = screen.getByRole("link", { name: "There's a wave of $100,000 challenges" });
    expect(link).toHaveAttribute("href", "https://videos.example/nia.tests/1");
    expect(link).toHaveAttribute("target", "_blank");
    // The new tab gets no hold on Library, nor where the creator came from.
    expect(link.getAttribute("rel")?.split(" ")).toEqual(expect.arrayContaining(["noopener", "noreferrer"]));
    // The line as drawn, and (to a screen reader) that it leaves for a new tab.
    expect(screen.getByText("Video · saved in Discover")).toBeInTheDocument();
    // (Without styles, the test's description walker puts a space before the hidden inline part;
    // a browser does not. The words are what is pinned.)
    expect(link).toHaveAccessibleDescription(/^Video · saved in Discover ?, opens in a new tab$/);
    // Not a button too: the only button is Remove.
    expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Remove from saved"]);
    // A tap follows the link and does nothing else: it is not also the row's opening of a chat.
    // (The test's browser is kept from leaving for the address.)
    const stay = (event: Event) => event.preventDefault();
    document.addEventListener("click", stay);
    try {
      fireEvent.click(link);
    } finally {
      document.removeEventListener("click", stay);
    }
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("its link covers the row, as a chat row's button does, under the Remove control", () => {
    renderRow(DISCOVER);
    const link = screen.getByRole("link", { name: "There's a wave of $100,000 challenges" });
    expect(link.className).toContain("after:absolute");
    expect(link.className).toContain("after:inset-0");
    expect(screen.getByRole("button", { name: "Remove from saved" }).className).toContain("z-[1]");
  });
});

describe("SavedRow — a piece with nowhere to open", () => {
  it("is plain text: neither a button nor a link", () => {
    renderRow(PLAIN);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button", { name: "A hook saved before pieces knew their chat" })).toBeNull();
    expect(screen.getByText("A hook saved before pieces knew their chat")).toBeInTheDocument();
    expect(screen.getByText("Hook")).toBeInTheDocument();
  });

  it("shows its text in full up to six lines (it cannot be opened to read the rest); a row that opens keeps two", () => {
    const textOf = (text: string) => screen.getByText(text).className.split(/\s+/);
    renderRow(PLAIN);
    expect(textOf(PLAIN.text)).toContain("line-clamp-6");
    expect(textOf(PLAIN.text)).not.toContain("line-clamp-2");
    // Nothing on it says "tap me": no row-wide hit area.
    expect(screen.getByText(PLAIN.text).closest("li")!.querySelector('[class*="after:absolute"]')).toBeNull();
    cleanup();
    renderRow(HOOK);
    expect(textOf(HOOK.text)).toContain("line-clamp-2");
    expect(textOf(HOOK.text)).not.toContain("line-clamp-6");
    cleanup();
    renderRow(DISCOVER);
    expect(textOf(DISCOVER.text)).toContain("line-clamp-2");
  });

  it("an address is not taken from a piece that opens its chat: the chat wins", () => {
    renderRow({ ...HOOK, href: "https://videos.example/nia.tests/2" });
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("button", { name: "Stop scrolling if you lift at 5am" })).toBeInTheDocument();
  });
});

describe("SavedRow — Remove from saved", () => {
  it.each([
    ["opens its chat", HOOK],
    ["opens its address", DISCOVER],
    ["opens nothing", PLAIN],
  ])("on a piece that %s: named, described by the piece's text, and it removes only", (_, item) => {
    const { onOpen, onRemove } = renderRow(item);
    const remove = screen.getByRole("button", { name: "Remove from saved" });
    expect(remove).toHaveAccessibleDescription(item.text);
    fireEvent.click(remove);
    expect(onRemove).toHaveBeenCalledWith(item.id);
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe("SavedRow — the mark and the rules", () => {
  it("shows the mark of its kind", () => {
    const { container } = renderRow(DISCOVER);
    expect(container.querySelector('[data-part="mark"]')).toHaveAttribute("data-kind", "video");
  });

  it.each([
    ["opens its chat", HOOK],
    ["opens its address", DISCOVER],
    ["opens nothing", PLAIN],
  ])("has no axe violations on a piece that %s", async (_, item) => {
    const { container } = renderRow(item);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});
