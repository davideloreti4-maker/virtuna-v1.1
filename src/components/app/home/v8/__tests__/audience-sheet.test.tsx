/** @vitest-environment happy-dom */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AudienceSheetV8 } from "../audience-sheet";
import type { Audience } from "@/lib/audience/audience-types";

beforeEach(() => {
  window.matchMedia = ((q: string) => ({
    matches: true,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

const mk = (over: Partial<Audience>): Audience =>
  ({
    id: "a1",
    name: "@lena.moves",
    platform: "tiktok",
    is_general: false,
    is_preset: false,
    source_account_id: "acct-1",
    type: "personal",
    mode: "socials",
    personas: [],
    ...over,
  }) as unknown as Audience;

const base = {
  open: true,
  onClose: vi.fn(),
  lens: "tiktok" as const,
  onLensChange: vi.fn(),
  note: null,
  onNewAudience: vi.fn(),
};

describe("AudienceSheetV8", () => {
  it("lists audiences with provenance and marks the selected one", () => {
    render(
      <AudienceSheetV8
        {...base}
        audiences={[mk({}), mk({ id: "a2", name: "Gym beginners", source_account_id: null })]}
        selectedAudienceId="a1"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("@lena.moves")).toBeInTheDocument();
    expect(screen.getByText("modeled on TikTok")).toBeInTheDocument();
    expect(screen.getByText("described by you")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /@lena\.moves/, selected: true }),
    ).toBeInTheDocument();
  });

  it("selecting a row hands back the Audience", () => {
    const onSelect = vi.fn();
    const a2 = mk({ id: "a2", name: "Gym beginners", source_account_id: null });
    render(
      <AudienceSheetV8
        {...base}
        audiences={[mk({}), a2]}
        selectedAudienceId="a1"
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText("Gym beginners"));
    expect(onSelect).toHaveBeenCalledWith(a2);
  });

  it("offers a new-audience door", () => {
    const onNewAudience = vi.fn();
    render(
      <AudienceSheetV8
        {...base}
        onNewAudience={onNewAudience}
        audiences={[mk({})]}
        selectedAudienceId="a1"
        onSelect={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("New audience"));
    expect(onNewAudience).toHaveBeenCalled();
  });

  it("the platform control is a lens with three surfaces and admits extrapolation", () => {
    const onLensChange = vi.fn();
    render(
      <AudienceSheetV8
        {...base}
        audiences={[mk({})]}
        selectedAudienceId="a1"
        onSelect={vi.fn()}
        onLensChange={onLensChange}
        note="calibrated on TikTok — extrapolating"
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Reels" }));
    expect(onLensChange).toHaveBeenCalledWith("instagram");
    expect(screen.getByText("calibrated on TikTok — extrapolating")).toBeInTheDocument();
  });
});
