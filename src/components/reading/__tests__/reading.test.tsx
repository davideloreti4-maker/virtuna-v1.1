/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import type { HeatmapPayload, PredictionResult } from '@/lib/engine/types';

import { makeReadingResult } from './fixtures/reading-fixture';

// ── Single-source contract: the container calls usePermalinkAnalysis ONCE and
// passes data to the leaves as props. We mock the hook (it reads useParams +
// fetch) so each test drives the container with a fixture (Landmine 1 / READ-10).
let mockState: { id: string | null; data: PredictionResult | null; isLoading: boolean } = {
  id: 'sim-1',
  data: makeReadingResult(),
  isLoading: false,
};
vi.mock('@/hooks/queries/use-permalink-analysis', () => ({
  usePermalinkAnalysis: () => mockState,
}));

// Keep the DrillSheet's side switch deterministic (desktop = right).
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));

// ThumbnailStrip now reads its keyframe map from usePermalinkFilmstrips() (lazy
// useQuery) so the hero poster renders on permalink reload. It's eager (top of the
// tree), so the container needs this mock to mount without a QueryClientProvider.
vi.mock('@/hooks/queries/use-permalink-filmstrips', () => ({
  usePermalinkFilmstrips: () => ({}),
}));

// The persistent follow-up chat (ReadingChat) drives useExpertChat, which fetches
// history on mount. Mock it inert so the container tests need no network/QueryClient.
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

// The container now reads the niche cohort (useComparisons) for the hero "Niche
// rank" stat + the Audience-&-context row. Mock it inert (no cohort) so the tests
// mount without a QueryClientProvider; the niche stat simply omits (D-13).
vi.mock('@/components/board/verdict/use-comparisons', () => ({
  useComparisons: () => ({ data: undefined }),
}));

import { Reading } from '../reading';

beforeEach(() => {
  mockState = { id: 'sim-1', data: makeReadingResult(), isLoading: false };
});

