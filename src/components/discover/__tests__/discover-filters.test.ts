/**
 * The filter predicate's two dangerous edges.
 *
 * Both are the kind that pass review by inspection and fail in production:
 *   · `engagement_rate` is stored as a FRACTION (0.041) and the control reads PERCENT (4.1).
 *     A predicate that compares them directly is wrong by exactly 100× and still returns a
 *     plausible-looking grid, so nothing about the screen says it is broken.
 *   · 136 of 532 corpus rows carry no baseline and make no claim by design. Scoring those as
 *     0× inside a numeric range would silently delete a quarter of the library from every
 *     filtered view — the fabrication the honesty gate exists to prevent, inverted.
 */

import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTERS,
  activeFilterCount,
  matchesFilters,
  type DiscoverFilterState,
} from '../discover-filters';

const NOW = Date.parse('2026-08-04T00:00:00Z');

const row = (over: Partial<Parameters<typeof matchesFilters>[0]> = {}) => ({
  handle: 'garyvee',
  platform: 'tiktok',
  niche: 'content-creation',
  views: 1_000_000,
  multiplier: 11.5,
  engagement: 0.041, // 4.1%
  postedAt: '2026-06-10T00:00:00Z',
  ...over,
});

const withFilters = (over: Partial<DiscoverFilterState>): DiscoverFilterState => ({
  ...EMPTY_FILTERS,
  ...over,
});

describe('engagement is a fraction in the data and a percent in the control', () => {
  it('matches a 4.1% row against a 4-5% band', () => {
    const f = withFilters({ minEngagement: '4', maxEngagement: '5' });
    expect(matchesFilters(row(), f, NOW)).toBe(true);
  });

  it('excludes the same row from a 5-10% band', () => {
    const f = withFilters({ minEngagement: '5', maxEngagement: '10' });
    expect(matchesFilters(row(), f, NOW)).toBe(false);
  });

  it('does NOT compare the raw fraction — 0.041 must not read as 0.041%', () => {
    // If the predicate forgot the ×100, a 0-1 band would wrongly ACCEPT this row.
    const f = withFilters({ minEngagement: '0', maxEngagement: '1' });
    expect(matchesFilters(row(), f, NOW)).toBe(false);
  });
});

describe('a row with no baseline makes no claim', () => {
  it('is excluded once either multiplier bound is set', () => {
    const f = withFilters({ minMultiplier: '3' });
    expect(matchesFilters(row({ multiplier: null }), f, NOW)).toBe(false);
  });

  it('is NOT scored as zero — a 0-100x band must not sweep it in', () => {
    const f = withFilters({ minMultiplier: '0', maxMultiplier: '100' });
    expect(matchesFilters(row({ multiplier: null }), f, NOW)).toBe(false);
  });

  it('still shows when no multiplier bound is touched', () => {
    expect(matchesFilters(row({ multiplier: null }), EMPTY_FILTERS, NOW)).toBe(true);
  });
});

describe('the remaining axes', () => {
  it('filters on creator, platform and niche exactly', () => {
    expect(matchesFilters(row(), withFilters({ creator: 'garyvee' }), NOW)).toBe(true);
    expect(matchesFilters(row(), withFilters({ creator: 'other' }), NOW)).toBe(false);
    expect(matchesFilters(row(), withFilters({ platform: 'instagram' }), NOW)).toBe(false);
    expect(matchesFilters(row(), withFilters({ niche: 'content-creation' }), NOW)).toBe(true);
  });

  it('applies views bounds inclusively', () => {
    expect(matchesFilters(row(), withFilters({ minViews: '1000000' }), NOW)).toBe(true);
    expect(matchesFilters(row(), withFilters({ minViews: '1000001' }), NOW)).toBe(false);
    expect(matchesFilters(row(), withFilters({ maxViews: '999999' }), NOW)).toBe(false);
  });

  it('converts the age unit rather than comparing raw numbers', () => {
    // Posted 2026-06-10, "now" 2026-08-04 — ~55 days.
    expect(matchesFilters(row(), withFilters({ age: '1', ageUnit: 'years' }), NOW)).toBe(true);
    expect(matchesFilters(row(), withFilters({ age: '3', ageUnit: 'months' }), NOW)).toBe(true);
    expect(matchesFilters(row(), withFilters({ age: '1', ageUnit: 'months' }), NOW)).toBe(false);
    expect(matchesFilters(row(), withFilters({ age: '7', ageUnit: 'days' }), NOW)).toBe(false);
  });

  it('drops a row with no date only when an age bound is set', () => {
    expect(matchesFilters(row({ postedAt: null }), EMPTY_FILTERS, NOW)).toBe(true);
    expect(
      matchesFilters(row({ postedAt: null }), withFilters({ age: '1', ageUnit: 'years' }), NOW),
    ).toBe(false);
  });
});

describe('activeFilterCount drives the Clear affordance', () => {
  it('ignores ageUnit, which always has a value', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount(withFilters({ ageUnit: 'days' }))).toBe(0);
  });

  it('counts each narrowing field once', () => {
    expect(activeFilterCount(withFilters({ creator: 'garyvee', minViews: '100' }))).toBe(2);
  });
});
