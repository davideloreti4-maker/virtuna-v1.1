/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useBoardStore } from '@/stores/board-store';
import { useShellStore } from '@/stores/shell-store';
import { useSidebarStore } from '@/stores/sidebar-store';

vi.setConfig({ testTimeout: 20_000 });

// Mocked: the router, the network, auth. Real: the stores and every shell component.
const router = { push: vi.fn(), replace: vi.fn() };
let pathname = '/library';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => router,
}));

const GYM = { id: 't1', title: 'Three hooks for the gym video', updated_at: '2026-11-18T10:00:00Z', created_at: '2026-11-18T09:00:00Z', pinned_at: null };
// What the thread-list query returns; a test sets `undefined` for a list still loading.
let threadList: (typeof GYM)[] | undefined = [GYM];
vi.mock('@/hooks/queries', () => ({
  useThreadList: () => ({ data: threadList, isLoading: threadList === undefined }),
  useArchiveThread: () => ({ mutateAsync: vi.fn() }),
  useRenameThread: () => ({ mutate: vi.fn() }),
  usePinThread: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/hooks/queries/use-profile', () => ({ useProfile: () => ({ data: null }) }));
vi.mock('@/hooks/use-subscription', () => ({ useSubscription: () => ({ usage: null }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signOut: vi.fn() } }) }));
vi.mock('@/components/app/auth-guard', () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { NextShell } from '../next-shell';

const renderShell = () =>
  render(
    <ToastProvider>
      <TooltipProvider>
        <NextShell>
          <p>page content</p>
        </NextShell>
      </TooltipProvider>
    </ToastProvider>,
  );

const tabBar = () => screen.queryByRole('navigation', { name: 'Places' });
const back = () => screen.queryByRole('button', { name: 'Back' });
/** The phone's Back header (the sidebar's Recent rows sit outside it). */
const pushedHeader = () => back()!.closest('header')!;

// The window width the sidebar's narrow-window rail reads. happy-dom's default (1024) is below
// 1100, where the sidebar starts as the rail; the tests run on a desktop window unless they say.
const realWidth = window.innerWidth;
const setWidth = (value: number) =>
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value });

afterEach(() => setWidth(realWidth));

beforeEach(() => {
  setWidth(1440);
  threadList = [GYM];
  pathname = '/library';
  router.push.mockReset();
  localStorage.clear();
  useShellStore.setState({ threadOpen: false, autoRail: false });
  useBoardStore.setState({ activeThreadId: null });
  useSidebarStore.setState({ isCollapsed: false, commandOpen: false });
});

describe('NextShell — what frames a screen', () => {
  it('renders the page inside <main>', () => {
    renderShell();
    expect(screen.getByRole('main')).toHaveTextContent('page content');
  });

  it('a place: tab bar, no Back', () => {
    renderShell();
    expect(tabBar()).not.toBeNull();
    expect(back()).toBeNull();
  });

  it('a thread: no tab bar; Back returns to the blank Home', () => {
    pathname = '/home';
    useShellStore.setState({ threadOpen: true });
    useBoardStore.setState({ activeThreadId: 't1' });
    renderShell();

    expect(tabBar()).toBeNull();
    // The thread's title names the screen, in its header.
    expect(within(pushedHeader()).getByText('Three hooks for the gym video')).toBeInTheDocument();

    fireEvent.click(back()!);
    expect(useBoardStore.getState().activeThreadId).toBeNull();
    expect(router.push).toHaveBeenCalledWith('/home');
  });

  it('a thread the loaded list does not hold (or holds untitled) is called "New chat"', () => {
    pathname = '/home';
    useShellStore.setState({ threadOpen: true });
    useBoardStore.setState({ activeThreadId: 't9' });
    renderShell();
    expect(within(pushedHeader()).getByText('New chat')).toBeInTheDocument();
  });

  it('while the thread list loads, the thread header shows no title (no "New chat" flash)', () => {
    threadList = undefined;
    pathname = '/home';
    useShellStore.setState({ threadOpen: true });
    useBoardStore.setState({ activeThreadId: 't1' });
    renderShell();
    expect(pushedHeader().textContent).toBe('');
  });

  it('a pushed screen under a place: no tab bar; Back goes up to the place', () => {
    pathname = '/audience/new';
    renderShell();
    expect(tabBar()).toBeNull();
    fireEvent.click(back()!);
    expect(router.push).toHaveBeenCalledWith('/audience');
  });

  it('a screen outside the places: no tab bar; Back goes Home', () => {
    pathname = '/settings';
    renderShell();
    expect(tabBar()).toBeNull();
    fireEvent.click(back()!);
    expect(router.push).toHaveBeenCalledWith('/home');
  });

  it('a pushed screen keeps a new chat one tap away, in its header', () => {
    pathname = '/settings';
    useBoardStore.setState({ activeThreadId: 't1' });
    renderShell();
    fireEvent.click(within(pushedHeader()).getByRole('button', { name: 'New chat' }));
    expect(useBoardStore.getState().activeThreadId).toBeNull();
    expect(router.push).toHaveBeenCalledWith('/home');
  });
});

