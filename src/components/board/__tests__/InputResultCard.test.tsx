/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { BehavioralPredictions } from '@/lib/engine/types';

// The poster data layer (permalink + SSE + pending-upload filmstrips) is stubbed
// so the card's own job — gating the poster on a *real* keyframe URL — is what's
// under test, not the network/query plumbing those hooks own.
let mockStream: { result: unknown; filmstrips: Record<number, string> } = {
  result: null,
  filmstrips: {},
};
let mockPermalinkFilmstrips: Record<number, string> = {};
let mockPendingVideo: { thumbnail: string; duration: number; frames: Record<number, string> } | null = null;

vi.mock('@/hooks/queries/use-permalink-analysis', () => ({
  usePermalinkAnalysis: () => ({ data: null }),
}));
vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: () => mockStream,
}));
vi.mock('@/hooks/queries/use-permalink-filmstrips', () => ({
  usePermalinkFilmstrips: () => mockPermalinkFilmstrips,
}));
vi.mock('@/stores/board-store', () => ({
  useBoardStore: (selector: (s: { pendingVideo: typeof mockPendingVideo }) => unknown) =>
    selector({ pendingVideo: mockPendingVideo }),
}));
// Reduced motion on → skips the rAF mount transition + count-in (stable render).
vi.mock('@/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => true,
}));

import { InputResultCard } from '../InputResultCard';

const BEHAVIORAL: BehavioralPredictions = {
  share_percentile: 'top 8%',
  completion_percentile: 'top 22%',
  comment_percentile: 'top 40%',
  save_percentile: 'top 15%',
} as unknown as BehavioralPredictions;

beforeEach(() => {
  mockStream = { result: null, filmstrips: {} };
  mockPermalinkFilmstrips = {};
  mockPendingVideo = null;
});

describe('InputResultCard — video poster', () => {
  it('renders a keyframe poster in the Input frame when SSE filmstrips are present', () => {
    mockStream = { result: null, filmstrips: { 0: 'https://signed/frame-0.jpg', 1: 'https://signed/frame-1.jpg' } };
    render(<InputResultCard behavioral={BEHAVIORAL} confidence={0.82} confidenceLabel="HIGH" />);

    const card = screen.getByTestId('input-scorecard');
    const poster = within(card).getByTestId('keyframe');
    expect(poster).toBeTruthy();
    // The signed keyframe is the earliest available frame ('first').
    const img = within(poster).getByRole('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://signed/frame-0.jpg');
  });

  it('renders a poster from permalink-replay filmstrips when SSE has none', () => {
    mockPermalinkFilmstrips = { 0: 'https://replay/frame-0.jpg' };
    render(<InputResultCard behavioral={BEHAVIORAL} confidence={0.82} confidenceLabel="HIGH" />);
    expect(within(screen.getByTestId('input-scorecard')).getByTestId('keyframe')).toBeTruthy();
  });

  it('does NOT render a poster in text mode (no filmstrips, no video) — no layout shift', () => {
    render(<InputResultCard behavioral={BEHAVIORAL} confidence={0.82} confidenceLabel="HIGH" />);
    const card = screen.getByTestId('input-scorecard');
    expect(within(card).queryByTestId('keyframe')).toBeNull();
  });

  it('stamps the duration badge from heatmap segments when present', () => {
    mockStream = {
      result: { heatmap: { segments: [{ idx: 0, t_start: 0, t_end: 15 }, { idx: 1, t_start: 15, t_end: 42 }] } },
      filmstrips: { 0: 'https://signed/frame-0.jpg' },
    };
    render(<InputResultCard behavioral={BEHAVIORAL} confidence={0.82} confidenceLabel="HIGH" />);
    // 42s → "0:42" badge.
    expect(within(screen.getByTestId('input-scorecard')).getByText('0:42')).toBeTruthy();
  });

  it('preserves the scorecard + confidence testids alongside the poster', () => {
    mockStream = { result: null, filmstrips: { 0: 'https://signed/frame-0.jpg' } };
    render(<InputResultCard behavioral={BEHAVIORAL} confidence={0.91} confidenceLabel="HIGH" />);
    expect(screen.getByTestId('input-scorecard')).toBeTruthy();
    expect(screen.getByTestId('input-confidence')).toBeTruthy();
    expect(screen.getByTestId('keyframe')).toBeTruthy();
  });

  it('shows no poster in the streaming holding state even with frames present', () => {
    mockStream = { result: null, filmstrips: { 0: 'https://signed/frame-0.jpg' } };
    render(<InputResultCard behavioral={null} confidence={null} confidenceLabel={null} isStreaming />);
    // Streaming holding state has no hero block → no poster beside it.
    expect(screen.queryByTestId('keyframe')).toBeNull();
  });
});
