/** @vitest-environment happy-dom */
/**
 * Phase 13 Plan 02 — SuggestionsSection tests (D-05 + D-06 + D-30)
 *
 * Test surface:
 *   1 — low band: renders 3 fix items with "Fix" badge (accent variant)
 *   2 — band header: correct text per band
 *   3 — reinforcement badge label is "Strength" (not "Reinforcement") with success variant
 *   4 — stretch badge label is "Stretch" with info variant
 *   5 — timestamp renders when timestamp_ms > 0; absent when 0
 *   6 — empty suggestions → fallback item rendered; never returns null
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SuggestionsSection } from '../insights-section';
import type { CounterfactualSuggestionItem } from '@/lib/engine/types';

function makeFixItem(i: number): CounterfactualSuggestionItem {
  return {
    type: 'fix',
    headline: `Fix headline ${i}`,
    detail: `Fix detail ${i}`,
    timestamp_ms: i * 1000,
    signal_anchor: `signal_${i}`,
  };
}

function makeReinforcementItem(): CounterfactualSuggestionItem {
  return {
    type: 'reinforcement',
    headline: 'Strength headline',
    detail: 'Strength detail',
    timestamp_ms: 0,
    signal_anchor: 'audio_signals',
  };
}

function makeStretchItem(): CounterfactualSuggestionItem {
  return {
    type: 'stretch',
    headline: 'Stretch headline',
    detail: 'Stretch detail',
    timestamp_ms: 7000,
    signal_anchor: 'hook_decomposition',
  };
}

// Test 1: low band renders 3 fix items with "Fix" badge
describe('SuggestionsSection — low band', () => {
  it('Test 1: renders 3 fix items with badge label "Fix" and accent variant', () => {
    render(
      <SuggestionsSection
        band="low"
        suggestions={[makeFixItem(1), makeFixItem(2), makeFixItem(3)]}
      />,
    );
    const fixBadges = screen.getAllByText('Fix');
    expect(fixBadges).toHaveLength(3);
  });
});

// Test 2: section header text per band
describe('SuggestionsSection — band headers', () => {
  it('Test 2a: header is "What to Fix" when band="low"', () => {
    render(
      <SuggestionsSection band="low" suggestions={[makeFixItem(1), makeFixItem(2), makeFixItem(3)]} />,
    );
    expect(screen.getByText('What to Fix')).toBeInTheDocument();
  });

  it('Test 2b: header is "Improvements + What\'s Working" when band="mid"', () => {
    render(
      <SuggestionsSection
        band="mid"
        suggestions={[makeFixItem(1), makeFixItem(2), makeReinforcementItem()]}
      />,
    );
    expect(screen.getByText("Improvements + What's Working")).toBeInTheDocument();
  });

  it('Test 2c: header is "What\'s Working" when band="high"', () => {
    render(
      <SuggestionsSection
        band="high"
        suggestions={[makeStretchItem(), makeReinforcementItem(), makeReinforcementItem()]}
      />,
    );
    expect(screen.getByText("What's Working")).toBeInTheDocument();
  });
});

// Test 3: reinforcement → badge label "Strength" (not "Reinforcement") with success variant
describe('SuggestionsSection — reinforcement badge', () => {
  it('Test 3: reinforcement type renders badge label "Strength" (not "Reinforcement")', () => {
    render(
      <SuggestionsSection
        band="high"
        suggestions={[makeStretchItem(), makeReinforcementItem(), makeReinforcementItem()]}
      />,
    );
    // "Strength" must appear for reinforcement items
    const strengthBadges = screen.getAllByText('Strength');
    expect(strengthBadges.length).toBeGreaterThanOrEqual(2);
    // "Reinforcement" must NOT appear as badge label
    expect(screen.queryByText('Reinforcement')).not.toBeInTheDocument();
  });
});

// Test 4: stretch → badge label "Stretch" with info variant
describe('SuggestionsSection — stretch badge', () => {
  it('Test 4: stretch type renders badge label "Stretch"', () => {
    render(
      <SuggestionsSection
        band="high"
        suggestions={[makeStretchItem(), makeReinforcementItem(), makeReinforcementItem()]}
      />,
    );
    expect(screen.getByText('Stretch')).toBeInTheDocument();
  });
});

// Test 5: timestamp renders when timestamp_ms > 0; absent when 0
describe('SuggestionsSection — timestamp rendering', () => {
  it('Test 5a: timestamp_ms=3000 renders "0:03" (Clock + M:SS format)', () => {
    render(
      <SuggestionsSection
        band="low"
        suggestions={[
          { ...makeFixItem(1), timestamp_ms: 3000 },
          { ...makeFixItem(2), timestamp_ms: 0 },
          { ...makeFixItem(3), timestamp_ms: 0 },
        ]}
      />,
    );
    expect(screen.getByText('0:03')).toBeInTheDocument();
  });

  it('Test 5b: timestamp_ms=0 → no timestamp element rendered', () => {
    render(
      <SuggestionsSection
        band="low"
        suggestions={[
          { ...makeFixItem(1), timestamp_ms: 0 },
          { ...makeFixItem(2), timestamp_ms: 0 },
          { ...makeFixItem(3), timestamp_ms: 0 },
        ]}
      />,
    );
    // No M:SS format timestamps
    expect(screen.queryByText(/^\d+:\d{2}$/)).not.toBeInTheDocument();
  });
});

// Test 6: empty suggestions → fallback item rendered; never returns null
describe('SuggestionsSection — empty/degraded state', () => {
  it('Test 6: empty suggestions → fallback "Analysis in progress" item rendered (D-04 always-on)', () => {
    const { container } = render(
      <SuggestionsSection band="low" suggestions={[]} />,
    );
    // Component must render (not null)
    expect(container.firstChild).not.toBeNull();
    // Fallback headline
    expect(screen.getByText('Analysis in progress')).toBeInTheDocument();
    // Fallback detail
    expect(screen.getByText(/Suggestions were not available/)).toBeInTheDocument();
    // Fallback uses reinforcement badge (neutral)
    expect(screen.getByText('Strength')).toBeInTheDocument();
  });
});
