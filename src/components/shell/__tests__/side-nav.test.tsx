/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useBoardStore } from '@/stores/board-store';
import { useShellStore } from '@/stores/shell-store';
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

let profile = { name: 'Nia Test', email: 'nia@example.com', avatar: null as string | null };
vi.mock('@/hooks/queries/use-profile', () => ({
  useProfile: () => ({ data: profile }),
}));

let usage: { remaining: number | null; limit: number | null } | null = null;
let tier = 'starter';
let isTrial = false;
vi.mock('@/hooks/use-subscription', () => ({
  useSubscription: () => ({ usage, tier, isTrial }),
}));

const signOut = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut } }),
}));

import { SIDE_NAV_CHOICE_KEY } from '../nav-config';
import { SideNav } from '../side-nav';
import { useShellShortcuts } from '../use-shell-shortcuts';
import { useThreadActions } from '../use-thread-actions';

function Harness() {
  const actions = useThreadActions();
  return <SideNav actions={actions} />;
}

/** The sidebar with the chrome shortcuts, as the frame mounts them. */
function WithShortcuts() {
  const actions = useThreadActions();
  useShellShortcuts(actions);
  return <SideNav actions={actions} />;
}

const renderNav = (ui: React.ReactElement = <Harness />) =>
  render(
    <ToastProvider>
      <TooltipProvider>{ui}</TooltipProvider>
    </ToastProvider>,
  );

// The window width the auto-rail reads. happy-dom's default (1024) is below 1100, so every test
// sets one; the narrow-window tests set 1000.
const realWidth = window.innerWidth;
const setWidth = (value: number) =>
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value });
/** sidebar-store's own persist key (its saved collapse state). */
const sidebarKey = () => useSidebarStore.persist.getOptions().name!;

const nav = () => screen.getByRole('navigation', { name: 'App navigation' });
const nameOf = (el: Element) => el.getAttribute('aria-label') ?? el.textContent ?? '';

beforeEach(() => {
  setWidth(1440);
  pathname = '/home';
  usage = null;
  tier = 'starter';
  isTrial = false;
  profile = { name: 'Nia Test', email: 'nia@example.com', avatar: null };
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
  useSidebarStore.setState({ isCollapsed: false });
  useShellStore.setState({ autoRail: false, threadOpen: false });
  useBoardStore.setState({ activeThreadId: null });
  // Last: resetting sidebar-store above writes its persist key.
  localStorage.clear();
});

afterEach(() => {
  setWidth(realWidth);
});

