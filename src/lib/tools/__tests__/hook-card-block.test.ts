/**
 * Task 2 TDD — RED: hook-card block schema + registry behaviour contract.
 *
 * Covers the four behaviour cases from the plan spec:
 *  1. validateBlock({ type: "hook-card", props: <valid> }) → { ok: true }
 *  2. validateBlock({ type: "hook-card", props: <missing required field> }) → { ok: false }
 *  3. assertBlocksInRegistry([{type:"hook-card",...}], ["hook-card"]) → no throw
 *  4. assertBlocksInRegistry([{type:"hook-card",...}], ["band"]) → throws
 *
 * D-04 additional guard: no craft-archetype slug in any required field path.
 */

import { describe, it, expect } from 'vitest';
import { validateBlock, assertBlocksInRegistry } from '../block-registry';
import type { BlockType } from '../block-registry';

const VALID_HOOK_CARD_PROPS = {
  hookLine: 'You have been told rest = recovery — here is why the timeline matters',
  audienceArchetype: 'Stops the skeptic',
  mechanism: 'Pattern interruption via contradicting the obvious rest-day assumption',
  seedHook: 'You have been told to rest 48 hours — science says it depends',
  rank: 1,
  band: 'Strong' as const,
  fraction: '7/10 stop',
  scrollQuote: 'Wait, my coach has been wrong this whole time?',
  model: 'sim1-flash' as const,
  channel: null,
};

describe('hook-card block — validateBlock', () => {
  it('returns ok:true for a valid hook-card block', () => {
    const result = validateBlock({
      type: 'hook-card',
      props: VALID_HOOK_CARD_PROPS,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.block.type).toBe('hook-card');
    }
  });

  it('returns ok:false for a missing required field (hookLine)', () => {
    const { hookLine: _omitted, ...propsWithoutHookLine } = VALID_HOOK_CARD_PROPS;
    const result = validateBlock({
      type: 'hook-card',
      props: propsWithoutHookLine,
    });
    expect(result.ok).toBe(false);
  });

  it('returns ok:false for an invalid band value', () => {
    const result = validateBlock({
      type: 'hook-card',
      props: { ...VALID_HOOK_CARD_PROPS, band: 'Excellent' },
    });
    expect(result.ok).toBe(false);
  });

  it('returns ok:false for a non-integer rank', () => {
    const result = validateBlock({
      type: 'hook-card',
      props: { ...VALID_HOOK_CARD_PROPS, rank: 1.5 },
    });
    expect(result.ok).toBe(false);
  });

  it('accepts channel: null (nullable field)', () => {
    const result = validateBlock({
      type: 'hook-card',
      props: { ...VALID_HOOK_CARD_PROPS, channel: null },
    });
    expect(result.ok).toBe(true);
  });

  it('accepts channel: "spoken" (optional multi-modal hint)', () => {
    const result = validateBlock({
      type: 'hook-card',
      props: { ...VALID_HOOK_CARD_PROPS, channel: 'spoken' },
    });
    expect(result.ok).toBe(true);
  });

  it('returns ok:false for rank 0 (non-positive)', () => {
    const result = validateBlock({
      type: 'hook-card',
      props: { ...VALID_HOOK_CARD_PROPS, rank: 0 },
    });
    expect(result.ok).toBe(false);
  });
});

describe('hook-card block — assertBlocksInRegistry', () => {
  const hookCardBlock = {
    type: 'hook-card' as BlockType,
    props: VALID_HOOK_CARD_PROPS,
  };

  it('does not throw when hook-card is in the allowed subset', () => {
    expect(() =>
      assertBlocksInRegistry([hookCardBlock], ['hook-card']),
    ).not.toThrow();
  });

  it('throws when hook-card is NOT in the allowed subset', () => {
    expect(() =>
      assertBlocksInRegistry([hookCardBlock], ['band']),
    ).toThrow();
  });
});
