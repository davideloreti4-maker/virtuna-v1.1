/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('react-konva', () => ({
  Stage: ({ children, ...rest }: any) => <div data-testid="stage" {...rest}>{children}</div>,
  Layer: ({ children }: any) => <div>{children}</div>,
  Group: ({ children, ...rest }: any) => <div data-testid={`group-${rest.x}-${rest.y}`}>{children}</div>,
  Rect: (props: any) => <div data-testid="rect" data-stroke={props.stroke} />,
  Text: () => null,
  Line: () => null,
}));

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

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
  useParams: () => ({}),
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {} }),
}));

// EngineGroup (mounted inside Board for the engine frame) calls useAnalysisStream
// which needs a QueryClientProvider. Mock the hook to avoid provider setup.
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
import { useBoardStore } from '@/stores/board-store';
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

describe('GroupFrame integration', () => {
  beforeEach(() => {
    useBoardStore.setState({ boardState: 'idle' });
  });

  it('renders 7 frames with role=region in idle state', async () => {
    renderBoard();
    // Dynamic import resolves async — wait for re-render
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    const regions = screen.getAllByRole('region');
    // 7 group frames (insight-hero added in Plan 05-03); region count = 7
    expect(regions.length).toBe(7);
  });

  it('renders real node bodies for verdict, actions, content-analysis frames in idle (plan 05-09 wiring)', async () => {
    renderBoard();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    // Plan 05-09 wired VerdictNode, ActionsNode, ContentAnalysisFrame into Board.
    // These replace empty-state copy for their frames; hasRealChildren → true → empty state suppressed.
    // Verify each node body renders its root testid.
    expect(screen.getByTestId('verdict-node')).toBeInTheDocument();
    expect(screen.getByTestId('actions-node')).toBeInTheDocument();
    expect(screen.getByTestId('content-analysis-frame')).toBeInTheDocument();
  });

  it('renders anti-virality stroke on Verdict + Audience rects when boardState=anti-virality', async () => {
    useBoardStore.setState({ boardState: 'anti-virality' });
    const { container } = renderBoard();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    const rects = container.querySelectorAll('[data-testid="rect"]');
    const orangeStrokes = Array.from(rects).filter((r) =>
      (r.getAttribute('data-stroke') ?? '').includes('255,148'),
    );
    // Verdict + Audience + Actions = 3 rects with anti-virality stroke
    // (Actions wired in plan 05-09; AFFECTED_FRAMES includes verdict, audience, actions)
    expect(orangeStrokes.length).toBe(3);
  });

  it('toggles aria-expanded on chevron click', async () => {
    renderBoard();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    const expandBtn = screen.getByLabelText('Collapse Audience');
    expect(expandBtn).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(expandBtn);
    expect(screen.getByLabelText('Expand Audience')).toHaveAttribute('aria-expanded', 'false');
  });
});
