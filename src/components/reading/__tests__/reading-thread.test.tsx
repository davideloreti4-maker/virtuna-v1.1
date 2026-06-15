/** @vitest-environment happy-dom */
/**
 * Phase 5 — ReadingThread gating. The follow-up tail + pinned composer appear ONLY
 * once the Simulation is complete; before that (in-flight / no-id) just the Reading
 * renders. Children are stubbed so the test isolates ReadingThread's gating logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { PredictionResult } from '@/lib/engine/types';

let mockState: { id: string | null; data: Partial<PredictionResult> | null };
vi.mock('@/hooks/queries/use-permalink-analysis', () => ({
  usePermalinkAnalysis: () => mockState,
}));

vi.mock('../reading', () => ({ Reading: () => <div data-testid="reading-stub" /> }));
vi.mock('../follow-up-thread', () => ({
  FollowUpThread: () => <div data-testid="thread-stub" />,
}));
vi.mock('@/components/app/home/composer', () => ({
  Composer: () => <div data-testid="composer-stub" />,
}));
// FollowUpProvider calls useExpertChat — stub it to avoid the fetch-on-mount.
vi.mock('@/hooks/queries/use-expert-chat', () => ({
  useExpertChat: () => ({
    messages: [],
    streamingText: '',
    isStreaming: false,
    error: null,
    send: vi.fn(),
    stop: vi.fn(),
    clearMessages: vi.fn(),
    loadHistory: vi.fn(),
  }),
}));

import { ReadingThread } from '../reading-thread';

beforeEach(() => {
  cleanup();
});

describe('Phase 5 — ReadingThread gating', () => {
  it('a completed Simulation mounts the follow-up tail + pinned composer', () => {
    mockState = { id: 'sim-1', data: { overall_score: 64 } as Partial<PredictionResult> };
    render(<ReadingThread />);
    expect(screen.getByTestId('reading-stub')).toBeInTheDocument();
    expect(screen.getByTestId('thread-stub')).toBeInTheDocument();
    expect(screen.getByTestId('follow-up-composer')).toBeInTheDocument();
  });

  it('an in-flight Simulation shows only the Reading (no follow-up yet)', () => {
    mockState = {
      id: 'sim-1',
      data: { overall_score: null, engine_version: 'pending' } as Partial<PredictionResult>,
    };
    render(<ReadingThread />);
    expect(screen.getByTestId('reading-stub')).toBeInTheDocument();
    expect(screen.queryByTestId('thread-stub')).not.toBeInTheDocument();
    expect(screen.queryByTestId('follow-up-composer')).not.toBeInTheDocument();
  });

  it('a genuinely failed read does not mount the follow-up surface', () => {
    mockState = {
      id: 'sim-1',
      data: { analysis_unavailable: true } as Partial<PredictionResult>,
    };
    render(<ReadingThread />);
    expect(screen.queryByTestId('follow-up-composer')).not.toBeInTheDocument();
  });

  it('the no-id /analyze base mounts only the inert Reading (no composer)', () => {
    mockState = { id: null, data: null };
    render(<ReadingThread />);
    expect(screen.getByTestId('reading-stub')).toBeInTheDocument();
    expect(screen.queryByTestId('follow-up-composer')).not.toBeInTheDocument();
  });
});
