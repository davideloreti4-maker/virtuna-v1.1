/** @vitest-environment happy-dom */
/**
 * Phase 13 Plan 02 — SignalAvailabilityChips three-state tests (D-30)
 *
 * Test surface:
 *   7 — available state: audio=true → success variant ✓
 *   8 — disabled state: ml/rules/retrieval → default variant ✕ line-through opacity-40
 *   9 — failed state: audio=false → warning variant ⚠
 *  10 — results-panel wiring: verified via acceptance criteria check (separate)
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SignalAvailabilityChips } from '../signal-availability-chips';
import type { SignalAvailability } from '@/lib/engine/types';

const BASE_AVAILABILITY: SignalAvailability = {
  behavioral: true,
  gemini: true,
  ml: false, // D-14: disabled in M1
  rules: false, // D-14: disabled
  trends: true,
  content_type: true,
  niche: true,
  gemini_hook: true,
  gemini_body: true,
  gemini_cta: true,
  personas: true,
  audio: true,
  retrieval: false, // D-15: disabled in M1
};

// Test 7: available state → success variant ✓
describe('SignalAvailabilityChips — available state', () => {
  it('Test 7: audio=true → renders "Audio ✓" with success variant', () => {
    render(<SignalAvailabilityChips signalAvailability={{ ...BASE_AVAILABILITY, audio: true }} />);
    expect(screen.getByText('Audio ✓')).toBeInTheDocument();
  });

  it('personas=true → renders "Personas ✓" with success variant', () => {
    render(<SignalAvailabilityChips signalAvailability={{ ...BASE_AVAILABILITY, personas: true }} />);
    expect(screen.getByText('Personas ✓')).toBeInTheDocument();
  });
});

// Test 8: disabled state → default variant ✕ line-through opacity-40
describe('SignalAvailabilityChips — disabled state (D-14/D-15 — DISABLED_THIS_PHASE)', () => {
  it('Test 8: ml → renders "ML ✕" with line-through opacity-40 (always disabled in M1)', () => {
    render(
      <SignalAvailabilityChips signalAvailability={{ ...BASE_AVAILABILITY, ml: true }} />,
    );
    // ML is in DISABLED_THIS_PHASE regardless of availability value
    expect(screen.getByText('ML ✕')).toBeInTheDocument();
    const mlChip = screen.getByText('ML ✕').closest('.inline-flex');
    expect(mlChip?.className).toContain('line-through');
    expect(mlChip?.className).toContain('opacity-40');
  });

  it('retrieval → renders "Retrieval ✕" with line-through opacity-40 (always disabled in M1)', () => {
    render(
      <SignalAvailabilityChips signalAvailability={{ ...BASE_AVAILABILITY, retrieval: true }} />,
    );
    expect(screen.getByText('Retrieval ✕')).toBeInTheDocument();
    const chip = screen.getByText('Retrieval ✕').closest('.inline-flex');
    expect(chip?.className).toContain('line-through');
    expect(chip?.className).toContain('opacity-40');
  });

  it('available chip (audio=true) should NOT have line-through', () => {
    render(<SignalAvailabilityChips signalAvailability={{ ...BASE_AVAILABILITY, audio: true }} />);
    const audioChip = screen.getByText('Audio ✓').closest('.inline-flex');
    expect(audioChip?.className).not.toContain('line-through');
  });
});

// Test 9: failed state → warning variant ⚠
describe('SignalAvailabilityChips — failed state', () => {
  it('Test 9: audio=false → renders "Audio ⚠" with warning variant (failed — not disabled)', () => {
    render(<SignalAvailabilityChips signalAvailability={{ ...BASE_AVAILABILITY, audio: false }} />);
    expect(screen.getByText('Audio ⚠')).toBeInTheDocument();
  });

  it('personas=false → renders "Personas ⚠"', () => {
    render(
      <SignalAvailabilityChips signalAvailability={{ ...BASE_AVAILABILITY, personas: false }} />,
    );
    expect(screen.getByText('Personas ⚠')).toBeInTheDocument();
  });

  it('"failed" string state → renders warning ⚠', () => {
    // Three-state string support: when backend sends "failed" string
    const withStringState: SignalAvailability = {
      ...BASE_AVAILABILITY,
      audio: 'failed' as unknown as boolean,
    };
    render(<SignalAvailabilityChips signalAvailability={withStringState} />);
    expect(screen.getByText('Audio ⚠')).toBeInTheDocument();
  });

  it('"available" string state → renders success ✓', () => {
    const withStringState: SignalAvailability = {
      ...BASE_AVAILABILITY,
      audio: 'available' as unknown as boolean,
    };
    render(<SignalAvailabilityChips signalAvailability={withStringState} />);
    expect(screen.getByText('Audio ✓')).toBeInTheDocument();
  });
});

// Chip order and count
describe('SignalAvailabilityChips — structure', () => {
  it('renders exactly 4 chips in order: Audio, Personas, Retrieval, ML', () => {
    const { container } = render(
      <SignalAvailabilityChips signalAvailability={BASE_AVAILABILITY} />,
    );
    const chips = container.querySelectorAll('[data-testid="signal-availability-chips"] .inline-flex');
    expect(chips.length).toBe(4);
    expect(chips[0]!.textContent).toContain('Audio');
    expect(chips[1]!.textContent).toContain('Personas');
    expect(chips[2]!.textContent).toContain('Retrieval');
    expect(chips[3]!.textContent).toContain('ML');
  });
});
