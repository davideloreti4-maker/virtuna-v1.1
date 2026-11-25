/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  clearActiveThreadCookie,
  getActiveThreadCookie,
  setActiveThreadCookie,
} from '@/lib/threads/active-thread-cookie';
import { useBoardStore } from '@/stores/board-store';
import { useShellStore } from '@/stores/shell-store';
import { useSidebarStore } from '@/stores/sidebar-store';

vi.setConfig({ testTimeout: 20_000 });

// Mocked: the router, the network, auth. Real: the stores and every shell component.
const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
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
import { SIDE_NAV_CHOICE_KEY } from '../nav-config';

// The sidebar marks Library's lists old after its actions; nothing here is read through it.
const client = new QueryClient();
const shellTree = () => (
  <QueryClientProvider client={client}>
    <ToastProvider>
      <TooltipProvider>
        <NextShell>
          <p>page content</p>
        </NextShell>
      </TooltipProvider>
    </ToastProvider>
  </QueryClientProvider>
);
const renderShell = () => render(shellTree());

/** The navigation the phone's bottom tab bar was. There is none: the drawer is the phone's way around. */
const barNav = () => screen.queryByRole('navigation', { name: 'Places', hidden: true });
const back = () => screen.queryByRole('button', { name: 'Back' });
/** The drawer's opener in a chat's band (`hidden`: while the drawer is open the page is hidden). */
const menu = () => screen.queryByRole('button', { name: 'Open menu', hidden: true });
/** The phone's pushed header, found through Back or, in a chat not opened from Library, the menu
 *  (the sidebar's Recent rows sit outside it). */
const pushedHeader = () => (back() ?? menu())!.closest('header')!;

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
  router.back.mockReset();
  localStorage.clear();
  useShellStore.setState({ threadOpen: false, autoRail: false, drawerOpen: false, accountFace: null });
  useBoardStore.setState({ activeThreadId: null });
  useSidebarStore.setState({ isCollapsed: false, commandOpen: false });
});

