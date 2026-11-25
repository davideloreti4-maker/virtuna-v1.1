/** @vitest-environment happy-dom */
/**
 * The ⌘K palette's opt-in `exactFirst` (plan 2026-11-24-you, final fix round B5): typing "You" and
 * Enter opened a chat, because chats whose title holds "you" are listed first. With the prop on, an
 * item whose title equals the query (case-blind, trimmed) is listed first, and its group first, so
 * Enter opens it. Without it the order is exactly today's. The real palette, rendered; the items are
 * shaped as the app's (`useCommandItems`): the chats, then the actions, then Go to.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CommandPalette, type CommandItem } from "../CommandPalette";

afterEach(cleanup);

function itemsWith(spy: (id: string) => void): CommandItem[] {
  const item = (id: string, title: string, group: string, subtitle?: string): CommandItem => ({
    id,
    title,
    group,
    subtitle,
    onSelect: () => spy(id),
  });
  return [
    item("thread-1", "What you should post this week", "Threads"),
    item("thread-2", "Why you stall at 1K", "Threads"),
    item("new-thread", "New thread", "Actions", "Start a fresh conversation"),
    item("new-audience", "New audience", "Actions"),
    item("audience", "Audience", "Go to", "Your calibrated audiences"),
    item("you", "You", "Go to"),
    item("settings", "Settings", "Go to"),
  ];
}

function open(exactFirst?: boolean) {
  const spy = vi.fn();
  render(<CommandPalette open onOpenChange={() => {}} items={itemsWith(spy)} placeholder="Search threads…" exactFirst={exactFirst} />);
  const search = (text: string) => fireEvent.change(screen.getByPlaceholderText("Search threads…"), { target: { value: text } });
  const enter = () => fireEvent.keyDown(screen.getByPlaceholderText("Search threads…"), { key: "Enter" });
  const options = () => screen.getAllByRole("option").map((o) => o.textContent);
  const groups = () => Array.from(screen.getByRole("listbox").children).map((g) => g.firstElementChild?.textContent);
  return { spy, search, enter, options, groups };
}

const TODAY_YOU = {
  groups: ["Threads", "Go to"],
  options: ["What you should post this week", "Why you stall at 1K", "AudienceYour calibrated audiences", "You"],
};

describe("CommandPalette: an exact name first", () => {
  it("off (the default): the order is exactly today's, and Enter opens the first chat", () => {
    const p = open();
    p.search("You");
    expect(p.groups()).toEqual(TODAY_YOU.groups);
    expect(p.options()).toEqual(TODAY_YOU.options);
    p.enter();
    expect(p.spy).toHaveBeenCalledWith("thread-1");
  });

  it("off, set false: the same; a query with spaces around it finds nothing, as today", () => {
    const p = open(false);
    p.search("you");
    expect(p.options()).toEqual(TODAY_YOU.options);
    p.search("  you  ");
    expect(screen.queryAllByRole("option")).toEqual([]);
    expect(screen.getByText("No commands found.")).toBeInTheDocument();
    p.search("you");
    p.enter();
    expect(p.spy).toHaveBeenCalledWith("thread-1");
  });

  it("on: the item named exactly is first and its group first; Enter opens it", () => {
    const p = open(true);
    p.search("You");
    expect(p.groups()).toEqual(["Go to", "Threads"]);
    expect(p.options()).toEqual(["You", "AudienceYour calibrated audiences", "What you should post this week", "Why you stall at 1K"]);
    p.enter();
    expect(p.spy).toHaveBeenCalledTimes(1);
    expect(p.spy).toHaveBeenCalledWith("you");
  });

  it("on: the match is case-blind and trimmed", () => {
    for (const text of ["you", "  yOU  ", "YOU "]) {
      cleanup();
      const p = open(true);
      p.search(text);
      expect(p.options()[0], text).toBe("You");
      p.enter();
      expect(p.spy, text).toHaveBeenCalledWith("you");
    }
  });

  it("on: with no title equal to the query, or no query, the order is today's", () => {
    const off = open();
    off.search("yo");
    const todayYo = { groups: off.groups(), options: off.options() };
    off.search("");
    const todayAll = { groups: off.groups(), options: off.options() };
    cleanup();
    const on = open(true);
    on.search("yo");
    expect({ groups: on.groups(), options: on.options() }).toEqual(todayYo);
    on.search("");
    expect({ groups: on.groups(), options: on.options() }).toEqual(todayAll);
    expect(todayAll.groups).toEqual(["Threads", "Actions", "Go to"]);
  });

  it("on: the other groups and items keep today's order behind it", () => {
    const off = open();
    off.search("audience");
    expect(off.groups()).toEqual(["Actions", "Go to"]);
    expect(off.options()).toEqual(["New audience", "AudienceYour calibrated audiences"]);
    cleanup();
    const on = open(true);
    on.search("audience");
    expect(on.groups()).toEqual(["Go to", "Actions"]);
    expect(on.options()).toEqual(["AudienceYour calibrated audiences", "New audience"]);
    on.enter();
    expect(on.spy).toHaveBeenCalledWith("audience");
  });
});
