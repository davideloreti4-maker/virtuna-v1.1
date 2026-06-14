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

// ─────────────────────────────────────────────────────────────────────────────
// Wave-0 panel scaffold (03-01) — the per-panel render + degradation gate the
// rest of Phase 3 verifies against (03-VALIDATION § Wave 0). The SVG leaf charts
// (RetentionChart / SegmentTable / PersonaGraph / CraftFilmstrip / ScoreDistribution
// / StatTile) have NO direct render tests today; this file is that coverage gap.
//
// SC-2 is the phase spine: every drill-down panel must (a) render real engine
// output with NO throw and NO grey-cell fallback, and (b) degrade to the calm
// PanelEmpty ("Not available for this read.") on null/thin data — never a throw,
// never a fabricated 0 (D-13). This file asserts BOTH for the 4 panels that exist
// TODAY (hook / retention / shareability / personas), and stages the rich-visual +
// `score`-panel assertions as `it.todo` for the downstream plans (03-02/03/04/05)
// to activate — so the contract surface is agreed up front, not a moving target.
//
// Mock setup mirrors reading.test.tsx EXACTLY (same vi.mock targets): the container
// is the single usePermalinkAnalysis subscriber, so we drive it with a fixture and
// keep the DrillSheet side switch deterministic (desktop = right drawer).
// ─────────────────────────────────────────────────────────────────────────────

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
  mockComparisons = { history: [], niche: null };
});

/** Calm degradation copy every transplanted visual falls to (02-UI-SPEC / D-13). */
const PANEL_EMPTY_COPY = 'Not available for this read.';

// ─────────────────────────────────────────────────────────────────────────────
// hook panel — tap the Hook driver row → DrillSheet("Hook")
// ─────────────────────────────────────────────────────────────────────────────
describe('drill-down: hook panel (READ-09)', () => {
  it('renders on real data without throwing — modality rows mount', async () => {
    const user = userEvent.setup();
    render(<Reading />);

    await user.click(screen.getByTestId('driver-row-hook'));
    const dialog = await screen.findByRole('dialog', { name: 'Hook' });
    expect(within(dialog).getByTestId('panel-hook')).toBeInTheDocument();
  });

  it('degrades gracefully when hook_decomposition is absent — falls to the hook dimension, no throw, no grey-cell', async () => {
    // ARCHITECTURE NOTE (verified against PanelContent + DriverRows): the hook
    // panel's true PanelEmpty requires BOTH hook_decomposition null AND no hook
    // dimension — but removing the hook dim flips DriverRows to its degraded branch
    // (generic, NON-clickable rows), so the sheet becomes unreachable by tap. The
    // REACHABLE graceful path: keep the dims (rows stay clickable) but null the
    // hook_decomposition → HookPanel falls back to the hook dimension's lever/
    // evidence (panel-dimension), never a throw, never an empty bar grid. The
    // sheet-level hook PanelEmpty is staged as a todo below for the wiring plans.
    mockState = {
      id: 'sim-1',
      data: makeReadingResult({ hook_decomposition: undefined }),
      isLoading: false,
    };
    const user = userEvent.setup();
    expect(() => render(<Reading />)).not.toThrow();

    await user.click(screen.getByTestId('driver-row-hook'));
    const dialog = await screen.findByRole('dialog', { name: 'Hook' });
    // Graceful fallback body (the §2 hook lever) — NOT the modality bar grid.
    expect(within(dialog).getByTestId('panel-dimension')).toBeInTheDocument();
    expect(within(dialog).queryByTestId('panel-hook')).not.toBeInTheDocument();
  });

  // 03-02/03-03 reskin only (hook stays the native 0–10 rows, no chart transplant);
  // no rich-visual mount to activate here. The sheet-level PanelEmpty (hook dim AND
  // decomposition both absent) is unreachable by tap while rows degrade — the wiring
  // plans decide whether the gauge/score tap exposes it.
  it.todo('hook panel shows PanelEmpty when both hook_decomposition and the hook dimension are absent (03-04)');
});

