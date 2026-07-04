/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PredictionResult } from '@/lib/engine/types';

import {
  makeReadingResult,
  makeApolloNullResult,
  makeEmptyPersonasResult,
  makeEmptySegmentsResult,
  makeEmptyHeatmapResult,
  makeNoBehavioralResult,
} from './fixtures/reading-fixture';

// The score panel runs a panel-local useComparisons(id) (lazy useQuery → fetch
// /api/analyze/{id}/comparisons). Mock it so the niche cohort is deterministic
// and no real network is hit. `null` niche → ScoreDistribution's absolute/lane
// mode (the in-panel honest degrade); a real cohort → field/lane mode.
let mockComparisons: { history: number[]; niche: null | { median: number; p75: number; count: number; histogram: number[] } } = {
  history: [],
  niche: null,
};
vi.mock('@/components/board/verdict/use-comparisons', () => ({
  useComparisons: () => ({ data: mockComparisons }),
}));

// The retention composed cluster reads its keyframe map from a panel-local
// usePermalinkFilmstrips() (lazy useQuery). Mock it so the cluster mounts without a
// QueryClientProvider. `{}` (no frames) is the realistic default — the heatmap
// segments still exist (curve + cohorts render); the filmstrip self-gates to neutral
// cells with no keyframes (the graceful, no-grey-cell path).
let mockFilmstrips: Record<number, string> = {};
vi.mock('@/hooks/queries/use-permalink-filmstrips', () => ({
  usePermalinkFilmstrips: () => mockFilmstrips,
}));

