/** @vitest-environment happy-dom */
/**
 * InsightHeroFrame tests — seven behavior cases.
 *
 * Covers:
 *  1. Live fixture (top-level apollo_reasoning): all 3 rewrites + 6 dimensions render.
 *  2. Permalink fixture (variants.apollo only, apollo_reasoning == null): renders identically
 *     (dual-read, Pitfall 2 / WPk976kozfWs regression guard).
 *  3. Each rewrite renders the original struck-through + copy affordance for the variant.
 *  4. Each dimension renders its band AND numeric score; legacy row (score === undefined)
 *     renders band-only without crashing.
 *  5. (D-07) Known heatmap biggest-drop → retention-lever rewrite is labelled with mm:ss.
 *     Null heatmap → no label, no crash.
 *  6. (D-02) Score band (bandLabel + range) sits BELOW rewrites + dimensions (DOM order).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { ApolloDimension, ApolloRewrite } from '@/lib/engine/types';

// ── Minimal mocks ──────────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useParams: () => ({}),
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

// usePermalinkAnalysis returns null by default; per-test overrides via the mock
let mockPermalinkData: Record<string, unknown> | null = null;

vi.mock('@/hooks/queries/use-permalink-analysis', () => ({
  usePermalinkAnalysis: () => ({ data: mockPermalinkData }),
}));

// useAnalysisStream result that tests can override
let mockStreamResult: Record<string, unknown> | null = null;
let mockPanelReady: Record<string, string> = {};

vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: () => ({
    result: mockStreamResult,
    phase: 'complete',
    stages: [],
    panelReady: mockPanelReady,
  }),
}));

// ── Test fixtures ──────────────────────────────────────────────────────────────

const DIMENSIONS: ApolloDimension[] = [
  { name: 'hook',        band: 'strong', score: 85, lever: 'Contrast (§2.1)', evidence: 'Opening line grabs immediately.' },
  { name: 'retention',   band: 'mid',    score: 50, lever: 'Pacing (§2.2)',   evidence: 'Pacing dips at 0:02.' },
  { name: 'clarity',     band: 'strong', score: 85, lever: 'Story arc (§2.3)',evidence: 'Clear message throughout.' },
  { name: 'share_pull',  band: 'mid',    score: 50, lever: 'Emotion (§2.4)',  evidence: 'Mild emotional resonance.' },
  { name: 'substance',   band: 'weak',   score: 20, lever: 'Value (§2.5)',    evidence: 'Thin on tips.' },
  { name: 'credibility', band: 'strong', score: 85, lever: 'Authority (§2.6)',evidence: 'Expert framing.' },
];

const REWRITES: ApolloRewrite[] = [
  { original: 'Why your hook fails every time.', variant: 'Three hook secrets creators miss.',   lever_fixed: 'Contrast (§2.1)' },
  { original: 'Why your hook fails every time.', variant: 'Your retention is bleeding at 0:02.', lever_fixed: 'Retention / pacing (§2.2)' },
  { original: 'Why your hook fails every time.', variant: 'Share this before they fix it.',      lever_fixed: 'Emotion / share-pull (§2.4)' },
];

const APOLLO_REASONING = {
  rewrites: REWRITES,
  dimensions: DIMENSIONS,
  composite_score: 74,
  confidence_scope: 'All six §2 signals observed.',
  ceiling_capper: 'Thin substance caps ceiling at 74.',
};

const HEATMAP = {
  weighted_curve: [1, 0.9, 0.5, 0.48, 0.47, 0.46],   // biggest drop at index 2 (0.9 → 0.5)
  segments: [
    { idx: 0, t_start: 0,  t_end: 5,  is_hook_zone: true,  label: 'Hook' },
    { idx: 1, t_start: 5,  t_end: 10, is_hook_zone: false, label: 'Body' },
    { idx: 2, t_start: 10, t_end: 15, is_hook_zone: false, label: 'Pacing drop' },
    { idx: 3, t_start: 15, t_end: 20, is_hook_zone: false, label: 'Tail' },
    { idx: 4, t_start: 20, t_end: 25, is_hook_zone: false, label: 'CTA' },
    { idx: 5, t_start: 25, t_end: 30, is_hook_zone: false, label: 'End' },
  ],
  weighted_completion_pct: 0.7,
  weighted_hook_score: 0.85,
  weighted_top_dropoff_t: 10,
};

/** Live PredictionResult shape — apollo_reasoning at top level. */
const LIVE_RESULT = {
  overall_score: 74,
  confidence: 0.8,
  anti_virality_gated: false,
  apollo_reasoning: APOLLO_REASONING,
  heatmap: HEATMAP,
};

/** Permalink DB row shape — apollo_reasoning null, nested under variants.apollo. */
const PERMALINK_RESULT = {
  overall_score: 74,
  confidence: 0.8,
  anti_virality_gated: false,
  apollo_reasoning: null,
  variants: { apollo: APOLLO_REASONING },
  heatmap: HEATMAP,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function setup(result: Record<string, unknown> | null = LIVE_RESULT) {
  mockStreamResult = result;
  mockPanelReady = { insight_hero: 'ready' };
  mockPermalinkData = null;
  const { InsightHeroFrame } = require('../InsightHeroFrame');
  const camera = { x: 0, y: 0, scale: 1 };
  const layout = { id: 'insight-hero', label: 'Insight', bounds: { x: 0, y: 0, width: 800, height: 600 } };
  return render(<InsightHeroFrame camera={camera} layout={layout} />);
}

function setupPermalink() {
  // Permalink: stream result omits apollo at top level; variants.apollo has it.
  mockStreamResult = PERMALINK_RESULT;
  mockPanelReady = { insight_hero: 'ready' };
  mockPermalinkData = PERMALINK_RESULT;
  const { InsightHeroFrame } = require('../InsightHeroFrame');
  const camera = { x: 0, y: 0, scale: 1 };
  const layout = { id: 'insight-hero', label: 'Insight', bounds: { x: 0, y: 0, width: 800, height: 600 } };
  return render(<InsightHeroFrame camera={camera} layout={layout} />);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetModules();
  mockStreamResult = null;
  mockPermalinkData = null;
  mockPanelReady = {};
});

