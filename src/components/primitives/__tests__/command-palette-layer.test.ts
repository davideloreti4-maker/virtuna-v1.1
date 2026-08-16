import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// ⌘K palette layering guard.
//
// WHY THIS EXISTS (2026-08-16): the palette's full-viewport overlay carried a
// hardcoded `z-50` while the left sidebar sits on `--z-sidebar` (250). The scrim
// therefore painted UNDER the app's own chrome: opening ⌘K dimmed <main> and the
// right rail while the left nav stayed at full contrast, so the modal read as if
// the chrome were on top of it.
//
// Measured on a signed-in dev build before the fix, at the sidebar's own centre
// (110, 450): `document.elementFromPoint` returned a sidebar <span>, NOT the
// scrim — even though the overlay's rect covered the whole 1440x900 viewport.
// After: the same point returns the scrim. Geometry was never the problem;
// stacking was.
//
// Two independent things must hold, and the pair is the point. Asserting only
// the first would be a string match against the line I just wrote; asserting
// only the second would not notice the palette opting out of the scale. So:
//
//   1. the overlay uses the shared --z-modal token rather than any raw z-value
//   2. --z-modal actually outranks --z-sidebar in globals.css
//
// (2) is what makes this a real invariant: it fails if someone renumbers the
// scale so that modals sink back below the chrome, which is the defect itself
// arriving by a different route.
//
// PURE FS test (default `node` env — no happy-dom pragma). jsdom cannot resolve
// a Tailwind arbitrary value or composite a stacking context, so a render-based
// version of this would assert less, not more.
// ─────────────────────────────────────────────────────────────────────────────

const ROOT = join(__dirname, '..', '..', '..', '..');
const CSS = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8');
const PALETTE = readFileSync(
  join(ROOT, 'src/components/primitives/CommandPalette.tsx'),
  'utf8',
);

/** Resolve a numeric `--z-*` token from the stylesheet. */
function zToken(name: string): number {
  const m = new RegExp(`^\\s*${name}\\s*:\\s*(\\d+)\\s*;`, 'm').exec(CSS);
  if (!m) throw new Error(`${name} is not declared in globals.css`);
  return Number(m[1]);
}

/** The palette's full-viewport overlay — the element that owns the scrim. */
function overlayClassName(): string {
  const m = /className="(fixed inset-0[^"]*)"/.exec(PALETTE);
  if (!m) throw new Error('could not find the palette overlay className');
  return m[1];
}

describe('⌘K command palette — layering', () => {
  it('puts its overlay on the shared --z-modal token, not a raw z-value', () => {
    const cls = overlayClassName();

    expect(cls).toContain('z-[var(--z-modal)]');
    // A raw Tailwind z-utility on this element is the exact regression: it is how
    // the overlay ended up at 50 while the chrome sat at 250.
    expect(cls).not.toMatch(/(^|\s)z-\d+(\s|$)/);
  });

  it('keeps --z-modal above --z-sidebar, so the scrim covers the chrome', () => {
    const modal = zToken('--z-modal');
    const sidebar = zToken('--z-sidebar');

    expect(modal).toBeGreaterThan(sidebar);
  });

  it('still leaves toast and tooltip above the modal layer', () => {
    // The scale only works if raising the palette did not swallow the layers
    // that are meant to survive a modal.
    expect(zToken('--z-toast')).toBeGreaterThan(zToken('--z-modal'));
    expect(zToken('--z-tooltip')).toBeGreaterThan(zToken('--z-toast'));
  });
});
