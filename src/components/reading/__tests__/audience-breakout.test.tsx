/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { SegmentGroup } from '@/components/board/audience/audience-derive';
import { AudienceBreakout, buildReachStages } from '../audience-breakout';
import { makeReadingResult } from './fixtures/reading-fixture';

const group = (key: SegmentGroup['key'], pct: number, count = 2): SegmentGroup => ({
  key,
  label: key,
  pct,
  desc: '',
  count,
});

describe('buildReachStages — cohort spread → declining breakout cascade', () => {
  it('anchors Stage 1 on the warmest cohort, Viral on the coldest, interpolating between', () => {
    const groups = [
      group('loyalist', 84),
      group('niche', 60),
      group('fyp', 40),
      group('cross_niche', 38),
    ];
    const model = buildReachStages(groups);
    expect(model).not.toBeNull();
    const rates = model!.stages.map((s) => s.rate);

    // warm=84, cold=38 → interpolate across 4 stages.
    expect(rates).toEqual([84, 69, 53, 38]);
    // reach labels + growing tube heights stay fixed.
    expect(model!.stages.map((s) => s.reach)).toEqual(['200', '1,000', '10,000', '100K+']);
    expect(model!.stages.map((s) => s.height)).toEqual([64, 96, 128, 160]);
    // rates are monotone non-increasing (the cascade only cools).
    for (let i = 1; i < rates.length; i++) expect(rates[i]!).toBeLessThanOrEqual(rates[i - 1]!);
  });

  it('caps at the first stage below the promotion line (cleared stages form a prefix)', () => {
    const model = buildReachStages([group('loyalist', 84), group('cross_niche', 38)])!;
    // 84, 69, 53, 38 vs line 55 → first two clear, last two cap.
    expect(model.stages.map((s) => s.cleared)).toEqual([true, true, false, false]);
    expect(model.clearedCount).toBe(2);
    expect(model.breakoutReach).toBe('1,000');
  });

  it('all stages clear when the coldest cohort still beats the line (goes viral)', () => {
    const model = buildReachStages([group('loyalist', 80), group('niche', 78)])!;
    expect(model.clearedCount).toBe(4);
    expect(model.breakoutReach).toBe('100K+');
  });

  it('no stage clears when even the warmest cohort is below the line', () => {
    const model = buildReachStages([group('fyp', 30), group('niche', 28)])!;
    expect(model.clearedCount).toBe(0);
    expect(model.breakoutReach).toBeNull();
  });

  it('ignores zero-count groups and returns null when no cohort is derivable (degraded path)', () => {
    expect(buildReachStages([])).toBeNull();
    expect(buildReachStages([group('fyp', 50, 0), group('niche', 60, 0)])).toBeNull();
  });
});

describe('AudienceBreakout — "How far it gets pushed" overview', () => {
  it('renders the four stages, reach labels, badge and a lever-naming foot', () => {
    const data = makeReadingResult();
    render(
      <AudienceBreakout
        heatmap={data.heatmap ?? null}
        simResults={data.persona_simulation_results}
        dropT={8}
      />,
    );

    expect(screen.getByTestId('audience-breakout')).toBeInTheDocument();
    expect(screen.getByText('How far it gets pushed')).toBeInTheDocument();

    // All four stage subtitles + the illustrative reach labels are present.
    // (Some stages are also named in the foot sentence → match ≥1 occurrence.)
    for (const stage of ['Stage 1', 'Stage 2', 'Stage 3', 'Viral']) {
      expect(screen.getAllByText(stage).length).toBeGreaterThan(0);
    }
    expect(screen.getByText('100K+')).toBeInTheDocument();

    // The badge summarizes where it breaks out; the foot names the 0:08 lever.
    expect(screen.getByTestId('audience-breakout-badge').textContent ?? '').toMatch(/breaks out|stalls/i);
    expect(screen.getByTestId('audience-breakout-foot').textContent ?? '').toContain('0:08');
  });

  it('returns null when there is no cohort (no empty shell)', () => {
    const { container } = render(
      <AudienceBreakout heatmap={null} simResults={undefined} dropT={null} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
