import { describe, it, expect } from 'vitest';
import { derivePersonaInsight } from '../audience-constants';

function p(id: string, swipe: number | null, archetype?: string) {
  return { id, swipe_predicted_at: swipe, archetype };
}

describe('derivePersonaInsight', () => {
  it('returns null when there are no personas', () => {
    expect(derivePersonaInsight([])).toBeNull();
  });

  it('reports all-watched when no persona drops', () => {
    expect(derivePersonaInsight([p('a', null), p('b', null)])).toBe(
      'All personas watch to the end',
    );
  });

  it('surfaces the earliest-dropping persona when it is a clear outlier', () => {
    const insight = derivePersonaInsight([
      p('niche_deep_scout', 3, 'niche_deep_scout'),
      p('x', 21),
      p('y', 21),
      p('z', 20),
    ]);
    // median of [3,20,21,21] (index 2) = 21; earliest 3 < 21-4 → outlier shown
    expect(insight).toBe('Most viewers hold to ~21s · Niche Scout drops first at 3s');
  });

  it('omits the outlier clause when the earliest drop is near the median', () => {
    const insight = derivePersonaInsight([p('a', 20), p('b', 21), p('c', 22)]);
    // median 21; earliest 20 is within 4s → no outlier clause
    expect(insight).toBe('Most viewers hold to ~21s');
  });

  it('falls back to the raw archetype/id when no display name exists', () => {
    const insight = derivePersonaInsight([p('mystery', 2, 'unknown_archetype'), p('b', 25)]);
    expect(insight).toContain('unknown_archetype drops first at 2s');
  });
});