describe('InsightHeroFrame', () => {

  it('Test 1: LIVE — renders all 3 rewrites and 6 dimensions', () => {
    setup(LIVE_RESULT);
    const frame = screen.getByTestId('insight-hero-frame');

    // 3 rewrites
    const rewrites = within(frame).getAllByTestId('insight-rewrite');
    expect(rewrites).toHaveLength(3);

    // 6 dimensions
    const dims = within(frame).getAllByTestId('insight-dimension');
    expect(dims).toHaveLength(6);
  });

  it('Test 2: PERMALINK dual-read — variants.apollo renders identically (WPk976kozfWs)', () => {
    setupPermalink();
    const frame = screen.getByTestId('insight-hero-frame');

    // Same 3 rewrites
    expect(within(frame).getAllByTestId('insight-rewrite')).toHaveLength(3);
    // Same 6 dimensions
    expect(within(frame).getAllByTestId('insight-dimension')).toHaveLength(6);
  });

  it('Test 3: each rewrite has struck-through original + copy button + variant text', () => {
    setup(LIVE_RESULT);
    const frame = screen.getByTestId('insight-hero-frame');
    const rewrites = within(frame).getAllByTestId('insight-rewrite');

    rewrites.forEach((rw, i) => {
      // struck-through original
      const del = rw.querySelector('del');
      expect(del).toBeTruthy();
      expect(del!.textContent).toBe(REWRITES[i]!.original);

      // copy button
      const copyBtn = within(rw).getByRole('button', { name: /copy/i });
      expect(copyBtn).toBeTruthy();

      // variant text
      expect(rw.textContent).toContain(REWRITES[i]!.variant);
    });
  });

  it('Test 4a: each dimension renders its band AND numeric score', () => {
    setup(LIVE_RESULT);
    const frame = screen.getByTestId('insight-hero-frame');
    const dims = within(frame).getAllByTestId('insight-dimension');

    dims.forEach((dim, i) => {
      const d = DIMENSIONS[i]!;
      // band label
      expect(dim.textContent?.toLowerCase()).toContain(d.band);
      // numeric score
      expect(dim.textContent).toContain(String(d.score));
    });
  });

  it('Test 4b: legacy dimension with score === undefined renders band-only, no crash', () => {
    const legacyResult = {
      ...LIVE_RESULT,
      apollo_reasoning: {
        ...APOLLO_REASONING,
        dimensions: DIMENSIONS.map(({ score: _score, ...rest }) => rest) as unknown as ApolloDimension[],
      },
    };
    setup(legacyResult as unknown as Record<string, unknown>);
    const frame = screen.getByTestId('insight-hero-frame');
    const dims = within(frame).getAllByTestId('insight-dimension');
    expect(dims).toHaveLength(6);
    // bands should still render
    dims.forEach((dim, i) => {
      expect(dim.textContent?.toLowerCase()).toContain(DIMENSIONS[i]!.band);
    });
  });

  it('Test 5a: (D-07) retention rewrite is labelled with the biggest-drop mm:ss', () => {
    setup(LIVE_RESULT);
    const frame = screen.getByTestId('insight-hero-frame');
    // HEATMAP: biggest drop at idx=2, t_start=10 → "0:10"
    const dropLabel = within(frame).getByTestId('insight-rewrite-drop-label');
    expect(dropLabel.textContent).toContain('0:10');
  });

  it('Test 5b: null heatmap → no drop label, no crash', () => {
    const noHeatmap = { ...LIVE_RESULT, heatmap: null };
    setup(noHeatmap as unknown as Record<string, unknown>);
    const frame = screen.getByTestId('insight-hero-frame');
    // No drop label rendered
    expect(within(frame).queryAllByTestId('insight-rewrite-drop-label')).toHaveLength(0);
  });

  it('Test 6: (D-02) score band sits BELOW rewrites + dimensions in DOM order', () => {
    setup(LIVE_RESULT);
    const frame = screen.getByTestId('insight-hero-frame');
    const band = within(frame).getByTestId('insight-score-band');
    const rewrites = within(frame).getAllByTestId('insight-rewrite');
    const dims = within(frame).getAllByTestId('insight-dimension');

    // All rewrites and dimensions should appear before the score band in DOM
    const allNodes = Array.from(frame.querySelectorAll('[data-testid]'));
    const bandIdx = allNodes.findIndex((n) => n === band);
    const lastRewriteIdx = Math.max(...rewrites.map((r) => allNodes.findIndex((n) => n === r)));
    const lastDimIdx = Math.max(...dims.map((d) => allNodes.findIndex((n) => n === d)));

    expect(bandIdx).toBeGreaterThan(lastRewriteIdx);
    expect(bandIdx).toBeGreaterThan(lastDimIdx);

    // Score band renders bandLabel text
    expect(band.textContent).toMatch(/High potential|Solid contender|Needs work/);
  });

});
