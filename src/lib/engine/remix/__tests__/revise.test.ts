/**
 * revise.ts — Phase 5 (revise_remix, spec §6.4).
 *
 * One Qwen JSON-mode call that rewrites the targeted beat indexes of an already-adapted script
 * against the stored source skeleton. All-or-nothing: any validation failure returns null (half a
 * revision is worse than a refusal). No retry loop — spec §6.4 is explicit this is ONE LLM call.
 *
 * The mocked Qwen client is the ONLY mock (I/O boundary) — same pattern as adapt.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AdaptedBeat } from '../decode-types';
import type { SourceBlueprint } from '../blueprint';
import type { ReviseInput } from '../revise';

// =====================================================
// Module mocks (must be before imports of revise.ts)
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

// Qwen-on-OpenAI mock — mirrors adapt.test.ts:40-49
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
// Fixtures
// =====================================================

/** 4 source beats (indexes 0-3), each with a distinguishing SOURCE_* token per field. */
function makeSourceBeats(): SourceBlueprint['beats'] {
  return [0, 1, 2, 3].map((index) => ({
    index,
    t_start: index * 5,
    t_end: index * 5 + 5,
    duration_s: 5,
    role: index === 0 ? 'hook' : index === 3 ? 'close' : 'setup',
    spoken: `SOURCE_SPOKEN_${index}`,
    spoken_span_s: null,
    on_screen_text: null,
    visual_event: `SOURCE_VISUAL_${index}`,
    audio_event: '',
    cuts: 1,
    weakness: null,
  })) as SourceBlueprint['beats'];
}

/** 4 current adapted beats (indexes 0-3), each with a distinguishing CURRENT_* token per field. */
function makeCurrentBeats(): AdaptedBeat[] {
  return [0, 1, 2, 3].map((index) => ({
    index,
    spoken: `CURRENT_SPOKEN_${index}`,
    on_screen_text: `CURRENT_ONSCREEN_${index}`,
    shot: `CURRENT_SHOT_${index}`,
  }));
}

function makeReviseInput(
  targets: number[],
  note = 'CREATOR_NOTE_TOKEN — the vibe is off here',
): ReviseInput {
  return { beats: makeSourceBeats(), current: makeCurrentBeats(), targets, note };
}

function makeQwenResponse(content: string) {
  return {
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  };
}

/** A valid revise response for the given (index, field-override) beats. */
function makeValidReviseResponse(
  beats: Array<{ index: number; spoken?: string; on_screen_text?: string; shot?: string; repair?: string }>,
): string {
  return JSON.stringify({
    beats: beats.map((b) => ({
      index: b.index,
      spoken: b.spoken ?? 'Revised spoken line',
      on_screen_text: b.on_screen_text ?? 'Revised overlay',
      shot: b.shot ?? 'Revised shot direction',
      ...(b.repair !== undefined ? { repair: b.repair } : {}),
    })),
  });
}

// =====================================================
// Tests
// =====================================================

