import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Type-scale lint — the static gate for the type ROLES (globals.css @theme
// "TYPE ROLES", 2026-07-28).
//
// WHAT WENT WRONG. A surface audit measured this app against linear.app,
// attio.com, cursor.com and claude.com with one identical computed-style probe.
// /home carried 34 distinct size/weight/line-height/tracking combinations across
// 74 text-bearing elements — 45.9 per 100, where every reference landed between
// 8.6 and 11.2. Repo-wide there were 1,099 arbitrary `text-[Npx]` against 835
// on-scale usages: 57% of all type bypassing the system, across 26 distinct sizes.
//
// 223 of those were HALF-PIXEL (`text-[12.5px]`, `text-[13.5px]`, …). Half-pixel
// sizes force glyphs onto subpixel positions and visibly soften text — the single
// most reliable "cheap app" tell, and all four references used exactly zero.
//
// The root cause was that the sizes this product actually runs on had no names:
// 13px used 180×, 11px 177×, 10px 152× — none of them tokenised, so every author
// typed a literal. The fix was to name them (the nine roles) rather than to force
// the app onto a marketing t-shirt scale it never fit.
//
// This gate is what stops it coming back. A stray `text-[12.5px]` is very easy to
// type and impossible to see. Same cheap FS-grep shape as its two siblings:
// thread/__tests__/radius-scale.test.ts and reading/__tests__/reskin-matte.test.ts
// — pure `node` env, reads source text, asserts a forbidden render string is absent.
//
// TWO RULES, DIFFERENT SCOPES:
//   1. Half-pixel sizes are banned EVERYWHERE under src/. There is no argument for
//      one, on any surface, including the ones that currently only redirect.
//   2. Arbitrary pixel sizes are banned in the GUARDED surfaces — the ones that
//      actually render. Elsewhere they are legacy debt, not a regression, and this
//      gate deliberately does not fail the build over code nothing mounts.
// ─────────────────────────────────────────────────────────────────────────────

const SRC = join(__dirname, '..', '..');            // …/src
const COMPONENTS = join(__dirname, '..');           // …/src/components

/** The surfaces that actually render — /home, /audience, /settings, the thread. */
const GUARDED_DIRS = ['app/home', 'app/settings', 'audience', 'sidebar', 'thread'] as const;

/** Any arbitrary font-size utility, incl. responsive/state prefixes (`lg:text-[19px]`). */
const ARBITRARY_TEXT_RE = /\btext-\[([0-9.]+)px\]/g;

/** A half-pixel (or any fractional) size — banned outright, everywhere. */
const FRACTIONAL_RE = /\btext-\[[0-9]*\.[0-9]+px\]/g;

/**
 * Documented one-offs. A design system does not need a token for the single
 * greeting on the single home surface — but it does need the exception written
 * down, so this list is the whole of it. Keep it near-empty; an entry here is a
 * claim that the value is genuinely singular, not that migrating it was awkward.
 */
const ALLOWLIST: Record<string, string> = {
  'app/home/home-greeting.tsx':
    'the serif voice-moment greeting — a single hero string, deliberately off-scale',
  'app/home/v8/arrival.tsx':
    'the same serif voice-moment greeting on the v8 arrival (CONCEPT_V8_ENABLED) — one hero string, same deliberate 26px',
};

function walk(dir: string, base = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      out.push(...walk(join(dir, entry.name), rel));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

describe('type roles are known to tailwind-merge', () => {
  // The failure this guards is SILENT and total. tailwind-merge ships knowing
  // Tailwind's built-in font sizes but nothing about custom `--text-*` theme keys;
  // shown `text-body` it cannot tell a size from a colour, guesses colour, and
  // DELETES the class the moment a real colour shares the same cn() call. The
  // element then falls back to the inherited 16px base. Nothing errors, nothing
  // logs, tsc is happy, and the utility is present in the compiled stylesheet —
  // it just never reaches the DOM.
  //
  // It shipped exactly once, in the pass that introduced the roles, and was caught
  // by eye rather than by any check: the sidebar's nav labels measured 16px where
  // the role says 13px. A role added to globals.css but not registered in
  // src/lib/utils.ts will do the same thing again, so assert they agree.
  it('every --text-* role token is registered in cn()’s font-size group', () => {
    const css = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8');
    const utils = readFileSync(join(SRC, 'lib', 'utils.ts'), 'utf8');

    // `--text-body: 13px;` → body. Skip the `--text-body--line-height` sub-keys.
    const declared = new Set<string>();
    for (const m of css.matchAll(/--text-([a-z0-9]+)\s*:/g)) declared.add(m[1]!);

    // The TYPE_ROLES array literal in utils.ts.
    const block = utils.match(/const TYPE_ROLES = \[([\s\S]*?)\] as const;/);
    const registered = new Set<string>();
    for (const m of (block?.[1] ?? '').matchAll(/"([a-z0-9]+)"/g)) registered.add(m[1]!);

    // Tailwind's own scale is built into tailwind-merge already — only the
    // non-standard keys need registering.
    const BUILT_IN = new Set(['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl']);
    const missing = [...declared].filter((k) => !BUILT_IN.has(k) && !registered.has(k)).sort();

    expect(
      missing,
      `These --text-* roles are declared in globals.css but missing from TYPE_ROLES\n` +
        `in src/lib/utils.ts. tailwind-merge will treat them as text COLOURS and strip\n` +
        `them wherever a role shares a cn() with a colour — silently, at runtime:\n\n` +
        `  ${missing.join(', ')}\n`,
    ).toEqual([]);
  });
});

describe('type scale', () => {
  it('declares no half-pixel font size anywhere under src/', () => {
    const offenders: string[] = [];
    for (const rel of walk(SRC)) {
      const text = readFileSync(join(SRC, rel), 'utf8');
      const hits = text.match(FRACTIONAL_RE);
      if (hits) offenders.push(`${rel} → ${[...new Set(hits)].join(', ')}`);
    }
    expect(
      offenders,
      `Half-pixel font sizes rasterize on subpixel boundaries and soften text.\n` +
        `Snap to the nearest integer, then take a role from globals.css @theme:\n` +
        `  micro 10 · caption 11 · label 12 · body 13 · reading 14\n` +
        `  title 16 · subhead 18 · heading 22 · stat 27\n\n` +
        offenders.join('\n'),
    ).toEqual([]);
  });

  it('uses type roles, not arbitrary pixel sizes, on the surfaces that render', () => {
    const offenders: string[] = [];
    for (const dir of GUARDED_DIRS) {
      for (const name of walk(join(COMPONENTS, dir), dir)) {
        if (ALLOWLIST[name]) continue;
        const text = readFileSync(join(COMPONENTS, name), 'utf8');
        const hits = text.match(ARBITRARY_TEXT_RE);
        if (hits) offenders.push(`${name} → ${[...new Set(hits)].join(', ')}`);
      }
    }
    expect(
      offenders,
      `These surfaces render, so their type must come from a role.\n` +
        `globals.css @theme → text-micro | text-caption | text-label | text-body |\n` +
        `text-reading | text-title | text-subhead | text-heading | text-stat\n\n` +
        `A role carries size, line-height AND tracking together — that is what keeps\n` +
        `the distinct-combination count down. If a value is genuinely singular, add it\n` +
        `to ALLOWLIST in this file with the reason.\n\n` +
        offenders.join('\n'),
    ).toEqual([]);
  });
});
