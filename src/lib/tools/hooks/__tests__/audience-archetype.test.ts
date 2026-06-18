/**
 * Tests for deriveAudienceArchetype (D-03/D-04).
 *
 * Behaviour contract:
 *  - Returns a human-facing AUDIENCE-persona tag derived from Flash per-persona stop verdicts.
 *  - The tag names an AUDIENCE persona that stopped, never a craft-archetype slug.
 *  - On multiple stops → names the highest-signal stopper (tougher crowd preferred).
 *  - On all-scroll → returns an honest neutral tag (no fabricated "stops the X" claim).
 *  - NEVER emits any of the craft-archetype slugs: BOLD/GAP/CONTRARIAN/RESEARCH/NARRATIVE/QUESTION.
 *
 * D-04 guard: the output string must NOT contain any craft-archetype slug (uppercase or mixed).
 */

import { describe, it, expect } from 'vitest';
import { deriveAudienceArchetype } from '../audience-archetype';

// ─── craft-slug guard ─────────────────────────────────────────────────────────
const CRAFT_SLUGS = ['BOLD', 'GAP', 'CONTRARIAN', 'RESEARCH', 'NARRATIVE', 'QUESTION'];
function assertNoCraftSlug(tag: string) {
  for (const slug of CRAFT_SLUGS) {
    expect(tag.toUpperCase()).not.toContain(slug);
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function persona(
  archetype: string,
  verdict: 'stop' | 'scroll',
  quote = 'test quote',
) {
  return { archetype, verdict, quote };
}

// ─── Test cases ───────────────────────────────────────────────────────────────

describe('deriveAudienceArchetype', () => {
  it('TC-01: first stop-verdict persona "tough_crowd" → human-facing tag naming that audience', () => {
    const personas = [
      persona('tough_crowd', 'stop'),
      persona('lurker', 'scroll'),
      persona('high_engager', 'scroll'),
    ];
    const tag = deriveAudienceArchetype(personas);
    // Must include something about the skeptic / tough crowd persona
    expect(tag.toLowerCase()).toMatch(/skeptic|tough|crowd/i);
    assertNoCraftSlug(tag);
  });

  it('TC-02: multiple stops → prefers the toughest/most-skeptical stopper (tough_crowd over loyalist)', () => {
    const personas = [
      persona('loyalist', 'stop'),
      persona('tough_crowd', 'stop'),
      persona('high_engager', 'scroll'),
      persona('lurker', 'scroll'),
    ];
    const tag = deriveAudienceArchetype(personas);
    // Should name tough_crowd (more discriminating signal) over loyalist
    expect(tag.toLowerCase()).toMatch(/skeptic|tough|crowd/i);
    assertNoCraftSlug(tag);
  });

  it('TC-03: all-scroll → honest neutral tag (no fabricated "stops the X" claim)', () => {
    const personas = [
      persona('tough_crowd', 'scroll'),
      persona('lurker', 'scroll'),
      persona('high_engager', 'scroll'),
      persona('loyalist', 'scroll'),
    ];
    const tag = deriveAudienceArchetype(personas);
    // Must NOT claim to stop anyone when no one stopped
    expect(tag.toLowerCase()).not.toMatch(/^stops the/i);
    // Must convey honesty — weak/no pull
    expect(tag.length).toBeGreaterThan(0);
    assertNoCraftSlug(tag);
  });

  it('TC-04: D-04 guard — output never contains craft-archetype slugs', () => {
    const personaSets = [
      // single stopper
      [persona('niche_deep_buyer', 'stop'), persona('tough_crowd', 'scroll')],
      // all scroll
      [persona('sharer', 'scroll'), persona('saver', 'scroll')],
      // multiple stoppers
      [persona('high_engager', 'stop'), persona('saver', 'stop'), persona('tough_crowd', 'stop')],
      // empty array edge case
      [],
    ];
    for (const set of personaSets) {
      const tag = deriveAudienceArchetype(set);
      assertNoCraftSlug(tag);
    }
  });

  it('TC-05: niche_deep_buyer stop with no tough_crowd → names core buyer audience', () => {
    const personas = [
      persona('niche_deep_buyer', 'stop'),
      persona('niche_deep_scout', 'scroll'),
      persona('loyalist', 'scroll'),
    ];
    const tag = deriveAudienceArchetype(personas);
    // Should name something about buyer/core audience
    expect(tag.toLowerCase()).toMatch(/buyer|core|niche/i);
    assertNoCraftSlug(tag);
  });

  it('TC-06: unknown/fallback archetype → returns a valid non-empty tag', () => {
    const personas = [
      persona('some_future_archetype_v99', 'stop'),
    ];
    const tag = deriveAudienceArchetype(personas);
    expect(tag.length).toBeGreaterThan(0);
    assertNoCraftSlug(tag);
  });
});
