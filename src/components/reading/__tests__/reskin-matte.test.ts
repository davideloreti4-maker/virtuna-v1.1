import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Matte-lint — the Wave-0 static gate for the flat-warm reskin (SC-3 / D-07).
//
// The transplanted board charts carry Raycast-era matte VIOLATIONS today: the old
// coral (#FF7F50 / rgba(255,127,80,…)), backdrop blur, the 137deg glass gradient,
// and `box-shadow: 0 0 Npx` glow halos. The flat-warm taste bar forbids glow /
// shine / halo / blur-glass and the legacy coral (THEME-06). A human-UAT gate at
// phase close (D-07) is the real arbiter, but that is expensive — this cheap grep
// gate catches matte regressions FIRST and gives the reskin plans (03-02/03-03) a
// hard, automatable target.
//
// This is a PURE FS test (default `node` env — no happy-dom pragma): it reads each
// transplant file as source text and asserts the forbidden RENDER strings are
// absent. It is INTENTIONALLY RED today for the not-yet-reskinned files (see the
// RED list below) — that is the gate having teeth. 03-02/03-03 flip it GREEN.
//
// Hygiene: it scans ONLY the transplant set; presence/absence of the forbidden
// render strings is the assertion (occurrences in comments are not separately
// counted — the contract is "the string must not appear in this source").
// ─────────────────────────────────────────────────────────────────────────────

const SRC = join(__dirname, '..', '..', '..'); // …/src

/** The transplant set the reskin plans clean (03-CONTEXT § reskin_targets). */
const TRANSPLANT_FILES = [
  'components/board/verdict/ScoreDistribution.tsx',
  'components/board/audience/RetentionChart.tsx',
  'components/board/_kit/PersonaGraph.tsx',
  'components/board/_kit/StatTile.tsx',
  'components/board/_kit/DataTable.tsx',
  'components/board/_kit/KeyframeImage.tsx',
] as const;

/**
 * RED-until-reskin file list (informational — every file below FAILS this gate
 * TODAY and flips GREEN when 03-02/03-03 repoint it to flat-warm tokens). The gate
 * asserts cleanliness for EVERY transplant file; this list just documents which
 * ones are expected RED right now so the reskin executor knows the target. Per the
 * plan's verification, this RED state is intentional and documented — it is the
 * Wave-0 gate having teeth, NOT a defect in this scaffold.
 *
 * Verified by grep at authoring time (03-01):
 *   - ScoreDistribution  — rgba(255,127,80,…) ×6 + outer glows 0 0 9/13/18px
 *   - RetentionChart     — #FF7F50 ×3 + rgba(255,127,80,…) ×3
 *   - CraftFilmstrip     — rgba(255,127,80,…) ×2 + end-cap glow 0 0 10px
 *   - RetentionPlayer    — #FF7F50 ×4 + backdropFilter: blur(2px)
 *   - KeyframeImage      — rgba(255,127,80,…) ×1 (coral radial fallback)
 *
 * Already GREEN today (informational):
 *   - PersonaGraph — its matte issues (glass hover card, <animate> pulse, white-
 *     alpha dots) are real reskin work for 03-03, but NONE are the forbidden RENDER
 *     strings this gate checks (no #FF7F50, no rgba coral, no backdrop blur, no
 *     137deg gradient, no 0-0-Npx glow). Verified visually at the D-07 UAT gate.
 *   - SegmentTable / StatTile / DataTable — Tier-1 token-swap only (white-alpha
 *     text), no forbidden render strings → clean here.
 */

/**
 * Strip legitimate matte shadows before the glow scan so the assertion only fires
 * on the `0 0 Npx` OUTER halo (the violation), never on:
 *   - `inset 0 0 Npx …`  (inset shadow — depth, not a halo)
 *   - `0 0 0 Npx …`       (zero-blur hairline ring, e.g. `0 0 0 1px`)
 * A single CSS string can legitimately mix an inset hairline with an outer glow
 * (ScoreDistribution L240: `inset 0 0 0 1px …, 0 0 18px …`) — stripping the inset
 * first leaves the outer `0 0 18px` glow to be caught.
 */
function stripLegitShadows(src: string): string {
  return src
    // inset shadows of any blur
    .replace(/inset\s+0 0 \d+px/g, '')
    // zero-blur rings: `0 0 0 <spread>` (no halo)
    .replace(/0 0 0(px)?\b/g, '');
}

/** The outer-glow halo: `0 0 Npx` with a NON-ZERO blur. The acceptance grep
 *  (`git grep -nE "0 0 [1-9]"`) anchors on this literal so the gate's glow check is
 *  greppable in the test source. */
const GLOW_RE = /0 0 [1-9]\d*px/;

/** Old coral, both forms: the `#FF7F50` literal and its rgba `255,127,80` body
 *  (ScoreDistribution/CraftFilmstrip/KeyframeImage use the rgba form, not the hex). */
