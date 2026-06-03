/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { DecodeResult } from '@/lib/engine/remix/decode-types';

// =====================================================
// Mocks — hook dependencies (hoisted before imports)
// =====================================================

vi.mock('@/hooks/queries/use-permalink-analysis', () => ({
  usePermalinkAnalysis: vi.fn(() => ({ data: null })),
}));
vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: vi.fn(),
}));

// =====================================================
// Imports (after mocks)
// =====================================================

import { DecodeShellNode } from '../DecodeShellNode';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';

const mockStream = useAnalysisStream as ReturnType<typeof vi.fn>;
const mockPermalink = usePermalinkAnalysis as ReturnType<typeof vi.fn>;

// =====================================================
// Inline DecodeResult fixture
// =====================================================

const FIXTURE_DECODE: DecodeResult = {
  beats: [
    {
      id: 'hook_pattern',
      body: 'The opening three seconds combine a freeze-frame cut with a direct-to-camera address, creating immediate pattern interruption.',
      verdict: 'present',
    },
    {
      id: 'structure_pacing',
      body: 'The clip runs in two distinct acts: a rapid montage of 2-second cuts, then a single 8-second payoff hold.',
      verdict: 'present',
    },
    {
      id: 'the_turn',
      body: 'No distinct turn — it rides one continuous bit.',
      verdict: 'absent',
    },
    {
      id: 'emotional_beat',
      body: 'A low-energy confessional tone holds throughout; no emotional escalation.',
      verdict: 'weak',
    },
  ],
  repeatable: [
    'Freeze-frame cut at the 2-second mark to interrupt default scroll behaviour',
    'Direct-to-camera address in the first line to establish parasocial proximity',
  ],
  luck: [
    {
      category: 'timing_trend_moment',
      note: 'The video landed the day the audio was trending at peak TikTok Creative Center velocity.',
    },
  ],
};

// Base stream mock — individual tests override as needed
const BASE_STREAM = {
  result: null,
  phase: 'idle',
  filmstrips: {},
  stages: [],
  partial: null,
  panelReady: {},
  error: null,
  reconnect: vi.fn(),
  analysisId: null,
  start: vi.fn(),
  abort: vi.fn(),
  reset: vi.fn(),
};

beforeEach(() => {
  mockPermalink.mockReturnValue({ data: null });
  mockStream.mockReturnValue({ ...BASE_STREAM });
});

// =====================================================
// Test cases
// =====================================================

