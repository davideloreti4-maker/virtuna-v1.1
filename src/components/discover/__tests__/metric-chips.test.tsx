/** @vitest-environment happy-dom */
/**
 * The card's metric row (2026-08-04).
 *
 * The owner's Sandcastles reference states a post's numbers as discrete tinted chips under
 * the title. Moving to that shape meant the card stopped hand-rolling a green ▲ over the
 * cover and started composing `MetricChips`, which is where the two dangerous conversions
 * on this surface now live. Both are the kind that render a plausible screen while lying:
 *
 *   · `engagement` is a FRACTION in the corpus (0.041) and a PERCENT everywhere a human
 *     reads it (4.1%). The filter predicate already had this exact bug covered by its own
 *     test; a chip that prints the raw fraction is the same defect one layer up, and "0.0%"
 *     on every card is not obviously wrong to anyone who has not seen the column.
 *   · a row with no baseline makes NO claim. 136 of 532 rows are baseline-less by design.
 *     A metric row that reaches for `multiplier ?? 0` prints "0.0×" — inventing a measured
 *     failure for a post that was never measured at all.
 *
 * The third assertion is the structural one the refine exists for: the multiplier is a chip
 * in the row beside the other two, not an overlay stuck on the cover image.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { MetricChips, fmtEngagement } from '@/components/discover/discover-primitives';
import { OutliersPanel } from '@/components/discover/outliers-panel';
import type { CorpusVideo } from '@/lib/discover/corpus-reads';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

afterEach(cleanup);

const video = (over: Partial<CorpusVideo> = {}): CorpusVideo => ({
  id: '11111111-1111-4111-8111-111111111111',
  videoUrl: 'https://www.tiktok.com/@garyvee/video/1',
  coverUrl: null,
  handle: 'garyvee',
  spokenHook: 'Which of these two videos got more views?',
  template: 'Which of these two [X] got more [Y]?',
  archetype: 'question',
  niche: 'content-creation',
  views: 1_240_000,
  platform: 'tiktok',
  engagement: 0.041,
  postedAt: '2026-06-01T00:00:00Z',
  multiplier: 11.5,
  baselineLabel: 'vs own',
  proven: true,
  extreme: false,
  ...over,
});

describe('engagement reaches the eye as a percent, not as the stored fraction', () => {
  it('renders 0.041 as 4.1%', () => {
    expect(fmtEngagement(0.041)).toBe('4.1%');
  });

  it('keeps one decimal — the corpus runs 0 → 0.24, so whole percents collapse the floor', () => {
    // 10 of 532 rows sit under 0.1%. Rounded to whole percents they are all "0%", which
    // reads as "we measured nothing" rather than "this barely engaged".
    expect(fmtEngagement(0.004)).toBe('0.4%');
    expect(fmtEngagement(0.2412)).toBe('24.1%');
  });

  it('puts the percent on the chip, not the raw 0.041', () => {
    render(<MetricChips video={video({ engagement: 0.041 })} />);
    expect(screen.getByText('4.1%')).toBeTruthy();
    expect(screen.queryByText(/0\.041/)).toBeNull();
  });

  it('omits the chip entirely when the row has no engagement recorded', () => {
    // 1 of 532. `?? 0` here would print a measured-looking "0.0%" for a post nobody measured.
    render(<MetricChips video={video({ engagement: null })} />);
    expect(screen.queryByText(/%$/)).toBeNull();
  });
});

describe('a row with no baseline still makes no claim inside the chip row', () => {
  it('says curated instead of inventing 0×', () => {
    render(<MetricChips video={video({ multiplier: null, proven: false })} />);
    expect(screen.getByText('curated')).toBeTruthy();
    expect(screen.queryByText(/0\.0×/)).toBeNull();
  });

  it('flags a thin-baseline extreme rather than showing it in proven green', () => {
    const PROVEN_GREEN = '.text-\\[color\\:var\\(--color-positive\\)\\]';
    // Negative control first: without it this selector could be wrong and the assertion
    // below would pass on any markup at all.
    const proven = render(<MetricChips video={video({ multiplier: 11.5 })} />);
    expect(proven.container.querySelector(PROVEN_GREEN)).not.toBeNull();
    cleanup();

    const { container } = render(
      <MetricChips video={video({ multiplier: 20154, extreme: true })} />,
    );
    expect(screen.getByText(/20154×/)).toBeTruthy();
    expect(container.querySelector(PROVEN_GREEN)).toBeNull();
  });
});

describe('the outlier card states its multiplier in the meta row, not on the cover', () => {
  it('renders all three metrics as siblings under the title', () => {
    render(
      <OutliersPanel
        videos={[video({ multiplier: 4.2, views: 61_000, engagement: 0.03 })]}
        query=""
        refreshedLabel="Newest video 2026-06-10"
        onOpen={vi.fn()}
      />,
    );
    // The chip row is one element; before this pass the multiplier lived in the cover's
    // absolutely-positioned overlay and had no container in common with the other two.
    const multiplier = screen.getByText(/4\.2×/);
    const row = multiplier.closest('div');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('61K')).toBeTruthy();
    expect(within(row as HTMLElement).getByText('3.0%')).toBeTruthy();
  });
});
