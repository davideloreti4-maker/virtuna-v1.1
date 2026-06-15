/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => true,
}));

import { AudienceOrbit } from '../audience-orbit';
import { makeReadingResult } from './fixtures/reading-fixture';

describe('AudienceOrbit — labeled retention orbit', () => {
  it('labels every visible archetype node and a plain takeaway from real segments', () => {
    const data = makeReadingResult();
    render(
      <AudienceOrbit
        heatmap={data.heatmap ?? null}
        simResults={data.persona_simulation_results}
        dropT={8}
      />,
    );

    expect(screen.getByTestId('audience-orbit')).toBeInTheDocument();

    // The fixture has one persona per slot → all four archetypes are labeled.
    expect(screen.getByText('Loyal fans')).toBeInTheDocument();
    expect(screen.getByText('Your niche')).toBeInTheDocument();
    expect(screen.getByText('New viewers')).toBeInTheDocument();
    expect(screen.getByText('Cross-niche')).toBeInTheDocument();

    // The center subject + a one-line takeaway (D-15: observation, never advice).
    expect(screen.getByText('your video')).toBeInTheDocument();
    expect(screen.getByTestId('audience-orbit-takeaway').textContent ?? '').toMatch(/drops first/i);
  });

  it('returns null when there is no audience cohort (degraded path — no empty shell)', () => {
    const { container } = render(
      <AudienceOrbit heatmap={null} simResults={undefined} dropT={null} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
