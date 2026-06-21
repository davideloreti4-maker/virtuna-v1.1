/** @vitest-environment happy-dom */
/**
 * message-blocks-concept — guards the LIVE-06 / LIVE-03(b) text-Read wiring gap
 * (09-VERIFICATION GAP 1(b) + GAP 3).
 *
 * The phase-09 verifier found MessageBlocks rendered every block as `<Component block={block} />`
 * and NEVER threaded `conceptText` to PersonasBlockRenderer — so the one chat-groundable text
 * surface (the text Read's personas block) never received a concept and never mounted the
 * AudienceLens. These tests lock that:
 *  - an explicit `conceptText` reaches the personas renderer → the Lens cue (LensTrigger) mounts.
 *  - the in-band fallback (a co-located markdown block in the same body) also mounts it.
 *  - with NO concept anywhere, the personas block renders the bare summary (no Lens cue) —
 *    and other renderers stay byte-identical.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MessageBlocks } from '../message-blocks';
import { ARCHETYPES } from '@/lib/engine/wave3/persona-registry';

afterEach(cleanup);

const ENUM = ARCHETYPES[4]; // "tough_crowd" — a real registry enum

function personasBlock() {
  return {
    type: 'personas',
    props: {
      personas: [
        { archetype: ENUM, verdict: 'stop', quote: 'This stopped me cold.' },
        { archetype: 'lurker', verdict: 'scroll', quote: 'Not for me.' },
      ],
    },
  };
}

/** The LensTrigger renders a role="button" with the "See how the room reacted" aria-label. */
const LENS_CUE = 'See how the room reacted';

describe('MessageBlocks — conceptText threading (LIVE-06 text Read)', () => {
  it('mounts the Lens cue on the personas block when an explicit conceptText is supplied', () => {
    const { queryByLabelText } = render(
      <MessageBlocks body={[personasBlock()]} conceptText="A concept the room reacted to" />,
    );
    expect(queryByLabelText(LENS_CUE)).toBeTruthy();
  });

  it('mounts the Lens cue via the in-band markdown fallback (no explicit prop)', () => {
    const body = [
      { type: 'markdown', props: { text: 'The concept being tested here.' } },
      personasBlock(),
    ];
    const { queryByLabelText } = render(<MessageBlocks body={body} />);
    expect(queryByLabelText(LENS_CUE)).toBeTruthy();
  });

  it('renders the personas block WITHOUT a Lens cue when no concept exists anywhere', () => {
    const { queryByLabelText, getByText } = render(<MessageBlocks body={[personasBlock()]} />);
    expect(queryByLabelText(LENS_CUE)).toBeNull();
    // The bare summary is still present (byte-identical pre-gap behavior).
    expect(getByText(/stop/).textContent).toBeTruthy();
  });

  it('does not affect non-personas renderers (markdown renders its text unchanged)', () => {
    const { getByText } = render(
      <MessageBlocks body={[{ type: 'markdown', props: { text: 'hello world' } }]} conceptText="x" />,
    );
    expect(getByText('hello world')).toBeTruthy();
  });
});