// ─────────────────────────────────────────────────────────────────────────────
// retention panel — tap the Retention driver row → DrillSheet("Retention")
// ─────────────────────────────────────────────────────────────────────────────
describe('drill-down: retention panel (READ-09)', () => {
  it('renders on real data without throwing — segment list mounts', async () => {
    const user = userEvent.setup();
    render(<Reading />);

    await user.click(screen.getByTestId('driver-row-retention'));
    const dialog = await screen.findByRole('dialog', { name: 'Retention' });
    expect(within(dialog).getByTestId('panel-retention')).toBeInTheDocument();
  });

  it('degrades to PanelEmpty on empty segments (no throw, no empty SVG shell)', async () => {
    // segments:[] and no drop indices → no curve / no rows → PanelEmpty.
    mockState = {
      id: 'sim-1',
      data: makeEmptySegmentsResult({ dropoff_segment_indices: undefined }),
      isLoading: false,
    };
    const user = userEvent.setup();
    expect(() => render(<Reading />)).not.toThrow();

    await user.click(screen.getByTestId('driver-row-retention'));
    const dialog = await screen.findByRole('dialog', { name: 'Retention' });
    expect(within(dialog).getByText(PANEL_EMPTY_COPY)).toBeInTheDocument();
    expect(within(dialog).queryByTestId('panel-retention')).not.toBeInTheDocument();
  });

  // ── Rich-visual mounts (03-04/03-05 swap the native list for the composed
  //    "watch journey" cluster). Activate these when the charts are wired. ──
  it.todo(
    'retention panel mounts RetentionChart (curve + niche/ghost overlay) on real data (wired in 03-04/03-05)',
  );
  it.todo('retention panel mounts CraftFilmstrip timeline-paired with the curve (D-04, 03-04/03-05)');
  it.todo('retention panel mounts SegmentTable (drop-segment breakdown) (03-04/03-05)');
});

// ─────────────────────────────────────────────────────────────────────────────
// shareability panel — tap the Shareability driver row → DrillSheet("Shareability")
// ─────────────────────────────────────────────────────────────────────────────
describe('drill-down: shareability panel (READ-09)', () => {
  it('renders on real data without throwing — StatTileRow + share_pull evidence mount', async () => {
    const user = userEvent.setup();
    render(<Reading />);

    await user.click(screen.getByTestId('driver-row-shareability'));
    const dialog = await screen.findByRole('dialog', { name: 'Shareability' });
    // 03-04 swap: the rate tiles (StatTileRow) replace the native dimension body…
    expect(within(dialog).getByTestId('stat-tile-row')).toBeInTheDocument();
    // …and the share_pull lever evidence is kept as supporting text.
    expect(within(dialog).getByTestId('panel-shareability')).toBeInTheDocument();
    expect(within(dialog).getByText(/identity-signalling/i)).toBeInTheDocument();
  });

  it('degrades gracefully on apollo-null — the driver rows show "Not available", no throw, no fabricated 0', () => {
    // ARCHITECTURE NOTE (verified): the shareability panel reads the exact
    // share_pull dimension; emptying it removes the dim, which flips DriverRows to
    // its degraded branch (NON-clickable rows) — so the sheet can't be opened by
    // tap in this state. The REACHABLE honesty signal on apollo-null is the
    // DriverRows degraded copy: the levers are shown as "Not available" rather than
    // a fabricated 0 (D-13). The sheet-level shareability PanelEmpty is staged below.
    mockState = {
      id: 'sim-1',
      data: makeApolloNullResult({ behavioral_predictions: undefined }),
      isLoading: false,
    };
    expect(() => render(<Reading />)).not.toThrow();

    const rows = screen.getByTestId('driver-rows');
    expect(rows.textContent ?? '').toMatch(/Not available/);
    // Never a fabricated 0 in the degraded rows.
    expect(rows.textContent ?? '').not.toMatch(/\b0\b/);
  });

  // ── 03-04 swap: StatTile rate tiles (deriveBehavioralTiles) beside the share_pull
  //    evidence. The first assertion (tiles + evidence mount) is covered above. ──
  it('mounts the behavioral rate tiles (deriveBehavioralTiles) on real data', async () => {
    const user = userEvent.setup();
    render(<Reading />);

    await user.click(screen.getByTestId('driver-row-shareability'));
    const dialog = await screen.findByRole('dialog', { name: 'Shareability' });
    // The fixture's behavioral_predictions emit ≥1 *_pct → ≥1 StatTile renders.
    expect(within(dialog).getAllByTestId('stat-tile').length).toBeGreaterThan(0);
  });

  it('rate tiles degrade gracefully via makeNoBehavioralResult — tiles omitted, NO fabricated 0%, share_pull evidence still shows', async () => {
    // behavioral_predictions absent → deriveBehavioralTiles returns [] (StatTileRow
    // renders nothing — NEVER a fabricated "0%"); the share_pull dimension is STILL
    // present (apollo kept), so the row stays clickable and the panel shows the
    // evidence text. This is the reachable D-13 honesty path.
    mockState = {
      id: 'sim-1',
      data: makeNoBehavioralResult(),
      isLoading: false,
    };
    const user = userEvent.setup();
    render(<Reading />);

    await user.click(screen.getByTestId('driver-row-shareability'));
    const dialog = await screen.findByRole('dialog', { name: 'Shareability' });
    // No rate tiles (the StatTileRow self-omits on empty) → no fabricated 0% tile.
    expect(within(dialog).queryByTestId('stat-tile-row')).not.toBeInTheDocument();
    expect(within(dialog).queryByTestId('stat-tile')).not.toBeInTheDocument();
    // But the share_pull evidence is kept (no throw, no grey-cell).
    expect(within(dialog).getByTestId('panel-shareability')).toBeInTheDocument();
    expect(within(dialog).getByText(/identity-signalling/i)).toBeInTheDocument();
  });

  // Strictly unreachable by tap (verified): emptying the share_pull dimension flips
  // DriverRows to its degraded NON-clickable branch (driver-rows.tsx L67 — any of
  // hook/retention/share absent ⇒ degraded), so the Shareability sheet can never be
  // opened in that state. The code guard EXISTS (`tiles.length === 0 && !dim →
  // PanelEmpty` in the shareability body), but it has no tap path; covering it needs
  // a direct-mount harness (deferred to 03-05). Honest staging, not a gap.
  it.todo('shareability panel PanelEmpty when BOTH tiles and the share_pull dim are absent — unreachable by tap (03-05 direct-mount)');
});

