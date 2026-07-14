/** @vitest-environment happy-dom */
/**
 * The receipt's honest counterpart (2026-07-14, owner call).
 *
 * A grounded Ideas run attributes SOME cards to a real source and leaves others unattributed
 * (the model emits sourceIndex per card; 0 = "wrote this one myself"). The grid therefore came
 * out with a receipt on card 1 and a receipt-shaped HOLE on card 2. Honest — and it read as
 * broken. The fix states the absence instead of leaving a gap.
 *
 * The two absences these tests hold apart look identical on the wire and mean opposite things:
 *
 *   grounded: false + no proof → retrieval found nothing / is off. NOTHING TO SAY. Stay silent,
 *                                or the note lands on 100% of cards forever as pure noise.
 *   grounded: true  + no proof → we HAD real sources and the model still wrote this from
 *                                scratch. That is a fact about the output. Say it.
 *
 * The load-bearing test in here is the LIVE-STREAM one at the bottom. `grounded` is optional on
 * the block schema, so `tsc` is perfectly happy with a `toBlocks()` that forgets to copy it —
 * and `toBlocks()` hand-builds its props field-by-field. That combination would have shipped a
 * fix that works on reload and does nothing on the live run, which is the ONLY run the user
 * ever sees the half-attributed grid on. It is not hypothetical: the first cut of this change
 * did exactly that and typechecked clean.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IdeaCardRenderer } from '@/components/thread/idea-card-block';
import type { IdeaCardBlock, HookProof } from '@/lib/tools/blocks';

function renderWithClient(ui: Parameters<typeof render>[0]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const NOTE = /Original — not drawn from a retrieved video/i;

const PROOF: HookProof = {
  handle: 'braedan.health',
  videoUrl: 'https://tiktok.com/@braedan.health/video/1',
  coverUrl: null,
  hookTemplate: 'The [thing] nobody tells you about [topic]',
  archetype: 'secret-reveal-breakdown',
  multiplier: 90.7,
  views: 621_000,
  baselineLabel: 'vs followers',
  fitLabel: 'in-audience',
};

function makeBlock(overrides: Partial<IdeaCardBlock['props']> = {}): IdeaCardBlock {
  return {
    type: 'idea-card',
    props: {
      title: 'The protein-timing myth',
      angle: 'Most timing advice is cargo-culted from bodybuilding magazines',
      whyItFits: 'you post for time-pressed lifters who want the mechanism',
      mechanism: 'contradiction of a held belief',
      seedHook: 'You have been timing protein wrong',
      needsTake: false,
      topic: 'protein timing',
      take: 'the anabolic window is marketing',
      format: 'talking-head',
      band: 'Strong',
      fraction: '7/10 stop',
      scrollQuote: 'Wait — I have been timing this completely wrong',
      model: 'sim1-flash',
      ...overrides,
    },
  };
}

beforeEach(cleanup);

describe('NoSourceNote — a grounded run that attributed nothing to THIS card says so', () => {
  it('states the absence when the run had sources but this card cited none', () => {
    renderWithClient(<IdeaCardRenderer block={makeBlock({ grounded: true })} />);
    expect(screen.getByText(NOTE)).toBeTruthy();
  });

  it('stays SILENT on an ungrounded run — there is no absence to explain', () => {
    // The whole reason the note is gated on `grounded` rather than on `!proof`. With retrieval
    // off, every card lacks a source; a note on all of them is noise, not honesty.
    renderWithClient(<IdeaCardRenderer block={makeBlock()} />);
    expect(screen.queryByText(NOTE)).toBeNull();
  });

  it('shows the receipt and NOT the note when the card earned an attribution', () => {
    renderWithClient(<IdeaCardRenderer block={makeBlock({ grounded: true, proof: PROOF })} />);
    expect(screen.getByText('@braedan.health')).toBeTruthy();
    expect(screen.queryByText(NOTE)).toBeNull();
  });

  it('claims nothing it cannot know — no handle, no multiplier, no fit glyph in the note', () => {
    // The note is NOT a degraded receipt. There is no source to describe, so it must not
    // borrow any of the receipt's vocabulary (§0.5b honesty spine).
    const { container } = renderWithClient(
      <IdeaCardRenderer block={makeBlock({ grounded: true })} />,
    );
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/@/);
    expect(text).not.toMatch(/×/);
    expect(text).not.toMatch(/vs followers/);
    // ○ is FIT_META's "cross-niche structure" glyph — reusing it here would assert a fit
    // nobody computed. The dashed container carries the meaning instead.
    expect(text).not.toMatch(/[●◐○]/);
  });

  it('renders the MIXED grid the owner actually saw: card 1 receipt, card 2 stated absence', () => {
    renderWithClient(
      <>
        <IdeaCardRenderer block={makeBlock({ grounded: true, proof: PROOF })} />
        <IdeaCardRenderer block={makeBlock({ grounded: true, title: 'A second idea' })} />
      </>,
    );
    expect(screen.getByText('@braedan.health')).toBeTruthy();
    expect(screen.getAllByText(NOTE)).toHaveLength(1);
  });
});

describe('the runners set `grounded` from the SOURCES, never from the proof', () => {
  it('derives it from groundingExamples.length — a run that attributed nothing is still grounded', async () => {
    // The tempting shortcut is `grounded: Boolean(proof)`. That is self-defeating: it makes the
    // flag mean "this card has a receipt", so the note can never fire on the card that lacks one
    // — the only card it exists for. Worse, a grounded run where the model attributed NO card
    // would report itself ungrounded and go silent entirely. Pin the real source of truth.
    const { readFileSync } = await import('node:fs');
    const runners = [
      'src/lib/tools/runners/ideas-runner.ts',
      'src/lib/tools/runners/hooks-runner.ts',
      'src/lib/tools/runners/script-runner.ts',
    ];
    for (const path of runners) {
      const src = readFileSync(path, 'utf8');
      expect(src, `${path} must set grounded from the retrieved examples`).toMatch(
        /groundingExamples\.length > 0 \? \{ grounded: true \}/,
      );
      expect(src, `${path} must NOT derive grounded from proof`).not.toMatch(
        /grounded:\s*Boolean\(proof\)|grounded:\s*!!proof|grounded:\s*proof\s*!==?\s*null/,
      );
    }
  });
});

describe('the live-stream path must not drop `grounded` (the bug that typechecked clean)', () => {
  it('toBlocks() copies grounded through — a reload-only fix is not a fix', async () => {
    // toBlocks() builds props field-by-field. `grounded` is optional on the schema, so omitting
    // it there is a silent no-op to the compiler and invisible to every persisted-block test.
    // Read the source: the streaming path is the ONE the half-attributed grid appears on.
    const { readFileSync } = await import('node:fs');
    const streams = [
      'src/hooks/queries/use-ideas-stream.ts',
      'src/hooks/queries/use-hooks-stream.ts',
      'src/hooks/queries/use-script-stream.ts',
    ];
    for (const path of streams) {
      const src = readFileSync(path, 'utf8');
      // parsed off the wire...
      expect(src, `${path} must parse grounded from the SSE props`).toMatch(
        /parseGroundedProp\(props\.grounded\)/,
      );
      // ...AND copied into the block toBlocks() hands the renderer.
      expect(src, `${path} toBlocks() must copy grounded onto the block`).toMatch(
        /grounded: true/,
      );
    }
  });
});