describe('NextShell — the content column', () => {
  const offset = () => screen.getByRole('main').style.marginLeft;

  it('starts where the sidebar ends: 248 expanded, 56 once ⌘\\ makes it the rail', () => {
    renderShell();
    expect(offset()).toBe('248px');
    fireEvent.keyDown(window, { key: '\\', metaKey: true });
    expect(offset()).toBe('56px');
  });

  it('on a narrow window with no choice made, starts beside the rail the sidebar starts as', () => {
    setWidth(1000);
    renderShell();
    expect(useSidebarStore.getState().isCollapsed).toBe(false);
    expect(offset()).toBe('56px');
  });
});

describe('NextShell — keyboard', () => {
  it('⌘N starts a new chat', () => {
    useBoardStore.setState({ activeThreadId: 't1' });
    renderShell();
    fireEvent.keyDown(window, { key: 'n', metaKey: true });
    expect(useBoardStore.getState().activeThreadId).toBeNull();
    expect(router.push).toHaveBeenCalledWith('/home');
  });

  it('⌘\\ collapses the sidebar, and again expands it', () => {
    renderShell();
    fireEvent.keyDown(window, { key: '\\', metaKey: true });
    expect(useSidebarStore.getState().isCollapsed).toBe(true);
    fireEvent.keyDown(window, { key: '\\', ctrlKey: true });
    expect(useSidebarStore.getState().isCollapsed).toBe(false);
  });

  it('a plain "n" typed into the page does nothing', () => {
    useBoardStore.setState({ activeThreadId: 't1' });
    renderShell();
    fireEvent.keyDown(window, { key: 'n' });
    expect(useBoardStore.getState().activeThreadId).toBe('t1');
  });
});

// Thread answers step 1 (Task 6; drawing `.scratch/next-look/part3/answers/answers.html`, `nav()`
// with `.ax-sub`): the phone's thread header names the audience the thread is for, under the title.
// The composer publishes it in the shell store (`threadAudience`); the shell only reads it.
describe('NextShell — the thread header names its audience', () => {
  beforeEach(() => {
    useShellStore.setState({ threadAudience: '' });
  });

  it('in a thread: "For {audience}" as a second line under the title, and the title is the page heading', () => {
    pathname = '/home';
    useShellStore.setState({ threadOpen: true, threadAudience: '@nia.tests' });
    useBoardStore.setState({ activeThreadId: 't1' });
    renderShell();
    const header = pushedHeader();
    const title = within(header).getByRole('heading', { level: 1, name: 'Three hooks for the gym video' });
    const sub = within(header).getByText('For @nia.tests');
    // Stacked: the line follows the title, inside the same centred cell of the 40px band.
    expect(title.compareDocumentPosition(sub) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(title.parentElement).toBe(sub.parentElement);
    expect(header.className).toContain('h-10');
    // 12 / 500 in the muted ink (`.ax-sub`); the title keeps its tracking as an <h1> (inline).
    expect(sub.className.split(/\s+/)).toEqual(expect.arrayContaining(['text-label', 'font-medium', 'text-foreground-muted', 'truncate']));
    expect(title.style.letterSpacing).toBe('-0.014em');
  });

  it('no audience published: the title alone', () => {
    pathname = '/home';
    useShellStore.setState({ threadOpen: true });
    useBoardStore.setState({ activeThreadId: 't1' });
    renderShell();
    expect(pushedHeader().textContent).toBe('Three hooks for the gym video');
  });

  it('a pushed screen that is not a thread shows no audience line', () => {
    pathname = '/settings';
    useShellStore.setState({ threadAudience: '@nia.tests' });
    renderShell();
    expect(within(pushedHeader()).queryByText(/^For /)).toBeNull();
  });
});
