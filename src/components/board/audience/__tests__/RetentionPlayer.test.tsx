/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RetentionPlayer, type RetentionPlayerProps } from '../RetentionPlayer';
import type { HeatmapPayload } from '@/lib/engine/types';

const heatmap = {
  segments: [
    { idx: 0, t_start: 0, t_end: 5, is_hook_zone: true, keyframe_uri: null },
    { idx: 1, t_start: 5, t_end: 10, is_hook_zone: false, keyframe_uri: null },
  ],
  personas: [],
  weighted_curve: [1, 0],
  weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
} as unknown as HeatmapPayload;

function baseProps(over: Partial<RetentionPlayerProps> = {}): RetentionPlayerProps {
  return {
    videoSrc: null,
    curve: [1, 0],
    heatmap,
    drop: null,
    totalDurationSec: 10,
    filmstrips: {},
    nicheCompletionPct: null,
    isLoading: false,
    ...over,
  };
}

describe('RetentionPlayer', () => {
  it('renders only the static chart when there is no playable source', () => {
    render(<RetentionPlayer {...baseProps({ videoSrc: null })} />);
    expect(screen.getByTestId('retention-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('retention-player')).toBeNull();
    expect(screen.queryByTestId('retention-video')).toBeNull();
  });

  it('renders the video + scrubber when a source exists', () => {
    render(<RetentionPlayer {...baseProps({ videoSrc: 'blob:vid' })} />);
    expect(screen.getByTestId('retention-player')).toBeInTheDocument();
    const video = screen.getByTestId('retention-video') as HTMLVideoElement;
    expect(video.getAttribute('src')).toBe('blob:vid');
    expect(screen.getByTestId('retention-scrubber')).toBeInTheDocument();
  });

  it('seeks via keyboard and reflects the new position on the slider', () => {
    render(<RetentionPlayer {...baseProps({ videoSrc: 'blob:vid' })} />);
    const scrubber = screen.getByTestId('retention-scrubber');

    expect(scrubber.getAttribute('aria-valuenow')).toBe('0');

    // total = 10s → one ArrowRight step = 1s = 10%
    fireEvent.keyDown(scrubber, { key: 'ArrowRight' });
    expect(scrubber.getAttribute('aria-valuenow')).toBe('10');

    fireEvent.keyDown(scrubber, { key: 'End' });
    expect(scrubber.getAttribute('aria-valuenow')).toBe('100');

    fireEvent.keyDown(scrubber, { key: 'Home' });
    expect(scrubber.getAttribute('aria-valuenow')).toBe('0');

    // ArrowUp = 5s big step = 50%
    fireEvent.keyDown(scrubber, { key: 'ArrowUp' });
    expect(scrubber.getAttribute('aria-valuenow')).toBe('50');
  });

  it('exposes a time + retention readout in the slider value text', () => {
    render(<RetentionPlayer {...baseProps({ videoSrc: 'blob:vid' })} />);
    const scrubber = screen.getByTestId('retention-scrubber');
    // at 0s the curve value is 1.0 → 100% retention
    expect(scrubber.getAttribute('aria-valuetext')).toContain('100% retention');
    fireEvent.keyDown(scrubber, { key: 'End' }); // 10s → curve value 0 → 0%
    expect(scrubber.getAttribute('aria-valuetext')).toContain('0% retention');
  });
});