describe('DecodeShellNode', () => {

  it('(1) renders all 4 beat labels in fixed order from a completed stream result', () => {
    mockStream.mockReturnValue({
      ...BASE_STREAM,
      result: { variants: { remix: { decode: FIXTURE_DECODE } } },
      phase: 'complete',
      analysisId: 'abc123',
    });

    render(<DecodeShellNode />);

    // All 4 beat labels must be present
    expect(screen.getByText('Hook pattern')).toBeTruthy();
    expect(screen.getByText('Structure & pacing')).toBeTruthy();
    expect(screen.getByText('The turn')).toBeTruthy();
    expect(screen.getByText('Emotional beat')).toBeTruthy();

    // Both lane headers must be present
    expect(screen.getByText('What you can repeat')).toBeTruthy();
    expect(screen.getByText('What was luck / timing')).toBeTruthy();

    // Beat body for the present beat
    expect(
      screen.getByText(
        'The opening three seconds combine a freeze-frame cut with a direct-to-camera address, creating immediate pattern interruption.',
      ),
    ).toBeTruthy();
  });

  it('(2) absent beat renders its honest body and carries muted class text-white/35', () => {
    mockStream.mockReturnValue({
      ...BASE_STREAM,
      result: { variants: { remix: { decode: FIXTURE_DECODE } } },
      phase: 'complete',
      analysisId: 'abc123',
    });

    const { container } = render(<DecodeShellNode />);

    // The absent beat body is rendered (honest absence, not hidden)
    const absentBody = screen.getByText('No distinct turn — it rides one continuous bit.');
    expect(absentBody).toBeTruthy();

    // Must carry the muted class (text-white/35)
    expect(absentBody.className).toContain('text-white/35');

    // The weak beat also carries the muted class
    const weakBody = screen.getByText(
      'A low-energy confessional tone holds throughout; no emotional escalation.',
    );
    expect(weakBody.className).toContain('text-white/35');

    // The present beat carries the normal class (text-white/60)
    const presentBody = screen.getByText(
      'The opening three seconds combine a freeze-frame cut with a direct-to-camera address, creating immediate pattern interruption.',
    );
    expect(presentBody.className).toContain('text-white/60');

    // No beat body is hidden
    const allBeatBodies = container.querySelectorAll('[data-testid="beat-body"]');
    allBeatBodies.forEach((el) => {
      expect(el.textContent?.trim().length).toBeGreaterThan(0);
    });
  });

  it('(3) both lane headers render and luck category renders as "timing / trend-moment" with note', () => {
    mockStream.mockReturnValue({
      ...BASE_STREAM,
      result: { variants: { remix: { decode: FIXTURE_DECODE } } },
      phase: 'complete',
      analysisId: 'abc123',
    });

    render(<DecodeShellNode />);

    expect(screen.getByText('What you can repeat')).toBeTruthy();
    expect(screen.getByText('What was luck / timing')).toBeTruthy();

    // Luck category display-name mapping
    expect(screen.getByText('timing / trend-moment')).toBeTruthy();

    // Luck note
    expect(
      screen.getByText(
        'The video landed the day the audio was trending at peak TikTok Creative Center velocity.',
      ),
    ).toBeTruthy();

    // Repeatable bullets
    expect(
      screen.getByText('Freeze-frame cut at the 2-second mark to interrupt default scroll behaviour'),
    ).toBeTruthy();
  });

  it('(4) no prohibited advice verb appears in beat bodies, luck notes, or repeatable bullets', () => {
    mockStream.mockReturnValue({
      ...BASE_STREAM,
      result: { variants: { remix: { decode: FIXTURE_DECODE } } },
      phase: 'complete',
      analysisId: 'abc123',
    });

    const { container } = render(<DecodeShellNode />);

    // Collect the rendered text from beat bodies, luck notes, and repeatable bullets
    const beatBodies = container.querySelectorAll('[data-testid="beat-body"]');
    const luckNotes = container.querySelectorAll('[data-testid="luck-note"]');
    const bulletItems = container.querySelectorAll('[data-testid="repeatable-bullet"]');

    const prohibitedVerbRegex = /\b(fix|improve|should|try|consider)\b/i;

    beatBodies.forEach((el) => {
      expect(prohibitedVerbRegex.test(el.textContent ?? '')).toBe(false);
    });
    luckNotes.forEach((el) => {
      expect(prohibitedVerbRegex.test(el.textContent ?? '')).toBe(false);
    });
    bulletItems.forEach((el) => {
      expect(prohibitedVerbRegex.test(el.textContent ?? '')).toBe(false);
    });

    // "you" outside the sanctioned lane header — the only allowed "you" is in "What you can repeat"
    const fullText = container.textContent ?? '';
    // Remove the exact sanctioned header before checking
    const withoutSanctioned = fullText.replace('What you can repeat', '');
    // No standalone "you" should appear outside the sanctioned header
    expect(/\byou\b/i.test(withoutSanctioned)).toBe(false);
  });

  it('(5) in-flight: with phase "analyzing" and no decode, renders "Decoding structure…" and NO beat labels', () => {
    mockStream.mockReturnValue({
      ...BASE_STREAM,
      result: null,
      phase: 'analyzing',
    });

    render(<DecodeShellNode />);

    expect(screen.getByText('Decoding structure…')).toBeTruthy();
    expect(screen.getByTestId('decode-skeleton')).toBeTruthy();

    // No beat labels in in-flight state
    expect(screen.queryByText('Hook pattern')).toBeNull();
    expect(screen.queryByText('Structure & pacing')).toBeNull();
    expect(screen.queryByText('The turn')).toBeNull();
    expect(screen.queryByText('Emotional beat')).toBeNull();
  });

  it('(6) permalink m3: stream has overall_score:null but permalinkData has decode — 4 beats still render', () => {
    // Stream result has overall_score:null — use-analysis-stream short-circuit won't fire
    mockStream.mockReturnValue({
      ...BASE_STREAM,
      result: { overall_score: null },
      phase: 'idle',
      analysisId: 'perm123',
    });

    // Permalink returns the full row with variants.remix.decode
    mockPermalink.mockReturnValue({
      data: {
        overall_score: null,
        variants: { remix: { decode: FIXTURE_DECODE } },
      },
    });

    render(<DecodeShellNode />);

    // All 4 beat labels render from the direct permalink read
    expect(screen.getByText('Hook pattern')).toBeTruthy();
    expect(screen.getByText('Structure & pacing')).toBeTruthy();
    expect(screen.getByText('The turn')).toBeTruthy();
    expect(screen.getByText('Emotional beat')).toBeTruthy();
  });

});
