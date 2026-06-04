/** @vitest-environment happy-dom */
/**
 * Plan 01-01 Task 3 — ResultsPanel predicted_engagement null-safety confirmation.
 *
 * These tests confirm EXISTING behavior (not new handling):
 * - TikTokResultCard is gated on `{result.predicted_engagement && ...}` in results-panel.tsx
 * - When predicted_engagement is null or absent, TikTokResultCard must NOT render.
 *
 * Production source is NOT modified by this task.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PredictionResult } from '@/lib/engine/types';

// Stub heavy store dependencies irrelevant to the gate being tested
vi.mock('@/stores/simulation-store', () => ({
  useSimulationStore: (sel: (s: { videoSrc: string | null; thumbnailSrc: string | null }) => unknown) =>
    sel({ videoSrc: null, thumbnailSrc: null }),
}));

// Stub child components that carry their own heavy deps (Recharts, Lucide, etc.)
// so the test focuses only on the predicted_engagement gate.
vi.mock('../tiktok-result-card', () => ({
  TikTokResultCard: () => <div data-testid="tiktok-result-card" />,
}));
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

describe('ResultsPanel — predicted_engagement gate (null-safety confirmation)', () => {
  it('does NOT render TikTokResultCard when predicted_engagement is null', () => {
    render(
      <ResultsPanel
        result={baseResult({ predicted_engagement: null as unknown as PredictionResult['predicted_engagement'] })}
        onRunAnother={() => {}}
      />,
    );
    expect(screen.queryByTestId('tiktok-result-card')).toBeNull();
  });

  it('does NOT render TikTokResultCard when predicted_engagement is null (Plan 02: field is now nullable)', () => {
    // Plan 02 D1.1: predicted_engagement is nullable; null produces the same guard as absent.
    const result = baseResult({ predicted_engagement: null });
    render(<ResultsPanel result={result} onRunAnother={() => {}} />);
    expect(screen.queryByTestId('tiktok-result-card')).toBeNull();
  });

  it('DOES render TikTokResultCard when predicted_engagement is present', () => {
    render(
      <ResultsPanel
        result={baseResult({
          predicted_engagement: {
            views: 50000,
            likes: 5000,
            comments: 200,
            shares: 300,
            saves: 150,
          } as PredictionResult['predicted_engagement'],
        })}
        onRunAnother={() => {}}
      />,
    );
    expect(screen.getByTestId('tiktok-result-card')).toBeTruthy();
  });
});
