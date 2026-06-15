/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

import { makeReadingResult, makeApolloNullResult } from './fixtures/reading-fixture';
import { DriverRows } from '../driver-rows';

// Pull the live Apollo dimensions / drop time out of the shared fixture so the
// tests assert against the same engine shape the thread will mount (READ-10: a
// small whitelist, never the raw spread).
function dims() {
  return makeReadingResult().apollo_reasoning!.dimensions;
}
function dropT() {
  // Canonical container path (PATTERNS L319): `data.weighted_top_dropoff_t`
  // (PredictionResult top-level, SECONDS — types.ts L483).
  return makeReadingResult().weighted_top_dropoff_t ?? null;
}

describe('DriverRows — 3 fixed-funnel levers (READ-05/06)', () => {
  it('renders exactly three rows in fixed funnel order Hook → Retention → Shareability (no sort)', () => {
    // share_pull (64) outranks retention (55), and hook (87) is the max — if the
    // component sorted, the DOM order would change. Assert the fixed order holds.
    const { container } = render(
      <DriverRows dimensions={dims()} dropT={dropT()} onRowTap={() => {}} />,
    );

    // Collect the rows in DOM order via their stable per-lever testids.
    const rows = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid^="driver-row-"]'),
    ).filter((el) => /^driver-row-(hook|retention|shareability)$/.test(el.dataset.testid ?? ''));
    expect(rows).toHaveLength(3);

    const labels = rows.map((r) => within(r).getByTestId('driver-row-label').textContent);
    expect(labels).toEqual(['Hook', 'Retention', 'Shareability']);
  });

  it('fills the Hook + Shareability bars by their 0-100 dimension score (no /10, no /max suffix)', () => {
    render(<DriverRows dimensions={dims()} dropT={dropT()} onRowTap={() => {}} />);

    // hook = 87, share_pull = 64 (from the fixture)
    const hookFill = screen.getByTestId('driver-row-fill-hook');
    const shareFill = screen.getByTestId('driver-row-fill-shareability');
    expect(hookFill).toHaveStyle({ width: '87%' });
    expect(shareFill).toHaveStyle({ width: '64%' });

    // value columns show the raw 0-100 score (not a "/100" or "/10" suffix)
    const hookRow = screen.getByTestId('driver-row-hook');
    const shareRow = screen.getByTestId('driver-row-shareability');
    expect(within(hookRow).getByTestId('driver-row-value').textContent).toBe('87');
    expect(within(shareRow).getByTestId('driver-row-value').textContent).toBe('64');
  });

  it('Retention bar fills by the retention score while its value shows ⚠ 0:08 (SECONDS, not 0:00)', () => {
    render(<DriverRows dimensions={dims()} dropT={dropT()} onRowTap={() => {}} />);

    // retention dimension score = 55 → bar fills 55%
    const retFill = screen.getByTestId('driver-row-fill-retention');
    expect(retFill).toHaveStyle({ width: '55%' });

    // value = drop timestamp from weighted_top_dropoff_t=8 SECONDS → "0:08" (NOT "0:00")
    const retRow = screen.getByTestId('driver-row-retention');
    const value = within(retRow).getByTestId('driver-row-value').textContent ?? '';
    expect(value).toContain('0:08');
    expect(value).not.toContain('0:00');
    expect(value).toContain('⚠');
  });

  it('colors ONLY the single weakest lever (min score) with its zone color + ⚠; the other two stay neutral cream', () => {
    // retention (55) is the min of hook 87 / retention 55 / share_pull 64 → it is the weakest.
    render(<DriverRows dimensions={dims()} dropT={dropT()} onRowTap={() => {}} />);

    const retFill = screen.getByTestId('driver-row-fill-retention');
    const hookFill = screen.getByTestId('driver-row-fill-hook');
    const shareFill = screen.getByTestId('driver-row-fill-shareability');

    // weakest (retention, score 55 → bandTone 'warn') takes the warning zone token.
    expect(retFill.style.background).toContain('var(--color-warning)');

    // the two non-weakest bars carry NO zone token and NO coral / glow.
    for (const fill of [hookFill, shareFill]) {
      expect(fill.style.background).not.toContain('var(--color-success)');
      expect(fill.style.background).not.toContain('var(--color-warning)');
      expect(fill.style.background).not.toContain('var(--color-error)');
      expect(fill.style.background).not.toContain('#FF7F50');
      expect(fill.style.background).not.toContain('#E8703F');
      expect(fill.style.boxShadow).toBe('');
    }

    // only the weakest row carries a ⚠ marker on its value (besides the retention drop ⚠).
    const retRow = screen.getByTestId('driver-row-retention');
    expect(within(retRow).getByTestId('driver-row-value').textContent).toContain('⚠');
  });

  it('weak red zone: when retention is the weakest AND <40, the weakest fill uses --color-error', () => {
    const lowRetention = dims().map((d) =>
      d.name === 'retention' ? { ...d, score: 22, band: 'weak' as const } : d,
    );
    render(<DriverRows dimensions={lowRetention} dropT={dropT()} onRowTap={() => {}} />);

    const retFill = screen.getByTestId('driver-row-fill-retention');
    expect(retFill.style.background).toContain('var(--color-error)');
  });

  it('degrades gracefully when apollo_reasoning is null — never renders a fabricated 0 score', () => {
    const nullDims = makeApolloNullResult().apollo_reasoning?.dimensions ?? null;
    render(<DriverRows dimensions={nullDims} dropT={dropT()} onRowTap={() => {}} />);

    // no row values region should print the literal "0" as a fake score.
    expect(screen.queryByTestId('driver-row-fill-hook')).not.toBeInTheDocument();
    const region = screen.getByTestId('driver-rows');
    // assert no value column rendered a "0" (the fabricated-score trap, D-13)
    const values = within(region).queryAllByTestId('driver-row-value');
    for (const v of values) {
      expect(v.textContent).not.toBe('0');
    }
  });

  it('each row is a ≥44px tap target that calls onRowTap with its panelId', async () => {
    const onRowTap = vi.fn();
    const user = userEvent.setup();
    render(<DriverRows dimensions={dims()} dropT={dropT()} onRowTap={onRowTap} />);

    await user.click(screen.getByTestId('driver-row-hook'));
    expect(onRowTap).toHaveBeenCalledWith('hook');

    await user.click(screen.getByTestId('driver-row-retention'));
    expect(onRowTap).toHaveBeenCalledWith('retention');

    await user.click(screen.getByTestId('driver-row-shareability'));
    expect(onRowTap).toHaveBeenCalledWith('shareability');

    // each row is a real button (keyboard + ≥44px target)
    for (const id of ['hook', 'retention', 'shareability']) {
      const row = screen.getByTestId(`driver-row-${id}`);
      expect(row.tagName).toBe('BUTTON');
      expect(row.className).toMatch(/min-h-\[44px\]/);
    }
  });

  it('passes axe', async () => {
    const { container } = render(
      <DriverRows dimensions={dims()} dropT={dropT()} onRowTap={() => {}} />,
    );
    const results = await axe(container);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(results).toHaveNoViolations();
  });
});
