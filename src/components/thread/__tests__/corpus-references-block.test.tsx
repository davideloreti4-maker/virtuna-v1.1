/** @vitest-environment happy-dom */
/**
 * corpus-references-block — the chat agent's cited sources.
 *
 * These lock the two things that make the card a CITATION rather than a decoration:
 *  1. the numbers rendered are the tool's row data, and an unmeasured row gets no number;
 *  2. the group states what its rows SHARE, a row states only what its siblings do not.
 *
 * (2) is not cosmetic — it was found by looking at the rendered card twice. Carrying the group's
 * claim per row printed "REAL EXAMPLE" three times under a header that had just said "3 real videos";
 * carrying the row's facets printed "GREENSCREEN" three times under a greenscreen FILTER. A facet that
 * is already a filter is redundant by construction.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CorpusReferencesBlockRenderer } from '../corpus-references-block';
import type { CorpusReferencesBlock } from '@/lib/tools/blocks';

function source(over: Partial<CorpusReferencesBlock['props']['sources'][number]> = {}) {
  return {
    handle: 'creator',
    videoUrl: 'https://www.instagram.com/reel/AAA/',
    coverUrl: null,
    hookTemplate: 'You have been lied to about [X].',
    spokenHook: 'You have been lied to about protein.',
    archetype: 'contrarian',
    format: 'breakdowns-explainers',
    visualSetting: 'greenscreen',
    editingStyle: 'visual-greenscreen',
    multiplier: 12,
    views: 900_000,
    baselineLabel: 'vs their usual views',
    fitLabel: 'adjacent' as const,
    ...over,
  };
}

function block(over: Partial<CorpusReferencesBlock['props']> = {}): CorpusReferencesBlock {
  return {
    type: 'corpus-references',
    props: { query: 'protein hooks', warrant: 'topical', sources: [source()], ...over },
  } as CorpusReferencesBlock;
}

describe('CorpusReferencesBlockRenderer [thread]', () => {
  it('renders the receipt from the row data, and states no number for an unmeasured row', () => {
    render(
      <CorpusReferencesBlockRenderer
        block={block({
          sources: [
            source({ handle: 'proven', multiplier: 44, baselineLabel: 'vs their usual views' }),
            // Curated exemplar: real, admitted, teaching — but nothing measured it.
            source({ handle: 'curated', multiplier: null, baselineLabel: null, videoUrl: null }),
          ],
        })}
      />,
    );

    expect(screen.getByText('@proven')).toBeInTheDocument();
    expect(screen.getByText('44.0×')).toBeInTheDocument();
    expect(screen.getByText('@curated')).toBeInTheDocument();
    // The unmeasured row must not borrow the other's number, nor invent a basis for one.
    expect(screen.queryByText('44.0×')).toBe(screen.getByText('44.0×'));
    expect(screen.getAllByText(/vs their usual views/)).toHaveLength(1);
  });

  it('states the warrant ONCE in the header — topical vs structural make different claims', () => {
    const { unmount } = render(<CorpusReferencesBlockRenderer block={block()} />);
    expect(screen.getByText(/1 real video on this/i)).toBeInTheDocument();
    unmount();

    render(<CorpusReferencesBlockRenderer block={block({ warrant: 'structural' })} />);
    expect(screen.getByText(/borrowed for shape/i)).toBeInTheDocument();
    // The caveat that keeps a cross-niche pattern from reading as topical proof.
    expect(screen.getByText(/not about this topic/i)).toBeInTheDocument();
  });

  it('drops a per-row facet that is already a group FILTER, keeping what varies', () => {
    render(
      <CorpusReferencesBlockRenderer
        block={block({
          filters: { visualSetting: 'greenscreen' },
          sources: [
            source({ handle: 'a', editingStyle: 'notes-article-greenscreen' }),
            source({ handle: 'b', editingStyle: 'split-screen' }),
          ],
        })}
      />,
    );

    // The filter is stated once, as a chip on the group…
    expect(screen.getByLabelText('Filters applied')).toHaveTextContent('Greenscreen');
    // …and never again per row, where it would be identical on every row by construction.
    expect(screen.queryByText('Greenscreen', { selector: 'span.uppercase' })).toBeNull();
    // What actually distinguishes the rows survives.
    expect(screen.getByText(/Notes article greenscreen/i)).toBeInTheDocument();
    expect(screen.getByText(/Split screen/i)).toBeInTheDocument();
  });

  it('falls back to the warrant word when a row carries no distinguishing facet at all', () => {
    render(
      <CorpusReferencesBlockRenderer
        block={block({
          filters: { visualSetting: 'greenscreen', editingStyle: 'visual-greenscreen', format: 'tutorial' },
          sources: [source({ visualSetting: null, editingStyle: null, format: null })],
        })}
      />,
    );
    expect(screen.getByText('Real example')).toBeInTheDocument();
  });
});
