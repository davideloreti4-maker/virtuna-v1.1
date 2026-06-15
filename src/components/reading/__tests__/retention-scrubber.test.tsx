/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { makeReadingResult, makeEmptySegmentsResult, makeEmptyHeatmapResult } from './fixtures/reading-fixture';

// The scrubber reads its keyframe map + video source from two panel-local hooks.
// Mock both so the component renders deterministically with no network.
let mockFilmstrips: Record<number, string> = {};
vi.mock('@/hooks/queries/use-permalink-filmstrips', () => ({
  usePermalinkFilmstrips: () => mockFilmstrips,
}));

let mockVideo: { src: string | null; status: string } = { src: null, status: 'idle' };
vi.mock('@/components/board/audience/use-uploaded-video-source', () => ({
  useUploadedVideoSource: () => mockVideo,
}));

import { RetentionScrubber } from '../retention-scrubber';

beforeEach(() => {
  mockFilmstrips = {};
  mockVideo = { src: null, status: 'idle' };
});

// ─────────────────────────────────────────────────────────────────────────────
// RetentionScrubber (003-A) — the linked watch-journey. One playhead drives the
// frame + curve + on-screen cell + who-leaves cohort. Real video when available,
// keyframe flipbook degrade, PanelEmpty on no timeline (D-13).
// ─────────────────────────────────────────────────────────────────────────────
describe('RetentionScrubber (linked watch-journey, 003-A)', () => {
  it('mounts the curve + slider + transport + who-leaves on real data', () => {
    render(<RetentionScrubber data={makeReadingResult()} />);
    expect(screen.getByTestId('retention-scrubber-cluster')).toBeInTheDocument();
    expect(screen.getByTestId('retention-chart')).toBeInTheDocument();
    expect(screen.getByTestId('retention-scrubber-slider')).toBeInTheDocument();
    expect(screen.getByTestId('retention-scrubber-cohorts')).toBeInTheDocument();
  });

  it('starts the live "leaving now" readout at "everyone watching" (playhead at 0)', () => {
    render(<RetentionScrubber data={makeReadingResult()} />);
    expect(screen.getByTestId('retention-scrubber-leaving').textContent ?? '').toMatch(
      /everyone watching/i,
    );
  });

  it('renders the real <video> when a playable source resolves (uploads + tiktok, S1)', () => {
    mockVideo = { src: 'https://example.test/clip.mp4', status: 'ready' };
    render(<RetentionScrubber data={makeReadingResult()} />);
    const video = screen.getByTestId('retention-scrubber-video') as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video.getAttribute('src')).toBe('https://example.test/clip.mp4');
  });

  it('degrades to the keyframe flipbook (no <video>) when no source resolves', () => {
    mockVideo = { src: null, status: 'idle' };
    render(<RetentionScrubber data={makeReadingResult()} />);
    expect(screen.queryByTestId('retention-scrubber-video')).not.toBeInTheDocument();
    // Still a working scrubber — curve + slider mount on the flipbook path.
    expect(screen.getByTestId('retention-scrubber-slider')).toBeInTheDocument();
  });

  it('degrades to PanelEmpty on empty segments (no curve, no empty SVG shell, D-13)', () => {
    render(<RetentionScrubber data={makeEmptySegmentsResult()} />);
    expect(screen.getByText('Not available for this read.')).toBeInTheDocument();
    expect(screen.queryByTestId('retention-scrubber-cluster')).not.toBeInTheDocument();
  });

  it('degrades to PanelEmpty on a null heatmap (no throw)', () => {
    expect(() => render(<RetentionScrubber data={makeEmptyHeatmapResult()} />)).not.toThrow();
    expect(screen.getByText('Not available for this read.')).toBeInTheDocument();
  });
});
