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
      const [Mod, setMod] = require('react').useState<any>(null);
      require('react').useEffect(() => { loader().then((m: any) => setMod(() => (m.default ?? m))); }, []);
      return Mod ? <Mod {...props} /> : null;
    };
    return Comp;
  },
}));

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('') }));

import { useBoardStore } from '@/stores/board-store';
import { Board } from '../Board';
import { ToastProvider } from '@/components/ui/toast';

function renderBoard() {
  return render(<ToastProvider><Board /></ToastProvider>);
}

describe('GroupFrame integration', () => {
  beforeEach(() => {
    useBoardStore.setState({ boardState: 'idle' });
  });

  it('renders 6 frames with role=region in idle state', async () => {
    const { container } = renderBoard();
    // Dynamic import resolves async — wait for re-render
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    const regions = screen.getAllByRole('region');
    // 6 group frames + the wrapper role=application div = separate; region count = 6
    expect(regions.length).toBe(6);
  });

  it('shows empty-state copy on non-Input/Engine frames in idle', async () => {
    renderBoard();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.getByText('Audience data will appear here')).toBeInTheDocument();
    expect(screen.getByText('Verdict will appear here')).toBeInTheDocument();
    expect(screen.getByText('Actions will appear here')).toBeInTheDocument();
    expect(screen.getByText('Content analysis will appear here')).toBeInTheDocument();
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
    // Verdict + Audience = 2 rects with anti-virality stroke
    expect(orangeStrokes.length).toBe(2);
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
