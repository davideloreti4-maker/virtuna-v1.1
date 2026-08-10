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

  it("shelfReady → the shelf headline + whisper — the NAME stays on the greeting only", () => {
    render(<ArrivalV8 shelfReady />);
    // "Tonight's remixes, Lena." was an owner-flagged defect (2026-08-10): the name
    // belongs to the greeting voice-moment, never the shelf headline.
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Tonight's remixes.");
    expect(screen.getByText("Proven videos · rebuilt for your niche")).toBeInTheDocument();
  });
});
