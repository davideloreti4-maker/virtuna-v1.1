/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PredictionResult } from '@/lib/engine/types';

import {
  makeReadingResult,
  makeUnavailableResult,
  makePartialResult,
  makeApolloNullResult,
  makeEmptyPersonasResult,
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
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false, useIsMobileHydrated: () => ({ isMobile: false, hydrated: true }) }));

// ThumbnailStrip reads usePermalinkFilmstrips() eagerly (top of tree) → mock so the
// container mounts without a QueryClientProvider. ReadingChat's useExpertChat is
// mocked inert so the degraded-state tests hit no network.
vi.mock('@/hooks/queries/use-permalink-filmstrips', () => ({
  usePermalinkFilmstrips: () => ({}),
}));
vi.mock('@/hooks/queries/use-expert-chat', () => ({
  useExpertChat: () => ({
    messages: [],
    streamingText: '',
    isStreaming: false,
    error: null,
    send: () => {},
    stop: () => {},
    clearMessages: () => {},
    loadHistory: async () => {},
  }),
}));
// The container reads the niche cohort (useComparisons) before the D-13 gates;
// mock it inert so even the degraded/error paths mount without a QueryClientProvider.
vi.mock('@/components/board/verdict/use-comparisons', () => ({
  useComparisons: () => ({ data: undefined }),
}));

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
    expect(screen.getByTestId('reading-accordion')).toBeInTheDocument();
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
    const rows = screen.getByTestId('reading-accordion');
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
    expect(screen.getByTestId('reading-skeleton')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// IN-FLIGHT gate — the placeholder row (overall_score:null + engine_version
// 'pending') is the row the composer's POST inserts BEFORE the ~57s pipeline
// finishes. The composer unmounts on the /home → /analyze/[id] nav (aborting its
// SSE), so the finished result reaches the Reading via usePermalinkAnalysis's
// poll, not the stream. While that row is in-flight the Reading must show the calm
// live state — NOT the "couldn't analyze" copy (the bug: the row's `'{}'`-default
// signal_availability derived analysis_unavailable=true), NOT a fabricated 0-gauge.
// ─────────────────────────────────────────────────────────────────────────────
describe('Reading container — in-flight (still processing) gate', () => {
  const makeInFlight = (over: Record<string, unknown> = {}) =>
    ({
      ...makeReadingResult(),
      overall_score: null,
      engine_version: 'pending',
      analysis_unavailable: false,
      ...over,
    }) as unknown as PredictionResult;

  it('processing:true → the calm live "Reading…" state (never CouldNotAnalyze, never a 0-gauge)', () => {
    mockState = { id: 'sim-1', data: makeInFlight({ processing: true }), isLoading: false };
    const { container } = render(<Reading />);

    expect(screen.getByTestId('reading-skeleton')).toBeInTheDocument();
    // NOT the failure copy, NOT the real thread, NOT a fabricated 0 gauge.
    expect(screen.queryByText(/We couldn.t analyze this video/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('reading')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Score \d+ of 100/ })).not.toBeInTheDocument();
    expect(container.querySelector('[data-testid="reading-hero"]')).toBeNull();
  });

  it('derives in-flight from null score + engine_version "pending" even without the processing flag', () => {
    // Older permalink shapes (pre-fix route) omit `processing`; the null+pending
    // discriminator still resolves to the live state.
    mockState = { id: 'sim-1', data: makeInFlight(), isLoading: false };
    render(<Reading />);
    expect(screen.getByTestId('reading-skeleton')).toBeInTheDocument();
  });

  it('a genuinely failed read (analysis_unavailable, NOT processing) still shows CouldNotAnalyze', () => {
    // The fix must not swallow the real failure state.
    mockState = { id: 'sim-1', data: makeUnavailableResult(), isLoading: false };
    render(<Reading />);
    expect(screen.getByText(/We couldn.t analyze this video/i)).toBeInTheDocument();
    expect(screen.queryByTestId('reading-skeleton')).not.toBeInTheDocument();
  });

  it('a completed read (real score) renders the thread, not the live state (guard not vacuous)', () => {
    mockState = { id: 'sim-1', data: makeReadingResult({ overall_score: 64 }), isLoading: false };
    render(<Reading />);
    expect(screen.getByTestId('reading')).toBeInTheDocument();
    expect(screen.queryByTestId('reading-skeleton')).not.toBeInTheDocument();
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

  it('still renders the watch-through stat on a healthy read (the guard is not vacuous)', () => {
    mockState = { id: 'sim-1', data: makeReadingResult(), isLoading: false };
    render(<Reading />);
    // The healthy fixture has personas → a real, non-null watch% stat renders in the
    // hero scorecard ("54%" value beside its "Watch-through" label).
    expect(screen.getByTestId('reading-watch')).toHaveTextContent(/^\d+%$/);
  });

  // ── AUD-FAIL-01 — a failed audience is not an audience that shrugged ────────────────────
  it('SAYS the audience simulation failed, instead of implying the room watched and felt nothing', () => {
    // The live run this pins (row iEbgUsLZRSFw, 2026-07-14): the fold timed out twice, zero
    // personas, and the only trace on the page was "No audience reaction landed for this video"
    // — which reads as a VERDICT (they watched, they shrugged). They never watched at all.
    mockState = {
      id: 'sim-1',
      data: makeEmptyPersonasResult({
        input_mode: 'tiktok_url',
        signal_availability: {
          ...makeReadingResult().signal_availability,
          personas: false,
        },
      }),
      isLoading: false,
    };
    render(<Reading />);

    const note = screen.getByTestId('reading-audience-did-not-run');
    expect(note).toHaveTextContent(/simulation failed/i);
    expect(note).toHaveTextContent(/no audience behind it/i);
    // The old wording must NOT be what a failed run shows.
    expect(note.textContent ?? '').not.toMatch(/No audience reaction landed/i);
  });

  it('keeps the neutral empty note when the audience simply produced nothing (guard is not vacuous)', () => {
    // personas availability TRUE = the sim ran. Empty nodes here are a genuine "nothing landed",
    // not a failure — so it must NOT claim the simulation failed.
    mockState = {
      id: 'sim-1',
      data: makeEmptyPersonasResult({
        input_mode: 'tiktok_url',
        signal_availability: {
          ...makeReadingResult().signal_availability,
          personas: true,
        },
      }),
      isLoading: false,
    };
    render(<Reading />);

    expect(screen.queryByTestId('reading-audience-did-not-run')).not.toBeInTheDocument();
    expect(screen.getByTestId('reading-audience-context')).toHaveTextContent(/No audience reaction landed/i);
  });
});
