/** @vitest-environment happy-dom */
/**
 * A pushed screen that is not a thread names itself in the phone header through the shell store
 * (`pushedTitle`), as the result page does ("Video · 0:29"). Back on a result returns to where the
 * creator came from, or Home when they opened it directly.
 *
 * Mocked: the router, the network, auth. Real: the stores and every shell component.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useBoardStore } from '@/stores/board-store';
import { useShellStore } from '@/stores/shell-store';
import { useSidebarStore } from '@/stores/sidebar-store';

vi.setConfig({ testTimeout: 20_000 });

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
let pathname = '/simulation/run-1';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => router,
}));
vi.mock('@/hooks/queries', () => ({
  useThreadList: () => ({ data: [], isLoading: false }),
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
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <TooltipProvider>
          <NextShell>
            <p>page content</p>
          </NextShell>
        </TooltipProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );

/** The phone's pushed header, found through Back or, in a chat not opened from Library, the menu. */
const header = () =>
  (screen.queryByRole('button', { name: 'Back' }) ?? screen.getByRole('button', { name: 'Open menu' })).closest('header')!;

const realLength = Object.getOwnPropertyDescriptor(History.prototype, 'length');
const setHistoryLength = (value: number) =>
  Object.defineProperty(window.history, 'length', { configurable: true, get: () => value });

beforeEach(() => {
  pathname = '/simulation/run-1';
  router.push.mockReset();
  router.back.mockReset();
  localStorage.clear();
  useShellStore.setState({ threadOpen: false, autoRail: false, pushedTitle: '' });
  useBoardStore.setState({ activeThreadId: null });
  useSidebarStore.setState({ isCollapsed: false, commandOpen: false });
});

afterEach(() => {
  // Drop the own-property override so the prototype's getter is back.
  delete (window.history as unknown as Record<string, unknown>).length;
  if (realLength) Object.defineProperty(History.prototype, 'length', realLength);
});

describe('NextShell — a pushed screen names itself', () => {
  it('shows the title the page set', () => {
    useShellStore.setState({ pushedTitle: 'Video · 0:29' });
    renderShell();
    expect(within(header()).getByText('Video · 0:29')).toBeInTheDocument();
  });

  it('follows the title as the page changes it', () => {
    useShellStore.setState({ pushedTitle: 'Simulating' });
    renderShell();
    expect(within(header()).getByText('Simulating')).toBeInTheDocument();
    act(() => useShellStore.getState().setPushedTitle('Video · 0:29'));
    expect(within(header()).getByText('Video · 0:29')).toBeInTheDocument();
  });

  it('a thread still shows the thread title, not the pushed title', () => {
    pathname = '/home';
    useShellStore.setState({ threadOpen: true, pushedTitle: 'Video · 0:29' });
    renderShell();
    expect(within(header()).queryByText('Video · 0:29')).toBeNull();
  });
});

describe('NextShell — Back on a result', () => {
  it('goes back when there is somewhere to go back to', () => {
    setHistoryLength(3);
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('goes Home when the result was opened directly', () => {
    setHistoryLength(1);
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(router.back).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/home');
  });

  it('other pushed screens keep going up to their place', () => {
    setHistoryLength(3);
    pathname = '/audience/new';
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(router.push).toHaveBeenCalledWith('/audience');
    expect(router.back).not.toHaveBeenCalled();
  });
});
