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
const pill = (name: string) =>
  field()
    .getAllByRole("button", { name })
    .find((b) => b.getAttribute("type") !== "submit")!;

describe("/dev/field placeholders", () => {
  it("are the composer's, for every pill and at rest", () => {
    render(<DevField state="rest" withBrief={false} />);
    expect(text().placeholder).toBe(NEXT_PLACEHOLDER_BY_TOOL.chat);
    for (const [name, tool] of [
      ["Hooks", "hooks"],
      ["Script", "script"],
      ["Remix", "remix"],
    ] as const) {
      fireEvent.click(pill(name));
      expect(text().placeholder).toBe(NEXT_PLACEHOLDER_BY_TOOL[tool]);
      fireEvent.click(pill(name)); // back to chat
    }
    fireEvent.click(pill("Simulate"));
    expect(text().placeholder).toBe(NEXT_SIMULATE_PLACEHOLDER.empty);
  });

  it("the Script placeholder is the shipped one", () => {
    render(<DevField state="rest" withBrief={false} />);
    fireEvent.click(pill("Script"));
    expect(text().placeholder).toBe("What the script is about");
  });
});
