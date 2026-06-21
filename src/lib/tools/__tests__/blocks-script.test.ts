/**
 * Task 1 TDD — RED: script-card block schema + registry + assembler mode behaviour contract.
 *
 * Covers the four behaviour cases from 06-01-PLAN.md:
 *  1. ScriptCardBlockSchema.safeParse(validScriptCard).success === true
 *  2. validateBlock(validScriptCard).ok === true (registered → rehydrates, not UnsupportedBlock)
 *  3. validateBlock({type:'script-card', props:{}}).ok === false (bad props rejected)
 *  4. assembleBundle({ask:'x', platform:'tiktok', mode:'script'}, null) does NOT throw
 *
 * Honesty spine (Pitfall 5): band/fraction describe the OPENER ONLY — not full-watch or
 * general retention; per-beat retentionMarker is craft reasoning, not a score.
 */

import { describe, it, expect } from 'vitest';
import { ScriptCardBlockSchema } from '../blocks';
import { validateBlock, assertBlocksInRegistry } from '../block-registry';
import type { BlockType } from '../block-registry';
import { assembleBundle } from '../../kc/assembler';

const VALID_SCRIPT_CARD_PROPS = {
  beats: [
    {
      label: 'Hook',
      content: 'You have been lied to about morning routines — here is what the data actually shows.',
      timing: '0–3s',
      retentionMarker: 'Pattern interrupt fires immediately — contradicts the established "wake up at 5am" common belief before the second sentence.',
    },
    {
      label: 'Setup',
      content: 'I tracked 90 days of morning data on 500 creators and found one variable that predicted output quality better than any routine.',
      timing: '3–15s',
      retentionMarker: 'Specificity of the research claim sustains the open loop — viewer predicts a concrete finding is coming.',
    },
    {
      label: 'Turn',
      content: 'It was not when they woke up. It was whether they had a hard stop — a non-negotiable calendar block that ended the morning.',
      timing: '15–40s',
      retentionMarker: 'Prediction error on the resolution — the "what" is surprising once stated but obvious in hindsight, the ideal honesty spine.',
    },
    {
      label: 'Payoff',
      content: 'Without the hard stop, the morning expands to fill whatever time is available. With it, the first block compresses into focused output.',
      timing: '40–55s',
      retentionMarker: 'Stakes landed — the principle is actionable and directly transferable by the viewer today.',
    },
    {
      label: 'CTA',
      content: 'Add one hard stop to tomorrow morning. Come back and tell me if your output changed.',
      timing: '55–60s',
      retentionMarker: 'Specific, low-friction action — one step, one day, measurable by the viewer themselves.',
    },
  ],
  openingBeatSeed: 'You have been lied to about morning routines',
  band: 'Strong' as const,
  fraction: '7/10 stop',
  scrollQuote: 'Wait, my whole morning routine is built on a myth?',
  model: 'sim1-flash' as const,
};

describe('ScriptCardBlockSchema — direct schema parse', () => {
  it('accepts a valid script-card block', () => {
    const result = ScriptCardBlockSchema.safeParse({
      type: 'script-card',
      props: VALID_SCRIPT_CARD_PROPS,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty props', () => {
    const result = ScriptCardBlockSchema.safeParse({
      type: 'script-card',
      props: {},
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid band value', () => {
    const result = ScriptCardBlockSchema.safeParse({
      type: 'script-card',
      props: { ...VALID_SCRIPT_CARD_PROPS, band: 'Excellent' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects beats with missing required sub-fields', () => {
    const result = ScriptCardBlockSchema.safeParse({
      type: 'script-card',
      props: {
        ...VALID_SCRIPT_CARD_PROPS,
        beats: [{ label: 'Hook', content: 'Some content' }], // missing timing + retentionMarker
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects wrong model literal', () => {
    const result = ScriptCardBlockSchema.safeParse({
      type: 'script-card',
      props: { ...VALID_SCRIPT_CARD_PROPS, model: 'sim1-max' },
    });
    expect(result.success).toBe(false);
  });
});

describe('script-card block — validateBlock (registry path, D-14 rehydration)', () => {
  it('returns ok:true for a valid script-card block (registered → rehydrates)', () => {
    const result = validateBlock({
      type: 'script-card',
      props: VALID_SCRIPT_CARD_PROPS,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.block.type).toBe('script-card');
    }
  });

  it('returns ok:false for empty props (bad props rejected)', () => {
    const result = validateBlock({
      type: 'script-card',
      props: {},
    });
    expect(result.ok).toBe(false);
  });

  it('returns ok:false for missing beats field', () => {
    const { beats: _omitted, ...propsWithoutBeats } = VALID_SCRIPT_CARD_PROPS;
    const result = validateBlock({
      type: 'script-card',
      props: propsWithoutBeats,
    });
    expect(result.ok).toBe(false);
  });

  it('returns ok:false for invalid band value', () => {
    const result = validateBlock({
      type: 'script-card',
      props: { ...VALID_SCRIPT_CARD_PROPS, band: 'Excellent' },
    });
    expect(result.ok).toBe(false);
  });
});

describe('script-card block — assertBlocksInRegistry', () => {
  const scriptCardBlock = {
    type: 'script-card' as BlockType,
    props: VALID_SCRIPT_CARD_PROPS,
  };

  it('does not throw when script-card is in the allowed subset', () => {
    expect(() =>
      assertBlocksInRegistry([scriptCardBlock], ['script-card']),
    ).not.toThrow();
  });

  it('throws when script-card is NOT in the allowed subset', () => {
    expect(() =>
      assertBlocksInRegistry([scriptCardBlock], ['band']),
    ).toThrow();
  });
});

describe('assembleBundle — script mode (Pitfall 2 closed)', () => {
  it('does not throw when mode is "script"', () => {
    expect(() =>
      assembleBundle(
        { ask: 'x', platform: 'tiktok', mode: 'script' },
        null,
      ),
    ).not.toThrow();
  });

  it('returns a non-empty string for mode script', () => {
    const result = assembleBundle(
      { ask: 'write a script about morning routines', platform: 'tiktok', mode: 'script' },
      null,
    );
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes the "script" mode label in the bundle header', () => {
    const result = assembleBundle(
      { ask: 'test', platform: 'tiktok', mode: 'script' },
      null,
    );
    expect(result).toContain('Mode: script');
  });
});
