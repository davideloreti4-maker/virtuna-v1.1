/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PredictionResult } from '@/lib/engine/types';

import { makeReadingResult } from './fixtures/reading-fixture';

// ─────────────────────────────────────────────────────────────────────────────
// READ-10 — the standing no-cut-data regression guard (threat T-02-11).
//
// The load-bearing trust boundary in the Reading is PredictionResult → DOM: only
// a small whitelist of fields may cross; the raw result is NEVER spread into JSX.
// This is an assert-ABSENT test — it extends the healthy fixture with EVERY banned
// field populated with a recognizable sentinel, renders the FULL Reading (every
// block + every drill panel opened), and proves none of those sentinels reach the
// DOM. If a banned field ever leaks, this test fails and names it.
//
// Cut/jargon fields (brief §2.9): feature_vector, dead *_score (rule/trend/ml/
// gemini), score_weights, signal_availability, latency_ms, cost_cents, model names
// (gemini_model/deepseek_model), critique, predicted_engagement, dead modules.
// ─────────────────────────────────────────────────────────────────────────────

/** Distinctive sentinels — strings/numbers that would be unmistakable if rendered. */
const SENTINELS = {
  featureVector: 'FEATVEC_SENTINEL_8842',
  geminiModel: 'qwen-omni-flash',
  deepseekModel: 'deepseek-reasoner',
  critique: 'CRITIQUE_SENTINEL_7731',
  predictedEngagement: 'PREDENG_SENTINEL_5519',
  costCents: 4242, // cost_cents sentinel
  latencyMs: 31999, // latency_ms sentinel
  ruleScore: 9111,
  trendScore: 9222,
  mlScore: 9333,
  geminiScore: 9444,
  scoreWeights: 'SCOREWEIGHT_SENTINEL',
  signalAvail: 'SIGNALAVAIL_SENTINEL',
} as const;

/** The healthy fixture, EXTENDED with populated banned fields (cast — these are
 *  fields the Reading must never read, so we layer them onto the realistic base). */
function makeResultWithCutData(): PredictionResult {
  const base = makeReadingResult();
  return {
    ...base,
    feature_vector: {
      __sentinel: SENTINELS.featureVector,
      hook_strength: 0.91,
      pacing: 0.42,
    },
    rule_score: SENTINELS.ruleScore,
    trend_score: SENTINELS.trendScore,
    ml_score: SENTINELS.mlScore,
    gemini_score: SENTINELS.geminiScore,
    score_weights: {
      behavioral: 0.533,
      apollo: 0.467,
      ml: 0,
      rules: 0,
      trends: 0,
      __sentinel: SENTINELS.scoreWeights,
    },
    signal_availability: {
      gemini: true,
      behavioral: true,
      __sentinel: SENTINELS.signalAvail,
    },
    latency_ms: SENTINELS.latencyMs,
    cost_cents: SENTINELS.costCents,
    gemini_model: SENTINELS.geminiModel,
    deepseek_model: SENTINELS.deepseekModel,
    critique: {
      summary: SENTINELS.critique,
      flaws: [{ note: SENTINELS.critique }],
    },
    predicted_engagement: {
      lo: 1000,
      hi: 50000,
      confidence: 0.6,
      basis: SENTINELS.predictedEngagement,
    },
  } as unknown as PredictionResult;
}

