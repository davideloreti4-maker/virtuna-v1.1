/**
 * Wave 0 test scaffolds for engine/remix/adapt.ts
 *
 * Tests (Wave 0 — implemented in plan 04-02):
 *   1 — exactly-3: Zod .length(3) enforcement — returns exactly 3 concepts
 *   2 — repair-loop: malformed/short Qwen output → repair attempt; final invalid → null (graceful)
 *   3 — no-caption-guard: input builder only accepts AdaptInput (no luck lane, no caption)
 *   4 — luck-exclusion: luck[] items absent from prompt user content (D-01 structural guard)
 *
 * All Qwen calls are mocked via the openai module mock (same pattern as stage11-counterfactuals.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DECODE_FIXTURE, DECODE_RESULT_FIXTURE } from '../decode.fixture';
import { decodeResultToAdaptInput } from '../decode-types';
import type { AdaptInput } from '../decode-types';
import { emptyBlueprint } from '../blueprint';
import type { SourceBlueprint } from '../blueprint';
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
  // Build AdaptInput from DECODE_FIXTURE — omits luck[] and any caption (D-01).
  // Empty blueprint + null target: DECODE_FIXTURE is the WIRE shape, and the wire carries neither.
  const { hook_pattern, structure, the_turn, emotional_beat, repeatable } = DECODE_FIXTURE;
  return {
    hook_pattern, structure, the_turn, emotional_beat, repeatable, niche: 'fitness',
    blueprint: emptyBlueprint(), target: null,
  };
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
    'no-caption-guard: buildAdaptUserContent only accepts AdaptInput — a luck lane or caption is a TS compile error',
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
    // AdaptInput is the 4 structural fields + repeatable lane + niche
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

// =====================================================
// Decode↔Adapt reconciliation seam (decodeResultToAdaptInput)
// =====================================================

describe('decodeResultToAdaptInput (Decode→Adapt seam)', () => {
  it('maps the 4 beat bodies to flat structural fields (structure_pacing → structure)', () => {
    const input = decodeResultToAdaptInput(DECODE_RESULT_FIXTURE, 'fitness');
    expect(input.hook_pattern).toBe('Open with a provocative question, delay the answer');
    expect(input.structure).toBe(
      'Hook (0-3s) → tension build (3-12s) → reveal (12-22s) → CTA (22-30s)',
    );
    expect(input.the_turn).toBe('Pivot from problem statement to counter-intuitive solution at 15s');
    expect(input.emotional_beat).toBe('Curiosity → frustration → relief → motivation');
    expect(input.niche).toBe('fitness');
  });

  it('converts repeatable string[] to RepeatableItem[] (label set, why_repeatable empty)', () => {
    const input = decodeResultToAdaptInput(DECODE_RESULT_FIXTURE, 'fitness');
    expect(input.repeatable).toEqual(
      DECODE_RESULT_FIXTURE.repeatable.map((label) => ({ label, why_repeatable: '' })),
    );
  });

  it('NEVER maps luck into AdaptInput (D-01 content-leak guard)', () => {
    const input = decodeResultToAdaptInput(DECODE_RESULT_FIXTURE, 'fitness');
    expect('luck' in input).toBe(false);
  });

  it('produces an AdaptInput whose prompt omits the dangling dash for empty why_repeatable', async () => {
    const { buildAdaptUserContent } = await import('../adapt');
    const input = decodeResultToAdaptInput(DECODE_RESULT_FIXTURE, 'fitness');
    const prompt = buildAdaptUserContent(input);
    // No `"label" — ` with an empty rationale, and luck notes never appear.
    expect(prompt).not.toMatch(/"[^"]+" — \n/);
    for (const luckItem of DECODE_RESULT_FIXTURE.luck) {
      expect(prompt).not.toContain(luckItem.note);
    }
    // Repeatable move labels DO appear.
    for (const move of DECODE_RESULT_FIXTURE.repeatable) {
      expect(prompt).toContain(move);
    }
  });
});

// =====================================================
// D-01 REVERSAL (D2/D3, 2026-08-10) — the timed beat map reaches the adapt call
//
// `weakness.factor` is a name HookFactorSchema (qwen/schemas.ts) can actually emit —
// "Completion Pull", which FACTOR_TARGET_ROLE maps to a `setup` beat. The brief's own
// fixture said "pacing"; the model cannot emit that, and an unrealistic factor name of
// exactly that shape is what let a dead branch survive review in Task 1.
// =====================================================

const BLUEPRINT: SourceBlueprint = {
  duration_s: 14,
  words_per_second: 3.2,
  has_speech: true,
  // Real perception. `buildAdaptUserContent` deliberately does not branch on this — a fabricated
  // grid carries no spoken_text, so `has_speech: false` already routes it to the on-screen-text
  // prompt. The flag is for the human reading the sheet, not for the model writing it.
  from_fixed_buckets: false,
  beats: [
    {
      index: 0, t_start: 0, t_end: 1.8, duration_s: 1.8, role: 'hook',
      spoken: 'Your protein shake is making you fatter', on_screen_text: 'STOP',
      visual_event: 'tight crop, hard cut in', audio_event: 'voice starts',
      cuts: 1, weakness: null,
    },
    {
      index: 1, t_start: 1.8, t_end: 5.4, duration_s: 3.6, role: 'setup',
      spoken: 'I tracked 400 clients for six months', on_screen_text: null,
      visual_event: 'b-roll of shaker', audio_event: 'music under',
      cuts: 2,
      weakness: { factor: 'Completion Pull', score: 4, tip: 'cut 1.2s earlier' },
    },
  ],
};

/** The 4 structural fields + repeatable lane, so each test states only what it varies. */
const ANATOMY = {
  hook_pattern: 'h', structure: 's', the_turn: 't', emotional_beat: 'e',
  repeatable: [] as AdaptInput['repeatable'],
  niche: 'fitness',
};

