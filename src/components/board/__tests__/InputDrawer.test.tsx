/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  }),
}));

// Mock analysis stream hook
vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: () => ({ start: vi.fn().mockResolvedValue(undefined), phase: 'idle' }),
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
});
