/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CreatorRulebookCard } from '../CreatorRulebookCard';
import type { CreatorRulebook, RulebookCheck, RuleStatus } from '@/lib/engine/creator-rulebook';

function check(id: string, status: RuleStatus, over: Partial<RulebookCheck> = {}): RulebookCheck {
  return {
    id,
    rule: `Rule ${id}`,
    creator: 'Hormozi',
    status,
    actual: status === 'unknown' ? null : '4/10',
    target: '≥7/10',
    note: `note for ${id}`,
    ...over,
  };
}

function book(checks: RulebookCheck[]): CreatorRulebook {
  let pass = 0,
    warn = 0,
    fail = 0,
    known = 0;
  for (const c of checks) {
    if (c.status === 'pass') pass++;
    else if (c.status === 'warn') warn++;
    else if (c.status === 'fail') fail++;
    if (c.status !== 'unknown') known++;
  }
  return {
    checks,
    passCount: pass,
    warnCount: warn,
    failCount: fail,
    knownCount: known,
    coveragePct: checks.length ? Math.round((known / checks.length) * 100) : 0,
  };
}

describe('CreatorRulebookCard', () => {
  it('renders each known check with rule label, creator source, actual & target', () => {
    const rb = book([
      check('hook', 'fail', { rule: 'Hook strength', creator: 'Hoyos', actual: '3/10' }),
      check('stack', 'pass', { rule: 'Three-Hook Stack', creator: 'Ava', actual: '3/3' }),
    ]);
    render(<CreatorRulebookCard rulebook={rb} />);
    // Scope to the table — the top miss (Hook strength) also appears in the hero insight by design.
    const table = within(screen.getByTestId('data-table'));
    expect(table.getByText('Hook strength')).toBeTruthy();
    expect(table.getByText('Three-Hook Stack')).toBeTruthy();
    expect(table.getByText('Hoyos')).toBeTruthy();
    expect(table.getByText('Ava')).toBeTruthy();
    expect(table.getByText('3/3')).toBeTruthy();
  });

  it('orders problems first — a fail row precedes a pass row in the DOM', () => {
    const rb = book([
      check('good', 'pass', { rule: 'Passing rule' }),
      check('bad', 'fail', { rule: 'Failing rule' }),
    ]);
    render(<CreatorRulebookCard rulebook={rb} />);
    const rows = screen.getAllByTestId('data-row');
    expect(within(rows[0]!).getByText('Failing rule')).toBeTruthy();
    expect(within(rows[1]!).getByText('Passing rule')).toBeTruthy();
  });

  it('hero shows pass/known ratio and an on-pattern word when all pass', () => {
    const rb = book([check('a', 'pass'), check('b', 'pass')]);
    render(<CreatorRulebookCard rulebook={rb} />);
    const hero = screen.getByTestId('frame-hero');
    expect(hero).toHaveTextContent('2/2');
    expect(hero).toHaveTextContent('On-pattern');
  });

  it('shows the critical (coral) hero word when a rule fails', () => {
    const rb = book([check('a', 'fail'), check('b', 'pass')]);
    render(<CreatorRulebookCard rulebook={rb} />);
    expect(screen.getByTestId('frame-hero')).toHaveTextContent('Off-pattern');
  });

  it('excludes unknown checks from the table and footnotes the deferred count', () => {
    const rb = book([
      check('a', 'pass'),
      check('u1', 'unknown'),
      check('u2', 'unknown'),
    ]);
    render(<CreatorRulebookCard rulebook={rb} />);
    expect(screen.getAllByTestId('data-row')).toHaveLength(1);
    expect(screen.getByText(/2 more rules unlock/)).toBeTruthy();
  });

  it('renders a "needs video" state (no table) when nothing is computable', () => {
    const rb = book([check('u1', 'unknown'), check('u2', 'unknown')]);
    render(<CreatorRulebookCard rulebook={rb} />);
    expect(screen.queryByTestId('data-table')).toBeNull();
    expect(screen.getByText(/Needs video/)).toBeTruthy();
  });

  it('renders a skeleton (no table) while loading', () => {
    render(<CreatorRulebookCard isLoading />);
    expect(screen.queryByTestId('data-table')).toBeNull();
    expect(screen.getByTestId('creator-rulebook')).toBeTruthy();
  });
});
