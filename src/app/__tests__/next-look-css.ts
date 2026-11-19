import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Shared by the next-look token tests. Not a test file itself.

const ROOT = join(__dirname, '..', '..', '..');
export const CSS = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8');
export const DOC = readFileSync(join(ROOT, 'docs/DESIGN-SYSTEM.md'), 'utf8');

export const LIGHT = ':root[data-look="next"]';
export const DARK = ':root[data-look="next"][data-theme="dark"]';

/**
 * The tokens the next look themes: declared in the light block, re-declared in the dark block
 * (next-look-contrast.test.ts) and documented, both themes, in the "Next look" tables
 * (design-token-drift.test.ts). One list, so a token cannot be guarded by one test and not the other.
 */
export const NEXT_LOOK_THEMED = [
  '--color-background', '--color-surface', '--color-surface-elevated', '--color-surface-sunken',
  '--color-border', '--color-border-hover',
  '--color-foreground', '--color-foreground-secondary', '--color-foreground-muted',
  '--color-action', '--color-action-foreground', '--color-hover', '--color-active',
  '--color-track', '--color-above', '--color-above-soft',
  '--color-below', '--color-below-text', '--color-below-soft',
  '--color-glass', '--color-scrim',
  '--shadow-rest', '--shadow-lift', '--shadow-press', '--shadow-float', '--shadow-button', '--shadow-sheet',
] as const;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Every `--token: value;` declaration in `text`, one per line. The first declaration of a name wins. */
export function declarationsIn(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of text.split('\n')) {
    const m = /^\s*(--[\w-]+)\s*:\s*([^;]+);/.exec(line);
    if (m?.[1] && m[2] && !out.has(m[1])) out.set(m[1], m[2].trim());
  }
  return out;
}

/**
 * The `--token: value;` declarations (one per line) of the first TOP-LEVEL rule written
 * exactly as `selector {` at the start of a line. Rules nested in an @media are indented,
 * so they are not picked up.
 */
export function ruleBlock(css: string, selector: string): Map<string, string> {
  const open = new RegExp(`^${escapeRe(selector)} \\{$`, 'm').exec(css);
  if (!open) throw new Error(`no top-level rule "${selector} {" in globals.css`);
  const start = open.index + open[0].length;
  const end = css.indexOf('\n}', start);
  if (end === -1) throw new Error(`rule "${selector}" is never closed`);
  return declarationsIn(css.slice(start, end));
}

/** What <html> resolves under the new look: @theme, then the light block, then the dark block. */
export function lookTokens(theme: 'light' | 'dark'): Map<string, string> {
  const merged = new Map(ruleBlock(CSS, '@theme'));
  for (const [k, v] of ruleBlock(CSS, LIGHT)) merged.set(k, v);
  if (theme === 'dark') for (const [k, v] of ruleBlock(CSS, DARK)) merged.set(k, v);
  return merged;
}

/** Follow whole-value `var(--x)` aliases to a literal. Throws on a cycle. */
export function resolveToken(name: string, tokens: Map<string, string>, seen: string[] = []): string {
  if (seen.includes(name)) throw new Error(`circular var() chain: ${[...seen, name].join(' -> ')}`);
  const raw = tokens.get(name);
  if (raw === undefined) throw new Error(`${name} is not declared`);
  const alias = /^var\(\s*(--[\w-]+)\s*\)$/.exec(raw)?.[1];
  return alias ? resolveToken(alias, tokens, [...seen, name]) : raw;
}

/** Every custom property a value mentions through var(), whole-value or embedded. */
export function references(value: string): string[] {
  return [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]!);
}
