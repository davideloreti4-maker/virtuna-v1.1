/** @vitest-environment happy-dom */
/**
 * The Watchlist an empty account meets (2026-08-02).
 *
 * 44 of 45 accounts track nothing, so this is the Watchlist most people see — and until this
 * pass it had only ever been looked at with six sources present. It rendered as TWO stacked
 * dashed boxes: a bare "You're not watching anyone yet." carrying no action, and beneath it a
 * separate dashed block that held the actual invitation and both doors. Two dashed boxes in a
 * row read as something half-loaded.
 *
 * A FILTER miss is a different state and keeps its own thin line — an account with sources
 * that searched for a handle it doesn't hold has not got an empty watchlist.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { WatchlistPanel } from '@/components/discover/watchlist-panel';
import type { WatchlistSource } from '@/lib/discover/watchlist-reads';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

afterEach(cleanup);

const SOURCE: WatchlistSource = {
  key: 'k',
  handle: 'cbum',
  name: 'Chris Bumstead',
  avatarUrl: null,
  followerCount: 20_000,
  outlierCount: 2,
  bestMultiplier: 4.5,
  videosHeld: 3,
  newestPostAt: '2026-06-01T00:00:00Z',
  mergedFrom: null,
  held: false,
  profileHandle: 'cbum',
};

const panel = (props: Partial<Parameters<typeof WatchlistPanel>[0]> = {}) => (
  <WatchlistPanel
    sources={[]}
    latest={[]}
    query=""
    libraryCount={230}
    onBrowseOutliers={vi.fn()}
    {...props}
  />
);

describe('Watchlist — the empty account', () => {
  it('states it once, in one block, with both doors on it', () => {
    const { container } = render(panel());

    expect(screen.getByText(/nothing on your watchlist yet/i)).toBeTruthy();
    // The defect was the COUNT: an actionless box stacked on top of the invitation.
    expect(container.querySelectorAll('.border-dashed')).toHaveLength(1);
    expect(screen.getByRole('link', { name: /add a creator/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /track a competitor/i })).toBeTruthy();
  });

  it('offers the library as the way out of a dead end', () => {
    const onBrowseOutliers = vi.fn();
    render(panel({ onBrowseOutliers }));

    const out = screen.getByRole('button', { name: /230 proven outliers are already/i });
    out.click();

    expect(onBrowseOutliers).toHaveBeenCalled();
  });

  it('says nothing about a library it has none of', () => {
    // A failed corpus read zeroes the count. Offering "0 proven outliers" as the consolation
    // is worse than offering nothing.
    render(panel({ libraryCount: 0 }));
    expect(screen.queryByText(/already in the library/i)).toBeNull();
    expect(screen.getByText(/nothing on your watchlist yet/i)).toBeTruthy();
  });

  it('keeps a filter miss distinct from an empty watchlist', () => {
    render(panel({ sources: [SOURCE], query: 'nobody-by-that-name' }));

    expect(screen.getByText(/no source matches that/i)).toBeTruthy();
    expect(screen.queryByText(/nothing on your watchlist yet/i)).toBeNull();
  });
});