describe('revise.ts (reviseBeats)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('valid response for targets [1,3] returns exactly those beats, indexes preserved', async () => {
    const { reviseBeats } = await import('../revise');
    mockCreate.mockResolvedValueOnce(
      makeQwenResponse(makeValidReviseResponse([{ index: 1 }, { index: 3 }])),
    );

    const result = await reviseBeats(makeReviseInput([1, 3]));

    expect(result).not.toBeNull();
    expect(result!.map((b) => b.index)).toEqual([1, 3]);
    expect(mockCreate).toHaveBeenCalledTimes(1);

    // Reuses the adapt.ts call shape (spec §6.4).
    const call = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
    expect(call.temperature).toBe(0);
    expect(call.seed).toBe(7);
    expect(call.response_format).toEqual({ type: 'json_object' });
    expect(call.enable_thinking).toBe(false);
  });

  it('a response containing untargeted index 2 → null', async () => {
    const { reviseBeats } = await import('../revise');
    mockCreate.mockResolvedValueOnce(
      makeQwenResponse(makeValidReviseResponse([{ index: 1 }, { index: 2 }, { index: 3 }])),
    );

    const result = await reviseBeats(makeReviseInput([1, 3]));

    expect(result).toBeNull();
  });

  it('a response missing a targeted beat → null (half a revision is worse than a refusal)', async () => {
    const { reviseBeats } = await import('../revise');
    mockCreate.mockResolvedValueOnce(makeQwenResponse(makeValidReviseResponse([{ index: 1 }])));

    const result = await reviseBeats(makeReviseInput([1, 3]));

    expect(result).toBeNull();
  });

  it('a duplicate target in the output → null', async () => {
    const { reviseBeats } = await import('../revise');
    mockCreate.mockResolvedValueOnce(
      makeQwenResponse(makeValidReviseResponse([{ index: 1 }, { index: 1 }])),
    );

    const result = await reviseBeats(makeReviseInput([1]));

    expect(result).toBeNull();
  });

  it('over-cap spoken (> 600 chars) → null', async () => {
    const { reviseBeats } = await import('../revise');
    mockCreate.mockResolvedValueOnce(
      makeQwenResponse(makeValidReviseResponse([{ index: 1, spoken: 'x'.repeat(601) }])),
    );

    const result = await reviseBeats(makeReviseInput([1]));

    expect(result).toBeNull();
  });

  it('over-cap shot (> 600 chars) → null', async () => {
    const { reviseBeats } = await import('../revise');
    mockCreate.mockResolvedValueOnce(
      makeQwenResponse(makeValidReviseResponse([{ index: 1, shot: 'x'.repeat(601) }])),
    );

    const result = await reviseBeats(makeReviseInput([1]));

    expect(result).toBeNull();
  });

  it('over-cap on_screen_text (> 300 chars) → null', async () => {
    const { reviseBeats } = await import('../revise');
    mockCreate.mockResolvedValueOnce(
      makeQwenResponse(makeValidReviseResponse([{ index: 1, on_screen_text: 'x'.repeat(301) }])),
    );

    const result = await reviseBeats(makeReviseInput([1]));

    expect(result).toBeNull();
  });

  it('over-cap repair (> 400 chars) → null', async () => {
    const { reviseBeats } = await import('../revise');
    mockCreate.mockResolvedValueOnce(
      makeQwenResponse(makeValidReviseResponse([{ index: 1, repair: 'x'.repeat(401) }])),
    );

    const result = await reviseBeats(makeReviseInput([1]));

    expect(result).toBeNull();
  });

  it('malformed JSON → null, and reports to Sentry', async () => {
    const { reviseBeats } = await import('../revise');
    const Sentry = await import('@sentry/nextjs');
    mockCreate.mockResolvedValueOnce(makeQwenResponse('not valid json'));

    const result = await reviseBeats(makeReviseInput([1]));

    expect(result).toBeNull();
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tags: { stage: 'remix_revise' } }),
    );
  });

  it('the built prompt contains the source beat text, the current line, and the note verbatim', async () => {
    const { reviseBeats } = await import('../revise');
    mockCreate.mockResolvedValueOnce(makeQwenResponse(makeValidReviseResponse([{ index: 1 }])));

    await reviseBeats(makeReviseInput([1], 'CREATOR_NOTE_TOKEN — the vibe is off here'));

    const call = mockCreate.mock.calls[0]![0] as { messages: Array<{ content: string }> };
    const serialized = JSON.stringify(call.messages);

    // Source beat (timing + what the source did/said) for the TARGETED index (1), not just any beat.
    expect(serialized).toContain('SOURCE_VISUAL_1');
    expect(serialized).toContain('SOURCE_SPOKEN_1');
    // The current adapted line being replaced, for the same index.
    expect(serialized).toContain('CURRENT_SPOKEN_1');
    expect(serialized).toContain('CURRENT_ONSCREEN_1');
    expect(serialized).toContain('CURRENT_SHOT_1');
    // The creator's note, verbatim.
    expect(serialized).toContain('CREATOR_NOTE_TOKEN — the vibe is off here');
  });

  it('a call with no valid targets (no matching beats/current) never reaches the Qwen client', async () => {
    const { reviseBeats } = await import('../revise');

    const result = await reviseBeats(makeReviseInput([99]));

    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
