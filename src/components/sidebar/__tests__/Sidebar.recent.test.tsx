/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: vi.fn(),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  }),
}));

vi.mock('@/hooks/queries/use-profile', () => ({
  useProfile: () => ({ data: null, isLoading: false }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/analyze',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/stores/sidebar-store', () => ({
  useSidebarStore: () => ({
    isOpen: true,
    close: vi.fn(),
    isCollapsed: false,
    toggleCollapsed: vi.fn(),
  }),
}));

// Desktop + expanded so the full Simulations list renders (not the icon rail).
vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => true,
}));

// Sidebar imported dynamically per test to pick up vi.doMock overrides
void 0; // placeholder — see dynamic imports below

function mockHistory(boards: Array<{ id: string; content_text?: string | null; overall_score?: number | null; created_at?: string }>) {
  vi.doMock('@/hooks/queries', () => ({
    useAnalysisHistory: () => ({ data: boards, isLoading: false }),
  }));
}

describe('Sidebar recent boards label', () => {
  it('shows content_text snippet when present', async () => {
    vi.resetModules();
    mockHistory([
      { id: 'abc', content_text: 'My morning routine that helps you grow fast', overall_score: 75 },
    ]);
    const { Sidebar: Fresh } = await import('../Sidebar');
    render(<Fresh />);
    const labels = screen.getAllByTestId('sidebar-board-label');
    expect(labels[0]?.textContent).toContain('My morning routine');
  });

  it('truncates content_text to 38 chars', async () => {
    vi.resetModules();
    mockHistory([
      { id: 'abc', content_text: 'A'.repeat(100), overall_score: 60 },
    ]);
    const { Sidebar: Fresh } = await import('../Sidebar');
    render(<Fresh />);
    const labels = screen.getAllByTestId('sidebar-board-label');
    expect((labels[0]?.textContent ?? '').length).toBeLessThanOrEqual(38);
  });

  it('falls back to "Analysis · ..." when content_text is null', async () => {
    vi.resetModules();
    mockHistory([
      { id: 'xyz', content_text: null, overall_score: null, created_at: new Date().toISOString() },
    ]);
    const { Sidebar: Fresh } = await import('../Sidebar');
    render(<Fresh />);
    const labels = screen.getAllByTestId('sidebar-board-label');
    expect(labels[0]?.textContent).toMatch(/^Analysis\s·/);
  });

  it('shows score chip with rounded overall_score', async () => {
    vi.resetModules();
    mockHistory([
      { id: 'def', content_text: 'Test content', overall_score: 72.8 },
    ]);
    const { Sidebar: Fresh } = await import('../Sidebar');
    render(<Fresh />);
    const chips = screen.getAllByTestId('sidebar-score-chip');
    expect(chips[0]?.textContent?.trim()).toBe('73');
  });

  it('shows — in score chip when overall_score is null', async () => {
    vi.resetModules();
    mockHistory([
      { id: 'ghi', content_text: 'Some text', overall_score: null },
    ]);
    const { Sidebar: Fresh } = await import('../Sidebar');
    render(<Fresh />);
    const chips = screen.getAllByTestId('sidebar-score-chip');
    expect(chips[0]?.textContent?.trim()).toBe('—');
  });
});

describe('Sidebar composition — Simulations label + no dead affordances (D-11/D-13)', () => {
  it('labels the history section "Simulations" (not "Recent")', async () => {
    vi.resetModules();
    mockHistory([
      { id: 'abc', content_text: 'A simulated video', overall_score: 80 },
    ]);
    const { Sidebar: Fresh } = await import('../Sidebar');
    render(<Fresh />);
    expect(screen.getByText('Simulations')).toBeInTheDocument();
    expect(screen.queryByText('Recent')).toBeNull();
  });

  it('renders no Pinned / Projects / Boards dead affordances', async () => {
    vi.resetModules();
    mockHistory([]);
    const { Sidebar: Fresh } = await import('../Sidebar');
    render(<Fresh />);
    expect(screen.queryByText('Pinned')).toBeNull();
    expect(screen.queryByText('Projects')).toBeNull();
    expect(screen.queryByText('Boards')).toBeNull();
  });

  it('empty state reads "No simulations yet."', async () => {
    vi.resetModules();
    mockHistory([]);
    const { Sidebar: Fresh } = await import('../Sidebar');
    render(<Fresh />);
    expect(screen.getByText(/no simulations yet/i)).toBeInTheDocument();
  });
});
