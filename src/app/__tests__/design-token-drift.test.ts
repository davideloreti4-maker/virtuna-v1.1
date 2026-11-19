import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lookTokens } from './next-look-css';

// ─────────────────────────────────────────────────────────────────────────────
// Design-token drift guard.
//
// WHY THIS EXISTS (2026-08-07): `docs/DESIGN-SYSTEM.md` is named as the design
// source of truth by CLAUDE.md, and five of its nine colour rows had silently
// drifted away from `globals.css`:
//
//     app background  #262624  ->  #1f1f1e
//     sidebar         #1a1a18  ->  #2c2c2b
//     composer        #1e1d1b  ->  #1a1a19
//     chip            #2f2e2b  ->  #2c2c2b
//     accent          #d97757  ->  #FF6363
//
// This is not a cosmetic docs problem. Both a human and an agent read that table
// to decide what to write, so a stale row produces off-brand UI that no visual
// test catches — the code is "correct", it just implements the wrong system. The
// project memory records this exact failure twice ("both were stale and both
// misled a live design session").
//
// The contract: `globals.css` is the ONLY authority. For every token below, the
// value resolved from `@theme` must appear verbatim in that token's row of the
// docs table. Change the CSS and this test tells you which row to update.
//
// PURE FS test (default `node` env — no happy-dom pragma).
// ─────────────────────────────────────────────────────────────────────────────

const ROOT = join(__dirname, '..', '..', '..');
const CSS = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8');
const DOC = readFileSync(join(ROOT, 'docs/DESIGN-SYSTEM.md'), 'utf8');

/** Every `--token: value;` declaration in the stylesheet. */
function declarations(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of css.split('\n')) {
    const m = /^\s*(--[\w-]+)\s*:\s*([^;]+);/.exec(line);
    if (!m) continue;
    const [, name, value] = m;
    if (name && value && !out.has(name)) out.set(name, value.trim());
  }
  return out;
}

/** Follow `var(--x)` aliases to the literal value. */
function resolve(token: string, decls: Map<string, string>, seen = new Set<string>()): string {
  if (seen.has(token)) throw new Error(`circular var() chain at ${token}`);
  seen.add(token);
  const raw = decls.get(token);
  if (raw === undefined) throw new Error(`${token} is not declared in globals.css`);
  const aliased = /^var\(\s*(--[\w-]+)\s*\)$/.exec(raw)?.[1];
  return aliased ? resolve(aliased, decls, seen) : raw;
}

/** The markdown table row that documents this token. */
function docRow(token: string): string | undefined {
  return DOC.split('\n').find((l) => l.trimStart().startsWith('|') && l.includes(`\`${token}\``));
}

// The tokens the docs table claims to document. Adding a row to the table?
// Add it here too — an undocumented token is allowed, a MIS-documented one is not.
const DOCUMENTED = [
  '--color-background',
  '--color-chrome',
  '--color-charcoal-app',
  '--color-charcoal-sidebar',
  '--color-charcoal-composer',
  '--color-charcoal-chip',
  '--color-charcoal-thread',
  '--color-cream-primary',
  '--color-cream-secondary',
  '--color-cream-muted',
  '--color-accent',
  '--color-accent-text',
  '--color-accent-soft',
  '--color-accent-foreground',
] as const;

describe('design tokens: globals.css is the only source of truth', () => {
  const decls = declarations(CSS);

  it('parses the @theme block', () => {
    expect(decls.size).toBeGreaterThan(50);
  });

  it.each(DOCUMENTED)('%s — docs table matches globals.css', (token) => {
    const actual = resolve(token, decls);
    const row = docRow(token);

    expect(row, `no row in docs/DESIGN-SYSTEM.md documents ${token}`).toBeDefined();

    // Hex is compared case-insensitively; everything else verbatim.
    const needle = actual.toLowerCase();
    const hay = row!.toLowerCase();
    expect(
      hay.includes(needle),
      `docs/DESIGN-SYSTEM.md documents ${token} as:\n  ${row!.trim()}\n` +
        `but globals.css resolves it to:  ${actual}`,
    ).toBe(true);
  });

  it('the retired hues never come back as the live accent', () => {
    const accent = resolve('--color-accent', decls).toLowerCase();
    // #FF7F50 = retired Raycast coral. #d97757 = retired terracotta.
    expect(accent).not.toContain('#ff7f50');
    expect(accent).not.toContain('#d97757');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Next look (behind NEXT_PUBLIC_NEW_LOOK). Same contract as above, for the scoped
// blocks: every row of the "Next look" tables must carry the value globals.css
// declares, light and dark. The rows above keep reading the FIRST declaration of a
// token (the legacy @theme value), so the two looks are guarded side by side.
// ─────────────────────────────────────────────────────────────────────────────

const NEXT_DOCUMENTED = [
  '--color-background', '--color-surface', '--color-surface-elevated', '--color-surface-sunken',
  '--color-border', '--color-border-hover',
  '--color-foreground', '--color-foreground-secondary', '--color-foreground-muted',
  '--color-action', '--color-action-foreground', '--color-hover', '--color-active',
  '--color-track', '--color-above', '--color-above-soft',
  '--color-below', '--color-below-text', '--color-below-soft',
  '--color-glass', '--color-scrim',
  '--shadow-rest', '--shadow-lift', '--shadow-press', '--shadow-float', '--shadow-button', '--shadow-sheet',
] as const;

const normalise = (v: string) => v.replace(/`/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** The text of the "## Next look" section of the docs, up to the next "## " heading. */
function nextLookSection(): string {
  const start = DOC.indexOf('\n## Next look');
  if (start === -1) return '';
  const rest = DOC.slice(start + 1);
  const end = rest.indexOf('\n## ', 1);
  return end === -1 ? rest : rest.slice(0, end);
}

/** The cells of the row documenting `token`: | Token | Role or Use | Light | Dark | */
function nextLookRow(token: string): string[] | undefined {
  const line = nextLookSection()
    .split('\n')
    .find((l) => l.trimStart().startsWith('|') && l.includes(`\`${token}\``));
  return line?.split('|').slice(1, -1).map(normalise);
}

describe('next look: the docs tables match the scoped blocks in globals.css', () => {
  it.each(NEXT_DOCUMENTED)('%s — light and dark', (token) => {
    const cells = nextLookRow(token);
    expect(cells, `no row in the "Next look" section of docs/DESIGN-SYSTEM.md documents ${token}`).toBeDefined();
    expect(cells![2], `${token}, light`).toBe(normalise(lookTokens('light').get(token) ?? ''));
    expect(cells![3], `${token}, dark`).toBe(normalise(lookTokens('dark').get(token) ?? ''));
  });
});
