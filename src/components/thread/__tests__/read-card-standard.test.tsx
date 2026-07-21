/** @vitest-environment happy-dom */
/**
 * Read card — standard-conformance guards (2026-07-21).
 *
 * Locks the three moves that brought the Text Read card onto the card spine
 * (docs/subsystems/ui-skill-cards.md §0.5 / §0.5.6). The card had drifted: the band color was
 * applied twice, "The room" was a nested bordered box, and the verdict labels carried a data
 * tone on the label text. Each assertion below is written to FAIL against the pre-2026-07-21
 * card and PASS after — a real fail-first guard, not a green rubber-stamp.
 *
 *   1. Band color is a data mark used ONCE — the band WORD rides the verdict row; the
 *      interpretation sentence is plain cream (no "{band} Read." colored lead).
 *   2. "The room" is a hairline-separated SECTION, not a nested bordered box.
 *   3. The stop/scroll verdict labels stay muted cream — the green/muted color rides a DOT.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { MultiAudienceReadBlockRenderer } from '@/components/thread/multi-audience-read-block';
import { VerbatimWall } from '@/components/thread/verbatim-wall';
import type { MultiAudienceReadBlock } from '@/lib/tools/blocks';

afterEach(cleanup);

function renderWithClient(ui: ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const SINGLE: MultiAudienceReadBlock = {
  type: 'multi-audience-read',
  props: {
    model: 'sim1-flash',
    tier: 'Directional',
    audiences: [
      {
        name: 'General',
        band: 'Mixed',
        fraction: '5/10 stop',
        interpretation: 'Half stop for the shock; the other half suspect a bait-and-switch.',
        lever: 'Add a concrete receipt early.',
        whoNotFor: '',
        personas: [
          { archetype: 'the_skeptic', verdict: 'scroll', quote: 'Heard this a hundred times already.' },
          { archetype: 'the_sharer', verdict: 'stop', quote: 'Sending this to my group chat right now.' },
        ],
      },
    ],
  },
};

describe('Read card — band color used once (§0.5.6)', () => {
  it('states the band WORD on the verdict row, not as a colored interpretation lead', () => {
    renderWithClient(<MultiAudienceReadBlockRenderer block={SINGLE} />);
    // The removed "{band} Read." colored lead must be gone (was the second band-color use)…
    expect(screen.queryByText('Mixed Read.')).toBeNull();
    // …and the band word now stands alone on the verdict row (its own coloured node).
    expect(screen.getByText('Mixed')).toBeTruthy();
    // The interpretation sentence still renders (plain cream, no colored lead).
    expect(screen.getByText(/suspect a bait-and-switch/)).toBeTruthy();
  });
});

describe('Read card — "The room" de-boxed, verdict color on a dot', () => {
  it('renders the room as a hairline section, not a nested bordered box', () => {
    const { container } = render(<VerbatimWall audiences={SINGLE.props.audiences} />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('border-t');
    expect(root.className).not.toContain('rounded-lg');
  });

  it('keeps the stop label muted cream — no data tone on the label text', () => {
    render(<VerbatimWall audiences={SINGLE.props.audiences} />);
    const label = screen.getByText('Stopped the scroll');
    expect(label.className).not.toContain('text-success');
    expect(label.className).toContain('text-foreground-muted');
  });
});