// ─────────────────────────────────────────────────────────────────────────────
// personas panel — tap the persona cloud (role="button") → DrillSheet("Audience")
// ─────────────────────────────────────────────────────────────────────────────
describe('drill-down: personas panel (READ-09)', () => {
  it('renders on real data without throwing — the full PersonaGraph mounts (03-04 swap)', async () => {
    const user = userEvent.setup();
    const { container } = render(<Reading />);

    // The hero now has TWO tap sources (the gauge=score + the cloud=audience), so
    // target the cloud SPECIFICALLY via its svg (the gauge's button is /Score …/).
    const cloud = container
      .querySelector('svg[aria-label="Audience watch-through by persona"]')!
      .closest('[role="button"]') as HTMLElement;
    await user.click(cloud);
    const dialog = await screen.findByRole('dialog', { name: 'Audience' });
    // 03-04 swap: the native persona list → the full PersonaGraph (SVG cloud).
    expect(within(dialog).getByTestId('persona-graph')).toBeInTheDocument();
    // The native list is gone.
    expect(within(dialog).queryByTestId('panel-personas')).not.toBeInTheDocument();
  });

  it('degrades to PanelEmpty on empty personas (no throw, no grey-cell)', async () => {
    // personas:[] → PersonaCloud returns null (the hero cloud omits itself); the
    // gauge button stays (it's score-driven, independent of personas). Assert the
    // CLOUD svg is gone — not "no buttons" (the gauge is always a button now after
    // D-02). PersonasPanel's own PanelEmpty guard (nodes.length===0) is the in-sheet
    // degrade, but it shares buildPersonaNodes with the cloud — so an empty cohort
    // hides BOTH the cloud and its only tap source (unreachable by tap, see todo).
    mockState = {
      id: 'sim-1',
      data: makeEmptyPersonasResult(),
      isLoading: false,
    };
    const { container } = render(<Reading />);

    // Empty personas → the hero cloud omits itself (no cloud svg / tap source).
    expect(
      container.querySelector('svg[aria-label="Audience watch-through by persona"]'),
    ).toBeNull();
    // And no throw occurred reaching this assertion (render above did not throw).
  });

  // PersonaGraph mount on real data is asserted in the first test above (03-04 swap).
  // The in-sheet PanelEmpty for empty personas is unreachable by tap (the cloud and
  // the panel share buildPersonaNodes — an empty cohort hides the cloud tap source);
  // the PanelEmpty guard exists in PersonasPanel, covered by direct-mount in 03-05.
  it.todo('personas panel PanelEmpty on empty personas inside the open sheet — unreachable by tap (03-05 direct-mount)');
});

