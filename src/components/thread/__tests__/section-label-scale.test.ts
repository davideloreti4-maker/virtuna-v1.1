import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Section-label lint — the static gate for THE CARD CONTRACT § "Type + geometry"
// (docs/subsystems/ui-skill-cards.md §0.5).
//
// The contract: a section label is `text-[11px] uppercase tracking-[0.05em]
// text-foreground-muted` — "NOT 10px/0.14em (that was the old stack)". The
// 2026-07-13 audit found the old stack still live on eight sites across five
// files, and labels living in FIVE different type stacks overall. Every card was
// built alone with nothing to conform to, so each one picked its own.
//
// This is the sibling of radius-scale.test.ts next door, and it exists for the
// same reason: the audit fixed the VALUES, but nothing stopped them coming back.
// A stray 10px uppercase label is easy to type, invisible in review, and only
// shows up as a surface that quietly feels off — which is exactly the failure
// mode this lane keeps hitting (a green suite while the rendered thing is wrong).
//
// WHAT IT BANS, precisely:
//   1. `tracking-[0.14em]` anywhere in the guarded dirs — the fingerprint of the
//      old stack. It has no legitimate use left.
//   2. An UPPERCASE label at `text-[10px]` — the old size. 10px non-uppercase is
//      untouched: timestamps (reading-hero), count badges (multi-audience) and
//      the disclosure chevron (progress-checklist) are legitimately 10px and are
//      not section labels.
//
// WHAT IT KNOWINGLY DOES NOT BAN (yet): the 11px near-misses — thread-shell
// (0.08em), persona-chat-turn (0.06em), proof-receipt (10.5px/0.07em, its own
// §0.5b primitive), script-card (12px). They are a smaller, separate drift and
// tightening onto them is a follow-up, not a silent widening of this commit's
// scope. Narrowing the rule to "0.05em or nothing" later is a one-line change.
// ─────────────────────────────────────────────────────────────────────────────

const COMPONENTS = join(__dirname, '..', '..'); // …/src/components

/** The guarded surfaces, relative to src/components. Same scope as the radius gate. */
const GUARDED_DIRS = ['thread', 'reading'] as const;

/** The old stack's letter-spacing. Named verbatim by the contract. */
const OLD_TRACKING_RE = /\btracking-\[0\.14em\]/g;

/**
 * An uppercase label at the old 10px size. Matched within a single `className`
 * string (not across the file) so a 10px timestamp and an unrelated `uppercase`
 * elsewhere in the file can never combine into a false positive.
 */
const CLASSNAME_RE = /className=(?:"([^"]*)"|\{`([^`]*)`\})/g;

/** Collect the old-stack label violations in a source file. */
export function findLabelViolations(src: string): string[] {
  const violations: string[] = [];

  for (const m of src.matchAll(OLD_TRACKING_RE)) violations.push(m[0]);

  for (const m of src.matchAll(CLASSNAME_RE)) {
    const cls = m[1] ?? m[2] ?? '';
    if (/\btext-\[10px\]/.test(cls) && /\buppercase\b/.test(cls)) {
      violations.push('text-[10px] + uppercase');
    }
  }

  return [...new Set(violations)];
}

/**
 * Every .ts/.tsx under the guarded dirs, EXCLUDING `__tests__` — this file must not
 * scan itself (its positive-control cases below contain the very strings it forbids).
 * Walking the tree means a NEW card is guarded the day it lands, with no list to keep.
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

describe('section-label lint — cards + Reading use the 11px/0.05em label stack (CARD CONTRACT §0.5)', () => {
  it('guards a non-trivial set of files (the walker actually found the surfaces)', () => {
    expect(GUARDED_FILES.length).toBeGreaterThan(20);
  });

  it.each(GUARDED_FILES)('%s carries no old-stack section label', (rel) => {
    const src = readFileSync(join(COMPONENTS, rel), 'utf8');
    const violations = findLabelViolations(src);
    expect(
      violations,
      `${rel} carries the OLD label stack: ${violations.join(', ')} — a section label is ` +
        `text-[11px] uppercase tracking-[0.05em] text-foreground-muted. ` +
        `See docs/subsystems/ui-skill-cards.md §0.5 "Type + geometry".`,
    ).toEqual([]);
  });
});

describe('section-label lint — the detector itself', () => {
  it('fires on the old stack the 2026-07-13 audit found live on eight sites', () => {
    expect(
      findLabelViolations(
        '<span className="text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">',
      ),
    ).toEqual(['tracking-[0.14em]', 'text-[10px] + uppercase']);
  });

  it('fires on a 10px uppercase label regardless of its tracking', () => {
    // verbatim-wall shipped both of these — one with a token tracking, one arbitrary.
    expect(findLabelViolations('<p className="text-[10px] uppercase tracking-wide">')).toEqual([
      'text-[10px] + uppercase',
    ]);
    expect(findLabelViolations('<p className="text-[10px] uppercase tracking-[0.1em]">')).toEqual([
      'text-[10px] + uppercase',
    ]);
  });

  it('accepts the contract stack', () => {
    expect(
      findLabelViolations(
        '<p className="text-[11px] font-medium uppercase tracking-[0.05em] text-foreground-muted">',
      ),
    ).toEqual([]);
  });

  it('does not trip on 10px text that is NOT a section label', () => {
    // Legitimately 10px and legitimately not labels: a video timestamp, a count badge,
    // a disclosure chevron. None are uppercase.
    expect(findLabelViolations('<span className="text-[10px] tabular-nums">0:04</span>')).toEqual([]);
    expect(
      findLabelViolations('<span className="text-[10px] font-semibold rounded-full bg-success/10">'),
    ).toEqual([]);
  });

  it('does not combine a 10px class and an uppercase class from DIFFERENT elements', () => {
    // The whole reason the check is scoped to one className at a time.
    expect(
      findLabelViolations(
        '<span className="text-[10px] tabular-nums">0:04</span><p className="text-[11px] uppercase tracking-[0.05em]">The room</p>',
      ),
    ).toEqual([]);
  });
});
