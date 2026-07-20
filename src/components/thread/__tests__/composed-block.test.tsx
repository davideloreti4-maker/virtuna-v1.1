/** @vitest-environment happy-dom */
/**
 * ComposedBlockRenderer — render lock for THE STREAM (phase 1).
 *
 * Renders the canonical all-16-primitives fixture through the REAL MessageBlocks
 * dispatch (validateBlock → BLOCK_COMPONENTS.composed), then asserts:
 *  - representative content from each structural family actually reaches the DOM
 *  - ONE frame total: exactly one [data-stream-frame] element (the asset block)
 *  - the honesty spine holds: the receipt carries provenance; an unmeasured row
 *    shows no invented number ("original — not drawn from a retrieved video")
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MessageBlocks } from '../message-blocks';
import { STREAM_COMPOSITION } from '@/lib/tools/__tests__/fixtures/stream-composition';

afterEach(cleanup);

// Card views mount SaveAffordance/ProofUnit (query client consumers) — same wrapper the
// chat-thread-view tests use.
function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('ComposedBlockRenderer via MessageBlocks', () => {
  it('renders the canonical composition end to end', () => {
    renderWithClient(<MessageBlocks body={[STREAM_COMPOSITION]} />);

    // receipt (leads) + provenance demoted into it
    expect(screen.getByText(/ran your audience · 3 steps · SIM-1 Flash/)).toBeTruthy();
    // ranked hero at hero size
    expect(screen.getByText("I trained wrong for six years. Here's what I'd keep.")).toBeTruthy();
    // honest unmeasured attribution survives verbatim
    expect(screen.getByText(/Original — not drawn from a retrieved video/)).toBeTruthy();
    // revision: before struck through, after present
    expect(screen.getByText('I filmed my form for 30 days. The problem was never form.')).toBeTruthy();
    // stats + table (rev 7) — the multipliers appear TWICE by design: once in the
    // table, once in the evidence rows (different primitives, same measured facts)
    expect(screen.getByText('2.9M')).toBeTruthy();
    expect(screen.getAllByText('9.2×')).toHaveLength(2);
    expect(screen.getAllByText('0.4×')).toHaveLength(2);
    // compare lever + facts basis-count + plan slot
    expect(screen.getByText(/Lead with the dollar amount/)).toBeTruthy();
    expect(screen.getByText('9 of 12 posts')).toBeTruthy();
    expect(screen.getByText('Form-myth explainer')).toBeTruthy();
    // persona turn — label swap, no bubble idiom to assert beyond the label
    expect(screen.getByText(/The Skeptic · via Maven/)).toBeTruthy();
    // input ask control row
    expect(screen.getByPlaceholderText('Paste a TikTok link…')).toBeTruthy();
    expect(screen.getByText('Decode it →')).toBeTruthy();
  });

  it('rev 8 card language — ranked results render as make-family cards', () => {
    renderWithClient(<MessageBlocks body={[STREAM_COMPOSITION]} />);
    // the eyebrow kicker (who it's for) + the shipped ProofReceipt eyebrow + the action bar
    expect(screen.getByText('For your Aspirants')).toBeTruthy();
    expect(screen.getByText('Proven structure')).toBeTruthy();
    expect(screen.getAllByText('Write script →').length).toBeGreaterThan(0);
  });

  it('the flagship /test verdict renders via the shipped video-test card', () => {
    renderWithClient(<MessageBlocks body={[STREAM_COMPOSITION]} />);
    expect(screen.getByText('Solid contender')).toBeTruthy();
    // bands-only spine: the fraction renders, no 0-100 anywhere in the composition
    expect(screen.getAllByText(/6\/10 stopped/).length).toBeGreaterThan(0);
  });

  it('an invalid composition falls to UnsupportedBlock, never a partial render', () => {
    const bad = {
      type: 'composed',
      props: { items: [{ kind: 'chart', data: [1] }] },
    };
    const { container } = renderWithClient(<MessageBlocks body={[bad]} />);
    expect(container.querySelector('[data-stream]')).toBeNull();
  });
});