describe('adapt input widening (D-01 reversal)', () => {
  it('puts every beat, its duration and its role into the user content', async () => {
    const { buildAdaptUserContent } = await import('../adapt');
    const content = buildAdaptUserContent({
      ...ANATOMY,
      repeatable: [{ label: 'cold open', why_repeatable: '' }],
      blueprint: BLUEPRINT, target: null,
    });
    expect(content).toContain('HOOK');
    expect(content).toContain('1.8s');
    expect(content).toContain('Your protein shake is making you fatter');
    expect(content).toContain('tight crop, hard cut in');
  });

  it('names the weakness so the model repairs rather than replicates it', async () => {
    const { buildAdaptUserContent } = await import('../adapt');
    const content = buildAdaptUserContent({ ...ANATOMY, blueprint: BLUEPRINT, target: null });
    expect(content).toContain('cut 1.2s earlier');
  });

  it('uses target as the adaptation target when present, not niche', async () => {
    const { buildAdaptUserContent } = await import('../adapt');
    const content = buildAdaptUserContent({
      ...ANATOMY, blueprint: BLUEPRINT, target: 'SaaS onboarding',
    });
    expect(content).toContain('SaaS onboarding');
    expect(content).not.toContain('CREATOR NICHE: fitness');
  });

  it('falls back to niche when target is null', async () => {
    const { buildAdaptUserContent } = await import('../adapt');
    const content = buildAdaptUserContent({ ...ANATOMY, blueprint: BLUEPRINT, target: null });
    expect(content).toContain('fitness');
  });

  it('tells the model to match DURATION, and never mentions matching word count', async () => {
    const { ADAPT_SYSTEM_PROMPT } = await import('../adapt');
    expect(ADAPT_SYSTEM_PROMPT).toMatch(/duration/i);
    expect(ADAPT_SYSTEM_PROMPT).not.toMatch(/match.{0,20}word count/i);
  });

  it('switches to on-screen text when the source has no speech', async () => {
    const { buildAdaptUserContent } = await import('../adapt');
    const silent: SourceBlueprint = {
      ...BLUEPRINT, has_speech: false, words_per_second: 0,
      beats: BLUEPRINT.beats.map((b) => ({ ...b, spoken: null })),
    };
    const content = buildAdaptUserContent({ ...ANATOMY, blueprint: silent, target: null });
    expect(content).toMatch(/no speech|on-screen text only/i);
  });

  // Back-compat: /api/remix/adapt and the drops pipe have no video, so they hand adapt an
  // EMPTY blueprint. The beat-map block must vanish entirely — a "TIMED BEAT MAP (0s, 0 beats)"
  // header with no rows would tell the model to emit a script for beats that do not exist.
  it('omits the beat map entirely when the blueprint has no beats', async () => {
    const { buildAdaptUserContent } = await import('../adapt');
    const content = buildAdaptUserContent(decodeResultToAdaptInput(DECODE_RESULT_FIXTURE, 'fitness'));
    expect(content).not.toMatch(/TIMED BEAT MAP/);
    expect(content).toContain('CREATOR NICHE: fitness');
  });

  it('keeps decodeResultToAdaptInput a two-arg call for /api/remix/adapt', () => {
    const input = decodeResultToAdaptInput(
      {
        beats: [
          { id: 'hook_pattern', body: 'h', verdict: 'present' },
          { id: 'structure_pacing', body: 's', verdict: 'present' },
          { id: 'the_turn', body: 't', verdict: 'present' },
          { id: 'emotional_beat', body: 'e', verdict: 'present' },
        ],
        repeatable: ['cold open'],
        luck: [{ category: 'algorithmic_outlier', note: 'n' }],
      },
      'fitness',
    );
    expect(input.niche).toBe('fitness');
    expect(input.target).toBeNull();
    expect(input.blueprint.beats).toEqual([]);
  });

  // Zod strips unknown keys, so a `script` the schema does not declare is dropped SILENTLY —
  // three valid concepts, no script, no error anywhere. Only a round-trip catches that.
  it('carries a returned script through Zod instead of stripping it', async () => {
    const { generateAdaptConcepts } = await import('../adapt');
    const withScript = JSON.parse(makeValidConceptsResponse()) as {
      concepts: Record<string, unknown>[];
    };
    withScript.concepts[0]!.script = [
      { index: 0, spoken: 'Your first coffee is costing you sleep', on_screen_text: 'STOP', shot: 'tight crop' },
      { index: 1, spoken: 'I logged 400 mornings', on_screen_text: '', shot: 'b-roll of mug', repair: 'lands 1.2s sooner' },
    ];
    mockCreate.mockReset();
    mockCreate.mockResolvedValueOnce(makeQwenResponse(JSON.stringify(withScript)));

    const result = await generateAdaptConcepts(makeAdaptInput());

    expect(result).not.toBeNull();
    expect(result![0]!.script).toHaveLength(2);
    expect(result![0]!.script![1]).toMatchObject({ index: 1, repair: 'lands 1.2s sooner' });
    // A concept that omits `script` still validates — same contract as `production`.
    expect(result![1]!.script).toBeUndefined();
  });

  // The `production` lesson (adapt.ts:100-107 — a missing sub-field cost two live shelf rows),
  // sharper: a script is up to 8 entries of 4 required fields, so a fumble is likelier. Failing
  // the response would trade 3 valid concepts for a garnish, and the retry repeats the omission.
  it('drops a malformed script rather than failing the whole response', async () => {
    const { generateAdaptConcepts } = await import('../adapt');
    const badScript = JSON.parse(makeValidConceptsResponse()) as {
      concepts: Record<string, unknown>[];
    };
    badScript.concepts[0]!.script = [
      { index: 0, spoken: 'a line', on_screen_text: '' }, // no `shot` — required
    ];
    mockCreate.mockReset();
    mockCreate.mockResolvedValueOnce(makeQwenResponse(JSON.stringify(badScript)));

    const result = await generateAdaptConcepts(makeAdaptInput());

    expect(result).toHaveLength(3);
    expect(result![0]!.script).toBeUndefined();
    expect(result![0]!.hook).toBe('Format-hook headline one for the niche');
    expect(mockCreate).toHaveBeenCalledTimes(1); // no repair round-trip
  });
});
