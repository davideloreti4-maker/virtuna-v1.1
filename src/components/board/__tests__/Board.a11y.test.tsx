/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('react-konva', () => ({
  Stage: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
  Layer: ({ children }: any) => <div>{children}</div>,
  Rect: () => null,
  Group: ({ children }: any) => <div>{children}</div>,
  Text: () => null,
  Line: () => null,
}));

vi.mock('next/dynamic', () => ({
  default: (loader: any) => {
    const C = (props: any) => {
      const [M, setM] = (require('react').useState as <T>(s:T)=>[T,(v:T)=>void])<any>(null);
      require('react').useEffect(() => { loader().then((m: any) => setM(() => (m.default ?? m))); }, []);
      return M ? <M {...props} /> : null;
    };
    return C;
  },
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/analyze',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/hooks/queries/use-analysis-stream', () => ({
  useAnalysisStream: () => ({
    stages: [],
    phase: 'idle',
    partial: { personas: [] },
    panelReady: {},
    result: null,
    error: null,
    analysisId: null,
    start: vi.fn().mockResolvedValue(undefined),
    reconnect: vi.fn(),
  }),
}));

import { Board } from '../Board';
import { ToastProvider } from '@/components/ui/toast';

function renderBoard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider><Board /></ToastProvider>
    </QueryClientProvider>,
  );
}

describe('Board a11y', () => {
  it('has no axe violations', async () => {
    const { container } = renderBoard();
    // Wait for dynamic Stage mock to mount
    await new Promise((r) => setTimeout(r, 0));
    const results = await axe(container);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(results).toHaveNoViolations();
  });
});
