import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';
import { CSS, DARK, LIGHT, NEXT_LOOK_THEMED, lookTokens, references, resolveToken, ruleBlock } from './next-look-css';

// ─────────────────────────────────────────────────────────────────────────────
// Next look (behind NEXT_PUBLIC_NEW_LOOK): the colours are judged from the CSS,
// not from the table in the spec. A value changed in globals.css that drops a
// pair under the WCAG floor fails here, in both themes.
//
// PURE FS test (default `node` env).
// ─────────────────────────────────────────────────────────────────────────────

type RGBA = [number, number, number, number];

function parseColor(value: string): RGBA {
  const v = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{6})$/.exec(v)?.[1];
  if (hex) {
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), 1];
  }
  const fn = /^rgba?\(([^)]+)\)$/.exec(v)?.[1];
  if (fn) {
    const p = fn.split(',').map((s) => Number(s.trim()));
    if (p.length >= 3 && p.every(Number.isFinite)) return [p[0]!, p[1]!, p[2]!, p[3] ?? 1];
  }
  throw new Error(`cannot parse colour "${value}"`);
}

function over(fg: RGBA, bg: RGBA): RGBA {
  const a = fg[3];
  return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
}

function luminance(c: RGBA): number {
  const f = (x: number) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}

/** WCAG contrast of `fg` painted over `layers`: first layer on top, last at the bottom. */
function contrast(fg: string, layers: string[]): number {
  const ground = layers
    .map(parseColor)
    .reduceRight<RGBA>((below, layer) => over(layer, below), [255, 255, 255, 1]);
  const ink = over(parseColor(fg), ground);
  const a = luminance(ink);
  const b = luminance(ground);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** [what it is, foreground token, layers from top to bottom] */
type Pair = [string, string, string[]];

const TEXT: Pair[] = [
  ['text on the ground', '--color-foreground', ['--color-background']],
  ['text on the sidebar', '--color-foreground', ['--color-sidebar']],
  ['secondary text on the sidebar', '--color-foreground-secondary', ['--color-sidebar']],
  ['secondary text on a lit sidebar row', '--color-foreground-secondary', ['--color-active', '--color-sidebar']],
  ['text on a card', '--color-foreground', ['--color-surface']],
  ['secondary text on the ground', '--color-foreground-secondary', ['--color-background']],
  ['secondary text on a card', '--color-foreground-secondary', ['--color-surface']],
  ['secondary text on a tinted control on a card', '--color-foreground-secondary', ['--color-surface-sunken', '--color-surface']],
  ['secondary text on a tinted control on the ground', '--color-foreground-secondary', ['--color-surface-sunken', '--color-background']],
  ['secondary text on the glass bar over the ground', '--color-foreground-secondary', ['--color-glass', '--color-background']],
  ['"above" as text on a card', '--color-above', ['--color-surface']],
  ['"above" on its pill', '--color-above', ['--color-above-soft', '--color-surface']],
  ['"below" text on a card', '--color-below-text', ['--color-surface']],
  ['"below" text on its pill', '--color-below-text', ['--color-below-soft', '--color-surface']],
  ['text on the primary button', '--color-action-foreground', ['--color-action']],
];

const GRAPHIC: Pair[] = [
  ['"below" as a graphic on a card', '--color-below', ['--color-surface']],
  ['"above" as a graphic on a card', '--color-above', ['--color-surface']],
  ['muted on a card', '--color-foreground-muted', ['--color-surface']],
  ['muted on the ground', '--color-foreground-muted', ['--color-background']],
  ['muted on the sidebar', '--color-foreground-muted', ['--color-sidebar']],
];

/** Names @theme must know, so Tailwind generates their utilities. */
const NEW_NAMES = [
  '--color-track', '--color-gauge-track', '--color-above', '--color-above-soft', '--color-below', '--color-below-text',
  '--color-below-soft', '--color-glass', '--color-scrim',
  '--text-ui', '--text-meta', '--text-figure', '--text-figure-lg',
  '--radius-4xl', '--shadow-sheet',
] as const;

describe.each(['light', 'dark'] as const)('next look, %s theme: contrast computed from globals.css', (theme) => {
  const tokens = lookTokens(theme);
  const value = (name: string) => resolveToken(name, tokens);

  it.each(TEXT)('%s reads at 4.5:1 or better', (_label, fg, layers) => {
    expect(contrast(value(fg), layers.map(value))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(GRAPHIC)('%s reads at 3:1 or better', (_label, fg, layers) => {
    expect(contrast(value(fg), layers.map(value))).toBeGreaterThanOrEqual(3);
  });

  it('has no circular var() chain (a cycle makes the property invalid, silently)', () => {
    const visit = (name: string, trail: string[]): void => {
      if (trail.includes(name)) throw new Error(`cycle: ${[...trail, name].join(' -> ')}`);
      const raw = tokens.get(name);
      if (raw === undefined) return; // set outside globals.css (--font-inter, --tw-*, …)
      for (const ref of references(raw)) visit(ref, [...trail, name]);
    };
    expect(() => { for (const name of tokens.keys()) visit(name, []); }).not.toThrow();
  });
});

describe('next look: the blocks are complete', () => {
  // NEXT_LOOK_THEMED: the tokens the dark block must re-declare, or dark would inherit a light value.
  it.each(NEXT_LOOK_THEMED)('%s is declared for light and re-declared for dark', (token) => {
    expect(ruleBlock(CSS, LIGHT).has(token), `${token} missing in ${LIGHT}`).toBe(true);
    expect(ruleBlock(CSS, DARK).has(token), `${token} missing in ${DARK}`).toBe(true);
  });

  it.each(NEW_NAMES)('%s is a name @theme knows', (token) => {
    expect(ruleBlock(CSS, '@theme').has(token)).toBe(true);
  });

  it('ties the next and dark variants to the attributes the root layout sets', () => {
    expect(CSS).toContain('@custom-variant next (&:is([data-look="next"] *));');
    expect(CSS).toContain('@custom-variant dark (&:is([data-theme="dark"] *));');
  });

  it('keeps the new type roles when a colour shares the same cn() call', () => {
    // tailwind-merge drops an unknown `text-*` as a duplicate colour unless the role is registered.
    for (const role of ['text-ui', 'text-meta', 'text-figure', 'text-figure-lg']) {
      expect(cn(role, 'text-foreground')).toBe(`${role} text-foreground`);
    }
  });
});
