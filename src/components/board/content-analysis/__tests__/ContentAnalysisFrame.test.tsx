/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// =====================================================
// Mocks — hook dependencies
// =====================================================

vi.mock('@/hooks/queries/use-permalink-analysis', () => ({
  usePermalinkAnalysis: vi.fn(() => ({ data: null })),
}));
vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: vi.fn(),
}));
vi.mock('@/hooks/queries/use-permalink-filmstrips', () => ({
  usePermalinkFilmstrips: vi.fn(() => ({})),
}));

// =====================================================
// Imports (after mocks)
// =====================================================

import { ContentAnalysisFrame } from '../ContentAnalysisFrame';
import { COPY } from '../content-analysis-constants';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { usePermalinkFilmstrips } from '@/hooks/queries/use-permalink-filmstrips';
import type { Camera, GroupFrameLayout } from '../../board-types';

const camera: Camera = { x: 0, y: 0, scale: 1 };
const layout: GroupFrameLayout = {
  id: 'content-analysis',
  label: 'Content craft',
  bounds: { x: 0, y: 0, width: 800, height: 600 },
};

const HOOK = {
  visual_stop_power: 9,
  audio_hook_quality: 7,
  text_overlay_score: 8,
  first_words_speech_score: 8,
  weakest_modality: 'audio_hook_quality',
  visual_audio_coherence: 8,
  cognitive_load: 3,
};

const ARC = [
  { timestamp_ms: 0, intensity_0_1: 0.58 },
  { timestamp_ms: 5000, intensity_0_1: 0.86 },
  { timestamp_ms: 8000, intensity_0_1: 0.4 },
  { timestamp_ms: 13000, intensity_0_1: 0.3 },
  { timestamp_ms: 18000, intensity_0_1: 0.34 },
  { timestamp_ms: 34000, intensity_0_1: 0.5 },
];

const SEGMENTS = [
  { idx: 0, t_start: 0, t_end: 6, is_hook_zone: true, keyframe_uri: 'k0.jpg' },
  { idx: 1, t_start: 6, t_end: 20, is_hook_zone: false, keyframe_uri: 'k1.jpg' },
  { idx: 2, t_start: 20, t_end: 34, is_hook_zone: false, keyframe_uri: 'k2.jpg' },
];

/** A completed analysis_results row with the craft signals stashed in variants.craft. */
function craftRow(overrides: Record<string, unknown> = {}) {
  return {
    overall_score: 72,
    hook_decomposition: HOOK,
    emotion_arc: ARC,
    heatmap: { segments: SEGMENTS },
    variants: {
      craft: {
        video_signals: { visual_production_quality: 8, hook_visual_impact: 9, pacing_score: 6, transition_quality: 7 },
        cta_segment: null, // no close → weak link
        audio_signals: { voice_clarity_0_10: 8, audio_hook_first_2s_0_10: 7, silence_ratio: 0.08, voiceover_ratio: 0.7, music_ratio: 0.2, audio_description: 'Clear voiceover.' },
        audio_perceptual_score: 82,
        overall_impression: 'A strong hook that loses momentum and never asks for the follow.',
        content_summary: 'GRWM clip.',
      },
    },
    ...overrides,
  };
}

/**
 * The LIVE SSE `complete` result is the raw PredictionResult — craft signals sit
 * at the TOP LEVEL (route.ts nests them under variants.craft only at DB-persist
 * time). Mirrors the real WPk976kozfWs run that rendered "No speech track" /
 * "CTA None" while the engine had captured clear voiceover + a "Stay tuned" CTA.
 */
function liveSseRow(overrides: Record<string, unknown> = {}) {
  return {
    overall_score: 34,
    hook_decomposition: {
      visual_stop_power: 2,
      audio_hook_quality: 4,
      text_overlay_score: 0,
      first_words_speech_score: 3,
      weakest_modality: 'text_overlay_score',
      visual_audio_coherence: 8,
      cognitive_load: 2,
    },
    emotion_arc: ARC,
    heatmap: { segments: SEGMENTS },
    // top-level craft — NO variants.craft (exactly what the SSE complete event carries)
    video_signals: { visual_production_quality: 6, hook_visual_impact: 3, pacing_score: 4, transition_quality: 5 },
    audio_signals: { voice_clarity_0_10: 9, audio_hook_first_2s_0_10: 4, silence_ratio: 0, voiceover_ratio: 1, music_ratio: 0, audio_description: 'Clear spoken voice.' },
    audio_perceptual_score: 79,
    cta_segment: { cta_present: true, type: 'watch_next', strength: 6, rationale: "'Stay tuned' soft CTA" },
    variants: null,
    ...overrides,
  };
}

function mockStream(value: Record<string, unknown>) {
  (useAnalysisStream as ReturnType<typeof vi.fn>).mockReturnValue({
    phase: 'complete',
    result: null,
    filmstrips: {},
    analysisId: 'abc',
    start: vi.fn(),
    abort: vi.fn(),
    reset: vi.fn(),
    stages: [],
    partial: null,
    panelReady: true,
    error: null,
    reconnect: vi.fn(),
    ...value,
  });
}

