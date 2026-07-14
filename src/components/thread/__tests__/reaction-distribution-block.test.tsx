/** @vitest-environment happy-dom */
/**
 * The Simulate card (reaction-distribution) — the honesty spine.
 *
 * THE BUG THESE PIN (2026-07-13 card audit, item 4): the card stated the audience fraction
 * TWICE, from TWO DIFFERENT SOURCES.
 *
 *   - the band row printed `fraction` — from `aggregateFlash`, which the block schema says in
 *     so many words must NEVER be re-rolled;
 *   - the drill toggle printed `{stopCount}/{total}`, RECOMPUTED client-side by counting
 *     `reactions.filter(r => r.verdict === 'stop')`.
 *
 * Those two can disagree — one salvaged or dropped persona is enough — and then the card shows
 * "8/10" up top and "7/10 react" a few pixels below. On the one surface whose entire job is to
 * be believed. §1.3: state the fraction ONCE.
 *
 * So the load-bearing test below feeds the card a fraction that DISAGREES with its own
 * reactions, and asserts the recount is nowhere on the surface. A test that fed it consistent
 * data would pass against the bug — which is exactly how the bug survived a green suite.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactionDistributionBlockRenderer } from '@/components/thread/reaction-distribution-block';
import type { ReactionDistributionBlock } from '@/lib/tools/blocks';

function renderWithClient(ui: Parameters<typeof render>[0]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

/** 10 reactions of which only SEVEN are 'stop'. */
const REACTIONS = [
  ...Array.from({ length: 7 }, (_, i) => ({
    archetype: `stopper_${i}`,
    verdict: 'stop' as const,
    quote: `I stopped for this (${i})`,
  })),
  ...Array.from({ length: 3 }, (_, i) => ({
    archetype: `scroller_${i}`,
    verdict: 'scroll' as const,
    quote: `Not for me (${i})`,
  })),
];

function panelBlock(
  overrides: Partial<ReactionDistributionBlock['props']> = {},
): ReactionDistributionBlock {
  return {
    type: 'reaction-distribution',
    props: {
      audienceName: 'Bootstrapped Founders',
      audienceId: 'aud_1',
      subjectKind: 'panel',
      band: 'Strong',
      // NOTE the disagreement: the engine says EIGHT stopped; the reactions array contains SEVEN.
      fraction: '8/10 react',
      stimulus: 'Fire your team. Use AI.',
      themes: [{ label: 'Relief', quote: 'Finally someone says the quiet part.' }],
      reactions: REACTIONS,
      model: 'sim1-flash',
      tier: 'Directional',
      ...overrides,
    },
  } as ReactionDistributionBlock;
}

beforeEach(cleanup);

describe('Simulate card — the fraction is stated ONCE, from the engine (§1.3)', () => {
  it('does NOT re-roll the fraction from `reactions` when the two disagree', () => {
    // The engine said 8/10. The reactions array holds 7 stops. The card must not print BOTH —
    // and the number it prints must be the engine's, never a client-side recount.
    renderWithClient(<ReactionDistributionBlockRenderer block={panelBlock()} />);

    const surface = document.body.textContent ?? '';

    // The engine's number is stated.
    expect(surface).toContain('8/10');

    // The recount is NOWHERE. This is the assertion that fails against the old renderer, which
    // printed "Audience reactions — 7/10 react" on the drill toggle.
    expect(surface).not.toContain('7/10');
  });

  it('states the fraction exactly once on the whole surface', () => {
    renderWithClient(<ReactionDistributionBlockRenderer block={panelBlock()} />);
    const surface = document.body.textContent ?? '';
    const hits = surface.match(/8\/10/g) ?? [];
    expect(hits).toHaveLength(1);
  });
});

describe('Simulate card — the Lens door only opens onto a real concept', () => {
  it('offers the room when a stimulus was carried', () => {
    renderWithClient(<ReactionDistributionBlockRenderer block={panelBlock()} />);
    expect(screen.getByLabelText(/see how the room reacted/i)).toBeTruthy();
  });

  it('drops the door entirely when there is no stimulus to ground it on', () => {
    // An image/video simulate, or a block persisted before `stimulus` existed. A door onto
    // nothing is worse than no door: "Ask them why" would open grounded on an empty concept.
    renderWithClient(
      <ReactionDistributionBlockRenderer block={panelBlock({ stimulus: undefined })} />,
    );
    expect(screen.queryByLabelText(/see how the room reacted/i)).toBeNull();

    // ...but the band + fraction still render — the degrade is honest, not a blank card.
    const surface = document.body.textContent ?? '';
    expect(surface).toContain('Strong');
    expect(surface).toContain('8/10');
  });
});

describe('Simulate card — provenance is a footnote, never a headline (§0.5.1 / §0.5.6)', () => {
  it('keeps the model tag OUT of the eyebrow and on the disclosure line', () => {
    renderWithClient(<ReactionDistributionBlockRenderer block={panelBlock()} />);

    // The eyebrow carries the audience and the trust tier — not the model.
    const eyebrow = screen.getByText('Bootstrapped Founders');
    expect(eyebrow.textContent).not.toContain('SIM-1');

    // The model tag rides the one disclosure toggle instead.
    const disclosure = screen.getByRole('button', { name: /why & details|hide details/i });
    expect(disclosure.textContent).toContain('SIM-1 Flash');
  });
});

describe('Simulate card — the person variant has no distribution to state (Pitfall 2)', () => {
  it('renders a single read with no fraction and no crowd', () => {
    renderWithClient(
      <ReactionDistributionBlockRenderer
        block={
          {
            type: 'reaction-distribution',
            props: {
              audienceName: 'Marcus Reyes',
              subjectKind: 'person',
              read: {
                verdict: 'receptive',
                reasoning: 'He has said the same thing himself, twice.',
                quote: 'This is the argument I keep losing.',
              },
              model: 'sim1-flash',
              tier: 'Directional',
            },
          } as ReactionDistributionBlock
        }
      />,
    );

    const surface = document.body.textContent ?? '';
    expect(surface).toContain('Marcus Reyes is likely to be receptive');
    // A single human has no honest distribution.
    expect(surface).not.toMatch(/\d+\/\d+/);
    // Provenance still stated — demoted to a footnote, not dropped.
    expect(surface).toContain('SIM-1 Flash');
  });
});
