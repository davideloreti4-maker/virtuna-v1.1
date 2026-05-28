/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

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

// Mock useSearchParams + useParams (Board permalink replay reads route id).
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
  useParams: () => ({}),
  useRouter: () => ({ push: vi.fn() }),
}));

// EngineGroup (mounted inside Board) calls useAnalysisStream which needs QueryClientProvider.
// Mutable stream state — allows per-test phase override for Fix 3 toast tests.
const mockBoardStream = {
  stages: [] as any[],
  phase: 'idle' as string,
  partial: { personas: [] as any[] },
  result: null as any,
  panelReady: {} as any,
  error: null as string | null,
  analysisId: null as string | null,
  start: vi.fn().mockResolvedValue(undefined),
  reconnect: vi.fn(),
  abort: vi.fn(),
  filmstrips: {} as any,
};

vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: () => mockBoardStream,
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Board } from '../Board';
import { ToastProvider } from '@/components/ui/toast';
import { useBoardStore } from '@/stores/board-store';

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
  beforeEach(() => {
    mockBoardStream.phase = 'idle';
    mockBoardStream.analysisId = null;
    mockBoardStream.result = null;
    mockBoardStream.error = null;
    mockBoardStream.abort = vi.fn();
    // Reset board store to idle so each test starts clean
    useBoardStore.setState({ boardState: 'idle' });
  });

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

  // Fix 3 (05-ux): persistent streaming toast shown when phase transitions to 'analyzing'
  it('Fix 3: shows "Analyzing your video" toast when stream phase is analyzing', async () => {
    mockBoardStream.phase = 'analyzing';
    renderBoard();

    // Toast is rendered via portal into document.body — use waitFor pattern
    await act(async () => {
      // Phase was set before render — the useEffect fires synchronously in test env
    });

    expect(screen.getByText('Analyzing your video')).toBeInTheDocument();
    expect(screen.getByText(/90 seconds/)).toBeInTheDocument();
  });

  it('Fix 3: Cancel button in toast calls stream.abort()', async () => {
    mockBoardStream.phase = 'analyzing';
    mockBoardStream.abort = vi.fn();
    renderBoard();

    await act(async () => {});

    // Toast renders via portal — find all buttons and look for the Cancel action button
    const allButtons = screen.getAllByRole('button');
    const cancelBtn = allButtons.find((b) => b.textContent?.trim() === 'Cancel');
    expect(cancelBtn).toBeDefined();
    cancelBtn!.click();
    expect(mockBoardStream.abort).toHaveBeenCalled();
  });
});