let mockState: { id: string | null; data: PredictionResult | null; isLoading: boolean } = {
  id: 'sim-1',
  data: makeResultWithCutData(),
  isLoading: false,
};
vi.mock('@/hooks/queries/use-permalink-analysis', () => ({
  usePermalinkAnalysis: () => mockState,
}));
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false, useIsMobileHydrated: () => ({ isMobile: false, hydrated: true }) }));
// The score panel (D-02) runs a panel-local useComparisons(id) (useQuery). Mock it
// so no QueryClientProvider is needed and the niche cohort is deterministic — a real
// cohort here renders ScoreDistribution's field histogram (the richest score surface
// for the READ-10 sweep below). The cohort numbers are NOT cut/jargon fields.
vi.mock('@/components/board/verdict/use-comparisons', () => ({
  useComparisons: () => ({
    data: { history: [], niche: { median: 58, p75: 74, count: 120, histogram: [2, 4, 8, 14, 22, 26, 18, 12, 8, 6] } },
  }),
}));
// The retention composed cluster (03-05) runs a panel-local usePermalinkFilmstrips()
// (useQuery). Mock it so opening the retention drill panel needs no QueryClientProvider.
// A real signed URL here is the richest filmstrip surface for the READ-10 sweep — and
// a URL string is NOT a cut/jargon field (the sweep asserts no banned sentinels leak).
vi.mock('@/hooks/queries/use-permalink-filmstrips', () => ({
  usePermalinkFilmstrips: () => ({ 0: 'https://example.test/frame-0.jpg', 2: 'https://example.test/frame-2.jpg' }),
}));
// The retention scrubber resolves a video via useUploadedVideoSource (fetch). Mock
// it so the drill sweep needs no network; a signed URL is not a cut/jargon field.
vi.mock('@/components/board/audience/use-uploaded-video-source', () => ({
  useUploadedVideoSource: () => ({ src: 'https://example.test/clip.mp4', status: 'ready' }),
}));

import { Reading } from '../reading';

beforeEach(() => {
  mockState = { id: 'sim-1', data: makeResultWithCutData(), isLoading: false };
});

/** Every banned sentinel, as strings, for a single sweep of the rendered DOM. */
const BANNED_STRINGS: string[] = [
  SENTINELS.featureVector,
  SENTINELS.geminiModel,
  SENTINELS.deepseekModel,
  SENTINELS.critique,
  SENTINELS.predictedEngagement,
  SENTINELS.scoreWeights,
  SENTINELS.signalAvail,
  String(SENTINELS.costCents),
  String(SENTINELS.latencyMs),
  String(SENTINELS.ruleScore),
  String(SENTINELS.trendScore),
  String(SENTINELS.mlScore),
  String(SENTINELS.geminiScore),
  // jargon words that must never surface as labels
  'feature_vector',
  'critique',
  'predicted_engagement',
  'cost_cents',
  'latency_ms',
  'projected views',
];

describe('Reading — READ-10 no-cut-data regression guard (T-02-11)', () => {
  it('renders NONE of the banned cut/jargon fields in the full thread', () => {
    const { container } = render(<Reading />);
    const text = container.textContent ?? '';
    for (const banned of BANNED_STRINGS) {
      expect(text).not.toContain(banned);
    }
  });

  it('keeps the cut data out even with every drill panel opened', async () => {
    const user = userEvent.setup();
    const { container } = render(<Reading />);

    // Expand each drill panel in turn (inline accordion — Hook, Retention,
    // Shareability, Audience, Niche rank). The expanded panel is the richest raw-data
    // surface, so sweep the whole thread with each one open.
    const panels: Array<[string, string]> = [
      ['row-trigger-score', 'score-distribution'],
      ['row-trigger-hook', 'panel-hook'],
      ['row-trigger-retention', 'retention-scrubber-cluster'],
      ['row-trigger-shareability', 'panel-shareability'],
      ['row-trigger-personas', 'panel-personas-list'],
    ];
    for (const [trigger, content] of panels) {
      await user.click(screen.getByTestId(trigger));
      await screen.findByTestId(content); // wait for the panel to mount
      const text = container.textContent ?? '';
      for (const banned of BANNED_STRINGS) {
        expect(text).not.toContain(banned);
      }
    }
  });

  it('still renders the legitimate whitelisted content (the guard is not vacuous)', () => {
    render(<Reading />);
    // The gauge score + the accordion rows + Fix First still render from the
    // whitelisted fields — proving the test renders a real, populated thread.
    expect(screen.getByRole('img', { name: /Score \d+ of 100/ })).toBeInTheDocument();
    expect(screen.getByTestId('reading-accordion')).toBeInTheDocument();
    expect(screen.getByTestId('fix-first')).toBeInTheDocument();
  });
});
