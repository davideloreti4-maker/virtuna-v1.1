/**
 * Wave 0 test scaffolds for engine/remix/adapt.ts
 *
 * Tests (Wave 0 — implemented in plan 04-02):
 *   1 — exactly-3: Zod .length(3) enforcement — returns exactly 3 concepts
 *   2 — repair-loop: malformed/short Qwen output → repair attempt; final invalid → null (graceful)
 *   3 — no-caption-guard: input builder only accepts AdaptInput (not DecodeOutput directly)
 *   4 — luck-exclusion: luck[] items absent from prompt user content (D-01 structural guard)
 *
 * All Qwen calls are mocked via the openai module mock (same pattern as stage11-counterfactuals.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DECODE_FIXTURE } from '../decode.fixture';
import type { AdaptInput } from '../decode-types';
// import type { AdaptConcept } from '../decode-types'; // used in Wave 1+ assertions

// =====================================================
// Module mocks (must be before imports of adapt.ts)
// =====================================================

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

// Qwen-on-OpenAI mock — mirrors stage11-counterfactuals.test.ts:46-51
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('openai', () => {
  const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
    this.chat = { completions: { create: mockCreate } };
  });
  return { default: MockOpenAI };
});

process.env.DASHSCOPE_API_KEY = 'test-key';

// =====================================================
// Helpers
// =====================================================

function makeValidConceptsResponse(): string {
  return JSON.stringify({
    concepts: [
      {
        hook: 'Format-hook headline one for the niche',
        angle: 'Structural angle borrowed from the source pattern',
        who_its_for: 'Audience segment one in the niche',
        format_borrowed: 'open-loop cold open',
      },
      {
        hook: 'Format-hook headline two adapted to niche',
        angle: 'Counter-intuitive narrative turn applied to niche topic',
        who_its_for: 'Audience segment two in the niche',
        format_borrowed: '4-beat emotional arc',
      },
      {
        hook: 'Format-hook headline three for niche',
        angle: 'Tension-reveal structure borrowed from source format',
        who_its_for: 'Audience segment three in the niche',
        format_borrowed: 'counter-intuitive turn at 60% mark',
      },
    ],
  });
}

function makeAdaptInput(): AdaptInput {
  // Build AdaptInput from DECODE_FIXTURE — omits luck[] and any caption (D-01)
  const { hook_pattern, structure, the_turn, emotional_beat, repeatable } = DECODE_FIXTURE;
  return { hook_pattern, structure, the_turn, emotional_beat, repeatable, niche: 'fitness' };
}

function makeQwenResponse(content: string) {
  return {
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  };
}

// =====================================================
// Tests
// =====================================================

describe('adapt.ts (Wave 0 — generateAdaptConcepts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(
    'exactly-3: returns exactly 3 AdaptConcept objects when Qwen returns valid JSON',
    async () => {
      const { generateAdaptConcepts } = await import('../adapt');
      mockCreate.mockResolvedValueOnce(makeQwenResponse(makeValidConceptsResponse()));

      const input = makeAdaptInput();
      const result = await generateAdaptConcepts(input);

      expect(result).not.toBeNull();
      expect(result).toHaveLength(3);
      expect(result![0]).toMatchObject({
        hook: expect.stringMatching(/.+/),
        angle: expect.stringMatching(/.+/),
        who_its_for: expect.stringMatching(/.+/),
        format_borrowed: expect.stringMatching(/.+/),
      });
    },
  );

  it(
    'repair-loop: retries once on malformed Qwen output and returns 3 concepts on second attempt',
    async () => {
      const { generateAdaptConcepts } = await import('../adapt');
      // First attempt: malformed (not valid JSON object with concepts)
      mockCreate.mockResolvedValueOnce(makeQwenResponse('not valid json'));
      // Second attempt: valid
      mockCreate.mockResolvedValueOnce(makeQwenResponse(makeValidConceptsResponse()));

      const input = makeAdaptInput();
      const result = await generateAdaptConcepts(input);

      expect(result).not.toBeNull();
      expect(result).toHaveLength(3);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    },
  );

  it(
    'final-invalid→null: returns null when both attempts produce invalid output (graceful failure)',
    async () => {
      const { generateAdaptConcepts } = await import('../adapt');
      const Sentry = await import('@sentry/nextjs');

      // Both attempts fail
      mockCreate.mockResolvedValueOnce(makeQwenResponse('bad json'));
      mockCreate.mockResolvedValueOnce(makeQwenResponse('still bad json'));

      const input = makeAdaptInput();
      const result = await generateAdaptConcepts(input);

      expect(result).toBeNull();
      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ tags: { stage: 'remix_adapt' } }),
      );
    },
  );

  it(
    'no-caption-guard: buildAdaptUserContent only accepts AdaptInput — passing DecodeOutput (with luck[]) is a TS compile error',
    async () => {
      const { buildAdaptUserContent } = await import('../adapt');
      const input = makeAdaptInput();
      // This test verifies the function is callable with AdaptInput and produces a string
      const prompt = buildAdaptUserContent(input);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
      // Structural check: AdaptInput has no 'luck' key
      expect('luck' in input).toBe(false);
    },
  );

  it(
    'luck-exclusion: luck[] item labels (e.g. "trending-audio-at-posting-time") are absent from prompt user content when DECODE_FIXTURE is the input',
    async () => {
      const { buildAdaptUserContent } = await import('../adapt');
      const input = makeAdaptInput();
      const prompt = buildAdaptUserContent(input);

      // Verify luck labels from DECODE_FIXTURE are NOT in the prompt
      for (const luckItem of DECODE_FIXTURE.luck) {
        expect(prompt).not.toContain(luckItem.label);
        expect(prompt).not.toContain(luckItem.why_repeatable);
      }

      // Verify repeatable labels from DECODE_FIXTURE ARE in the prompt
      for (const repeatItem of DECODE_FIXTURE.repeatable) {
        expect(prompt).toContain(repeatItem.label);
      }
    },
  );

  // =====================================================
  // Wave 0 smoke — fixture + contract import verification
  // =====================================================

  it('DECODE_FIXTURE has 3 repeatable items and 2 luck items', () => {
    expect(DECODE_FIXTURE.repeatable).toHaveLength(3);
    expect(DECODE_FIXTURE.luck).toHaveLength(2);
  });

  it('DECODE_FIXTURE.repeatable and .luck items are textually distinct', () => {
    const repeatableLabels = DECODE_FIXTURE.repeatable.map((i) => i.label);
    const luckLabels = DECODE_FIXTURE.luck.map((i) => i.label);
    for (const luckLabel of luckLabels) {
      expect(repeatableLabels).not.toContain(luckLabel);
    }
  });

  it('makeAdaptInput omits luck[] from DECODE_FIXTURE (structural D-01 guard)', () => {
    const input = makeAdaptInput();
    // AdaptInput is Pick<DecodeOutput, 4 fields + repeatable> & { niche }
    // It must NOT have a 'luck' key — the type system enforces this; runtime check for belt-and-suspenders
    expect('luck' in input).toBe(false);
  });

  it('makeAdaptInput.repeatable has the same labels as DECODE_FIXTURE.repeatable', () => {
    const input = makeAdaptInput();
    expect(input.repeatable.map((i) => i.label)).toEqual(
      DECODE_FIXTURE.repeatable.map((i) => i.label),
    );
  });

  it('mockCreate is defined (Qwen mock wired correctly)', () => {
    // Smoke: ensure the mock is callable (Wave 1 tests will exercise it)
    expect(typeof mockCreate).toBe('function');
  });

  it('makeValidConceptsResponse produces parseable JSON with exactly 3 concepts', () => {
    const parsed = JSON.parse(makeValidConceptsResponse()) as { concepts: unknown[] };
    expect(parsed.concepts).toHaveLength(3);
  });
});
