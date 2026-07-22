/** @vitest-environment happy-dom */
/**
 * OutlierTile — standard-conformance guards (2026-07-21). Locks the three moves that brought
 * the Explore tile onto the card spine (docs/subsystems/ui-skill-cards.md §0.5 / §0.5.7). Each
 * assertion is written to FAIL against the pre-2026-07-21 tile and PASS after:
 *   1. ONE cream primary, single forward verb — "Remix →", not the two-verb "Remix → Read".
 *   2. Save + Track are demoted BELOW the primary, never stacked above it.
 *   3. The FIT magnitude bar stays neutral cream — the level tone rides a DOT on the label,
 *      never the bar fill.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { OutlierTile, type OutlierTileData } from '@/components/discover/outlier-tile';

afterEach(cleanup);

function renderWithClient(ui: ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const TILE: OutlierTileData = {
  platformVideoId: 'v1',
  videoUrl: 'https://tiktok.com/@x/video/1',
  caption: 'The one habit that changed my mornings',
  views: 2_400_000,
  likes: 312_000,
  comments: 8_400,
  shares: 41_200,
  saves: 5_000,
  durationSeconds: 34,
  postedAt: '2026-05-18T00:00:00Z',
  multiplier: 12,
  baselineLabel: 'vs own',
  source: 'Your channel',
  fit: { level: 'Strong' },
  trackable: true,
  trackHandle: 'somebody',
};

describe('OutlierTile — standard conformance', () => {
  it('uses one cream primary with a single forward verb ("Remix →")', () => {
    renderWithClient(<OutlierTile tile={TILE} onRemix={vi.fn()} onTrack={vi.fn()} />);
    expect(screen.queryByText('Remix → Read')).toBeNull();
    expect(screen.getByText('Remix →')).toBeTruthy();
  });

  it('demotes Save + Track BELOW the primary (primary leads in DOM order)', () => {
    renderWithClient(<OutlierTile tile={TILE} onRemix={vi.fn()} onTrack={vi.fn()} />);
    const primary = screen.getByRole('button', { name: /remix this outlier/i });
    const track = screen.getByRole('button', { name: /track this account/i });
    // The primary must come BEFORE the track button in document order.
    expect(primary.compareDocumentPosition(track) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps the FIT bar neutral cream — the level tone rides a dot, not the fill', () => {
    const { container } = renderWithClient(<OutlierTile tile={TILE} onRemix={vi.fn()} />);
    const fill = container.querySelector('[role="presentation"] > div') as HTMLElement;
    expect(fill.style.backgroundColor).not.toContain('positive');
    // The level tone rides the leading dot of the FIT label. Strong now uses the calm sage
    // `--color-positive` (unified 2026-07-22 to the band palette), NOT the old bright
    // `--color-success` — see FIT_BAR in outlier-tile.tsx.
    const label = screen.getByText(/FIT ·/);
    const dot = label.firstElementChild as HTMLElement;
    expect(dot.style.backgroundColor).toContain('positive');
  });
});
