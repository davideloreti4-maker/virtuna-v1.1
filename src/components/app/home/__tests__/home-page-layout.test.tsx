/** @vitest-environment happy-dom */
/**
 * HomePageLayout — empty-state welcome hero (Claude-style start screen).
 *
 * The serif greeting is visible only before conversation content exists.
 * Once blocks stream in or a turn is submitted, the greeting is removed entirely
 * (not receded to a top banner).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { renderWithClient } from '@/test/render-with-client';

vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: () => ({
    start: vi.fn(),
    analysisId: null,
    result: null,
    stages: [],
    partial: { personas: [] },
    panelReady: {},
    phase: 'idle',
    error: null,
    reconnect: vi.fn(),
    filmstrips: {},
    abort: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock('@/hooks/queries/use-profile', () => ({
  useProfile: () => ({ data: { name: 'Davide' }, isLoading: false }),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({}),
  usePathname: () => '/home',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => true,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
    },
    storage: { from: () => ({ upload: vi.fn() }) },
  }),
}));

let ideasMockBlocks: unknown[] = [];
vi.mock('@/hooks/queries/use-ideas-stream', () => ({
  useIdeasStream: () => ({
    start: vi.fn(),
    isStreaming: false,
    statusMessage: null,
    error: null,
    toBlocks: () => ideasMockBlocks,
  }),
}));

vi.mock('@/hooks/queries/use-hooks-stream', () => ({
  useHooksStream: () => ({
    start: vi.fn(),
    isStreaming: false,
    statusMessage: null,
    error: null,
    toBlocks: () => [],
  }),
}));

import { HomePageLayout } from '../home-page-layout';

beforeEach(() => {
  ideasMockBlocks = [];
  cleanup();
});

describe('HomePageLayout — welcome hero visibility', () => {
  it('shows the serif greeting on an empty home', () => {
    renderWithClient(<HomePageLayout />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    // The headline is the short time-of-day greeting (2026-07-20); the product
    // voice lives in the hero's promise line beneath it.
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(
      /good (morning|afternoon|evening)|welcome back/i,
    );
    expect(screen.getByText(/simulate your audience/i)).toBeInTheDocument();
  });

  it('removes the greeting entirely when conversation content exists', () => {
    ideasMockBlocks = [{ type: 'idea-card', props: { headline: 'Test idea' } }];
    renderWithClient(<HomePageLayout />);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });
});