describe('ContentAnalysisFrame — Content craft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (usePermalinkFilmstrips as ReturnType<typeof vi.fn>).mockReturnValue({});
  });

  it('renders the four pillars as stat tiles from variants.craft data', () => {
    mockStream({ result: craftRow() });
    render(<ContentAnalysisFrame camera={camera} layout={layout} />);

    expect(screen.getByTestId('stat-tile-row')).toBeInTheDocument();
    const tiles = screen.getAllByTestId('stat-tile');
    expect(tiles).toHaveLength(4);
    // Order: Hook · Pacing · Audio · CTA (PILLAR_ORDER).
    expect(tiles[0]).toHaveTextContent('Hook');
    expect(tiles[0]).toHaveTextContent('8.0');
    expect(tiles[1]).toHaveTextContent('Pacing');
    expect(tiles[1]).toHaveTextContent('6.0');
    expect(tiles[2]).toHaveTextContent('Audio');
    expect(tiles[2]).toHaveTextContent('8.2');
    expect(tiles[3]).toHaveTextContent('CTA');
    expect(tiles[3]).toHaveTextContent('None');
  });

  it('flags the missing CTA as the weak link (neutral emphasis tile) and shows the no-close end-cap', () => {
    mockStream({ result: craftRow() });
    render(<ContentAnalysisFrame camera={camera} layout={layout} />);

    const tiles = screen.getAllByTestId('stat-tile');
    // CTA tile (last) carries neutral weak-link emphasis; Hook (first) does not.
    expect(tiles[3]!.className).toMatch(/border-border-hover/);
    expect(tiles[0]!.className).not.toMatch(/border-border-hover/);
    expect(screen.getByTestId('craft-endcap')).toBeInTheDocument();
    expect(screen.getByTestId('craft-mark-close')).toHaveTextContent(COPY.NO_CLOSE_MARK);
  });

  it('renders the editorial headline spine', () => {
    mockStream({ result: craftRow() });
    render(<ContentAnalysisFrame camera={camera} layout={layout} />);

    const headline = screen.getByTestId('content-analysis-headline');
    expect(headline).toHaveTextContent('Strong open');
    expect(headline).toHaveTextContent('no close');
  });

  it('renders one filmstrip cell per segment', () => {
    mockStream({ result: craftRow() });
    render(<ContentAnalysisFrame camera={camera} layout={layout} />);
    expect(screen.getAllByTestId('craft-cell')).toHaveLength(3);
  });

  it('shows the empty state for formats with no craft signal (text mode)', () => {
    mockStream({ result: { overall_score: 60, hook_decomposition: null, emotion_arc: null, heatmap: null, variants: null } });
    render(<ContentAnalysisFrame camera={camera} layout={layout} />);
    expect(screen.getByTestId('content-analysis-empty')).toHaveTextContent(COPY.EMPTY);
    // The Rulebook scorecard lives inside the craft branch — gone in the empty state.
    expect(screen.queryByTestId('creator-rulebook')).not.toBeInTheDocument();
  });

  it('renders the Creator Rulebook scorecard derived from the craft signals', () => {
    mockStream({ result: craftRow() });
    render(<ContentAnalysisFrame camera={camera} layout={layout} />);
    const card = screen.getByTestId('creator-rulebook');
    expect(card).toBeInTheDocument();
    // Populated (not the "Needs video" placeholder) → shows the coverage unit.
    expect(card).toHaveTextContent(/on-pattern/i);
  });

  it('renders skeletons while streaming with no data yet', () => {
    mockStream({ phase: 'analyzing', result: null });
    render(<ContentAnalysisFrame camera={camera} layout={layout} />);
    expect(screen.getByTestId('craft-filmstrip-loading')).toBeInTheDocument();
    expect(screen.getByTestId('craft-rail-loading')).toBeInTheDocument();
  });

  it('populates Audio/Pacing/CTA from TOP-LEVEL craft on the live SSE result (regression: WPk976kozfWs "No speech track")', () => {
    mockStream({ result: liveSseRow() });
    render(<ContentAnalysisFrame camera={camera} layout={layout} />);

    const tiles = screen.getAllByTestId('stat-tile');
    // Hook reads top-level hook_decomposition → always worked. (2+4+0+3)/4 = 2.25 → 2.3
    expect(tiles[0]).toHaveTextContent('Hook');
    expect(tiles[0]).toHaveTextContent('2.3');
    // Pacing reads video_signals.pacing_score — must dual-read top-level on live SSE.
    expect(tiles[1]).toHaveTextContent('Pacing');
    expect(tiles[1]).toHaveTextContent('4.0');
    // Audio: real voiceover (perceptual 79 → 7.9) — NOT the "No speech track" placeholder.
    expect(tiles[2]).toHaveTextContent('Audio');
    expect(tiles[2]).toHaveTextContent('7.9');
    // CTA: "Stay tuned" present (strength 6) — NOT "None".
    expect(tiles[3]).toHaveTextContent('CTA');
    expect(tiles[3]).toHaveTextContent('6.0');
    // The smoking-gun string must be gone everywhere (rail tile + filmstrip caption).
    expect(screen.queryByText(/No speech track/i)).not.toBeInTheDocument();
  });

  it('uses permalink filmstrips when the stream has none', () => {
    (usePermalinkFilmstrips as ReturnType<typeof vi.fn>).mockReturnValue({ 0: 'p0.jpg', 1: 'p1.jpg', 2: 'p2.jpg' });
    // Segments carry no keyframe_uri → cells must fall back to the permalink URLs.
    const row = craftRow({ heatmap: { segments: SEGMENTS.map((s) => ({ ...s, keyframe_uri: null })) } });
    mockStream({ result: row, filmstrips: {} });
    render(<ContentAnalysisFrame camera={camera} layout={layout} />);

    const imgs = screen.getAllByTestId('craft-cell').map((c) => c.querySelector('img'));
    expect(imgs[0]).toHaveAttribute('src', 'p0.jpg');
  });
});
