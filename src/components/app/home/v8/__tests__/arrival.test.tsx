/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArrivalV8 } from "../arrival";

vi.mock("@/hooks/queries/use-profile", () => ({
  useProfile: () => ({ data: { name: "Lena Example" } }),
}));

describe("ArrivalV8", () => {
  it("defaults to the time greeting (no shelf promise before cards exist)", () => {
    render(<ArrivalV8 />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toMatch(/^(Welcome back|Good (morning|afternoon|evening)), Lena\.$/);
    expect(screen.queryByText(/Proven videos/)).toBeNull();
  });

  it("shelfReady → the shelf headline + whisper (only ever over real cards)", () => {
    render(<ArrivalV8 shelfReady />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Tonight's remixes, Lena.",
    );
    expect(screen.getByText("Proven videos · rebuilt for your niche")).toBeInTheDocument();
  });
});
