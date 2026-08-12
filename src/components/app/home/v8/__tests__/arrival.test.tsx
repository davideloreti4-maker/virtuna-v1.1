/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ArrivalV8 } from "../arrival";
import { GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import type { Audience } from "@/lib/audience/audience-types";

vi.mock("@/hooks/queries/use-profile", () => ({
  useProfile: () => ({ data: { name: "Lena Example" } }),
}));

const audience: Audience = { ...GENERAL_AUDIENCE, name: "Your audience" };

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

  /**
   * The room line (owner ruling 2026-08-13). MEASURED at 393×852 before it existed: the phone's
   * first screen was hamburger · mark · greeting · one caption · four cards, and the only thing
   * naming the audience was the dock's plate at y=1,133 — which states the CREATOR's handle, not
   * the room. Same argument r3 accepted for the desktop rail, on the viewport that needs it more.
   */
  it("names the room under the greeting — the same facts the rail header states", () => {
    render(<ArrivalV8 audience={audience} onOpenRoom={() => {}} />);
    const line = screen.getByTestId("arrival-room-line");
    // Composed from `audienceToMeta`, so the phone and the rail can never state different rooms.
    // General ⇒ "baseline", the honest badge — this line must not upgrade it to "calibrated".
    expect(line.textContent).toContain("1,000 viewers");
    expect(line.textContent).toContain("baseline");
    expect(line.textContent).toContain("simulating for TikTok");
  });

  it("hides itself at ≥xl, where the rail already states these facts verbatim", () => {
    // Printing the same sentence twice on one screen is what the foot chip's
    // `showName={!useHeader && !useRail}` rule exists to prevent.
    render(<ArrivalV8 audience={audience} onOpenRoom={() => {}} />);
    expect(screen.getByTestId("arrival-room-line").className).toContain("xl:hidden");
  });

  it("is a DOOR into the room, not a label", () => {
    const onOpenRoom = vi.fn();
    render(<ArrivalV8 audience={audience} onOpenRoom={onOpenRoom} />);
    const line = screen.getByTestId("arrival-room-line");
    expect(line.tagName).toBe("BUTTON");
    fireEvent.click(line);
    expect(onOpenRoom).toHaveBeenCalledTimes(1);
  });

  it("renders static text when nothing can open the room — never a control that does nothing", () => {
    render(<ArrivalV8 audience={audience} />);
    expect(screen.getByTestId("arrival-room-line").tagName).toBe("P");
  });

  it("says nothing about a room it has no audience for", () => {
    // A fabricated headcount is worse than silence; the welcome renders alone.
    render(<ArrivalV8 />);
    expect(screen.queryByTestId("arrival-room-line")).toBeNull();
  });

  it("spends no accent — the dosage rule is LOCKED and this is not a sanctioned use", () => {
    const { container } = render(<ArrivalV8 audience={audience} onOpenRoom={() => {}} />);
    const line = container.querySelector('[data-testid="arrival-room-line"]');
    expect(line?.className).toContain("text-foreground-muted");
    expect(line?.className).not.toMatch(/accent|coral/);
  });
});
