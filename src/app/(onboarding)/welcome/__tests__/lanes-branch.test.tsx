/** @vitest-environment happy-dom */
/**
 * The day-0 lanes door on ConnectStep (v8 Phase 5).
 *
 * The door is driven by the PRESENCE of `onNotSure`, not by reading the flag inside the
 * component — that is what keeps flag-off byte-identical, and it is what this locks.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConnectStep } from "@/components/onboarding/connect-step";

vi.mock("@/stores/onboarding-store", () => ({
  useOnboardingStore: () => ({ tiktokHandle: "", setTiktokHandle: vi.fn() }),
}));

describe("ConnectStep — the lanes door", () => {
  it("shows no lanes door when onNotSure is absent (flag-off is byte-identical)", () => {
    render(<ConnectStep initialDoor="target" onDraftReady={() => {}} />);
    expect(screen.queryByRole("button", { name: /not sure yet/i })).toBeNull();
  });

  it("shows the lanes door on the describe side when onNotSure is given", () => {
    render(<ConnectStep initialDoor="target" onDraftReady={() => {}} onNotSure={() => {}} />);
    expect(screen.getByRole("button", { name: /not sure yet/i })).toBeTruthy();
  });

  it("never shows the lanes door on the handle side — a handle IS the answer", () => {
    render(<ConnectStep initialDoor="personal" onDraftReady={() => {}} onNotSure={() => {}} />);
    expect(screen.queryByRole("button", { name: /not sure yet/i })).toBeNull();
  });

  it("calls onNotSure when the door is taken", () => {
    const onNotSure = vi.fn();
    render(<ConnectStep initialDoor="target" onDraftReady={() => {}} onNotSure={onNotSure} />);
    screen.getByRole("button", { name: /not sure yet/i }).click();
    expect(onNotSure).toHaveBeenCalledOnce();
  });
});
