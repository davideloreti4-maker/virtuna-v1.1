import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

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
  if (!m?.[1]) throw new Error(`${name} is not declared in globals.css`);
  return Number(m[1]);
}

/** The palette's full-viewport overlay — the element that owns the scrim. */
function overlayClassName(): string {
  const m = /className="(fixed inset-0[^"]*)"/.exec(PALETTE);
  if (!m?.[1]) throw new Error('could not find the palette overlay className');
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

// ─────────────────────────────────────────────────────────────────────────────
// The same defect, everywhere else.
//
// ⌘K was not special — it was just the one that got measured. Four more
// full-viewport overlays carried raw z-values below --z-sidebar (250):
// `ui/sheet.tsx` (overlay + content, three consumers), `SimulateDoorHost.tsx`,
// `surfaces/room-drawer.tsx`, and `home/audience-chip.tsx`'s mobile pair.
//
// The ratchet below is deliberately keyed on the SHAPE of the bug rather than on
// a list of files, so a newly written overlay fails it too. A `fixed inset-0`
// element that paints a dimming background is a modal backdrop by definition and
// belongs on the scale.
//
// One legitimate exception exists and the rule admits it by construction: a
// TRANSPARENT `fixed inset-0` click-catcher (`embedded-composer.tsx`) has no
// background and is deliberately low, because it must NOT cover the chrome — it
// only needs to catch a click outside a popover. Covering the nav there would
// turn the first tap on a nav item into a dismiss instead of a navigation.
//
// ⚠️ WHAT THIS RATCHET CANNOT SEE — stated so its green is not over-read.
// Verified by stashing the fixes and re-running: it catches `sheet.tsx` and
// `audience-chip.tsx` and MISSES the other two real offenders, because it keys
// on a dimming class sitting on the same element as the z:
//   • `room-drawer.tsx` — container is bare; the scrim is a CHILD `absolute inset-0`
//   • `SimulateDoorHost.tsx` — paints its scrim via an inline `style` background
// So this is a net for the common shape, not a proof that no overlay is mis-layered.
// A new overlay written in either of those two shapes will pass this test while
// being broken. Measure the surface; do not let a green here stand in for that.
// ─────────────────────────────────────────────────────────────────────────────

/** Every `.tsx` under a directory, recursively, repo-relative. */
function tsxFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) tsxFiles(full, acc);
    else if (entry.name.endsWith('.tsx')) acc.push(relative(ROOT, full));
  }
  return acc;
}

describe('full-viewport overlays — none may sit under the chrome', () => {
  const COMPONENT_FILES = tsxFiles(join(ROOT, 'src/components'));

  it('finds the component tree (guard against a glob that matches nothing)', () => {
    expect(COMPONENT_FILES.length).toBeGreaterThan(100);
  });

  it('puts every dimming full-viewport scrim on a --z-modal* token', () => {
    const offenders: string[] = [];

    for (const rel of COMPONENT_FILES) {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      // Every class string containing a full-viewport overlay.
      for (const m of src.matchAll(/"([^"]*fixed inset-0[^"]*)"/g)) {
        const cls = m[1] ?? '';
        const hasRawZ = /(^|\s)z-\d+(\s|$)/.test(cls);
        // A dimming backdrop — the thing that makes it a modal rather than a
        // transparent click-catcher.
        const dims = /\bbg-(black|white)\//.test(cls);
        if (hasRawZ && dims) offenders.push(`${rel}: ${cls.slice(0, 90)}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
