/** @vitest-environment happy-dom */
/**
 * The desktop thread header (thread answers step 1, Task 6; drawing
 * `.scratch/next-look/part3/answers/answers.html`, `axDesk`: `.desk .top` with `.ax-sub2`): 68 tall,
 * 12 from the content's left edge, the thread's title, then "For {audience}" 10 after it in the
 * tertiary ink. No Share: nothing can be shared yet. Desktop only; the phone's header is the shell's.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { DesktopThreadHeader } from "../thread-header";

afterEach(() => cleanup());

describe("DesktopThreadHeader", () => {
  it("the title is the page heading, the audience follows it; md and up only, as drawn", () => {
    const { container } = render(<DesktopThreadHeader title="Meal prep for busy students" audience="@nia.tests" />);
    const row = container.firstElementChild as HTMLElement;
    expect(row.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["hidden", "md:flex", "h-[68px]", "shrink-0", "items-center", "gap-2.5", "pl-3", "pr-8"]),
    );
    const title = screen.getByRole("heading", { level: 1, name: "Meal prep for busy students" });
    expect(title.className.split(/\s+/)).toEqual(expect.arrayContaining(["text-title", "font-[640]", "truncate", "min-w-0"]));
    // Tracked as drawn, inline: the app-wide `h1 { letter-spacing: -0.02em }` is unlayered.
    expect(title.style.letterSpacing).toBe("-0.014em");
    const audience = screen.getByText("For @nia.tests");
    expect(audience.className.split(/\s+/)).toEqual(expect.arrayContaining(["text-body", "text-foreground-muted", "shrink-0"]));
    expect(title.compareDocumentPosition(audience) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull(); // no Share
  });

  // Fix round 1: the title takes the room it needs; only a full row truncates it (no cap of its own).
  it("the title has no width of its own: it grows with the row and truncates only when the row is full", () => {
    render(<DesktopThreadHeader title="Meal prep for busy students" audience="@nia.tests" />);
    const title = screen.getByRole("heading", { level: 1 });
    const classes = title.className.split(/\s+/);
    expect(classes.filter((c) => /^(max-w|w)-/.test(c))).toEqual([]);
    expect(classes).toEqual(expect.arrayContaining(["min-w-0", "truncate"]));
    expect(classes).not.toContain("flex-1"); // the audience stays right after it, not at the row's end
  });

  it("no audience: the title alone", () => {
    const { container } = render(<DesktopThreadHeader title="Meal prep for busy students" audience={null} />);
    expect(container.textContent).toBe("Meal prep for busy students");
  });
});
