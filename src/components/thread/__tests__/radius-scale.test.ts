import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Radius-scale lint — the static gate for THE CARD CONTRACT § "Type + geometry"
// (docs/subsystems/ui-skill-cards.md §0.5).
//
// The contract: a corner radius comes from the token scale 4/6/8/12/16/20/24
// (globals.css --radius-xs…3xl → rounded-xs/sm/md/lg/xl/2xl/3xl). Every arbitrary
// radius the 2026-07-13 audit found in the thread — 10px, 7px, 5px, 11px, 18px —
// was DRIFT: each card was built alone with no written scale to conform to, and
// the same element (a source thumbnail) ended up with three different corners on
// three different cards.
//
// The audit fixed the values. This gate is what stops them coming back — a card
// redesign is a place where a stray `rounded-[10px]` is very easy to type and
// impossible to see. It is the same cheap FS-grep shape as the coral/matte gate
// next door (reading/__tests__/reskin-matte.test.ts): pure `node` env, reads
// source text, asserts a forbidden render string is absent.
//
// SCOPE: thread/** (the cards, contract-owned) AND reading/** (the biggest
// surface, still unaudited and next in line to be redesigned — locking the scale
// BEFORE that pass is the whole point of a guard).
//
// WHAT IT BANS: an arbitrary radius whose value is off the scale. It deliberately
// does NOT ban the arbitrary *syntax* itself: `rounded-[8px]` renders identically
// to `rounded-md`, so banning it would mean ~26 no-op rewrites across cards that
// are about to be redesigned anyway. The drift that hurt was off-scale CORNERS,
// and that is exactly what this fires on. (Tightening the rule to "tokens only"
// later is a one-line change: drop ON_SCALE_PX from isAllowedRadius.)
// ─────────────────────────────────────────────────────────────────────────────

const COMPONENTS = join(__dirname, '..', '..'); // …/src/components

/** The guarded surfaces, relative to src/components. */
const GUARDED_DIRS = ['thread', 'reading'] as const;

/** The token scale (globals.css --radius-xs … --radius-3xl). `full` is a utility, never arbitrary. */
const ON_SCALE_PX = new Set([4, 6, 8, 12, 16, 20, 24]);

/**
 * Every arbitrary-radius utility, any side: `rounded-[…]`, `rounded-t-[…]`,
 * `rounded-tl-[…]`, `rounded-ss-[…]`. Anchored on `rounded` so it can never match a
 * neighbouring arbitrary value that merely contains a length — `shadow-[0_10px_26px_…]`
 * and `max-w-[240px]` are not radii and must not trip this.
 */
const ARBITRARY_RADIUS_RE = /\brounded(?:-[a-z]{1,2})?-\[([^\]]+)\]/g;

/** A radius token reference — `rounded-[var(--radius-lg)]` IS the scale, just spelled long. */
const RADIUS_VAR_RE = /^var\(\s*--radius-[a-z0-9]+\s*\)$/i;

/** A bare pixel length: `12px`. */
const PX_RE = /^(\d+(?:\.\d+)?)px$/;

function isAllowedRadius(value: string): boolean {
  const v = value.trim();
  if (RADIUS_VAR_RE.test(v)) return true;
  const px = PX_RE.exec(v);
  if (!px?.[1]) return false; // %, calc(), rem, unitless — none of it is on the scale
  return ON_SCALE_PX.has(Number(px[1]));
}

/** Collect the off-scale radii in a source file, as `rounded-[10px]`-shaped strings. */
export function findRadiusViolations(src: string): string[] {
  const violations: string[] = [];
  for (const match of src.matchAll(ARBITRARY_RADIUS_RE)) {
    // Group 1 always participates when the pattern matches; `?? ''` satisfies
    // noUncheckedIndexedAccess and fails closed (an empty radius is not on the scale).
    if (!isAllowedRadius(match[1] ?? '')) violations.push(match[0]);
  }
  return [...new Set(violations)];
}

/**
 * Every .ts/.tsx under the guarded dirs, EXCLUDING `__tests__` — this file must not scan
 * itself (its own positive-control cases below contain the very strings it forbids), and a
 * test asserting a radius is not a rendered radius. Walking the tree rather than listing
 * files means a NEW card is guarded the day it lands, with no list to keep current.
 */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(COMPONENTS, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      out.push(...sourceFiles(rel));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

const GUARDED_FILES = GUARDED_DIRS.flatMap(sourceFiles);

describe('radius-scale lint — cards + Reading use the 4/6/8/12/16/20/24 token scale (CARD CONTRACT §0.5)', () => {
  it('guards a non-trivial set of files (the walker actually found the surfaces)', () => {
    expect(GUARDED_FILES.length).toBeGreaterThan(20);
  });

  it.each(GUARDED_FILES)('%s carries no off-scale radius', (rel) => {
    const src = readFileSync(join(COMPONENTS, rel), 'utf8');
    const violations = findRadiusViolations(src);
    expect(
      violations,
      `${rel} carries off-scale radii: ${violations.join(', ')} — use the token scale ` +
        `(4/6/8/12/16/20/24 → rounded-xs/sm/md/lg/xl/2xl/3xl). See docs/subsystems/ui-skill-cards.md §0.5.`,
    ).toEqual([]);
  });
});

describe('radius-scale lint — the detector itself', () => {
  it('fires on every off-scale radius the 2026-07-13 audit found', () => {
    // The exact drift values named in the contract.
    for (const drift of ['5px', '7px', '10px', '11px', '18px']) {
      expect(findRadiusViolations(`className="rounded-[${drift}] border"`)).toEqual([
        `rounded-[${drift}]`,
      ]);
    }
  });

  it('accepts the token scale, in either spelling', () => {
    for (const ok of ['4px', '6px', '8px', '12px', '16px', '20px', '24px']) {
      expect(findRadiusViolations(`className="rounded-[${ok}]"`)).toEqual([]);
    }
    expect(findRadiusViolations('className="rounded-[var(--radius-lg)]"')).toEqual([]);
    expect(findRadiusViolations('className="rounded-lg rounded-full rounded-md"')).toEqual([]);
  });

  it('catches an off-scale radius on any single corner', () => {
    expect(findRadiusViolations('className="rounded-t-[10px]"')).toEqual(['rounded-t-[10px]']);
    expect(findRadiusViolations('className="rounded-tl-[18px]"')).toEqual(['rounded-tl-[18px]']);
  });

  it('does not trip on a neighbouring arbitrary value that merely contains a length', () => {
    // The Reading tooltip carries both a matte drop-shadow and a max-width; neither is a radius.
    expect(
      findRadiusViolations('className="max-w-[240px] rounded-[12px] shadow-[0_10px_26px_rgba(0,0,0,0.45)]"'),
    ).toEqual([]);
  });
});
