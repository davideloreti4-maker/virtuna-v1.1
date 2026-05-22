/** @vitest-environment happy-dom */
/**
 * Phase 11 D-02 signal availability chip tests — updated Phase 13 Plan 02 (D-30).
 *
 * Changes from Phase 11:
 * - Three-state: available=✓ (success), disabled=✕ (default, line-through), failed=⚠ (warning)
 * - ml and retrieval are always DISABLED (DISABLED_THIS_PHASE set) regardless of availability value
 * - false availability → ⚠ "failed" (not ✕ "disabled") for non-DISABLED_THIS_PHASE signals
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SignalAvailabilityChips } from "../signal-availability-chips";
import type { SignalAvailability } from "@/lib/engine/types";

describe("SignalAvailabilityChips", () => {
  const allAvailable: SignalAvailability = {
    behavioral: true,
    gemini: true,
    ml: true,        // D-14: DISABLED_THIS_PHASE — always shows ✕ regardless of value
    rules: true,
    trends: true,
    content_type: true,
    niche: true,
    gemini_hook: true,
    gemini_body: true,
    gemini_cta: true,
    personas: true,
    audio: true,
    retrieval: true, // D-15: DISABLED_THIS_PHASE — always shows ✕ regardless of value
  };

  it("renders 4 chip badges", () => {
    const { container } = render(
      <SignalAvailabilityChips signalAvailability={allAvailable} />
    );
    const badges = container.querySelectorAll('[data-testid="signal-availability-chips"] .inline-flex');
    expect(badges.length).toBe(4);
  });

  it("renders available chips with ✓ for non-disabled signals (audio, personas)", () => {
    render(<SignalAvailabilityChips signalAvailability={allAvailable} />);
    expect(screen.getByText("Audio ✓")).toBeInTheDocument();
    expect(screen.getByText("Personas ✓")).toBeInTheDocument();
  });

  it("ml and retrieval always show ✕ (DISABLED_THIS_PHASE) even when availability=true", () => {
    render(<SignalAvailabilityChips signalAvailability={allAvailable} />);
    expect(screen.getByText("ML ✕")).toBeInTheDocument();
    expect(screen.getByText("Retrieval ✕")).toBeInTheDocument();
  });

  it("false availability on non-disabled signals shows ⚠ (failed), not ✕", () => {
    const noneAvailable: SignalAvailability = {
      ...allAvailable,
      audio: false,
      personas: false,
    };
    render(<SignalAvailabilityChips signalAvailability={noneAvailable} />);
    expect(screen.getByText("Audio ⚠")).toBeInTheDocument();
    expect(screen.getByText("Personas ⚠")).toBeInTheDocument();
    // ml and retrieval still ✕ (disabled)
    expect(screen.getByText("ML ✕")).toBeInTheDocument();
    expect(screen.getByText("Retrieval ✕")).toBeInTheDocument();
  });

  it("treats undefined key as failed (⚠) for non-disabled signals", () => {
    const partialAvailability: SignalAvailability = {
      ...allAvailable,
      ml: true,
    };
    delete (partialAvailability as Record<string, unknown>).audio;
    delete (partialAvailability as Record<string, unknown>).retrieval;

    render(<SignalAvailabilityChips signalAvailability={partialAvailability} />);
    // Audio undefined → failed ⚠ (not in DISABLED_THIS_PHASE)
    expect(screen.getByText("Audio ⚠")).toBeInTheDocument();
    // ML true but in DISABLED_THIS_PHASE → ✕
    expect(screen.getByText("ML ✕")).toBeInTheDocument();
    // Retrieval undefined but in DISABLED_THIS_PHASE → ✕
    expect(screen.getByText("Retrieval ✕")).toBeInTheDocument();
  });

  it("renders chips in order: Audio, Personas, Retrieval, ML", () => {
    const { container } = render(
      <SignalAvailabilityChips signalAvailability={allAvailable} />
    );
    const chipLabels = container.querySelectorAll('[data-testid="signal-availability-chips"] .inline-flex');
    expect(chipLabels[0].textContent).toContain("Audio");
    expect(chipLabels[1].textContent).toContain("Personas");
    expect(chipLabels[2].textContent).toContain("Retrieval");
    expect(chipLabels[3].textContent).toContain("ML");
  });
});
