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
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));

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

    // Open each panel in turn (Hook, Retention, Shareability via rows; Personas
    // via the cloud) — the drill content is the richest surface, so prove the
    // banned fields stay out there too.
    for (const panelTrigger of ['driver-row-hook', 'driver-row-retention', 'driver-row-shareability']) {
      await user.click(screen.getByTestId(panelTrigger));
      const dialog = await screen.findByRole('dialog');
      const dialogText = dialog.textContent ?? '';
      for (const banned of BANNED_STRINGS) {
        expect(dialogText).not.toContain(banned);
      }
      // Close before opening the next.
      await user.keyboard('{Escape}');
    }

    // Personas panel via the cloud.
    const cloud = container.querySelector('[role="button"]') as HTMLElement;
    await user.click(cloud);
    const personasDialog = await screen.findByRole('dialog', { name: 'Audience' });
    const personasText = personasDialog.textContent ?? '';
    for (const banned of BANNED_STRINGS) {
      expect(personasText).not.toContain(banned);
    }
  });

  it('still renders the legitimate whitelisted content (the guard is not vacuous)', () => {
    render(<Reading />);
    // The gauge score + the driver rows + Fix First still render from the
    // whitelisted fields — proving the test renders a real, populated thread.
    expect(screen.getByRole('img', { name: /Score \d+ of 100/ })).toBeInTheDocument();
    expect(screen.getByTestId('driver-rows')).toBeInTheDocument();
    expect(screen.getByTestId('fix-first')).toBeInTheDocument();
  });
});
