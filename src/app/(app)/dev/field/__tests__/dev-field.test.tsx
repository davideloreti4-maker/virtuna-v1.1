/** @vitest-environment happy-dom */
/**
 * /dev/field shows the field with the composer's own placeholders (final review 8: the page had
 * drifted, "A topic to script"). The real DevField, the real ThreadField; nothing is sent.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { NEXT_PLACEHOLDER_BY_TOOL, NEXT_SIMULATE_PLACEHOLDER } from "@/components/thread-next/field-copy";
import { DevField } from "../dev-field";

afterEach(cleanup);

const field = () => within(screen.getByTestId("thread-field"));
const text = () => field().getByRole("textbox") as HTMLTextAreaElement;
/** Picks a skill as a creator does: Skills (or the picked tag), then its row in the menu. */
const pick = (name: string) => {
  const opener = field().queryByRole("button", { name: "Skills" }) ?? field().getAllByRole("button").find((b) => b.getAttribute("aria-haspopup") === "dialog" && !b.getAttribute("aria-label")?.startsWith("Audience"))!;
  fireEvent.click(opener);
  fireEvent.click(within(screen.getByRole("dialog", { name: "Skills" })).getByRole("button", { name }));
};
const unpick = (name: string) => fireEvent.click(field().getByRole("button", { name: `Remove ${name}` }));

describe("/dev/field placeholders", () => {
  it("are the composer's, for every skill and at rest", () => {
    render(<DevField state="rest" withBrief={false} />);
    expect(text().placeholder).toBe(NEXT_PLACEHOLDER_BY_TOOL.chat);
    for (const [name, tool] of [
      ["Hooks", "hooks"],
      ["Script", "script"],
      ["Remix", "remix"],
    ] as const) {
      pick(name);
      expect(text().placeholder).toBe(NEXT_PLACEHOLDER_BY_TOOL[tool]);
      unpick(name); // back to chat
    }
    pick("Simulate");
    expect(text().placeholder).toBe(NEXT_SIMULATE_PLACEHOLDER.empty);
  });

  it("the Script placeholder is the shipped one", () => {
    render(<DevField state="rest" withBrief={false} />);
    pick("Script");
    expect(text().placeholder).toBe("What the script is about");
  });
});
