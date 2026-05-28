/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBoardStore } from '@/stores/board-store';
import { InputDrawer } from '../InputDrawer';

// Mock Supabase client used by analysis history
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        is: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    storage: { from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }) },
  }),
}));

// Mutable stream state — allows per-test analysisId override
const mockStreamState = {
  start: vi.fn().mockResolvedValue(undefined),
  phase: 'idle' as string,
  analysisId: null as string | null,
};

vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: () => mockStreamState,
}));

// Fix 2 — mock useRouter to capture push calls
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(''),
}));

// Mock history to return empty list for most tests
vi.mock('@/hooks/queries', () => ({
  useAnalysisHistory: () => ({ data: [], isLoading: false }),
}));

function withProvider(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

describe('InputDrawer', () => {
  beforeEach(() => {
    useBoardStore.setState({
      boardState: 'idle',
      preDrawerState: null,
      inputDrawerOpen: false,
    });
    mockStreamState.analysisId = null;
    mockStreamState.phase = 'idle';
    mockPush.mockClear();
  });

  it('hidden when board state is not edit-input', () => {
    render(withProvider(<InputDrawer />));
    expect(screen.queryByText('Edit input')).not.toBeInTheDocument();
  });

  it('open when edit-input — shows Recent header', () => {
    useBoardStore.setState({
      boardState: 'edit-input',
      preDrawerState: 'idle',
      inputDrawerOpen: true,
    });
    render(withProvider(<InputDrawer />));
    expect(screen.getByText('Edit input')).toBeInTheDocument();
    expect(screen.getByText('Recent inputs')).toBeInTheDocument();
  });

  it('shows empty state when no recent inputs', () => {
    useBoardStore.setState({
      boardState: 'edit-input',
      preDrawerState: 'idle',
      inputDrawerOpen: true,
    });
    render(withProvider(<InputDrawer />));
    expect(screen.getByText('No recent inputs yet')).toBeInTheDocument();
  });

  // Fix 2 (05-ux): router.push called when analysisId transitions null → string
  it('Fix 2: calls router.push(/analyze/[id]) when analysisId transitions null to a string', async () => {
    const { rerender } = render(withProvider(<InputDrawer />));

    // Initially no push — analysisId is null
    expect(mockPush).not.toHaveBeenCalled();

    // Simulate stream emitting analysisId (POST resolves, event:started received)
    await act(async () => {
      mockStreamState.analysisId = 'abc123';
      rerender(withProvider(<InputDrawer />));
    });

    expect(mockPush).toHaveBeenCalledWith('/analyze/abc123');
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('Fix 2: does NOT call router.push again if analysisId stays the same', async () => {
    mockStreamState.analysisId = 'abc123';
    const { rerender } = render(withProvider(<InputDrawer />));

    // analysisId was already set before first render — ref starts as 'abc123', not null
    // No null→string transition occurred
    await act(async () => {
      rerender(withProvider(<InputDrawer />));
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});