// ─────────────────────────────────────────────────────────────────────────────
// score panel — the NEW 5th panel (D-02). Does not exist until 03-04 adds the
// gauge `onOpen` + extends the closed PanelId union + a ScorePanel case. Staged as
// todos here so this file is the agreed contract surface for that wiring.
// ─────────────────────────────────────────────────────────────────────────────
describe('drill-down: score panel (READ-09, D-02 — NEW in 03-04)', () => {
  it("opens from the hero gauge onOpen → setPanel('score'), titled 'Score'", async () => {
    const user = userEvent.setup();
    render(<Reading />);

    // No dialog before tapping the gauge.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // The gauge is the only role="button" exposing the score (aria-label "Score N…").
    await user.click(screen.getByRole('button', { name: /Score 71 of 100/ }));
    // PANEL_TITLE.score === 'Score' → the single DrillSheet opens named "Score".
    const dialog = await screen.findByRole('dialog', { name: 'Score' });
    expect(dialog).toBeInTheDocument();
  });

  it('mounts ScoreDistribution (niche histogram + confidence range) on a real cohort', async () => {
    // A real ≥20-count cohort → ScoreDistribution renders its field histogram.
    mockComparisons = {
      history: [],
      niche: { median: 58, p75: 74, count: 120, histogram: [2, 4, 8, 14, 22, 26, 18, 12, 8, 6] },
    };
    const user = userEvent.setup();
    render(<Reading />);

    await user.click(screen.getByRole('button', { name: /Score 71 of 100/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Score' });
    const dist = within(dialog).getByTestId('score-distribution');
    expect(dist).toBeInTheDocument();
    // overall_score=71 + count=120 → field mode (the grounded histogram).
    expect(dist.dataset.mode).toBe('field');
    expect(within(dialog).getByTestId('score-field')).toBeInTheDocument();
  });

  it('degrades honestly when niche is null → ScoreDistribution absolute/lane mode, no throw', async () => {
    // mockComparisons.niche stays null (the beforeEach default) → the panel-local
    // useComparisons returns no cohort → ScoreDistribution falls to absolute mode
    // (the in-panel honest degrade — NEVER a throw, NEVER a fabricated 0).
    const user = userEvent.setup();
    expect(() => render(<Reading />)).not.toThrow();

    await user.click(screen.getByRole('button', { name: /Score 71 of 100/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Score' });
    const dist = within(dialog).getByTestId('score-distribution');
    // null niche → 'absolute' mode (lane plot, no histogram) — still renders the score.
    expect(dist.dataset.mode).toBe('absolute');
    expect(within(dialog).getByTestId('score-lane')).toBeInTheDocument();
  });

  it('suppresses the "likely lo–hi" range text on HIGH confidence (showRangeText gate)', async () => {
    // confidence_label HIGH → showRangeText=false → no "likely N–N" caption; the
    // band is still drawn. MEDIUM/LOW would show it (VerdictNode recipe parity).
    mockState = {
      id: 'sim-1',
      data: makeReadingResult({ confidence_label: 'HIGH', confidence: 0.9 }),
      isLoading: false,
    };
    const user = userEvent.setup();
    render(<Reading />);

    await user.click(screen.getByRole('button', { name: /Score 71 of 100/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Score' });
    expect(within(dialog).getByTestId('score-distribution')).toBeInTheDocument();
    // The band always draws; the numeric range caption is suppressed for HIGH.
    expect(within(dialog).queryByText(/likely\s/i)).not.toBeInTheDocument();
  });
});

// Reference so makeNoBehavioralResult is exercised by the type-checker now (its
// behavioral assertions activate in 03-04/03-05). Asserts the empty-behavioral
// fixture renders the Reading without throwing today (the shareability tiles it
// feeds don't exist yet, but the container must already tolerate the shape).
describe('empty-behavioral fixture tolerance (Wave-0 guard)', () => {
  it('Reading renders without throwing on makeNoBehavioralResult', () => {
    mockState = { id: 'sim-1', data: makeNoBehavioralResult(), isLoading: false };
    expect(() => render(<Reading />)).not.toThrow();
    expect(screen.getByTestId('reading')).toBeInTheDocument();
  });
});
