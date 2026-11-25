import { describe, expect, it } from "vitest";
import { DRAWER_WORDS } from "../drawer-words";

describe("DRAWER_WORDS", () => {
  it("holds the three new words", () => {
    expect(DRAWER_WORDS).toEqual({ openMenu: "Open menu", menu: "Menu", allChats: "All chats" });
  });
});
