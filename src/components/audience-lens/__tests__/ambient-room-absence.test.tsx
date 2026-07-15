/** @vitest-environment happy-dom */
/**
 * AmbientRoom — a persona who said NOTHING must not look like a persona who said something.
 *
 * THE BUG THIS PINS: when the SIM returned no verbatim for a persona, the Room rendered the
 * absence in the QUOTE SLOT, in ITALIC — and italic is this app's verbatim idiom (PopulationSwarm
 * renders a real quote in italic; the thread's blockquotes are italic). So the one thing standing
 * where a quote goes, wearing a quote's clothing, was the fact that the persona never spoke.
 *
 * We are scrupulous about never fabricating a quote — and then styled the ABSENCE of one to read
 * as a quiet remark. Same defect class as the missing proof receipt (#287 → NoSourceNote) and the
 * dead audience that shipped as HIGH confidence: state the absence, don't dress it up.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { AmbientRoom } from '../AmbientRoom';

afterEach(cleanup);

/** One persona who spoke, one who stopped silently, one who scrolled silently. */
const MIXED = [
  { archetype: 'the_skeptic', verdict: 'stop' as const, quote: 'Okay, that got me.' },
  { archetype: 'the_loyalist', verdict: 'stop' as const, quote: '' },
  { archetype: 'the_lurker', verdict: 'scroll' as const, quote: '' },
];

function renderRoom() {
  const result = render(
    <AmbientRoom
      reducedMotion
      conceptText="Hook one"
      fraction="1/3 stop"
      flatPersonas={MIXED}
    />,
  );
  // The standalone room now LANDS on the brain (its landing view, added on feat/audience-brain-panel).
  // The per-persona voices — where an absence is rendered — live under "The people"; switch to it
  // before asserting. The feature is unchanged; only the default view moved.
  fireEvent.click(screen.getByRole('button', { name: 'The people' }));
  return result;
}

describe('AmbientRoom — an absence is stated, never dressed as speech', () => {
  it('does not render the silent personas in italic (the verbatim idiom)', () => {
    renderRoom();

    const absence = screen.getAllByText(/no words recorded/i);
    expect(absence.length).toBeGreaterThan(0);

    for (const el of absence) {
      // The load-bearing assertion. A bare `italic` class here would put an ABSENCE in the same
      // typographic voice the app uses for things a persona actually SAID. Compared as class
      // TOKENS, not as a substring — `not-italic` contains the word "italic" and is the opposite.
      const classes = el.className.split(/\s+/);
      expect(classes).not.toContain('italic');
      expect(classes).toContain('not-italic');
      // ...and it is visibly an empty slot, not a filled one (NoSourceNote's dashed spine).
      expect(classes).toContain('border-dashed');
    }
  });

  it('never wraps an absence in quote marks', () => {
    renderRoom();
    for (const el of screen.getAllByText(/no words recorded/i)) {
      expect(el.textContent ?? '').not.toMatch(/[“”"]/);
    }
  });

  it('still renders a REAL quote as a quote — serif, in quote marks', () => {
    renderRoom();
    // The persona who actually spoke is unchanged: the fix must not flatten real verbatims.
    const spoken = screen.getByText(/Okay, that got me/);
    expect(spoken.className).toMatch(/font-serif/);
    expect(spoken.textContent ?? '').toMatch(/[“”]/);
  });

  it('distinguishes a silent STOP from a silent SCROLL — they are different facts', () => {
    renderRoom();
    expect(screen.getByText(/^Stopped\. No words recorded\.$/)).toBeTruthy();
    expect(screen.getByText(/^Scrolled past\. No words recorded\.$/)).toBeTruthy();
  });
});
