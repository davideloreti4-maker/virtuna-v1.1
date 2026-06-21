/** @vitest-environment happy-dom */
/**
 * card-reaction-at-rest — the resting-state reaction readout (Surface 3, D-01/D-03).
 *
 * CardReactionAtRest is the per-card "reaction at rest" content rendered INSIDE the
 * existing LensTrigger on each generated skill card (idea/hook/script/remix). It promotes
 * the quiet "tap to see the room" cue into a visible readout: the real `{stop}/{total} stop`
 * fraction + a thin cream-vs-muted sentiment ribbon.
 *
 * The honesty spine is the load-bearing contract these tests lock:
 *  - A parseable fraction → the fraction text + a ribbon whose cream fill width = stop/total.
 *  - An UNPARSEABLE / empty fraction → renders NOTHING (`container.firstChild === null`) —
 *    the honest silent degrade (mirrors `cardScrollQuoteReactions([])` → LensTrigger collapse).
 *  - Token correctness: NO legacy `#FF7F50` / `rgba(255,127,80)` (THEME-06 SSOT is
 *    `var(--color-accent)`); a positive reaction is CREAM, never coral.
 *  - It carries NO quote and NO band chip — those stay in the card (no duplication).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CardReactionAtRest } from '../card-reaction-at-rest';

afterEach(cleanup);

describe('CardReactionAtRest — resting-state reaction readout (Surface 3)', () => {
  it('renders the stop fraction text "6/10 stop" for a parseable fraction', () => {
    const { container } = render(<CardReactionAtRest fraction="6/10 stop" />);
    expect(container.textContent).toContain('6/10 stop');
  });

  it('renders a ribbon whose cream fill width is derived from the fraction (6/10 → 60%)', () => {
    const { getByTestId } = render(<CardReactionAtRest fraction="6/10 stop" />);
    const fill = getByTestId('reaction-ribbon-fill');
    expect(fill).toBeTruthy();
    expect(fill.style.width).toBe('60%');
  });

  it('renders the fill at 100% for an all-stop fraction (10/10)', () => {
    const { getByTestId } = render(<CardReactionAtRest fraction="10/10 stop" />);
    expect(getByTestId('reaction-ribbon-fill').style.width).toBe('100%');
  });

  it('renders NOTHING for an unparseable fraction (honest degrade)', () => {
    const { container } = render(<CardReactionAtRest fraction="not-a-fraction" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders NOTHING for an empty fraction (honest degrade)', () => {
    const { container } = render(<CardReactionAtRest fraction="" />);
    expect(container.firstChild).toBeNull();
  });

  it('uses tabular-nums on the fraction text (UI-SPEC §Surface 3)', () => {
    const { container } = render(<CardReactionAtRest fraction="6/10 stop" />);
    expect(container.innerHTML).toContain('tabular-nums');
  });

  it('source is token-correct — no legacy #FF7F50 / rgba(255,127,80) coral (Pitfall 3)', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/components/audience-lens/card-reaction-at-rest.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/#FF7F50/i);
    expect(src).not.toMatch(/255\s*,\s*127\s*,\s*80/);
  });

  it('source carries no quote and no band chip — those stay in the card (no duplication)', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/components/audience-lens/card-reaction-at-rest.tsx'),
      'utf8',
    );
    // Strip comments so the honesty-framing prose does not trip the assertion.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/blockquote/);
    expect(code).not.toMatch(/scrollQuote/);
    expect(code).not.toMatch(/\bband\b/);
  });
});
