/**
 * ONE section-label stack on /analyze — enforced (2026-07-14).
 *
 * Companion to `thread/__tests__/radius-scale.test.ts`: same idea (walk the tree, fail the build
 * on drift), different axis. Radii were guarded in July; type never was, and type is where the
 * flagship rotted.
 *
 * What a browser sweep of the RENDERED Reading found (the surface had never been looked at at
 * 1:1 — it has no dev route of its own and only ever got seen downscaled inside /dev/cards):
 * ELEVEN uppercase-label declarations across EIGHT files, in SEVEN type stacks —
 *
 *     10px / 0.14em   reading-section · fix-first-list ×2 · reading-chat     <- the "old stack"
 *     12px / 0.08em   fix-first-list                                          the contract names as dead
 *     10px / 0.10em   panel-shell
 *     11px / 0.08em   reading-chat
 *      9.5px/ 0.11em  reading-room            (in a MONO face, no less)
 *      9.5px/ 0.10em  audience-orbit ×2       (SVG <text>, inline style)
 *     10px / 0.06em   audience-orbit          (SVG <text>, inline style)
 *
 * — and NOT ONE of them was the contract's `text-[11px] tracking-[0.05em]`. fix-first-list ran
 * three different sizes for its own three labels. The card contract had assumed reading-section
 * was THE primitive and flagged only it; fixing that alone would have corrected one of eleven
 * and left the ladder standing. "A stacked ladder of equal-weight ALL-CAPS labels is the failure
 * mode" (§0.5) — this is what it looks like when nothing guards it.
 *
 * The rule: every uppercase label in `reading/**` goes through READING_LABEL (DOM) or SVG_LABEL
 * (SVG <text>, which cannot take a Tailwind class). Hand-rolling a size/tracking pair fails here.
 *
 * KNOWN + ALLOWED: `reading-hero.tsx`'s "powered by SIM-1 Max" chip is a bordered PROVENANCE tag,
 * not a section label, so it is exempt from the stack — but it is NOT exempt from §0.5's rule that
 * provenance is a footnote, never a headline, and today it sits in the hero's eyebrow. That is an
 * open finding for the owner (information design of the flagship hero), deliberately not silently
 * restyled here. If it moves, delete it from ALLOWLIST.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'src/components/reading';

/** The one true stack, mirrored from reading-section.tsx. */
const CONTRACT = { size: '11px', tracking: '0.05em' };

/** Files allowed to carry an uppercase treatment that is NOT a section label. */
const ALLOWLIST = new Set(['reading-hero.tsx']); // the provenance chip — see header

function sourceFiles(): string[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.tsx'))
    .filter((f) => !ALLOWLIST.has(f));
}

describe('/analyze runs ONE section-label type stack', () => {
  it('declares no hand-rolled uppercase size/tracking pair in a className', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const src = readFileSync(join(DIR, file), 'utf8');
      src.split('\n').forEach((line, i) => {
        if (!/uppercase/.test(line)) return;
        // a className that says `uppercase` AND pins its own tracking is a new rung on the ladder
        const tracking = /tracking-\[([0-9.]+em)\]/.exec(line);
        if (tracking && tracking[1] !== CONTRACT.tracking) {
          offenders.push(`${file}:${i + 1} tracking-[${tracking[1]}] (contract: ${CONTRACT.tracking})`);
        }
        const size = /text-\[([0-9.]+px)\][^"`]*uppercase|uppercase[^"`]*text-\[([0-9.]+px)\]/.exec(line);
        const px = size?.[1] ?? size?.[2];
        if (px && px !== CONTRACT.size) {
          offenders.push(`${file}:${i + 1} text-[${px}] (contract: ${CONTRACT.size})`);
        }
      });
    }
    expect(offenders, `Use READING_LABEL. Off-contract labels:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('declares no hand-rolled uppercase style object in SVG <text>', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const src = readFileSync(join(DIR, file), 'utf8');
      src.split('\n').forEach((line, i) => {
        if (!/textTransform:\s*'uppercase'/.test(line)) return;
        // SVG_LABEL is the single allowed carrier; an inline literal is drift.
        if (/fontSize:/.test(line)) {
          offenders.push(`${file}:${i + 1} inline uppercase style — use SVG_LABEL`);
        }
      });
    }
    expect(offenders, `Use SVG_LABEL. Offenders:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('pins READING_LABEL and SVG_LABEL to the contract stack', () => {
    // If someone "fixes" the ladder by editing the primitive to match the drift, the guards above
    // all still pass and the surface is still wrong. Pin the primitive itself.
    const section = readFileSync(join(DIR, 'reading-section.tsx'), 'utf8');
    expect(section).toMatch(/text-\[11px\][^'"`]*uppercase[^'"`]*tracking-\[0\.05em\]/);

    const orbit = readFileSync(join(DIR, 'audience-orbit.tsx'), 'utf8');
    expect(orbit).toMatch(/fontSize:\s*11/);
    expect(orbit).toMatch(/letterSpacing:\s*'0\.05em'/);
  });
});

describe('/analyze paints no retired accent', () => {
  it('never hardcodes the dead terracotta #d97757 / rgba(217,119,87)', () => {
    // The stage bars in the hero hardcoded rgba(217,119,87,0.28) — the RETIRED terracotta accent
    // — while the live accent (#FF6363) rendered a persona dot in the same view. Two different
    // reds, one surface. The literals tracked no token, so the accent migration skipped the
    // flagship entirely and nothing caught it because nobody had looked at it at full size.
    const offenders: string[] = [];
    for (const file of readdirSync(DIR).filter((f) => f.endsWith('.tsx'))) {
      const src = readFileSync(join(DIR, file), 'utf8');
      src.split('\n').forEach((line, i) => {
        // Strip comments first — prose ABOUT the dead color (like the note at the fixed call
        // site, which names it so the next reader knows why the token is there) does not paint
        // anything. Only code does.
        const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '').replace(/^\s*\*.*$/, '');
        if (/217,\s*119,\s*87|#d97757/i.test(code)) {
          offenders.push(`${file}:${i + 1} retired terracotta — use var(--color-accent)`);
        }
      });
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