// The retention scrubber (003-A) resolves a playable video via useUploadedVideoSource
// (fetch /api/videos/sign). Mock it so the panel renders deterministically with no
// network — null src exercises the keyframe-flipbook path (curve + cohorts still mount).
vi.mock('@/components/board/audience/use-uploaded-video-source', () => ({
  useUploadedVideoSource: () => ({ src: null, status: 'idle' }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Drill-down panels (UX rework 2026-06-15) — every panel now expands INLINE inside
// the ReadingAccordion (the DrillSheet is retired). The interaction is uniform: tap
// a row trigger (`row-trigger-<panel>`) → its panel content mounts in place. type=
// "single" collapsible → exactly one panel open at a time, so `screen` queries
// resolve unambiguously against the open panel.
//
// SC-2 spine (unchanged): every panel must (a) render real engine output with NO
// throw and NO grey-cell, and (b) degrade to the calm PanelEmpty on null/thin data —
// never a throw, never a fabricated 0 (D-13).
// ─────────────────────────────────────────────────────────────────────────────

let mockState: { id: string | null; data: PredictionResult | null; isLoading: boolean } = {
  id: 'sim-1',
  data: makeReadingResult(),
  isLoading: false,
};
vi.mock('@/hooks/queries/use-permalink-analysis', () => ({
  usePermalinkAnalysis: () => mockState,
}));
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false, useIsMobileHydrated: () => ({ isMobile: false, hydrated: true }) }));

import { Reading } from '../reading';

beforeEach(() => {
  mockState = { id: 'sim-1', data: makeReadingResult(), isLoading: false };
  mockComparisons = { history: [], niche: null };
  mockFilmstrips = {};
});

/** Calm degradation copy every transplanted visual falls to (02-UI-SPEC / D-13). */
const PANEL_EMPTY_COPY = 'Not available for this read.';

// ─────────────────────────────────────────────────────────────────────────────
// hook panel — tap the Hook row → inline panel-hook
// ─────────────────────────────────────────────────────────────────────────────
describe('drill-down: hook panel (READ-09)', () => {
  it('renders on real data without throwing — modality rows mount', async () => {
    const user = userEvent.setup();
    render(<Reading />);

    await user.click(screen.getByTestId('row-trigger-hook'));
    expect(await screen.findByTestId('panel-hook')).toBeInTheDocument();
  });

  it('keeps the 0–10 modality rows (reskin-only, Pitfall 3 — bar width caps at 0–10, never 0–100)', async () => {
    // The modality rows stay on the 0–10 scale. The fixture's text_overlay_score=6.6
    // → a ~66% bar (6.6 × 10), NOT a 660% overflow. Assert the panel mounts the rows +
    // every printed modality value reads a 0–10 figure (a 0–100 mis-scale would print
    // e.g. 87, not ≤10). Scope to the value spans only (exclude the "/10" suffix).
    const user = userEvent.setup();
    render(<Reading />);

    await user.click(screen.getByTestId('row-trigger-hook'));
    const panel = await screen.findByTestId('panel-hook');
    expect(panel).toHaveTextContent(/Visual stop power/i);
    const values = within(panel).getAllByText(/^\d+(\.\d+)?$/);
    expect(values.length).toBeGreaterThan(0);
    for (const v of values) {
      // The value span reads "{n}/10" (the "/10" is a child span); parseFloat takes
      // the leading 0–10 figure. A 0–100 mis-scale would parse e.g. 87, not ≤10.
      expect(parseFloat(v.textContent ?? '')).toBeLessThanOrEqual(10);
    }
  });

  it('degrades gracefully when hook_decomposition is absent — falls to the hook dimension, no throw, no grey-cell', async () => {
    // hook_decomposition null but the hook DIMENSION present → the Hook row stays
    // enabled and HookPanel falls back to the hook dimension's lever/evidence
    // (panel-dimension), never a throw, never an empty bar grid.
    mockState = {
      id: 'sim-1',
      data: makeReadingResult({ hook_decomposition: undefined }),
      isLoading: false,
    };
    const user = userEvent.setup();
    expect(() => render(<Reading />)).not.toThrow();

    await user.click(screen.getByTestId('row-trigger-hook'));
    // Graceful fallback body (the §2 hook lever) — NOT the modality bar grid.
    expect(await screen.findByTestId('panel-dimension')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-hook')).not.toBeInTheDocument();
  });

  it('hook PanelEmpty (both hook_decomposition AND the hook dim absent) is unreachable by tap — the Hook row is disabled', async () => {
    // apollo-null removes the hook dimension → the Hook lever row has no score, so
    // the accordion renders it DISABLED with "Not available" (honest, never a
    // fabricated 0). A disabled row can't expand, so the both-absent PanelEmpty has
    // no tap path — the verified architectural fact, now expressed as a disabled row.
    mockState = {
      id: 'sim-1',
      data: makeApolloNullResult({ hook_decomposition: undefined }),
      isLoading: false,
    };
    const user = userEvent.setup();
    expect(() => render(<Reading />)).not.toThrow();

    const trigger = screen.getByTestId('row-trigger-hook');
    expect(trigger).toBeDisabled();
    // Clicking the disabled row does nothing — no panel content mounts.
    await user.click(trigger);
    expect(screen.queryByTestId('panel-hook')).not.toBeInTheDocument();
    expect(screen.queryByTestId('panel-dimension')).not.toBeInTheDocument();
    // The degraded row shows "Not available" (honest, never a fabricated 0).
    expect(screen.getByTestId('reading-accordion').textContent ?? '').toMatch(/Not available/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// retention panel — tap the Retention row → the linked watch-journey scrubber (003-A)
// ─────────────────────────────────────────────────────────────────────────────
describe('drill-down: retention panel (READ-09)', () => {
  it('renders on real data without throwing — the linked scrubber cluster mounts', async () => {
    const user = userEvent.setup();
    render(<Reading />);

    await user.click(screen.getByTestId('row-trigger-retention'));
    // The signature scrubber: ONE playhead over the curve + slider + who-leaves cohorts.
    expect(await screen.findByTestId('retention-scrubber-cluster')).toBeInTheDocument();
    expect(screen.getByTestId('retention-chart')).toBeInTheDocument();
    expect(screen.getByTestId('retention-scrubber-slider')).toBeInTheDocument();
  });

  it('degrades to PanelEmpty on empty segments (no throw, no empty SVG shell)', async () => {
    // makeEmptySegmentsResult → heatmap.segments:[] → no timeline → PanelEmpty.
    mockState = {
      id: 'sim-1',
      data: makeEmptySegmentsResult({ dropoff_segment_indices: undefined }),
      isLoading: false,
    };
    const user = userEvent.setup();
    expect(() => render(<Reading />)).not.toThrow();

    await user.click(screen.getByTestId('row-trigger-retention'));
    expect(await screen.findByText(PANEL_EMPTY_COPY)).toBeInTheDocument();
    expect(screen.queryByTestId('retention-chart')).not.toBeInTheDocument();
  });

  it('degrades to PanelEmpty on a null heatmap (no throw)', async () => {
    // makeEmptyHeatmapResult → heatmap:null → segments:[] + curve:null → PanelEmpty.
    mockState = {
      id: 'sim-1',
      data: makeEmptyHeatmapResult({ dropoff_segment_indices: undefined }),
      isLoading: false,
    };
    const user = userEvent.setup();
    expect(() => render(<Reading />)).not.toThrow();

    await user.click(screen.getByTestId('row-trigger-retention'));
    expect(await screen.findByText(PANEL_EMPTY_COPY)).toBeInTheDocument();
    expect(screen.queryByTestId('retention-chart')).not.toBeInTheDocument();
  });

  it('mounts RetentionChart (curve + niche/ghost overlay) on real data', async () => {
    const user = userEvent.setup();
    render(<Reading />);

    await user.click(screen.getByTestId('row-trigger-retention'));
    expect(await screen.findByTestId('retention-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-retention')).not.toBeInTheDocument();
  });

  it('drives a live "leaving now" readout off the playhead (the scrubber signature)', async () => {
    const user = userEvent.setup();
    render(<Reading />);

    await user.click(screen.getByTestId('row-trigger-retention'));
    // The live readout starts at "everyone watching" (playhead at 0).
    const leaving = await screen.findByTestId('retention-scrubber-leaving');
    expect(leaving.textContent ?? '').toMatch(/everyone watching/i);
  });

  it('mounts the linked who-leaves cohort list driven by the same playhead', async () => {
    const user = userEvent.setup();
    render(<Reading />);

    await user.click(screen.getByTestId('row-trigger-retention'));
    expect(await screen.findByTestId('retention-scrubber-cohorts')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// shareability panel — tap the Shareability row → inline tiles
// ─────────────────────────────────────────────────────────────────────────────
describe('drill-down: shareability panel (READ-09)', () => {
  it('renders on real data without throwing — StatTileRow mounts', async () => {
    const user = userEvent.setup();
    render(<Reading />);

    await user.click(screen.getByTestId('row-trigger-shareability'));
    // The rate tiles (StatTileRow) are the instrument body.
    expect(await screen.findByTestId('panel-shareability')).toBeInTheDocument();
    expect(screen.getByTestId('stat-tile-row')).toBeInTheDocument();
  });

  it('degrades gracefully on apollo-null — the rows show "Not available", no throw, no fabricated 0', () => {
    // apollo-null removes the share_pull dimension → the Shareability lever row is
    // disabled with "Not available". The reachable D-13 honesty signal: never a
    // fabricated 0.
    mockState = {
      id: 'sim-1',
      data: makeApolloNullResult({ behavioral_predictions: undefined }),
      isLoading: false,
    };
    expect(() => render(<Reading />)).not.toThrow();

    const rows = screen.getByTestId('reading-accordion');
    expect(rows.textContent ?? '').toMatch(/Not available/);
    expect(rows.textContent ?? '').not.toMatch(/\b0\b/);
  });

  it('mounts the behavioral rate tiles (deriveBehavioralTiles) on real data', async () => {
    const user = userEvent.setup();
    render(<Reading />);

    await user.click(screen.getByTestId('row-trigger-shareability'));
    await screen.findByTestId('panel-shareability');
    // The fixture's behavioral_predictions emit ≥1 *_pct → ≥1 StatTile renders.
    expect(screen.getAllByTestId('stat-tile').length).toBeGreaterThan(0);
  });

  it('rate tiles degrade gracefully via makeNoBehavioralResult — tiles omitted, NO fabricated 0%, evidence shows', async () => {
    // behavioral_predictions absent → deriveBehavioralTiles returns [] (StatTileRow
    // renders nothing — NEVER a fabricated "0%"); the share_pull dimension is STILL
    // present (apollo kept), so the row stays enabled and the panel mounts.
    mockState = {
      id: 'sim-1',
      data: makeNoBehavioralResult(),
      isLoading: false,
    };
    const user = userEvent.setup();
    render(<Reading />);

    await user.click(screen.getByTestId('row-trigger-shareability'));
    expect(await screen.findByTestId('panel-shareability')).toBeInTheDocument();
    // No rate tiles (the StatTileRow self-omits on empty) → no fabricated 0% tile.
    expect(screen.queryByTestId('stat-tile-row')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stat-tile')).not.toBeInTheDocument();
  });

  it('shareability PanelEmpty (both tiles AND the share_pull dim absent) is unreachable by tap — the row is disabled', async () => {
    // apollo-null empties the share_pull dimension → the Shareability lever row is
    // disabled, so the both-absent PanelEmpty has no tap path. The reachable honesty
    // path holds (rows show "Not available", never a fabricated 0/0%).
    mockState = {
      id: 'sim-1',
      data: makeApolloNullResult({ behavioral_predictions: undefined }),
      isLoading: false,
    };
    const user = userEvent.setup();
    expect(() => render(<Reading />)).not.toThrow();

    const trigger = screen.getByTestId('row-trigger-shareability');
    expect(trigger).toBeDisabled();
    await user.click(trigger);
    expect(screen.queryByTestId('panel-shareability')).not.toBeInTheDocument();
    const rows = screen.getByTestId('reading-accordion');
    expect(rows.textContent ?? '').toMatch(/Not available/);
    expect(rows.textContent ?? '').not.toMatch(/\b0%/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// audience — the v6 Room, INLINE (Phase 3 · Option A): the persona deep-dive that
// used to drill the old AudienceLens is now the Room, rendered in place (named voices
// + The people ⇄ Population·1,000 + the video-only timeline replay). The hero still
// folds the breakout OVERVIEW; the Room is the per-persona detail. The legacy list panel
// (the old renderPanel('personas') drill) is now deleted — this is the sole audience path.
// ─────────────────────────────────────────────────────────────────────────────
describe('audience — the inline Room (READ-09, Phase 3)', () => {
  it('renders the Room inline (no drill) with the People/Population toggle + the timeline replay', () => {
    render(<Reading />);
    // Inline — present without any accordion tap.
    expect(screen.getByTestId('reading-room')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /audience scale/i })).toBeInTheDocument();
    // The video carries a real per-persona attentions[] timeline → the TIMELINE replay
    // (constellation lights up as the video plays), not the flat cascade.
    expect(screen.getByRole('button', { name: /replay reactions/i })).toBeInTheDocument();
    expect(screen.getByTestId('persona-graph')).toBeInTheDocument();
  });

  it('empty personas → the honest empty note, no Room, no fabricated shell', () => {
    // personas:[] → buildAudienceNodes returns [] → the breakout overview omits itself
    // AND the Room is not rendered (honest: never an empty Room).
    mockState = {
      id: 'sim-1',
      data: makeEmptyPersonasResult(),
      isLoading: false,
    };
    render(<Reading />);

    expect(screen.queryByTestId('audience-breakout')).toBeNull();
    expect(screen.queryByTestId('reading-room')).toBeNull();
    expect(screen.getByText(/no audience reaction landed/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// score panel — tap the Score row → inline ScoreDistribution
// ─────────────────────────────────────────────────────────────────────────────
describe('drill-down: score panel (READ-09, D-02)', () => {
  it('opens the Score panel inline when the Score row is tapped', async () => {
    const user = userEvent.setup();
    render(<Reading />);

    // No panel content before tapping.
    expect(screen.queryByTestId('score-distribution')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('row-trigger-score'));
    expect(await screen.findByTestId('score-distribution')).toBeInTheDocument();
  });

  it('mounts ScoreDistribution (niche histogram + confidence range) on a real cohort', async () => {
    // A real ≥20-count cohort → ScoreDistribution renders its field histogram.
    mockComparisons = {
      history: [],
      niche: { median: 58, p75: 74, count: 120, histogram: [2, 4, 8, 14, 22, 26, 18, 12, 8, 6] },
    };
    const user = userEvent.setup();
    render(<Reading />);

    await user.click(screen.getByTestId('row-trigger-score'));
    const dist = await screen.findByTestId('score-distribution');
    // overall_score=71 + count=120 → field mode (the grounded histogram).
    expect(dist.dataset.mode).toBe('field');
    expect(screen.getByTestId('score-field')).toBeInTheDocument();
  });

  it('degrades honestly when niche is null → ScoreDistribution absolute/lane mode, no throw', async () => {
    // mockComparisons.niche stays null → ScoreDistribution falls to absolute mode
    // (the in-panel honest degrade — NEVER a throw, NEVER a fabricated 0).
    const user = userEvent.setup();
    expect(() => render(<Reading />)).not.toThrow();

    await user.click(screen.getByTestId('row-trigger-score'));
    const dist = await screen.findByTestId('score-distribution');
    expect(dist.dataset.mode).toBe('absolute');
    expect(screen.getByTestId('score-lane')).toBeInTheDocument();
  });

  it('suppresses the "likely lo–hi" range text on HIGH confidence (showRangeText gate)', async () => {
    mockState = {
      id: 'sim-1',
      data: makeReadingResult({ confidence_label: 'HIGH', confidence: 0.9 }),
      isLoading: false,
    };
    const user = userEvent.setup();
    render(<Reading />);

    await user.click(screen.getByTestId('row-trigger-score'));
    expect(await screen.findByTestId('score-distribution')).toBeInTheDocument();
    // The band always draws; the numeric range caption is suppressed for HIGH.
    expect(screen.queryByText(/likely\s/i)).not.toBeInTheDocument();
  });
});

// The empty-behavioral fixture must render the Reading without throwing.
describe('empty-behavioral fixture tolerance', () => {
  it('Reading renders without throwing on makeNoBehavioralResult', () => {
    mockState = { id: 'sim-1', data: makeNoBehavioralResult(), isLoading: false };
    expect(() => render(<Reading />)).not.toThrow();
    expect(screen.getByTestId('reading')).toBeInTheDocument();
  });
});
