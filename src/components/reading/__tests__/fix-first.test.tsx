/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

import { makeReadingResult } from './fixtures/reading-fixture';
import { FixFirstList } from '../fix-first-list';
import type { CounterfactualSuggestionItem, ApolloRewrite } from '@/lib/engine/types';

// happy-dom clipboard polyfill — the embedded RewriteItem reads navigator.clipboard.
beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

function fixes(): CounterfactualSuggestionItem[] {
  return makeReadingResult().counterfactuals!.suggestions;
}
function rewrites(): ApolloRewrite[] {
  return makeReadingResult().apollo_reasoning!.rewrites;
}

describe('FixFirstList — top-3 fixes + inline expand + D-14 (READ-07/08)', () => {
  it('renders the top-3 type=fix headlines; the 4th collapses behind an inline "1 more fixes →"', async () => {
    const user = userEvent.setup();
    // fixture has 3 type=fix + 1 reinforcement → add a 4th fix so the overflow path triggers.
    const fourFixes: CounterfactualSuggestionItem[] = [
      ...fixes().filter((s) => s.type === 'fix'),
      { type: 'fix', headline: 'Trim the dead air', detail: 'Cut the 0:11 pause.', timestamp_ms: 11000, signal_anchor: 'pacing' },
    ];
    render(<FixFirstList fixes={fourFixes} rewrites={null} />);

    // exactly 3 fix headlines visible before expanding
    expect(screen.getByText('Recut the open')).toBeInTheDocument();
    expect(screen.getByText('Tighten the text overlay')).toBeInTheDocument();
    expect(screen.getByText('Add an explicit CTA')).toBeInTheDocument();
    // the 4th is hidden until expand
    expect(screen.queryByText('Trim the dead air')).not.toBeInTheDocument();

    // inline overflow affordance (NOT a Sheet/dialog)
    const more = screen.getByRole('button', { name: /1 more fixes/i });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(more);
    // 4th now revealed inline; still no dialog opened
    expect(screen.getByText('Trim the dead air')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('each fix renders headline + detail; non-fix suggestion types are excluded', () => {
    render(<FixFirstList fixes={fixes()} rewrites={null} />);
    // headline + detail for a fix
    expect(screen.getByText('Recut the open')).toBeInTheDocument();
    expect(screen.getByText('You lose them at 0:08 — front-load the payoff.')).toBeInTheDocument();
    // the reinforcement item ("Keep the cold open") must NOT render in Fix First
    expect(screen.queryByText('Keep the cold open')).not.toBeInTheDocument();
  });

  it('D-14 empty: zero fixes shows the positive win, not a blank or a fabricated list', () => {
    render(<FixFirstList fixes={[]} rewrites={null} />);
    expect(screen.getByText('Nothing urgent to fix')).toBeInTheDocument();
    expect(screen.getByText("This one's solid.")).toBeInTheDocument();
    // no fix list rendered
    expect(screen.queryByTestId('fix-first-item')).not.toBeInTheDocument();
  });

  it('D-14 empty: undefined fixes (no counterfactuals) also shows the win, no throw', () => {
    render(<FixFirstList fixes={undefined} rewrites={null} />);
    expect(screen.getByText('Nothing urgent to fix')).toBeInTheDocument();
  });

  // Score-aware empty state — counterfactuals are dormant (post-R9), so fixItems is
  // ALWAYS empty today. Without the score gate every Reading claimed "This one's
  // solid", even a 27 flop. The win must be reserved for a genuinely strong read.
  it('empty + WEAK score names the weakest lever — never claims "This one\'s solid"', () => {
    render(
      <FixFirstList
        fixes={[]}
        rewrites={null}
        score={27}
        weakestLever={{ label: 'Hook', score: 20 }}
      />,
    );
    expect(screen.getByText(/Start with your hook/i)).toBeInTheDocument();
    expect(screen.getByText(/weakest lever, at 20\/100/i)).toBeInTheDocument();
    expect(screen.queryByText("This one's solid.")).not.toBeInTheDocument();
  });

  it('empty + a red lever under an otherwise-good overall still does NOT claim solid', () => {
    // overall 72 (good band) but the hook is in the red (<40) → honest, not "solid".
    render(
      <FixFirstList
        fixes={[]}
        rewrites={null}
        score={72}
        weakestLever={{ label: 'Hook', score: 31 }}
      />,
    );
    expect(screen.getByText(/Start with your hook/i)).toBeInTheDocument();
    expect(screen.queryByText("This one's solid.")).not.toBeInTheDocument();
  });

  it('empty + genuinely STRONG score (good overall, no red lever) → the solid win', () => {
    render(
      <FixFirstList
        fixes={[]}
        rewrites={null}
        score={85}
        weakestLever={{ label: 'Retention', score: 74 }}
      />,
    );
    expect(screen.getByText('Nothing urgent to fix')).toBeInTheDocument();
    expect(screen.getByText("This one's solid.")).toBeInTheDocument();
  });

  it('D-14 no rewrites: rewrites null → fixes render WITHOUT any Copy/RewriteItem chip', () => {
    render(<FixFirstList fixes={fixes()} rewrites={null} />);
    // fixes present
    expect(screen.getByText('Recut the open')).toBeInTheDocument();
    // no rewrite section / no Copy affordance
    expect(screen.queryByRole('button', { name: /copy rewrite/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('reading-rewrite')).not.toBeInTheDocument();
  });

  it('with rewrites present → one RewriteItem per rewrite (delegates to the rewrite atom)', () => {
    render(<FixFirstList fixes={fixes()} rewrites={rewrites()} />);
    const items = screen.getAllByTestId('reading-rewrite');
    expect(items).toHaveLength(rewrites().length); // 2 in the fixture
    // each carries a Copy button
    expect(screen.getAllByRole('button', { name: /copy rewrite/i })).toHaveLength(2);
  });

  it('renders standalone with NO board-store provider (board coupling severed)', () => {
    // mounting bare (no <BoardStoreProvider>) must not throw — proves useBoardStore is gone.
    expect(() => render(<FixFirstList fixes={fixes()} rewrites={null} />)).not.toThrow();
  });

  it('passes axe (full + empty states)', async () => {
    const full = render(<FixFirstList fixes={fixes()} rewrites={rewrites()} />);
    const r1 = await axe(full.container);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(r1).toHaveNoViolations();

    const empty = render(<FixFirstList fixes={[]} rewrites={null} />);
    const r2 = await axe(empty.container);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(r2).toHaveNoViolations();
  });
});
