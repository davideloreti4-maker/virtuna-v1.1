/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SignalAvailabilityChips } from "../signal-availability-chips";
import type { SignalAvailability } from "@/lib/engine/types";

describe("SignalAvailabilityChips", () => {
  const allAvailable: SignalAvailability = {
    behavioral: true,
    gemini: true,
    ml: true,
    rules: true,
    trends: true,
    content_type: true,
    niche: true,
    gemini_hook: true,
    gemini_body: true,
    gemini_cta: true,
    personas: true,
    audio: true,
    retrieval: true,
  };

  it("renders 4 chip badges", () => {
    const { container } = render(
      <SignalAvailabilityChips signalAvailability={allAvailable} />
    );
    const badges = container.querySelectorAll('[data-testid="signal-availability-chips"] .inline-flex');
    expect(badges.length).toBe(4);
  });

  it("renders available chips with ✓ and success variant", () => {
    render(<SignalAvailabilityChips signalAvailability={allAvailable} />);
    expect(screen.getByText("Audio ✓")).toBeInTheDocument();
    expect(screen.getByText("Personas ✓")).toBeInTheDocument();
    expect(screen.getByText("Retrieval ✓")).toBeInTheDocument();
    expect(screen.getByText("ML ✓")).toBeInTheDocument();
  });

  it("renders unavailable chips with ✕ and line-through opacity-40", () => {
    const noneAvailable: SignalAvailability = {
      ...allAvailable,
      audio: false,
      personas: false,
      retrieval: false,
      ml: false,
    };
    const { container } = render(
      <SignalAvailabilityChips signalAvailability={noneAvailable} />
    );
    expect(screen.getByText("Audio ✕")).toBeInTheDocument();
    expect(screen.getByText("Personas ✕")).toBeInTheDocument();
    expect(screen.getByText("Retrieval ✕")).toBeInTheDocument();
    expect(screen.getByText("ML ✕")).toBeInTheDocument();

    const chips = container.querySelectorAll('[data-testid="signal-availability-chips"] .inline-flex');
    chips.forEach((chip) => {
      expect(chip.className).toContain("line-through");
      expect(chip.className).toContain("opacity-40");
    });
  });

  it("treats undefined key as unavailable", () => {
    const partialAvailability: SignalAvailability = {
      ...allAvailable,
      ml: true,
    };
    delete (partialAvailability as any).audio;
    delete (partialAvailability as any).retrieval;

    render(<SignalAvailabilityChips signalAvailability={partialAvailability} />);
    expect(screen.getByText("Audio ✕")).toBeInTheDocument();
    expect(screen.getByText("ML ✓")).toBeInTheDocument();
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
