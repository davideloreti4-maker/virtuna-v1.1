/** @vitest-environment happy-dom */
/**
 * The thread's loading outline under the new look (thread answers step 1, Task 6): the answer's
 * label is the new one (the mark and "Maven" in the secondary ink, sentence case), never the
 * legacy uppercase "MAVEN" eyebrow. It is a placeholder, so the label is not a heading.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { ThreadLoadingSkeleton } from "../thread-loading";

afterEach(() => cleanup());

describe("ThreadLoadingSkeleton, flag on", () => {
  it.each(["chat", "skill"] as const)("%s: the new answer label, no legacy caps, no heading", (variant) => {
    render(<ThreadLoadingSkeleton variant={variant} caption="Opening thread…" />);
    const skeleton = screen.getByTestId("thread-loading-skeleton");
    const label = within(skeleton).getByText("Maven");
    expect(label.className).not.toContain("uppercase");
    expect(label.className).toContain("text-foreground-secondary");
    expect(label.querySelector("svg")).not.toBeNull(); // the mark
    expect(within(skeleton).queryByRole("heading")).toBeNull();
    expect(within(skeleton).getByTestId("thread-loading-caption")).toHaveTextContent("Opening thread…");
  });
});
