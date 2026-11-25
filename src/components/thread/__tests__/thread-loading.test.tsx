/** @vitest-environment happy-dom */
/**
 * The thread's loading outline with the flag off: the legacy uppercase "Maven" eyebrow, unchanged.
 * The flag-on label is held by thread-loading.flag-on.test.tsx.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { ThreadLoadingSkeleton } from "../thread-loading";

afterEach(() => cleanup());

describe("ThreadLoadingSkeleton, flag off", () => {
  it("runs with the flag off", () => {
    expect(NEW_LOOK_ENABLED).toBe(false);
  });

  it.each(["chat", "skill"] as const)("%s: the legacy eyebrow", (variant) => {
    render(<ThreadLoadingSkeleton variant={variant} />);
    const label = within(screen.getByTestId("thread-loading-skeleton")).getByText("Maven");
    expect(label.tagName).toBe("SPAN");
    expect(label.className).toContain("uppercase");
    expect(label.querySelector("svg")).toBeNull();
  });
});
