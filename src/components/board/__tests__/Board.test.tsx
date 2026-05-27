/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock react-konva — Stage/Layer/Rect rendered as divs (RESEARCH §Validation Wave 0)
vi.mock('react-konva', () => ({
  Stage: ({ children, ...rest }: any) => <div data-testid="stage" {...rest}>{children}</div>,
  Layer: ({ children }: any) => <div data-testid="layer">{children}</div>,
  Rect: () => null,
  Group: ({ children }: any) => <div>{children}</div>,
  Text: () => null,
  Line: () => null,
}));

// Mock next/dynamic to render the dynamic target synchronously
vi.mock('next/dynamic', () => ({
  default: (loader: any) => {
    const Comp = (props: any) => {
      const [Mod, setMod] = (require('react').useState as <T>(s:T)=>[T,(v:T)=>void])<any>(null);
      require('react').useEffect(() => { loader().then((m: any) => setMod(() => (m.default ?? m))); }, []);
      return Mod ? <Mod {...props} /> : null;
    };
    return Comp;
  },
}));

// Mock useSearchParams
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));

// EngineGroup (mounted inside Board) calls useAnalysisStream which needs QueryClientProvider.
// Mock the hook to avoid provider setup.
vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: () => ({
    stages: [],
    phase: 'idle',
    partial: { personas: [] },
    result: null,
    panelReady: {},
    error: null,
    analysisId: null,
    start: () => Promise.resolve(),
    reconnect: () => {},
  }),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Board } from '../Board';
import { ToastProvider } from '@/components/ui/toast';

vi.mock('@/hooks/queries/use-analysis-history', () => ({
  useAnalysisHistory: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/hooks/queries/use-profile', () => ({
  useProfile: () => ({ data: null }),
}));

function renderBoard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider><Board /></ToastProvider>
    </QueryClientProvider>
  );
}

describe('Board', () => {
  it('Test 1: renders without crashing', () => {
    const { container } = renderBoard();
    expect(container.firstChild).toBeTruthy();
  });

  it('Test 2 + 4: has role=application with aria-label "Analysis board"', () => {
    renderBoard();
    const el = screen.getByRole('application');
    expect(el).toHaveAttribute('aria-label', 'Analysis board');
  });

  it('Test 3: renders 5 camera preset buttons with correct aria-labels', () => {
    renderBoard();
    ['Overview view', 'Verdict view', 'Audience view', 'Content Analysis view', 'Reset view']
      .forEach((label) => expect(screen.getByRole('button', { name: label })).toBeInTheDocument());
  });
});
