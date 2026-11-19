/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useBoardStore } from '@/stores/board-store';
import { useSidebarStore } from '@/stores/sidebar-store';

// Module warm-up (icons, stores, Radix) lands on the first test; see Sidebar.recent.test.tsx.
vi.setConfig({ testTimeout: 20_000 });

// Mocked: the router, the network, auth. Real: both stores, the cookie, the components.
const router = { push: vi.fn(), replace: vi.fn() };
let pathname = '/home';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => router,
}));

interface Row { id: string; title: string | null; updated_at: string; created_at: string; pinned_at: string | null }
const row = (id: string, title: string | null, pinned = false): Row => ({
  id,
  title,
  updated_at: '2026-11-18T10:00:00Z',
  created_at: '2026-11-18T09:00:00Z',
  pinned_at: pinned ? '2026-11-18T09:30:00Z' : null,
});

let threads: Row[] = [];
const rename = vi.fn();
const pin = vi.fn();
const archive = vi.fn();
vi.mock('@/hooks/queries', () => ({
  useThreadList: () => ({ data: threads, isLoading: false }),
  useArchiveThread: () => ({ mutateAsync: archive }),
  useRenameThread: () => ({ mutate: rename }),
  usePinThread: () => ({ mutate: pin }),
}));

vi.mock('@/hooks/queries/use-profile', () => ({
  useProfile: () => ({ data: { name: 'Nia Test', email: 'nia@example.com', avatar: null } }),
}));

let usage: { remaining: number | null } | null = null;
vi.mock('@/hooks/use-subscription', () => ({
  useSubscription: () => ({ usage }),
}));

const signOut = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut } }),
}));

import { SideNav } from '../side-nav';
import { useThreadActions } from '../use-thread-actions';

function Harness() {
  const actions = useThreadActions();
  return <SideNav actions={actions} />;
}

const renderNav = () =>
  render(
    <ToastProvider>
      <TooltipProvider>
        <Harness />
      </TooltipProvider>
    </ToastProvider>,
  );

const nav = () => screen.getByRole('navigation', { name: 'App navigation' });
const nameOf = (el: Element) => el.getAttribute('aria-label') ?? el.textContent ?? '';

beforeEach(() => {
  pathname = '/home';
  usage = null;
  threads = [
    row('t1', null),
    row('t2', 'Three hooks for the gym video'),
    row('t3', 'Why did Tuesday flop'),
    row('t4', 'Script: morning routine', true),
    row('t5', 'Remix the 19x one'),
    row('t6', 'Ask the audience about pricing'),
    row('t7', 'Hooks for the protein video'),
    row('t8', null),
  ];
  router.push.mockReset();
  rename.mockReset();
  pin.mockReset();
  archive.mockReset();
  signOut.mockReset();
  localStorage.clear();
  useSidebarStore.setState({ isCollapsed: false });
  useBoardStore.setState({ activeThreadId: null });
});

describe('SideNav — places', () => {
  it('lists the four places in the desktop order, after the brand: Library sits next to the threads', () => {
    renderNav();
    expect(within(nav()).getAllByRole('link').map(nameOf)).toEqual([
      'Maven home', 'Home', 'Discover', 'Audience', 'Library',
    ]);
  });

  it('marks the place the creator is in, including behind a redirect door', () => {
    pathname = '/saved';
    renderNav();
    const current = within(nav()).getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map(nameOf)).toEqual(['Library']);
  });
});

describe('SideNav — recent threads', () => {
  const recent = () => within(screen.getByRole('list', { name: 'Recent' })).getAllByRole('listitem');

  it('shows six at most: the newest plus titled ones; older untitled ones are noise', () => {
    renderNav();
    expect(recent()).toHaveLength(6);
    expect(recent().map((li) => within(li).getAllByRole('button')[0]?.textContent)).toEqual([
      'New chat',
      'Three hooks for the gym video',
      'Why did Tuesday flop',
      'Script: morning routine',
      'Remix the 19x one',
      'Ask the audience about pricing',
    ]);
  });

  it('opens a thread: points the app at it and goes Home', () => {
    pathname = '/library';
    renderNav();
    fireEvent.click(screen.getByRole('button', { name: 'Why did Tuesday flop' }));
    expect(useBoardStore.getState().activeThreadId).toBe('t3');
    expect(router.push).toHaveBeenCalledWith('/home');
  });

  it('marks the open thread only while it is on screen (on Home)', () => {
    useBoardStore.setState({ activeThreadId: 't3' });
    const { unmount } = renderNav();
    expect(screen.getByRole('button', { name: 'Why did Tuesday flop' })).toHaveAttribute('aria-current', 'page');
    unmount();

    pathname = '/library';
    renderNav();
    expect(screen.getByRole('button', { name: 'Why did Tuesday flop' })).not.toHaveAttribute('aria-current');
  });

  it('pins, renames and deletes from the row, and delete asks twice', () => {
    archive.mockResolvedValue(undefined);
    renderNav();

    fireEvent.click(screen.getByRole('button', { name: 'Pin Why did Tuesday flop' }));
    expect(pin).toHaveBeenCalledWith({ id: 't3', pinned: true });

    fireEvent.click(screen.getByRole('button', { name: 'Rename Why did Tuesday flop' }));
    const field = screen.getByRole('textbox', { name: 'Rename Why did Tuesday flop' });
    fireEvent.change(field, { target: { value: 'Tuesday post-mortem' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(rename).toHaveBeenCalledWith({ id: 't3', title: 'Tuesday post-mortem' });

    fireEvent.click(screen.getByRole('button', { name: 'Delete thread: Remix the 19x one' }));
    expect(archive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Remix the 19x one' }));
    expect(archive).toHaveBeenCalledWith('t5');
  });
});

describe('SideNav — new chat', () => {
  it('leaves the open thread for a blank one', () => {
    useBoardStore.setState({ activeThreadId: 't3' });
    renderNav();
    // Two buttons are named "New chat": the action, and the untitled newest thread's row.
    // The action comes first in the sidebar.
    fireEvent.click(within(nav()).getAllByRole('button', { name: 'New chat' })[0]!);
    expect(useBoardStore.getState().activeThreadId).toBeNull();
    expect(router.push).toHaveBeenCalledWith('/home');
  });
});

describe('SideNav — the rail', () => {
  it('collapses to icons, keeps every place reachable by name, and drops the thread list', () => {
    renderNav();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    expect(useSidebarStore.getState().isCollapsed).toBe(true);
    for (const name of ['Home', 'Discover', 'Library', 'Audience']) {
      expect(within(nav()).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'New chat' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Recent' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(useSidebarStore.getState().isCollapsed).toBe(false);
  });
});

describe('SideNav — the account', () => {
  it('shows the name, and the balance only when the account has one', () => {
    usage = { remaining: 3 };
    const { unmount } = renderNav();
    expect(screen.getByText('Nia Test')).toBeInTheDocument();
    expect(screen.getByText('3 left')).toBeInTheDocument();
    unmount();

    usage = { remaining: null }; // unlimited
    renderNav();
    expect(screen.queryByText(/left$/)).toBeNull();
  });

  it('keeps Settings and Log out one menu away', () => {
    renderNav();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Account menu' }), { key: 'Enter' });

    fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