const OLD_CORAL_HEX_RE = /#FF7F50/i;
const OLD_CORAL_RGBA_RE = /rgba\(\s*255\s*,\s*127\s*,\s*80/i;

/** Raycast glass gradient. */
const GLASS_GRADIENT_RE = /linear-gradient\(137deg/i;

/** Backdrop blur — both the CSS property and the React inline-style camelCase form
 *  (RetentionPlayer uses `backdropFilter: 'blur(2px)'`). Lightning CSS strips it +
 *  the matte bar forbids it. */
const BACKDROP_FILTER_RE = /backdrop-filter|backdropFilter/;

/** Collect the forbidden matte render strings present in a source file. */
function findViolations(src: string): string[] {
  const scrubbed = stripLegitShadows(src);
  const violations: string[] = [];
  if (OLD_CORAL_HEX_RE.test(src)) violations.push('#FF7F50 (old coral)');
  if (OLD_CORAL_RGBA_RE.test(src)) violations.push('rgba(255,127,80,…) (old coral)');
  if (GLASS_GRADIENT_RE.test(src)) violations.push('linear-gradient(137deg (Raycast glass)');
  if (BACKDROP_FILTER_RE.test(src)) violations.push('backdrop-filter / backdropFilter (blur)');
  if (GLOW_RE.test(scrubbed)) violations.push('box-shadow: 0 0 Npx (glow halo)');
  return violations;
}

describe('matte-lint — transplanted charts carry no flat-warm violations (SC-3 / D-07)', () => {
  // Every transplant file must be matte-clean. This gate is INTENTIONALLY RED today
  // for the not-yet-reskinned files (ScoreDistribution / RetentionChart /
  // CraftFilmstrip / RetentionPlayer / KeyframeImage) — that is the documented
  // Wave-0 gate state (see verification in 03-01-PLAN). 03-02/03-03 reskin those
  // files and turn this GREEN. The clean files (PersonaGraph / SegmentTable /
  // StatTile / DataTable) pass today.
  it.each(TRANSPLANT_FILES)('%s is matte-clean (no #FF7F50, no rgba coral, no backdrop blur, no 137deg gradient, no 0-0-Npx glow)', (rel) => {
    const src = readFileSync(join(SRC, rel), 'utf8');
    const violations = findViolations(src);
    expect(violations, `${rel} carries matte violations: ${violations.join(', ')}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Matte-lint (secondary chrome) — lane/frame dead-glass sweep gate.
//
// Locks the flat-warm pass on the app's pill/chip primitive + the competitors
// chrome. These files carried the Raycast holdout that the audit
// surfaced — the 137deg glass gradient, backdrop-blur, dead surface hex literals
// (#18191a / #222326 / #0A0A0A), and the dead `var(--color-muted)` token (the real
// token is --color-foreground-muted) — and are now matte. This gate keeps them clean.
//
// SCOPE NOTE: the sanctioned subtle top-edge `inset 0 1px 0 0 rgba(255,255,255,0.05)`
// is NOT a violation — the gold-standard saved-shelf uses it, and the enforced matte
// rule bans GLASS + outer GLOW, not inset depth. So this gate checks the glass
// signatures + dead literals/tokens only, never inset shine.
//
// KNOWN-REMAINING 137deg holdouts (deliberately NOT in this set — GSI-adjacent,
// deferred to a coordinated pass): app/test-type-selector, app/content-form,
// tooltips/contextual-tooltip, command-bar/CommandBar, primitives/GlassPanel
// (its only consumer is analyze/result-card = GSI turf).
// ─────────────────────────────────────────────────────────────────────────────

/** The chrome files cleaned by the lane/frame dead-glass sweep. */
const CLEANED_CHROME_FILES = [
  'components/primitives/GlassPill.tsx',
  'components/app/legend-pills.tsx',
  'components/app/context-bar.tsx',
  'components/app/filter-pills.tsx',
  'components/app/auth-guard.tsx',
  'components/competitors/comparison/comparison-metric-card.tsx',
  'components/competitors/intelligence/strategy-analysis-card.tsx',
  'components/competitors/charts/chart-tooltip.tsx',
] as const;

/** Dead Raycast surface hex literals retired by the flat-warm token migration. */
const DEAD_LITERAL_RE = /#18191a|#222326|#0A0A0A/i;
/** Dead token: `--color-muted` does not exist (real token is --color-foreground-muted). */
const DEAD_MUTED_TOKEN_RE = /var\(--color-muted\)/;

/** Glass + dead-literal/token violations for the secondary-chrome gate. */
function findChromeViolations(src: string): string[] {
  const violations: string[] = [];
  if (GLASS_GRADIENT_RE.test(src)) violations.push('linear-gradient(137deg (Raycast glass)');
  if (BACKDROP_FILTER_RE.test(src)) violations.push('backdrop-filter / backdropFilter (blur)');
  if (DEAD_LITERAL_RE.test(src)) violations.push('dead Raycast hex literal (#18191a/#222326/#0A0A0A)');
  if (DEAD_MUTED_TOKEN_RE.test(src)) violations.push('var(--color-muted) (dead token)');
  if (OLD_CORAL_HEX_RE.test(src)) violations.push('#FF7F50 (old coral)');
  return violations;
}

describe('matte-lint (secondary chrome) — pill primitive + competitors chrome are flat-warm (lane/frame dead-glass sweep)', () => {
  it.each(CLEANED_CHROME_FILES)('%s carries no Raycast glass / dead literal / dead token', (rel) => {
    const src = readFileSync(join(SRC, rel), 'utf8');
    const violations = findChromeViolations(src);
    expect(violations, `${rel} carries matte violations: ${violations.join(', ')}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Matte-lint (Hybrid depth) — 2026-07-05 premium-elevation pass.
//
// The Hybrid elevation lever ADDS a matte depth scale (--shadow-rest/lift/press)
// on top of the flat-warm system: cards gain a soft DARK drop-shadow floor + a
// lift on hover. The de-Claude rules are UNCHANGED — the depth is monochrome
// (black-alpha), so near-zero accent is untouched, and glass / glow-halo /
// inset-shine / coral all stay banned.
//
// The distinction this gate locks: a MATTE drop has a non-zero vertical offset
// (`0 10px 26px …`) and is ALLOWED; a GLOW halo has a zero offset (`0 0 Npx`)
// and is BANNED. The GLOW_RE above already encodes exactly this — these tests
// pin the intent so a future edit can't quietly widen the rule.
// ─────────────────────────────────────────────────────────────────────────────

describe('matte-lint (Hybrid depth) — matte drop-shadows allowed, glow halos banned', () => {
  it('allows a matte dark drop-shadow (non-zero vertical offset)', () => {
    // The approved depth-scale values (globals.css --shadow-rest/lift/press).
    for (const shadow of [
      '0 1px 2px rgba(0,0,0,0.28)',
      '0 10px 26px -8px rgba(0,0,0,0.5)',
      '0 2px 6px rgba(0,0,0,0.3)',
    ]) {
      expect(findViolations(`box-shadow: ${shadow};`)).toEqual([]);
    }
  });

  it('still bans a zero-offset glow halo', () => {
    expect(findViolations('box-shadow: 0 0 18px rgba(217,119,87,0.6);')).toContain(
      'box-shadow: 0 0 Npx (glow halo)',
    );
  });
});

/**
 * Surfaces that carry (or will carry) the Hybrid matte depth. They elevate via
 * the .elev-* utilities / --shadow-* tokens — NOT via glass, glow, blur, or
 * coral. This set locks them clean as the premium-elevation sweep adds depth
 * surface by surface (extend it as each surface PR lands).
 */
const HYBRID_DEPTH_SURFACES = [
  // The audience surface was rebuilt as index + detail (rebuild P2, 2026-07-16):
  // audience-workspace (and before it audience-card / audience-profile-view) was
  // deleted, so the guard locks its replacement. Coverage moves with the code.
  'components/audience/audience-index.tsx',
  'components/audience/audience-detail.tsx',
  // population-field.tsx + audience-composition-bar.tsx were deleted in the
  // 2026-07-20 rework (the dot cloud and the segment cipher). Coverage moves with
  // the code: their replacements — the room's share bars and the roster line — live
  // in audience-detail.tsx / audience-index.tsx, both already guarded above.
  'components/audience/audience-manager.tsx',
  'components/surfaces/start-page.tsx',
  'components/surfaces/surface-canvas.ts',
  'components/saved/saved-shelf.tsx',
  'app/(app)/library/page.tsx',
  'components/calendar/calendar-workspace.tsx',
  'components/calendar/month-grid.tsx',
  'components/calendar/up-next.tsx',
  'components/calendar/backlog-rail.tsx',
  'components/referral/referrals-section.tsx',
  'components/discover/discover-hub.tsx',
  'components/feed/feed-card.tsx',
  'components/feed/feed-filters.tsx',
  'components/feed/feed-results.tsx',
  'components/competitors/competitor-card.tsx',
  'components/competitors/competitor-table.tsx',
  'components/competitors/competitor-empty-state.tsx',
  'app/(app)/competitors/competitors-client.tsx',
] as const;

describe('matte-lint (Hybrid depth) — elevated surfaces stay glass/glow/coral-free', () => {
  it.each(HYBRID_DEPTH_SURFACES)('%s uses matte depth only (no glass, glow, blur, or coral)', (rel) => {
    const src = readFileSync(join(SRC, rel), 'utf8');
    const violations = findViolations(src);
    expect(violations, `${rel} carries matte violations: ${violations.join(', ')}`).toEqual([]);
  });
});
