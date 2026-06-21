/** @vitest-environment happy-dom */
/**
 * Phase 14-04 — the surface lane (KCQ-09 + KCQ-04) on the fixed idea-card renderer.
 *
 * KCQ-09 (Task 1): the existing `whyItFits` grounding line is surfaced as inline
 *   plain-language "Made for you" micro-copy on the card FACE — derived from the
 *   prop (not hardcoded), and the scroll-quote still LEADS the card (D-03: above
 *   the band fraction).
 *
 * KCQ-04 (Task 2): the `predictedFailureMode` flop texture (populated in 14-02)
 *   renders as an OPT-IN drill/expand affordance — only when the field is non-null,
 *   and only inside the expand/disclosure (never on the always-visible face, never
 *   silent-only). Warning-toned (--color-warning), never coral, never error-red.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IdeaCardRenderer } from '@/components/thread/idea-card-block';
import type { IdeaCardBlock } from '@/lib/tools/blocks';

// IdeaCardRenderer mounts SaveAffordance (useSaveItem → useQueryClient), so every
// render must sit under a QueryClientProvider (Phase 10 Saved-shelf integration).
function renderWithClient(ui: Parameters<typeof render>[0]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const WHY_IT_FITS = 'you post for time-pressed lifters who want the mechanism, not hype';
const SCROLL_QUOTE = 'Wait — I have been timing this completely wrong';
const FLOP_REASON = 'reads as a listicle the niche has seen a hundred times';

function makeBlock(overrides: Partial<IdeaCardBlock['props']> = {}): IdeaCardBlock {
  return {
    type: 'idea-card',
    props: {
      title: 'The protein-timing myth',
      angle: 'Most timing advice is cargo-culted from bodybuilding magazines',
      whyItFits: WHY_IT_FITS,
      mechanism: 'Challenges a load-bearing belief with a concrete counter-fact',
      seedHook: 'protein timing is mostly a myth',
      needsTake: false,
      topic: 'nutrition timing',
      take: 'the 30-minute window is overstated',
      format: 'talking head',
      band: 'Strong',
      fraction: '7/10 stop',
      scrollQuote: SCROLL_QUOTE,
      model: 'sim1-flash',
      predictedFailureMode: null,
      ...overrides,
    },
  };
}

beforeEach(() => {
  cleanup();
});

describe('IdeaCardRenderer — KCQ-09 made-for-you rationale (Task 1)', () => {
  it('renders the whyItFits grounding line inline on the face (derived from the prop, not hardcoded)', () => {
    renderWithClient(<IdeaCardRenderer block={makeBlock()} />);
    // The rationale text is the exact whyItFits prop value.
    expect(screen.getByText(new RegExp(WHY_IT_FITS, 'i'))).toBeTruthy();
  });

  it('frames the rationale as plain-language "Made for you" micro-copy (not a source citation/pill)', () => {
    renderWithClient(<IdeaCardRenderer block={makeBlock()} />);
    expect(screen.getByText(/made for you/i)).toBeTruthy();
  });

  it('derives the rationale from the prop — a different whyItFits renders different text', () => {
    const alt = 'you sell to skeptical engineers who distrust marketing language';
    renderWithClient(<IdeaCardRenderer block={makeBlock({ whyItFits: alt })} />);
    expect(screen.getByText(new RegExp(alt, 'i'))).toBeTruthy();
    expect(screen.queryByText(new RegExp(WHY_IT_FITS, 'i'))).toBeNull();
  });

  it('keeps the scroll-quote leading the card — it renders before the band fraction (D-03)', () => {
    const { container } = renderWithClient(<IdeaCardRenderer block={makeBlock()} />);
    const html = container.innerHTML;
    const quoteIdx = html.indexOf(SCROLL_QUOTE);
    // Phase 13-02 Surface 3 added a resting-reaction readout (the real "{stop}/{total} stop"
    // fraction + ribbon) ABOVE the verbatim quote, inside the same LensTrigger. So "7/10 stop"
    // now occurs twice: first the Surface-3 readout (above the quote), then the secondary band
    // chip (below it). This test guards the ORIGINAL invariant — the quote leads the secondary
    // BAND-CHIP row — so anchor on the band chip's fraction (the occurrence in the "SIM-1 Flash"
    // chip row), not the new Surface-3 readout.
    const bandChipIdx = html.indexOf('SIM-1 Flash');
    const bandFractionIdx = html.lastIndexOf('7/10 stop', bandChipIdx);
    expect(quoteIdx).toBeGreaterThan(-1);
    expect(bandFractionIdx).toBeGreaterThan(-1);
    // Scroll-quote DOM position precedes the secondary band-chip fraction.
    expect(quoteIdx).toBeLessThan(bandFractionIdx);
    // And the new Surface-3 resting readout precedes the quote (the at-rest reaction leads).
    const surface3FractionIdx = html.indexOf('7/10 stop');
    expect(surface3FractionIdx).toBeLessThan(quoteIdx);
  });
});

describe('IdeaCardRenderer — KCQ-04 opt-in flop reveal (Task 2)', () => {
  it('renders NO flop affordance when predictedFailureMode is null', () => {
    renderWithClient(<IdeaCardRenderer block={makeBlock({ predictedFailureMode: null })} />);
    // Expand the disclosure — the affordance must still be absent.
    fireEvent.click(screen.getByRole('button', { name: /expand idea details/i }));
    expect(screen.queryByRole('button', { name: /reveal why this idea might miss/i })).toBeNull();
    expect(screen.queryByText(/if this could flop/i)).toBeNull();
  });

  it('renders NO flop affordance when predictedFailureMode is absent (older rehydrated card)', () => {
    const block = makeBlock();
    delete (block.props as { predictedFailureMode?: string | null }).predictedFailureMode;
    renderWithClient(<IdeaCardRenderer block={block} />);
    fireEvent.click(screen.getByRole('button', { name: /expand idea details/i }));
    expect(screen.queryByText(/if this could flop/i)).toBeNull();
  });

  it('flop affordance is gated behind the disclosure — NOT on the always-visible face', () => {
    renderWithClient(<IdeaCardRenderer block={makeBlock({ predictedFailureMode: FLOP_REASON })} />);
    // Before expanding: affordance is not present on the face.
    expect(screen.queryByRole('button', { name: /reveal why this idea might miss/i })).toBeNull();
    expect(screen.queryByText(FLOP_REASON)).toBeNull();
  });

  it('reveals the failure-mode text only after a second opt-in drill (never silent-only)', () => {
    renderWithClient(<IdeaCardRenderer block={makeBlock({ predictedFailureMode: FLOP_REASON })} />);
    // 1) open the disclosure — affordance appears but text stays hidden (opt-in).
    fireEvent.click(screen.getByRole('button', { name: /expand idea details/i }));
    const flopBtn = screen.getByRole('button', { name: /reveal why this idea might miss/i });
    expect(flopBtn).toBeTruthy();
    expect(screen.queryByText(FLOP_REASON)).toBeNull();
    // 2) drill the affordance — now the failure-mode text is reachable.
    fireEvent.click(flopBtn);
    expect(screen.getByText(FLOP_REASON)).toBeTruthy();
  });

  it('the flop affordance is warning-toned (--color-warning), never coral, never error-red', () => {
    renderWithClient(<IdeaCardRenderer block={makeBlock({ predictedFailureMode: FLOP_REASON })} />);
    fireEvent.click(screen.getByRole('button', { name: /expand idea details/i }));
    const flopBtn = screen.getByRole('button', { name: /reveal why this idea might miss/i });
    expect(flopBtn.getAttribute('style')).toContain('--color-warning');
    expect(flopBtn.getAttribute('style')).not.toContain('255,127,80'); // no coral
  });
});