describe('SideNav — places', () => {
  it('lists the four places in the desktop order, after the brand: Library sits next to the threads', () => {
    renderNav();
    expect(within(nav()).getAllByRole('link').map(nameOf)).toEqual([
      'Maven home', 'Home', 'Discover', 'Audience', 'Library',
    ]);
  });

  it('on Home with no thread open, Home is the current place', () => {
    renderNav();
    const current = within(nav()).getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map(nameOf)).toEqual(['Home']);
  });

  it('inside a thread the thread is the current thing, not Home: one highlight', () => {
    useBoardStore.setState({ activeThreadId: 't3' });
    useShellStore.setState({ threadOpen: true });
    renderNav();
    const marked = [...nav().querySelectorAll('[aria-current="page"]')];
    expect(marked.map(nameOf)).toEqual(['Why did Tuesday flop']);
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('inside a thread whose row is not on screen (the rail, or a thread that is not recent), Home keeps the mark', () => {
    useBoardStore.setState({ activeThreadId: 't3' });
    useShellStore.setState({ threadOpen: true });
    useSidebarStore.setState({ isCollapsed: true });
    const { unmount } = renderNav();
    expect([...nav().querySelectorAll('[aria-current="page"]')].map(nameOf)).toEqual(['Home']);
    unmount();

    useSidebarStore.setState({ isCollapsed: false });
    useBoardStore.setState({ activeThreadId: 'not-in-the-list' });
    renderNav();
    expect([...nav().querySelectorAll('[aria-current="page"]')].map(nameOf)).toEqual(['Home']);
  });

  it('a thread left open while on another place does not unmark that place', () => {
    useShellStore.setState({ threadOpen: true });
    pathname = '/library';
    renderNav();
    const current = within(nav()).getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map(nameOf)).toEqual(['Library']);
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
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Rename Why did Tuesday flop' }), { key: 'Enter' });
    expect(rename).not.toHaveBeenCalled(); // nothing changed, nothing sent

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

describe('SideNav — keyboard focus survives the row changing', () => {
  it('arming delete lands on Cancel; cancelling returns to the delete button', () => {
    renderNav();
    fireEvent.click(screen.getByRole('button', { name: 'Delete thread: Remix the 19x one' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel delete' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cancel delete' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete thread: Remix the 19x one' }));
    expect(archive).not.toHaveBeenCalled();
  });

  it('leaving rename with Escape returns to the row and sends nothing', () => {
    renderNav();
    fireEvent.click(screen.getByRole('button', { name: 'Rename Why did Tuesday flop' }));
    const field = screen.getByRole('textbox', { name: 'Rename Why did Tuesday flop' });
    fireEvent.change(field, { target: { value: 'Something else' } });
    // Default-prevented (false), so Escape never reaches a surrounding dialog or menu.
    expect(fireEvent.keyDown(field, { key: 'Escape' })).toBe(false);

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Why did Tuesday flop' }));
    expect(rename).not.toHaveBeenCalled();
  });

  it('leaving rename with Enter returns to the row and sends the new name once', () => {
    renderNav();
    fireEvent.click(screen.getByRole('button', { name: 'Rename Why did Tuesday flop' }));
    const field = screen.getByRole('textbox', { name: 'Rename Why did Tuesday flop' });
    fireEvent.change(field, { target: { value: 'Tuesday post-mortem' } });
    // Default-prevented (false): focus moves to the open button during keydown, and a browser
    // would turn the rest of this Enter into a click on it (opening the thread).
    expect(fireEvent.keyDown(field, { key: 'Enter' })).toBe(false);

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Why did Tuesday flop' }));
    expect(router.push).not.toHaveBeenCalled();
    expect(rename).toHaveBeenCalledTimes(1);
    expect(rename).toHaveBeenCalledWith({ id: 't3', title: 'Tuesday post-mortem' });
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

describe('SideNav — a narrow window starts as the rail, and that is not a choice', () => {
  it('below 1100px with no choice made: the rail, and nothing is saved', () => {
    setWidth(1000);
    renderNav();

    expect(nav()).toHaveStyle({ width: '56px' });
    expect(within(nav()).getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Recent' })).toBeNull();
    expect(useSidebarStore.getState().isCollapsed).toBe(false);
    expect(localStorage.getItem(sidebarKey())).toBeNull();
    expect(localStorage.getItem(SIDE_NAV_CHOICE_KEY)).toBeNull();
  });

  it('below 1100px after the creator chose: left as it is (expanded)', () => {
    localStorage.setItem(SIDE_NAV_CHOICE_KEY, '1');
    setWidth(1000);
    renderNav();

    expect(nav()).toHaveStyle({ width: '248px' });
    expect(screen.getByRole('list', { name: 'Recent' })).toBeInTheDocument();
  });

  it('expanding the rail is a choice: it is recorded and a later visit keeps it', () => {
    setWidth(1000);
    const { unmount } = renderNav();
    fireEvent.click(within(nav()).getByRole('button', { name: 'Expand sidebar' }));

    expect(nav()).toHaveStyle({ width: '248px' });
    expect(localStorage.getItem(SIDE_NAV_CHOICE_KEY)).toBe('1');
    unmount();

    renderNav();
    expect(nav()).toHaveStyle({ width: '248px' });
    expect(within(nav()).getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
  });

  it('at 1100px and wider with no choice made: expanded, and a rail default left from a narrow window is cleared', () => {
    useShellStore.setState({ autoRail: true }); // as if an earlier mount was on a narrow window
    setWidth(1440);
    renderNav();

    expect(nav()).toHaveStyle({ width: '248px' });
    expect(useShellStore.getState().autoRail).toBe(false);
    expect(screen.getByRole('list', { name: 'Recent' })).toBeInTheDocument();
  });

  it('⌘\\ is a choice too: it toggles the sidebar and records it', () => {
    setWidth(1000);
    renderNav(<WithShortcuts />);
    expect(nav()).toHaveStyle({ width: '56px' });

    fireEvent.keyDown(window, { key: '\\', metaKey: true });
    expect(nav()).toHaveStyle({ width: '248px' });
    expect(localStorage.getItem(SIDE_NAV_CHOICE_KEY)).toBe('1');

    fireEvent.keyDown(window, { key: '\\', metaKey: true });
    expect(nav()).toHaveStyle({ width: '56px' });
    expect(useSidebarStore.getState().isCollapsed).toBe(true);
  });
});

describe('SideNav — the account', () => {
  it('shows the name, and the balance only when the account has one', () => {
    usage = { remaining: 3, limit: 500 };
    const { unmount } = renderNav();
    expect(screen.getByText('Nia Test')).toBeInTheDocument();
    // Final fix A4: the phone's words and the approved drawing's, not "3 left".
    expect(screen.getByText('3 credits')).toBeInTheDocument();
    unmount();

    usage = { remaining: null, limit: null }; // unlimited
    renderNav();
    expect(screen.queryByText(/credits?$/)).toBeNull();
  });

  it('one credit reads "1 credit"', () => {
    usage = { remaining: 1, limit: 500 };
    renderNav();
    expect(screen.getByText('1 credit')).toBeInTheDocument();
  });

  it('no plan (free, not in a trial): no tag, the number is not a balance there (A4)', () => {
    tier = 'free';
    usage = { remaining: 0, limit: 0 };
    renderNav();
    expect(screen.queryByText(/credits?$/)).toBeNull();
    expect(screen.queryByText(/left$/)).toBeNull();
  });

  it('a trial pool shows what is left of it', () => {
    tier = 'free';
    isTrial = true;
    usage = { remaining: 4, limit: 5 };
    renderNav();
    expect(screen.getByText('4 credits')).toBeInTheDocument();
  });

  it('names the account button after the account, and falls back to the email for a blank name', () => {
    const { unmount } = renderNav();
    expect(screen.getByRole('button', { name: /^Account/ })).toHaveAccessibleName('Account: Nia Test');
    unmount();

    profile = { name: '   ', email: 'nia@example.com', avatar: null };
    renderNav();
    expect(screen.getByRole('button', { name: /^Account/ })).toHaveAccessibleName('Account: nia@example.com');
    expect(screen.getByText('nia@example.com')).toBeInTheDocument();
    expect(screen.getByText('?')).toBeInTheDocument(); // no initials from a blank name
  });

  it('keeps Settings and Log out one menu away', () => {
    renderNav();
    fireEvent.keyDown(screen.getByRole('button', { name: /^Account/ }), { key: 'Enter' });

    fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
