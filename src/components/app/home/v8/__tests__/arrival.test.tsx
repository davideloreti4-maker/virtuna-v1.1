/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArrivalV8 } from "../arrival";

vi.mock("@/hooks/queries/use-profile", () => ({
  useProfile: () => ({ data: { name: "Lena Example" } }),
}));

describe("ArrivalV8", () => {
  it("greets by first name, always — the welcome no longer swaps out for a shelf label", () => {
    // Owner ruling 2026-08-11 r4. The h1 used to BECOME "Tonight's remixes." once drops existed,
    // so the screen a creator normally meets had no welcome at all. The shelf label lives in
    // `drop-shelf.tsx` now; this block is the greeting and only the greeting.
    render(<ArrivalV8 />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toMatch(/^(Welcome back|Good (morning|afternoon|evening)), Lena\.$/);
    expect(screen.queryByText(/Proven videos/)).toBeNull();
    expect(screen.queryByText(/Tonight/)).toBeNull();
  });

  it("carries the brand mark, in cream — not the accent it defaults to", () => {
    // The mark is a sanctioned accent use, but the sidebar already spends the one allowed accent
    // element on this same screen (dosage LOCKED), so the welcome's mark inherits chrome cream.
    const { container } = render(<ArrivalV8 />);
    const mark = container.querySelector("svg");
    expect(mark).not.toBeNull();
    expect(mark?.getAttribute("class")).toContain("text-foreground");
    expect(mark?.getAttribute("class")).not.toContain("--color-accent");
  });
});