describe('Reading container — composition + hero (READ-01/03/04/07)', () => {
  it('lays the blocks top-to-bottom: hero → your audience → score drivers → audience & context → Fix First → Deeper read (READ-01)', () => {
    // Give the hero poster a real keyframe so the <img> renders INSIDE the hero
    // scorecard (the standalone thumbnail strip is retired — the poster is now part
    // of "THE READ" card, no longer a block above it).
    const data = makeReadingResult();
    const heatmap = {
      ...(data.heatmap as HeatmapPayload),
      segments: (data.heatmap as HeatmapPayload).segments.map((s, i) =>
        i === 0 ? { ...s, keyframe_uri: 'https://signed.example/frame0.jpg' } : s,
      ),
    } as HeatmapPayload;
    mockState = { id: 'sim-1', data: makeReadingResult({ heatmap }), isLoading: false };

    const { container } = render(<Reading />);

    // The poster lives INSIDE the hero scorecard now (not a strip above it).
    const hero = container.querySelector<HTMLElement>('[data-testid="reading-hero"]')!;
    expect(hero.querySelector('img[alt=""]')).toBeInTheDocument();

    // Collect the ordered section anchors that mark each block. The audience
    // overview (breakout) now sits directly under the hero, above Score drivers.
    const ids = [
      'reading-hero',
      'audience-breakout',
      'reading-accordion',
      'reading-audience-context',
      'fix-first',
      'deeper-read',
    ];
    const order = Array.from(
      container.querySelectorAll<HTMLElement>(ids.map((id) => `[data-testid="${id}"]`).join(', ')),
    ).map((el) => el.dataset.testid);

    // Each anchor present and in the locked vertical order.
    const indices = ids.map((id) => order.indexOf(id));
    expect(indices.every((i) => i >= 0)).toBe(true);
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i - 1]).toBeLessThan(indices[i]!);
    }
  });

  it('renders the gauge from overall_score and the hero watch-through stat EXACTLY ONCE (READ-04 owned-once)', () => {
    mockState = { id: 'sim-1', data: makeReadingResult({ overall_score: 71 }), isLoading: false };
    render(<Reading />);

    // The gauge exposes the score via its aria-label (display-only img — UX rework).
    expect(screen.getByRole('img', { name: /Score 71 of 100/ })).toBeInTheDocument();

    // The hero-owned watch-through stat renders EXACTLY ONCE. The persona dot-cloud
    // that used to emit a second aggregate caption is gone (replaced by the
    // AudienceOrbit, which carries no watch caption) — so the container owns it alone.
    expect(screen.getAllByTestId('reading-watch')).toHaveLength(1);
    // New scorecard format: the value is "{n}%" (its "Watch-through" label is a sibling).
    expect(screen.getByTestId('reading-watch').textContent).toMatch(/^\d+%$/);
  });

  it('shows the score for an anti-virality-gated read with NO top gate banner (banner removed per UX)', () => {
    mockState = {
      id: 'sim-1',
      data: makeReadingResult({
        anti_virality_gated: true,
        anti_virality_reason: 'confidence',
        overall_score: 38,
      }),
      isLoading: false,
    };
    const { container } = render(<Reading />);

    // Gauge (score) still rendered (display-only img — UX rework).
    expect(screen.getByRole('img', { name: /Score 38 of 100/ })).toBeInTheDocument();

    // The "Don't post yet" gradient banner is no longer mounted above the read
    // (removed during the hero rework — the signal can be relocated if wanted).
    expect(container.querySelector('[data-testid="av-header"]')).toBeNull();
    expect(screen.queryByText(/post anyway/i)).toBeNull();
  });

  it('watch% survives the empty-personas degraded path — stat present, NO orbit/cloud svg (READ-04)', () => {
    const data = makeReadingResult();
    const heatmap = {
      ...(data.heatmap as HeatmapPayload),
      personas: [],
      weighted_completion_pct: 0.42,
    } as HeatmapPayload;
    mockState = { id: 'sim-1', data: makeReadingResult({ heatmap }), isLoading: false };

    const { container } = render(<Reading />);

    // Both audience visuals need personas: the old dot-cloud and the new breakout
    // overview each omit on empty personas → neither renders (no empty shell).
    expect(
      container.querySelector('svg[aria-label="Audience watch-through by persona"]'),
    ).toBeNull();
    expect(container.querySelector('[data-testid="audience-breakout"]')).toBeNull();

    // But the hero-owned watch stat is STILL present exactly once — it is
    // container-owned, so it survives the empty-personas path.
    expect(screen.getAllByTestId('reading-watch')).toHaveLength(1);
    // Fallback = round(0.42*100) = 42.
    expect(screen.getByTestId('reading-watch').textContent).toMatch(/^42%$/);
  });

  it('expands the Hook panel INLINE when the Hook row is tapped (accordion drill-down)', async () => {
    const user = userEvent.setup();
    render(<Reading />);

    // No panel content before interaction (collapsed accordion).
    expect(screen.queryByTestId('panel-hook')).not.toBeInTheDocument();

    // Tap the Hook row → its panel expands IN PLACE (no bottom-sheet / dialog).
    await user.click(screen.getByTestId('row-trigger-hook'));
    expect(await screen.findByTestId('panel-hook')).toBeInTheDocument();
    // Inline expand — never a modal dialog (the DrillSheet is retired here).
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the audience overview (breakout) directly under the hero — no deep-dive drill row yet', () => {
    render(<Reading />);
    // The breakout cascade is the audience overview; the 10-segment deep-dive drill
    // row is deferred to the step-2 panel redesign, so it is NOT mounted in the accordion.
    expect(screen.getByTestId('audience-breakout')).toBeInTheDocument();
    expect(screen.queryByTestId('row-trigger-personas')).not.toBeInTheDocument();
  });

  it('has no a11y violations in the healthy state', async () => {
    const { container } = render(<Reading />);
    const results = await axe(container);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(results).toHaveNoViolations();
  });
});
