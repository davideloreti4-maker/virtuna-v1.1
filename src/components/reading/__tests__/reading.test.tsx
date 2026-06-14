/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

import { Reading } from '../reading';

beforeEach(() => {
  mockState = { id: 'sim-1', data: makeReadingResult(), isLoading: false };
});

describe('Reading container — composition + hero (READ-01/03/04/07)', () => {
  it('lays the blocks top-to-bottom: thumbnail → hero → driver rows → Fix First → Deeper read (READ-01)', () => {
    // Give the thumbnail a real keyframe so the strip renders (it omits itself
    // otherwise) — proves it sits ABOVE the hero in DOM order.
    const data = makeReadingResult();
    const heatmap = {
      ...(data.heatmap as HeatmapPayload),
      segments: (data.heatmap as HeatmapPayload).segments.map((s, i) =>
        i === 0 ? { ...s, keyframe_uri: 'https://signed.example/frame0.jpg' } : s,
      ),
    } as HeatmapPayload;
    mockState = { id: 'sim-1', data: makeReadingResult({ heatmap }), isLoading: false };

    const { container } = render(<Reading />);

    // Collect the ordered anchors that mark each block.
    const order = Array.from(
      container.querySelectorAll<HTMLElement>(
        'img[alt=""], [data-testid="reading-hero"], [data-testid="driver-rows"], [data-testid="fix-first"], [data-testid="deeper-read"]',
      ),
    );

    const thumbIdx = order.findIndex((el) => el.tagName === 'IMG');
    const heroIdx = order.findIndex((el) => el.dataset.testid === 'reading-hero');
    const rowsIdx = order.findIndex((el) => el.dataset.testid === 'driver-rows');
    const fixIdx = order.findIndex((el) => el.dataset.testid === 'fix-first');
    const deeperIdx = order.findIndex((el) => el.dataset.testid === 'deeper-read');

    expect(thumbIdx).toBeGreaterThanOrEqual(0);
    expect(thumbIdx).toBeLessThan(heroIdx);
    expect(heroIdx).toBeLessThan(rowsIdx);
    expect(rowsIdx).toBeLessThan(fixIdx);
    expect(fixIdx).toBeLessThan(deeperIdx);
  });

  it('renders the gauge from overall_score and the watch% caption EXACTLY ONCE (READ-04 owned-once)', () => {
    mockState = { id: 'sim-1', data: makeReadingResult({ overall_score: 71 }), isLoading: false };
    const { container } = render(<Reading />);

    // The gauge exposes the score via its aria-label (now a button — D-02 tap target).
    expect(screen.getByRole('button', { name: /Score 71 of 100/ })).toBeInTheDocument();

    // The hero-owned "{n}% watch" caption renders EXACTLY ONCE (the cloud no
    // longer renders an aggregate caption — the container owns it). Count the
    // caption ELEMENTS, not raw textContent (the cloud's sr-only per-persona
    // "watch-through" mirror is a distinct a11y string, not the hero caption).
    expect(screen.getAllByTestId('reading-watch')).toHaveLength(1);
    expect(screen.getByTestId('reading-watch').textContent).toMatch(/^\d+%\s*watch$/);

    // No element anywhere renders the bare aggregate "{n}% watch" caption twice:
    // assert the cloud component does not emit a matching standalone caption.
    const captions = Array.from(container.querySelectorAll<HTMLElement>('p, span')).filter((el) =>
      /^\s*\d+%\s*watch\s*$/.test(el.textContent ?? ''),
    );
    // Only the hero <p data-testid="reading-watch"> matches (its inner <span> holds
    // "{n}%" only, so it alone has the full "{n}% watch" text).
    expect(captions).toHaveLength(1);
    expect(captions[0]?.dataset.testid).toBe('reading-watch');
  });

  it('places the gate banner ABOVE the gauge when anti_virality_gated, score still present (READ-03/D-04)', () => {
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

    // Gauge (score) still rendered (now a button — D-02 tap target).
    const gauge = screen.getByRole('button', { name: /Score 38 of 100/ });
    expect(gauge).toBeInTheDocument();

    // The gate banner sits before the hero section in DOM order.
    const hero = container.querySelector('[data-testid="reading-hero"]')!;
    // The AntiViralityHeader copy contains "post" (override link "Post anyway →"
    // / header copy). Assert SOMETHING from the banner precedes the hero.
    const banner = screen.getByText(/post anyway/i);
    expect(banner.compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('watch% survives the empty-personas degraded path — caption present, NO cloud svg (READ-04)', () => {
    const data = makeReadingResult();
    const heatmap = {
      ...(data.heatmap as HeatmapPayload),
      personas: [],
      weighted_completion_pct: 0.42,
    } as HeatmapPayload;
    mockState = { id: 'sim-1', data: makeReadingResult({ heatmap }), isLoading: false };

    const { container } = render(<Reading />);

    // PersonaCloud returns null on empty personas → no aria-labelled cloud svg.
    expect(
      container.querySelector('svg[aria-label="Audience watch-through by persona"]'),
    ).toBeNull();

    // But the hero-owned watch% caption is STILL present exactly once — it is
    // container-owned, so it survives the empty-personas path where the cloud omits.
    expect(screen.getAllByTestId('reading-watch')).toHaveLength(1);
    // Fallback = round(0.42*100) = 42.
    expect(screen.getByTestId('reading-watch').textContent).toMatch(/^42%\s*watch$/);
  });

  it('opens the ONE DrillSheet with native content when a driver row is tapped (READ-07)', async () => {
    const user = userEvent.setup();
    render(<Reading />);

    // No dialog before interaction.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Tap the Hook row → the single DrillSheet opens, named by its title.
    await user.click(screen.getByTestId('driver-row-hook'));
    const dialog = await screen.findByRole('dialog', { name: 'Hook' });
    expect(dialog).toBeInTheDocument();

    // Native hook content rendered (modality rows), NOT a stub.
    expect(within(dialog).getByTestId('panel-hook')).toBeInTheDocument();
  });

  it('the cloud opens the Phase-3 personas seam in the same single DrillSheet', async () => {
    const user = userEvent.setup();
    const { container } = render(<Reading />);

    // Target the cloud SPECIFICALLY (the gauge is now also a button — D-02 score tap).
    const cloud = container
      .querySelector('svg[aria-label="Audience watch-through by persona"]')!
      .closest('[role="button"]') as HTMLElement;
    await user.click(cloud);

    const dialog = await screen.findByRole('dialog', { name: 'Audience' });
    expect(within(dialog).getByTestId('panel-personas')).toBeInTheDocument();
  });

  it('has no a11y violations in the healthy state', async () => {
    const { container } = render(<Reading />);
    const results = await axe(container);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(results).toHaveNoViolations();
  });
});
