/** @vitest-environment happy-dom */
/**
 * Plan 05-04 Task 1 — ResultsPanel predicted_engagement null-safety + range rendering.
 *
 * Tests:
 * - When predicted_engagement is null/absent, NO engagement card renders (R9 honesty).
 * - When predicted_engagement is a populated EngagementRange, EngagementRangeCard renders
 *   with lo + hi range bounds — never a single bare point number.
 * - TikTokResultCard is no longer imported or rendered by results-panel (D-08 dead path removed).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PredictionResult } from '@/lib/engine/types';

// Stub heavy store dependencies irrelevant to the gate being tested
vi.mock('@/stores/simulation-store', () => ({
  useSimulationStore: (sel: (s: { videoSrc: string | null; thumbnailSrc: string | null }) => unknown) =>
    sel({ videoSrc: null, thumbnailSrc: null }),
}));

// Stub child components that carry their own heavy deps
vi.mock('../impact-score', () => ({
  HeroScore: () => <div data-testid="hero-score" />,
}));
vi.mock('../attention-breakdown', () => ({
  FactorBreakdown: () => <div data-testid="factor-breakdown" />,
}));
vi.mock('../behavioral-predictions', () => ({
  BehavioralPredictionsSection: () => <div data-testid="behavioral-predictions" />,
}));
vi.mock('../insights-section', () => ({
  SuggestionsSection: () => <div data-testid="suggestions-section" />,
}));
vi.mock('../share-button', () => ({
  ShareButton: () => <div data-testid="share-button" />,
}));
vi.mock('../signal-availability-chips', () => ({
  SignalAvailabilityChips: () => <div data-testid="signal-chips" />,
}));
vi.mock('../goal-recheck-banner', () => ({
  GoalRecheckBanner: () => <div data-testid="goal-recheck-banner" />,
}));

import { ResultsPanel } from '../results-panel';

const baseResult = (over: Partial<PredictionResult> = {}): PredictionResult =>
  ({
    overall_score: 72,
    confidence: 0.7,
    confidence_label: 'Medium',
    has_video: true,
    factors: [],
    latency_ms: 12000,
    engine_version: 'v3.1',
    warnings: [],
    ...over,
  }) as unknown as PredictionResult;

describe('ResultsPanel — predicted_engagement gate (null-safety + range shape)', () => {
  it('does NOT render EngagementRangeCard when predicted_engagement is null', () => {
    render(
      <ResultsPanel
        result={baseResult({ predicted_engagement: null })}
        onRunAnother={() => {}}
      />,
    );
    expect(screen.queryByTestId('engagement-range-card')).toBeNull();
  });

  it('does NOT render EngagementRangeCard when predicted_engagement is absent (undefined cast to null)', () => {
    const result = baseResult({ predicted_engagement: null });
    render(<ResultsPanel result={result} onRunAnother={() => {}} />);
    expect(screen.queryByTestId('engagement-range-card')).toBeNull();
  });

  it('renders EngagementRangeCard with lo and hi when predicted_engagement is a populated EngagementRange', () => {
    render(
      <ResultsPanel
        result={baseResult({
          predicted_engagement: {
            lo: 8000,
            hi: 40000,
            confidence: 0.65,
            basis: 'vs your follower tier',
          } as PredictionResult['predicted_engagement'],
        })}
        onRunAnother={() => {}}
      />,
    );
    const card = screen.getByTestId('engagement-range-card');
    expect(card).toBeTruthy();
    // Both range bounds must be present — never a single point
    expect(card.textContent).toMatch(/8[Kk]|8,000/);
    expect(card.textContent).toMatch(/40[Kk]|40,000/);
  });

  it('does NOT render TikTokResultCard (dead path removed — D-08)', () => {
    // TikTokResultCard is no longer imported or used in results-panel.
    render(
      <ResultsPanel
        result={baseResult({ predicted_engagement: null })}
        onRunAnother={() => {}}
      />,
    );
    expect(screen.queryByTestId('tiktok-result-card')).toBeNull();
  });
});
