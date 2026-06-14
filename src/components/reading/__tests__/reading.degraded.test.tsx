/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PredictionResult } from '@/lib/engine/types';

import {
  makeReadingResult,
  makeUnavailableResult,
  makePartialResult,
  makeApolloNullResult,
} from './fixtures/reading-fixture';

// Drive the container with each D-13 degraded fixture via the mocked single source.
let mockState: { id: string | null; data: PredictionResult | null; isLoading: boolean } = {
  id: 'sim-1',
  data: makeReadingResult(),
  isLoading: false,
};
vi.mock('@/hooks/queries/use-permalink-analysis', () => ({
  usePermalinkAnalysis: () => mockState,
}));
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));

import { Reading } from '../reading';

beforeEach(() => {
  mockState = { id: 'sim-1', data: makeReadingResult(), isLoading: false };
});

describe('Reading container — D-13 honesty gate (degraded states)', () => {
  it('analysis_unavailable short-circuits BEFORE the gauge — the fabricated 0 never renders', () => {
    mockState = { id: 'sim-1', data: makeUnavailableResult(), isLoading: false };
    const { container } = render(<Reading />);

    // The dedicated "couldn't analyze" state.
    expect(screen.getByText(/We couldn.t analyze this video/i)).toBeInTheDocument();

    // The gauge (a role="img" "Score N of 100") is NOT rendered.
    expect(screen.queryByRole('img', { name: /Score \d+ of 100/ })).not.toBeInTheDocument();

    // The literal "0" does not appear in the score region (no gauge, no "0%").
    expect(container.querySelector('[data-testid="reading-hero"]')).toBeNull();
    expect(container.textContent ?? '').not.toMatch(/\b0\b/);
  });

  it('partial_analysis renders the "Partial read" annotation AND the full hero/rows still render', () => {
    mockState = { id: 'sim-1', data: makePartialResult(), isLoading: false };
    render(<Reading />);

    expect(screen.getByTestId('reading-partial')).toHaveTextContent(/Partial read/i);
    // Hero + rows still render (the partial flag annotates; it does not gate).
    expect(screen.getByRole('img', { name: /Score \d+ of 100/ })).toBeInTheDocument();
    expect(screen.getByTestId('driver-rows')).toBeInTheDocument();
  });

  it('apollo_reasoning null → gauge + gate still resolve from overall_score; rows/deeper degrade (no throw, no fabricated 0)', () => {
    mockState = {
      id: 'sim-1',
      data: makeApolloNullResult({ overall_score: 64 }),
      isLoading: false,
    };
    expect(() => render(<Reading />)).not.toThrow();

    // Hero gauge still resolves from overall_score (never null).
    expect(screen.getByRole('img', { name: /Score 64 of 100/ })).toBeInTheDocument();

    // DriverRows degrades to the "Not available" labels — never a fabricated 0.
    const rows = screen.getByTestId('driver-rows');
    expect(rows).toBeInTheDocument();
    expect(rows.textContent ?? '').toMatch(/Not available/);
    expect(rows.textContent ?? '').not.toMatch(/\b0\b/);

    // DeeperRead returns null when no dimensions → not in the document.
    expect(screen.queryByTestId('deeper-read')).not.toBeInTheDocument();
  });

  it('id present but data null (a real fetch failure) → the "didn\'t load" error state', () => {
    mockState = { id: 'sim-1', data: null, isLoading: false };
    render(<Reading />);
    expect(screen.getByTestId('reading-error')).toBeInTheDocument();
    expect(screen.getByText(/This Simulation didn.t load/i)).toBeInTheDocument();
  });

  it('no id and no data (the no-id /analyze composer route) → the Reading is inert (renders nothing)', () => {
    mockState = { id: null, data: null, isLoading: false };
    const { container } = render(<Reading />);
    // Inert: the Phase-1 composer shell owns the screen, not the Reading.
    expect(container.firstChild).toBeNull();
  });

  it('isLoading → a calm loading state (not an error, not a fabricated read)', () => {
    mockState = { id: 'sim-1', data: null, isLoading: true };
    render(<Reading />);
    expect(screen.getByTestId('reading-loading')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CR-01 — hero watch% must NEVER render a fabricated "0% watch" when watch-through
// is genuinely underivable (D-13 honesty contract). averageWatchThrough returns
// null on empty personas; the heatmap fallback (weighted_completion_pct) is itself
// genuinely absent on text / tiktok-url reads and on sub-threshold permalink rows.
// Both null paths must OMIT the caption — not show "0% watch" beside a real gauge.
// ─────────────────────────────────────────────────────────────────────────────
describe('Reading container — CR-01 hero watch% honesty (no fabricated 0% watch)', () => {
  it('empty personas + weighted_completion_pct null → NO "% watch" caption (scored read)', () => {
    // A scored read (gauge renders) but the watch-through is genuinely underivable:
    // no personas AND no weighted_completion_pct. Must NOT fabricate "0% watch".
    const heatmap = {
      segments: [],
      personas: [],
      weighted_curve: [],
      weights: {},
      weights_source: 'default',
      weighted_completion_pct: null,
      weighted_top_dropoff_t: null,
    } as unknown as PredictionResult['heatmap'];
    mockState = {
      id: 'sim-1',
      data: makeReadingResult({ overall_score: 64, heatmap }),
      isLoading: false,
    };
    render(<Reading />);

    // The gauge still resolves from overall_score — this is a real, scored read.
    expect(screen.getByRole('img', { name: /Score 64 of 100/ })).toBeInTheDocument();

    // The watch% caption is OMITTED — no testid, no "% watch" text, no "0".
    expect(screen.queryByTestId('reading-watch')).not.toBeInTheDocument();
    const hero = screen.getByTestId('reading-hero');
    expect(hero.textContent ?? '').not.toMatch(/% watch/i);
    expect(hero.textContent ?? '').not.toMatch(/0%/);
  });

  it('heatmap null on a scored read → NO "% watch" caption', () => {
    // heroWatchPct(null) → buildPersonaNodes(null) → [] → averageWatchThrough → null,
    // and the weighted_completion_pct fallback has no heatmap to read → null. Omit.
    mockState = {
      id: 'sim-1',
      data: makeReadingResult({ overall_score: 64, heatmap: null }),
      isLoading: false,
    };
    render(<Reading />);

    expect(screen.getByRole('img', { name: /Score 64 of 100/ })).toBeInTheDocument();
    expect(screen.queryByTestId('reading-watch')).not.toBeInTheDocument();
    const hero = screen.getByTestId('reading-hero');
    expect(hero.textContent ?? '').not.toMatch(/% watch/i);
    expect(hero.textContent ?? '').not.toMatch(/0%/);
  });

  it('still renders "% watch" on a healthy read (the guard is not vacuous)', () => {
    mockState = { id: 'sim-1', data: makeReadingResult(), isLoading: false };
    render(<Reading />);
    // The healthy fixture has personas → a real, non-null watch% caption renders.
    expect(screen.getByTestId('reading-watch')).toHaveTextContent(/% watch/i);
  });
});
