/**
 * Tests for remix-card block schema + registry + assembler remix mode (06-02).
 *
 * TDD RED: These tests are written BEFORE the implementation.
 * They verify REMIX-01 mandated block/mode foundations.
 */

import { describe, it, expect } from 'vitest';
import { RemixCardBlockSchema } from '../blocks';
import { validateBlock } from '../block-registry';
import { assembleBundle } from '../../kc/assembler';

// ─── Valid fixture ────────────────────────────────────────────────────────────

const validRemixCard = {
  type: 'remix-card' as const,
  props: {
    adaptedHook: 'How I got 10k followers in 30 days (niche twist)',
    angle: 'Personal-journey cold open with reversal',
    whoItsFor: 'Early-stage creators in the fitness niche',
    formatBorrowed: 'open-loop cold open',
    sourceDecode: {
      hookPattern: 'Creator reveals counter-intuitive result upfront, building curiosity',
      structure: 'Hook (0–3s) → Setup problem (3–12s) → Reveal twist (12–25s) → CTA (25–30s)',
      theTurn: 'The pivot from "I failed" to "here is what actually worked" at the midpoint',
      emotionalBeat: 'Frustration → hope → surprise → motivation arc across 30s',
    },
    band: 'Strong' as const,
    fraction: '7/10 stop',
    scrollQuote: 'Wait, this is exactly what I was dealing with last week',
    model: 'sim1-flash' as const,
  },
};

// ─── RemixCardBlockSchema tests ───────────────────────────────────────────────

describe('RemixCardBlockSchema', () => {
  it('validates a well-formed remix-card block', () => {
    const result = RemixCardBlockSchema.safeParse(validRemixCard);
    expect(result.success).toBe(true);
  });

  it('rejects a remix-card with empty adaptedHook', () => {
    const bad = {
      ...validRemixCard,
      props: { ...validRemixCard.props, adaptedHook: '' },
    };
    expect(RemixCardBlockSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a remix-card with invalid band value', () => {
    const bad = {
      ...validRemixCard,
      props: { ...validRemixCard.props, band: 'Perfect' },
    };
    expect(RemixCardBlockSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a remix-card with wrong model value', () => {
    const bad = {
      ...validRemixCard,
      props: { ...validRemixCard.props, model: 'sim1-max' },
    };
    expect(RemixCardBlockSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a remix-card with missing sourceDecode fields', () => {
    const bad = {
      ...validRemixCard,
      props: {
        ...validRemixCard.props,
        sourceDecode: { hookPattern: 'something' }, // missing 3 required fields
      },
    };
    expect(RemixCardBlockSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects empty props object', () => {
    const bad = { type: 'remix-card', props: {} };
    expect(RemixCardBlockSchema.safeParse(bad).success).toBe(false);
  });
});

// ─── Registry / validateBlock tests ──────────────────────────────────────────

describe('validateBlock with remix-card', () => {
  it('validates a registered remix-card block', () => {
    const result = validateBlock(validRemixCard);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.block.type).toBe('remix-card');
    }
  });

  it('rejects remix-card with empty props (not UnsupportedBlock)', () => {
    const result = validateBlock({ type: 'remix-card', props: {} });
    expect(result.ok).toBe(false);
  });

  it('rejects unknown block type', () => {
    const result = validateBlock({ type: 'unknown-block', props: {} });
    expect(result.ok).toBe(false);
  });
});

// ─── Assembler remix mode tests ────────────────────────────────────────────────

describe('assembleBundle remix mode', () => {
  it('does not throw for mode remix', () => {
    expect(() =>
      assembleBundle({ ask: 'x', platform: 'tiktok', mode: 'remix' }, null),
    ).not.toThrow();
  });

  it('includes mode and platform in the assembled bundle', () => {
    const bundle = assembleBundle(
      { ask: 'adapt this for my niche', platform: 'tiktok', mode: 'remix' },
      null,
    );
    expect(bundle).toContain('remix');
    expect(bundle).toContain('tiktok');
  });

  it('rejects invalid mode', () => {
    expect(() =>
      // @ts-expect-error — intentional invalid mode for test
      assembleBundle({ ask: 'x', platform: 'tiktok', mode: 'invalid-mode' }, null),
    ).toThrow();
  });
});
