/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

/**
 * Timeout raised for MODULE WARM-UP, not for slow assertions (2026-07-14).
 *
 * This file intermittently timed out under full-suite parallel load. It is not a slow component
 * and not a slow test — a --reporter=verbose run shows the cost is paid entirely by whichever
 * test happens to run FIRST:
 *
 *     first test   1437 ms      <- imports + first mount of Sidebar's module graph
 *     other seven  7–27 ms each <- the component itself renders fine
 *
 * Sidebar pulls a barrel import of @phosphor-icons/react plus the supabase client and two
 * stores; evaluating that graph once costs well over a second, and on a contended CPU it can
 * cross the 5s default before the first assertion ever runs. The default is a per-test budget,
 * so a one-time startup cost lands entirely on test #1 and looks like a failure of whatever
 * that test happens to be asserting.
 *
 * Raised only on THIS file, and only enough to absorb the warm-up — deliberately not a global
 * bump, which would mask a genuine render regression here or anywhere else. If the seven fast
 * tests ever start costing seconds, that IS a real regression and this timeout will not hide it.
 */
vi.setConfig({ testTimeout: 20_000 });

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
  usePathname: () => '/home',
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

// Desktop + expanded so the full thread list renders (not the icon rail).
vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => true,
}));

interface MockThread {
  id: string;
  title: string | null;
  updated_at: string;
  created_at: string;
}

function mockThreads(threads: MockThread[]) {
  vi.doMock('@/hooks/queries', () => ({
    useThreadList: () => ({ data: threads, isLoading: false }),
    useCreateThread: () => ({ mutateAsync: vi.fn().mockResolvedValue('new-id') }),
    useActivateThread: () => ({ mutateAsync: vi.fn().mockResolvedValue('id') }),
    useArchiveThread: () => ({ mutateAsync: vi.fn().mockResolvedValue('id') }),
  }));
}

describe('Sidebar chat thread list', () => {
  it('shows the thread title when present', async () => {
    vi.resetModules();
    mockThreads([
      { id: 'abc', title: 'Hook ideas for launch', updated_at: new Date().toISOString(), created_at: new Date().toISOString() },
    ]);
    const { Sidebar: Fresh } = await import('../Sidebar');
    render(<Fresh />);
    const labels = screen.getAllByTestId('sidebar-thread-label');
    expect(labels[0]?.textContent).toContain('Hook ideas for launch');
  });

  it('falls back to "New chat · ..." when title is null', async () => {
    vi.resetModules();
    mockThreads([
      { id: 'xyz', title: null, updated_at: new Date().toISOString(), created_at: new Date().toISOString() },
    ]);
    const { Sidebar: Fresh } = await import('../Sidebar');
    render(<Fresh />);
    const labels = screen.getAllByTestId('sidebar-thread-label');
    expect(labels[0]?.textContent).toMatch(/^New chat\s·/);
  });

  it('drops the dangling separator when updated_at is malformed', async () => {
    vi.resetModules();
    mockThreads([
      { id: 'no-date', title: null, updated_at: '', created_at: '' },
    ]);
    const { Sidebar: Fresh } = await import('../Sidebar');
    render(<Fresh />);
    const labels = screen.getAllByTestId('sidebar-thread-label');
    const text = (labels[0]?.textContent ?? '').trim();
    expect(text).toBe('New chat');
    expect(text).not.toContain('·');
  });
});

describe('Sidebar composition — Threads label + no dead affordances', () => {
  it('labels the history section "Threads"', async () => {
    vi.resetModules();
    mockThreads([
      { id: 'abc', title: 'A chat', updated_at: new Date().toISOString(), created_at: new Date().toISOString() },
    ]);
    const { Sidebar: Fresh } = await import('../Sidebar');
    render(<Fresh />);
    expect(screen.getByText('Threads')).toBeInTheDocument();
    expect(screen.queryByText('Simulations')).toBeNull();
    expect(screen.queryByText('Recent')).toBeNull();
  });

  it('renders no Pinned / Projects / Boards dead affordances', async () => {
    vi.resetModules();
    mockThreads([]);
    const { Sidebar: Fresh } = await import('../Sidebar');
    render(<Fresh />);
    expect(screen.queryByText('Pinned')).toBeNull();
    expect(screen.queryByText('Projects')).toBeNull();
    expect(screen.queryByText('Boards')).toBeNull();
  });

  it('empty state reads "No threads yet."', async () => {
    vi.resetModules();
    mockThreads([]);
    const { Sidebar: Fresh } = await import('../Sidebar');
    render(<Fresh />);
    expect(screen.getByText(/no threads yet/i)).toBeInTheDocument();
  });
});

describe('Sidebar thread delete — two-step confirm', () => {
  async function renderWithArchive(archiveMock: ReturnType<typeof vi.fn>) {
    vi.resetModules();
    vi.doMock('@/hooks/queries', () => ({
      useThreadList: () => ({
        data: [
          { id: 'abc', title: 'Doomed thread', updated_at: new Date().toISOString(), created_at: new Date().toISOString() },
        ],
        isLoading: false,
      }),
      useCreateThread: () => ({ mutateAsync: vi.fn() }),
      useActivateThread: () => ({ mutateAsync: vi.fn() }),
      useArchiveThread: () => ({ mutateAsync: archiveMock }),
    }));
    const { Sidebar: Fresh } = await import('../Sidebar');
    render(<Fresh />);
  }

  it('does NOT archive on the first (arming) click', async () => {
    const archiveMock = vi.fn().mockResolvedValue('abc');
    await renderWithArchive(archiveMock);

    fireEvent.click(screen.getByRole('button', { name: /delete thread: doomed thread/i }));

    // The trash icon armed the confirm; nothing deleted yet.
    expect(archiveMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /cancel delete/i })).toBeInTheDocument();
  });

  it('archives only after the confirm click', async () => {
    const archiveMock = vi.fn().mockResolvedValue('abc');
    await renderWithArchive(archiveMock);

    fireEvent.click(screen.getByRole('button', { name: /delete thread: doomed thread/i }));
    fireEvent.click(screen.getByRole('button', { name: /^delete doomed thread$/i }));

    expect(archiveMock).toHaveBeenCalledWith('abc');
  });
});