describe('NextShell — what frames a screen', () => {
  it('renders the page inside <main>', () => {
    renderShell();
    expect(screen.getByRole('main')).toHaveTextContent('page content');
  });

  it('a place: no bar, no Back', () => {
    renderShell();
    expect(barNav()).toBeNull();
    expect(back()).toBeNull();
  });

  it('a thread: no bar; the menu at the top left, no Back', () => {
    setWidth(390);
    pathname = '/home';
    useShellStore.setState({ threadOpen: true });
    useBoardStore.setState({ activeThreadId: 't1' });
    renderShell();

    expect(barNav()).toBeNull();
    // The thread's title names the screen, in its header.
    expect(within(pushedHeader()).getByText('Three hooks for the gym video')).toBeInTheDocument();
    expect(back()).toBeNull();
    // In Back's column: the band's first cell. New chat stays at the right.
    expect(pushedHeader().firstElementChild).toBe(menu());
    expect(pushedHeader().lastElementChild).toContainElement(within(pushedHeader()).getByRole('button', { name: 'New chat' }));
    expect(menu()).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(menu()!);
    expect(useShellStore.getState().drawerOpen).toBe(true);
    expect(menu()).toHaveAttribute('aria-expanded', 'true');
    // The chat stays open: nothing pushed, no new chat.
    expect(useBoardStore.getState().activeThreadId).toBe('t1');
    expect(useShellStore.getState().threadOpen).toBe(true);
    expect(router.push).not.toHaveBeenCalled();
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

  it('a pushed screen under a place: no bar; Back goes up to the place', () => {
    pathname = '/audience/new';
    renderShell();
    expect(barNav()).toBeNull();
    fireEvent.click(back()!);
    expect(router.push).toHaveBeenCalledWith('/audience');
  });

  // The menu opens You, Earn and Settings from any place or chat, so Back returns there as it was
  // left; opened directly (a fresh tab, a pasted link), You goes Home and the other two to You.
  describe.each([
    ['/you', '/home'],
    ['/earn', '/you'],
    ['/settings', '/you'],
  ])('%s', (path, target) => {
    const realHistoryLength = Object.getOwnPropertyDescriptor(window.history, 'length');
    const setHistoryLength = (value: number) =>
      Object.defineProperty(window.history, 'length', { configurable: true, get: () => value });
    afterEach(() => {
      if (realHistoryLength) Object.defineProperty(window.history, 'length', realHistoryLength);
      else delete (window.history as { length?: number }).length;
    });

    it('no bar; with an entry to go back to, Back goes back in history', () => {
      setHistoryLength(3);
      pathname = path;
      renderShell();
      expect(barNav()).toBeNull();
      fireEvent.click(back()!);
      expect(router.back).toHaveBeenCalledTimes(1);
      expect(router.push).not.toHaveBeenCalled();
    });

    it(`with none, Back goes to ${target}`, () => {
      setHistoryLength(1);
      pathname = path;
      renderShell();
      fireEvent.click(back()!);
      expect(router.back).not.toHaveBeenCalled();
      expect(router.push).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledWith(target);
    });
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

// Library plan 2026-11-23 (spec §5): on the phone, Back in a chat opened from Library
// returns to Library, where the creator came from; Back in a chat opened any other way starts a
// new chat, as today. Library's open leaves the marker (`threadBack`) in the shell store.
describe('NextShell — Back in a chat opened from Library', () => {
  beforeEach(() => {
    useShellStore.setState({ threadBack: null });
    clearActiveThreadCookie();
  });

  // Back goes back in history, so Library comes back as it was left
  // (its chip and search are in its address), and no round trip adds a history entry.
  const realHistoryLength = Object.getOwnPropertyDescriptor(window.history, 'length');
  const setHistoryLength = (value: number) =>
    Object.defineProperty(window.history, 'length', { configurable: true, get: () => value });
  afterEach(() => {
    if (realHistoryLength) Object.defineProperty(window.history, 'length', realHistoryLength);
    else delete (window.history as { length?: number }).length;
  });

  it('goes back to the Library entry it came from and clears the marker; it neither pushes nor starts a new chat', () => {
    setHistoryLength(3);
    pathname = '/home';
    setActiveThreadCookie('t1');
    useShellStore.setState({ threadOpen: true, threadBack: '/library' });
    useBoardStore.setState({ activeThreadId: 't1' });
    renderShell();

    fireEvent.click(back()!);

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
    expect(useShellStore.getState().threadBack).toBeNull();
    // The chat stays the open one: nothing was left for a blank Home.
    expect(useBoardStore.getState().activeThreadId).toBe('t1');
    expect(getActiveThreadCookie()).toBe('t1');
  });

  it('with no entry to go back to (a fresh tab), it goes to Library', () => {
    setHistoryLength(1);
    pathname = '/home';
    useShellStore.setState({ threadOpen: true, threadBack: '/library' });
    useBoardStore.setState({ activeThreadId: 't1' });
    renderShell();

    fireEvent.click(back()!);

    expect(router.back).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/library');
    expect(useShellStore.getState().threadBack).toBeNull();
  });

  it("with no marker, the menu takes Back's place", () => {
    pathname = '/home';
    setActiveThreadCookie('t1');
    useShellStore.setState({ threadOpen: true });
    useBoardStore.setState({ activeThreadId: 't1' });
    renderShell();

    expect(back()).toBeNull();
    expect(pushedHeader().firstElementChild).toBe(menu());

    fireEvent.click(menu()!);

    // The menu is not a way out of the chat: it neither goes back nor starts a new chat.
    expect(router.back).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(useBoardStore.getState().activeThreadId).toBe('t1');
    expect(getActiveThreadCookie()).toBe('t1');
  });

  it('"New chat" in that chat\'s header starts a new chat and drops the marker', () => {
    pathname = '/home';
    setActiveThreadCookie('t1');
    useShellStore.setState({ threadOpen: true, threadBack: '/library' });
    useBoardStore.setState({ activeThreadId: 't1' });
    renderShell();

    fireEvent.click(within(pushedHeader()).getByRole('button', { name: 'New chat' }));

    expect(router.push).toHaveBeenCalledWith('/home');
    expect(useShellStore.getState().threadBack).toBeNull();
  });

  // The shell is mounted once and stays while the routes change under it, so
  // these start in the chat on /home and then navigate (a new pathname, the same mounted shell).
  /** In a chat opened from Library: the marker set, on /home, the shell mounted. */
  const inLibraryChat = () => {
    pathname = '/home';
    useShellStore.setState({ threadOpen: true, threadBack: '/library' });
    useBoardStore.setState({ activeThreadId: 't1' });
    const view = renderShell();
    expect(useShellStore.getState().threadBack).toBe('/library');
    return view;
  };
  const navigateTo = (view: ReturnType<typeof renderShell>, next: string) => {
    pathname = next;
    view.rerender(shellTree());
  };

  it('a result opened from that chat keeps the marker, and so does coming back to the chat from it', () => {
    const view = inLibraryChat();
    navigateTo(view, '/simulation/a1');
    expect(useShellStore.getState().threadBack).toBe('/library');
    navigateTo(view, '/simulation/hook/t1/k1');
    expect(useShellStore.getState().threadBack).toBe('/library');
    navigateTo(view, '/home');
    expect(useShellStore.getState().threadBack).toBe('/library');
  });

  it.each(['/library', '/discover', '/audience', '/settings'])(
    'leaving the chat for %s drops the marker: a chat found open again later was not opened from Library',
    (place) => {
      const view = inLibraryChat();
      navigateTo(view, place);
      expect(useShellStore.getState().threadBack).toBeNull();
      // On /home again with the same chat still open: it was not opened from Library, so its band
      // shows the menu, not Back.
      navigateTo(view, '/home');
      expect(back()).toBeNull();
      expect(pushedHeader().firstElementChild).toBe(menu());
      expect(router.back).not.toHaveBeenCalled();
      expect(useBoardStore.getState().activeThreadId).toBe('t1');
    },
  );
});

// The scroll Library was left at and the name the row showed travel with the marker: Back hands the
// scroll to Library (which takes it as it arrives) and drops the name; leaving the chat any other
// way drops all three.
describe('NextShell — what goes with the way back to Library', () => {
  const SCROLL = { href: '/library?filter=simulated', top: 640 };
  beforeEach(() => {
    useShellStore.setState({ threadBack: null, threadTitleHint: null, libraryScroll: null });
  });
  const inLibraryChat = () => {
    pathname = '/home';
    useShellStore.setState({
      threadOpen: true,
      threadBack: '/library',
      threadTitleHint: { id: 't1', title: 'Video simulation' },
      libraryScroll: SCROLL,
    });
    useBoardStore.setState({ activeThreadId: 't1' });
    return renderShell();
  };

  it('Back: the marker and the name go, the scroll stays for Library to put back (also once the route is Library)', () => {
    const realLength = Object.getOwnPropertyDescriptor(window.history, 'length');
    Object.defineProperty(window.history, 'length', { configurable: true, get: () => 3 });
    try {
      const view = inLibraryChat();
      fireEvent.click(back()!);
      expect(router.back).toHaveBeenCalledTimes(1);
      expect(useShellStore.getState().threadBack).toBeNull();
      expect(useShellStore.getState().threadTitleHint).toBeNull();
      expect(useShellStore.getState().libraryScroll).toEqual(SCROLL);
      pathname = '/library';
      view.rerender(shellTree());
      expect(useShellStore.getState().libraryScroll).toEqual(SCROLL);
    } finally {
      if (realLength) Object.defineProperty(window.history, 'length', realLength);
      else delete (window.history as { length?: number }).length;
    }
  });

  it.each(['/library', '/discover', '/settings'])('leaving the chat for %s another way drops the marker, the name and the scroll', (place) => {
    const view = inLibraryChat();
    pathname = place;
    view.rerender(shellTree());
    expect(useShellStore.getState().threadBack).toBeNull();
    expect(useShellStore.getState().threadTitleHint).toBeNull();
    expect(useShellStore.getState().libraryScroll).toBeNull();
  });

  it('a chat opened from a Recent row (no marker, a name) drops the name on leaving too', () => {
    pathname = '/home';
    useShellStore.setState({ threadOpen: true, threadTitleHint: { id: 't1', title: 'Video simulation' } });
    useBoardStore.setState({ activeThreadId: 't1' });
    const view = renderShell();
    pathname = '/discover';
    view.rerender(shellTree());
    expect(useShellStore.getState().threadTitleHint).toBeNull();
  });

  it("the phone header of an untitled chat reads the row's name; a titled chat its own title", () => {
    threadList = [GYM, { ...GYM, id: 'v1', title: null as unknown as string }];
    pathname = '/home';
    useShellStore.setState({ threadOpen: true, threadBack: '/library', threadTitleHint: { id: 'v1', title: 'Video simulation' } });
    useBoardStore.setState({ activeThreadId: 'v1' });
    const view = renderShell();
    expect(within(pushedHeader()).getByRole('heading', { level: 1 })).toHaveTextContent('Video simulation');
    view.unmount();

    useShellStore.setState({ threadTitleHint: { id: 't1', title: 'Video simulation' } });
    useBoardStore.setState({ activeThreadId: 't1' });
    renderShell();
    expect(within(pushedHeader()).getByRole('heading', { level: 1 })).toHaveTextContent('Three hooks for the gym video');
  });
});

// Plan 2026-11-24-you: You is opened as any other place is (its sidebar row and the menu's row are
// links, the palette pushes /you), so the shell treats its route as it treats theirs: a chat left
// for You leaves nothing behind in the shell.
describe('NextShell — going to You from a chat', () => {
  const SCROLL = { href: '/library?filter=simulated', top: 640 };
  beforeEach(() => {
    useShellStore.setState({ threadBack: null, threadTitleHint: null, libraryScroll: null, threadAudience: '' });
  });
  afterEach(() => {
    useShellStore.setState({ threadAudience: '' });
  });

  it('drops the way back to Library (the marker, the name, the scroll); You shows nothing of the chat; its Back goes back to the chat, or Home with no entry', () => {
    pathname = '/home';
    useShellStore.setState({
      threadOpen: true,
      threadBack: '/library',
      threadTitleHint: { id: 't1', title: 'Video simulation' },
      libraryScroll: SCROLL,
      threadAudience: '@nia.tests',
    });
    useBoardStore.setState({ activeThreadId: 't1' });
    const view = renderShell();
    expect(within(pushedHeader()).getByText('Three hooks for the gym video')).toBeInTheDocument();

    pathname = '/you';
    view.rerender(shellTree());

    expect(useShellStore.getState().threadBack).toBeNull();
    expect(useShellStore.getState().threadTitleHint).toBeNull();
    expect(useShellStore.getState().libraryScroll).toBeNull();
    // Even with the store still saying a chat is open, You's header carries neither its title nor
    // its audience, and there is no bar.
    expect(pushedHeader().textContent).toBe('');
    expect(within(pushedHeader()).queryByRole('heading')).toBeNull();
    expect(barNav()).toBeNull();
    const realLength = Object.getOwnPropertyDescriptor(window.history, 'length');
    const setHistoryLength = (value: number) =>
      Object.defineProperty(window.history, 'length', { configurable: true, get: () => value });
    try {
      // With an entry: back in history, to the chat as it was left (its band then shows the menu,
      // the marker is gone); not a new chat.
      setHistoryLength(3);
      fireEvent.click(back()!);
      expect(router.back).toHaveBeenCalledTimes(1);
      expect(router.push).not.toHaveBeenCalled();
      expect(useShellStore.getState().threadBack).toBeNull();
      expect(useBoardStore.getState().activeThreadId).toBe('t1');
      router.back.mockReset();

      // With none (a fresh tab): Home.
      setHistoryLength(1);
      fireEvent.click(back()!);
      expect(router.back).not.toHaveBeenCalled();
      expect(router.push).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledWith('/home');
      expect(useBoardStore.getState().activeThreadId).toBe('t1');
    } finally {
      if (realLength) Object.defineProperty(window.history, 'length', realLength);
      else delete (window.history as { length?: number }).length;
    }
  });

  it('the same chat found open again on Home after You was not opened from Library: the menu, not Back', () => {
    pathname = '/home';
    useShellStore.setState({ threadOpen: true, threadBack: '/library' });
    useBoardStore.setState({ activeThreadId: 't1' });
    const view = renderShell();
    // Opened from Library: Back, no menu.
    expect(back()).not.toBeNull();
    expect(menu()).toBeNull();
    pathname = '/you';
    view.rerender(shellTree());
    pathname = '/home';
    view.rerender(shellTree());
    router.push.mockReset();

    expect(back()).toBeNull();
    expect(pushedHeader().firstElementChild).toBe(menu());
    expect(router.back).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(useBoardStore.getState().activeThreadId).toBe('t1');
  });
});

// Discover's pushed pages (a video, a collection, the pull page) are opened from the hub's grid, whose
// filter, order, search and scroll live in the hub's own history entry: Back goes back in history to
// it; opened directly (a fresh tab, a pasted link), Back goes up to Discover.
describe("NextShell — Back on Discover's pushed pages", () => {
  const realHistoryLength = Object.getOwnPropertyDescriptor(window.history, 'length');
  const setHistoryLength = (value: number) =>
    Object.defineProperty(window.history, 'length', { configurable: true, get: () => value });
  afterEach(() => {
    if (realHistoryLength) Object.defineProperty(window.history, 'length', realHistoryLength);
    else delete (window.history as { length?: number }).length;
  });

  it.each(['/feed/video/v1', '/feed/collection/meal-prep', '/feed/discover'])(
    '%s: no bar; Back goes back in history when there is an entry to go back to',
    (path) => {
      setHistoryLength(3);
      pathname = path;
      renderShell();
      expect(barNav()).toBeNull();
      fireEvent.click(back()!);
      expect(router.back).toHaveBeenCalledTimes(1);
      expect(router.push).not.toHaveBeenCalled();
    },
  );

  it.each(['/feed/video/v1', '/feed/collection/meal-prep', '/feed/discover'])('%s opened directly: Back goes up to Discover', (path) => {
    setHistoryLength(1);
    pathname = path;
    renderShell();
    fireEvent.click(back()!);
    expect(router.back).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/feed');
  });

  it('the hub itself draws no bar and has no Back (its screen draws its own top row)', () => {
    setHistoryLength(3);
    pathname = '/feed';
    renderShell();
    expect(barNav()).toBeNull();
    expect(back()).toBeNull();
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

// The phone's drawer: the shell mounts it once. In a chat not opened from Library the band's first
// cell is its menu; a chat opened from Library and every other pushed page keep Back; the four places
// carry their own opener (their screens, not the shell).
describe("NextShell — the phone's drawer", () => {
  beforeEach(() => {
    setWidth(390);
    useShellStore.setState({ threadBack: null, threadTitleHint: null, libraryScroll: null });
    clearActiveThreadCookie();
  });

  const drawer = () => screen.queryByRole('dialog', { name: 'Menu' });
  /** Let Radix's timers (its outside-pointer listener, its focus on close) settle. */
  const settle = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  const inChat = (id = 't1') =>
    act(() => {
      useShellStore.setState({ threadOpen: true });
      useBoardStore.setState({ activeThreadId: id });
    });

  it('a chat opened from Library keeps Back, and draws no menu', () => {
    pathname = '/home';
    useShellStore.setState({ threadOpen: true, threadBack: '/library' });
    useBoardStore.setState({ activeThreadId: 't1' });
    renderShell();
    expect(pushedHeader().firstElementChild).toBe(back());
    expect(menu()).toBeNull();
  });

  it.each([
    '/simulation/a1',
    '/feed/video/v1',
    '/feed/collection/meal-prep',
    '/feed/discover',
    '/you',
    '/earn',
    '/settings',
    '/audience/new',
    '/audience/a1',
  ])('every pushed page keeps Back and draws no menu: %s', (path) => {
    pathname = path;
    // The store still says a chat is open (a result is opened from one): only a chat's own band
    // shows the menu.
    useShellStore.setState({ threadOpen: true });
    useBoardStore.setState({ activeThreadId: 't1' });
    renderShell();
    expect(barNav()).toBeNull();
    expect(pushedHeader().firstElementChild).toBe(back());
    expect(menu()).toBeNull();
  });

  it.each(['/library', '/feed', '/audience', '/home'])(
    'a place draws no menu in the shell (its screen carries the opener): %s',
    (place) => {
      pathname = place;
      renderShell();
      expect(barNav()).toBeNull();
      expect(menu()).toBeNull();
      expect(back()).toBeNull();
    },
  );

  it('on a phone the menu opens the drawer, and Escape gives the focus back to it', async () => {
    pathname = '/home';
    inChat();
    renderShell();
    await settle();
    const opener = menu()!;
    opener.focus();
    fireEvent.click(opener);
    await settle();

    const panel = drawer()!;
    expect(panel).not.toBeNull();
    expect(document.activeElement).toBe(within(panel).getByRole('heading', { name: 'Menu' }));
    expect(opener).toHaveAttribute('aria-expanded', 'true');
    // The page behind is out of reach while it is open.
    expect(opener.closest('[aria-hidden="true"]')).not.toBeNull();

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await settle();
    expect(useShellStore.getState().drawerOpen).toBe(false);
    expect(drawer()).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(opener).toHaveAttribute('aria-expanded', 'false');
  });

  it('the drawer is mounted once', async () => {
    // On a place, whose screen carries the opener, the drawer is there to open.
    pathname = '/library';
    const view = renderShell();
    await settle();
    await act(async () => useShellStore.getState().openDrawer());
    await settle();
    expect(screen.getAllByRole('dialog', { name: 'Menu' })).toHaveLength(1);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await settle();
    expect(drawer()).toBeNull();

    // In a chat, through the band's menu: still one.
    pathname = '/home';
    inChat();
    view.rerender(shellTree());
    fireEvent.click(menu()!);
    await settle();
    expect(screen.getAllByRole('dialog', { name: 'Menu' })).toHaveLength(1);
  });

  it('a resize to 768 closes the open drawer', async () => {
    pathname = '/home';
    inChat();
    renderShell();
    await settle();
    fireEvent.click(menu()!);
    await settle();
    expect(drawer()).not.toBeNull();

    await act(async () => {
      setWidth(768);
      window.dispatchEvent(new Event('resize'));
    });
    await settle();
    expect(useShellStore.getState().drawerOpen).toBe(false);
    expect(drawer()).toBeNull();
  });

  it('a chat opened from the drawer shows the menu, and its row is lit', async () => {
    const HEADSET = { ...GYM, id: 't2', title: 'Hooks for the dream headset video' };
    threadList = [GYM, HEADSET];
    pathname = '/library';
    const view = renderShell();
    await settle();
    await act(async () => useShellStore.getState().openDrawer());
    await settle();

    fireEvent.click(within(drawer()!).getByRole('button', { name: HEADSET.title }));
    expect(useShellStore.getState().drawerOpen).toBe(false);
    expect(router.push).toHaveBeenCalledWith('/home');
    expect(useBoardStore.getState().activeThreadId).toBe('t2');
    // No way back recorded: the drawer is not Library.
    expect(useShellStore.getState().threadBack).toBeNull();

    // Home opens the chat (its layout publishes that a thread is on screen).
    pathname = '/home';
    inChat('t2');
    view.rerender(shellTree());
    await settle();
    expect(back()).toBeNull();
    expect(pushedHeader().firstElementChild).toBe(menu());
    expect(within(pushedHeader()).getByText(HEADSET.title)).toBeInTheDocument();

    fireEvent.click(menu()!);
    await settle();
    const lit = drawer()!.querySelectorAll('[aria-current="page"]');
    // Its own row, and not Home: the sidebar's rule.
    expect(Array.from(lit, (element) => element.textContent)).toEqual([HEADSET.title]);
  });

  it("the drawer's Recent lists the sidebar's Recent, in its order", async () => {
    // A choice made and the sidebar expanded: on this narrow window it is not the rail, so it draws
    // its Recent.
    localStorage.setItem(SIDE_NAV_CHOICE_KEY, '1');
    useSidebarStore.setState({ isCollapsed: false });
    const chat = (n: number, title: string | null) => ({ ...GYM, id: `r${n}`, title: title as string });
    threadList = [
      chat(1, null), // the newest, untitled: listed, as "New chat"
      chat(2, 'Hooks for the dream headset video'),
      chat(3, null), // untitled and not the newest: left out
      chat(4, 'Remix: ghost factories'),
      chat(5, '   '), // a blank title: left out
      chat(6, 'Ideas for next week'),
      chat(7, 'Captions that keep people watching'),
      chat(8, 'A slower open for the bakery clip'),
      chat(9, 'What to post on Friday'), // the seventh named: past the limit
    ];
    pathname = '/library';
    renderShell();
    await settle();
    const names = (list: HTMLElement) =>
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.querySelector('button')!.textContent!.trim());

    const sidebar = screen.getByRole('navigation', { name: 'App navigation' });
    const sidebarRecent = names(within(sidebar).getByRole('list', { name: 'Recent' }));
    expect(sidebarRecent).toEqual([
      'New chat',
      'Hooks for the dream headset video',
      'Remix: ghost factories',
      'Ideas for next week',
      'Captions that keep people watching',
      'A slower open for the bakery clip',
    ]);

    await act(async () => useShellStore.getState().openDrawer());
    await settle();
    expect(names(within(drawer()!).getByRole('list', { name: 'Recent' }))).toEqual(sidebarRecent);
  });
});

// The phone has no bottom tab bar: the left drawer is its one way around (its opener at the top left
// of the four places and of a chat), and New chat is the drawer's first row and the right button of a
// chat's band. The room <main> kept for the bar also lifted a place's last row clear of the home
// indicator; the four places keep that part, the safe area at the foot of <main>. A chat (its field is
// docked) and a pushed page keep what they had: no foot on <main>.
describe('NextShell — no bottom bar on a phone', () => {
  beforeEach(() => {
    setWidth(390);
    useShellStore.setState({ threadBack: null, threadTitleHint: null, libraryScroll: null });
    clearActiveThreadCookie();
  });

  const PLACE_SCREENS = ['/home', '/feed', '/library', '/audience'];
  /** Let Radix's timers (its outside-pointer listener, its focus on close) settle. */
  const settle = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  /** The classes that pad the foot of <main>. */
  const mainFoot = () =>
    screen
      .getByRole('main')
      .className.split(/\s+/)
      .filter((name) => /(^|:)pb-/.test(name));
  /** happy-dom applies no Tailwind, so what a phone draws is read from the classes: nothing under
   *  `hidden` (the sidebar is `hidden md:flex`) or `max-md:hidden` is drawn below 768. */
  const drawnOnPhone = (element: Element) => !element.closest('.hidden, .max-md\\:hidden');
  const navsOnPhone = () => screen.queryAllByRole('navigation', { hidden: true }).filter(drawnOnPhone);
  const newChatsOnPhone = () => screen.queryAllByRole('button', { name: 'New chat', hidden: true }).filter(drawnOnPhone);

  it.each(PLACE_SCREENS)("%s: no bar, no pushed band; <main> keeps the safe area at its foot, not the bar's room", (place) => {
    pathname = place;
    renderShell();
    expect(barNav()).toBeNull();
    // No band: neither Back nor the menu, and no header of the shell's (the screen draws its own row).
    expect(back()).toBeNull();
    expect(menu()).toBeNull();
    expect(document.querySelector('header')).toBeNull();
    expect(mainFoot()).toEqual(['max-md:pb-[env(safe-area-inset-bottom)]']);
  });

  it.each([
    ['a chat', '/home', true],
    ['a pushed page', '/settings', false],
    ['a page Discover pushes', '/feed/video/v1', false],
    ['a pushed page under a place', '/audience/new', false],
  ] as const)('%s (%s): no bar; the band as before, its New chat the only one drawn; no foot on <main>', (_what, path, chat) => {
    pathname = path;
    useShellStore.setState({ threadOpen: chat });
    useBoardStore.setState({ activeThreadId: chat ? 't1' : null });
    renderShell();
    expect(barNav()).toBeNull();
    expect(navsOnPhone()).toEqual([]);
    expect(newChatsOnPhone()).toEqual([within(pushedHeader()).getByRole('button', { name: 'New chat' })]);
    expect(mainFoot()).toEqual([]);
  });

  it.each(PLACE_SCREENS)(
    "on a phone nothing of a bottom bar is in the page: no navigation landmark besides the drawer's dialog when it is open, and no New chat button outside a chat's band and the drawer (%s)",
    async (place) => {
      pathname = place;
      renderShell();
      await settle();
      // The sidebar's landmark and its New chat are in the tree; a phone does not draw them.
      expect(screen.getByRole('navigation', { name: 'App navigation' })).toHaveClass('hidden');
      expect(navsOnPhone()).toEqual([]);
      expect(newChatsOnPhone()).toEqual([]);

      await act(async () => useShellStore.getState().openDrawer());
      await settle();
      const panel = screen.getByRole('dialog', { name: 'Menu' });
      expect(navsOnPhone()).toEqual([]);
      // New chat is the drawer's first row, and only there.
      const [newChat, ...others] = newChatsOnPhone();
      expect(others).toEqual([]);
      expect(panel).toContainElement(newChat ?? null);
    },
  );
});
