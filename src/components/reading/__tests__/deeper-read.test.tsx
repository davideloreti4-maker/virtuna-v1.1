/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

import { makeReadingResult, makeApolloNullResult } from './fixtures/reading-fixture';
import { DeeperRead } from '../deeper-read';
import type { ApolloDimension } from '@/lib/engine/types';

function dims(): ApolloDimension[] {
  return makeReadingResult().apollo_reasoning!.dimensions;
}

describe('DeeperRead — inline-expand of the remaining 3 Apollo dims (READ-08, D-13)', () => {
  it('collapsed by default; activating "Deeper read" reveals clarity/substance/credibility inline (no dialog)', async () => {
    const user = userEvent.setup();
    render(<DeeperRead dimensions={dims()} />);

    // the trigger is present...
    const trigger = screen.getByRole('button', { name: /deeper read/i });
    // ...but the dim rows are not visible while collapsed
    expect(screen.queryByText('Clarity')).not.toBeInTheDocument();
    expect(screen.queryByText('Substance')).not.toBeInTheDocument();
    expect(screen.queryByText('Credibility')).not.toBeInTheDocument();

    await user.click(trigger);

    // now the three remaining dims are visible INLINE — no Sheet/dialog opened
    expect(screen.getByText('Clarity')).toBeInTheDocument();
    expect(screen.getByText('Substance')).toBeInTheDocument();
    expect(screen.getByText('Credibility')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // the funnel dims (hook/retention/share_pull — owned by DriverRows) are NOT here
    expect(screen.queryByText('Hook')).not.toBeInTheDocument();
    expect(screen.queryByText('Retention')).not.toBeInTheDocument();
  });

  it('each visible dim row shows its score (tabular-nums) + a band word in a score-zone token class', async () => {
    const user = userEvent.setup();
    const { container } = render(<DeeperRead dimensions={dims()} />);
    await user.click(screen.getByRole('button', { name: /deeper read/i }));

    // clarity = score 72, band 'strong' → 'Strong' colored by --color-success
    const rows = container.querySelectorAll('[data-testid="deeper-read-row"]');
    expect(rows).toHaveLength(3);

    const clarity = screen.getByText('Clarity').closest('[data-testid="deeper-read-row"]')!;
    expect(within(clarity as HTMLElement).getByText('72')).toBeInTheDocument();
    const clarityBand = within(clarity as HTMLElement).getByText('Strong');
    expect(clarityBand.className).toContain('text-success');

    // substance = 70 strong, credibility = 80 strong → both success-toned
    const substance = screen.getByText('Substance').closest('[data-testid="deeper-read-row"]')!;
    expect(within(substance as HTMLElement).getByText('70')).toBeInTheDocument();
  });

  it('band colors map to score-zone tokens: strong→success, mid→warning, weak→error', async () => {
    const user = userEvent.setup();
    // force one of each band across the three deeper dims
    const mixed = dims().map((d) => {
      if (d.name === 'clarity') return { ...d, band: 'strong' as const, score: 88 };
      if (d.name === 'substance') return { ...d, band: 'mid' as const, score: 55 };
      if (d.name === 'credibility') return { ...d, band: 'weak' as const, score: 30 };
      return d;
    });
    render(<DeeperRead dimensions={mixed} />);
    await user.click(screen.getByRole('button', { name: /deeper read/i }));

    expect(screen.getByText('Strong').className).toContain('text-success');
    expect(screen.getByText('Mid').className).toContain('text-warning');
    expect(screen.getByText('Weak').className).toContain('text-error');
  });

  it('D-13 degrade: apollo_reasoning null (no dimensions) → renders nothing, does not throw', () => {
    const nullDims = makeApolloNullResult().apollo_reasoning?.dimensions ?? null;
    const { container } = render(<DeeperRead dimensions={nullDims} />);
    // no trigger, no rows — the component returns null (hero/rows resolve elsewhere)
    expect(screen.queryByRole('button', { name: /deeper read/i })).not.toBeInTheDocument();
    expect(container.querySelector('[data-testid="deeper-read-row"]')).toBeNull();
  });

  it('partial dims: only some of the 3 present → renders only those, omits missing silently', async () => {
    const user = userEvent.setup();
    // drop substance + credibility → only clarity remains of the deeper trio
    const partial = dims().filter((d) => d.name !== 'substance' && d.name !== 'credibility');
    render(<DeeperRead dimensions={partial} />);
    await user.click(screen.getByRole('button', { name: /deeper read/i }));

    expect(screen.getByText('Clarity')).toBeInTheDocument();
    expect(screen.queryByText('Substance')).not.toBeInTheDocument();
    expect(screen.queryByText('Credibility')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('deeper-read-row')).toHaveLength(1);
  });

  it('passes axe', async () => {
    const { container } = render(<DeeperRead dimensions={dims()} />);
    const results = await axe(container);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(results).toHaveNoViolations();
  });
});
