/** @vitest-environment happy-dom */
/**
 * The editor in the shell (plan 2026-11-24-editor-screens-a, Task 15; spec E1, E19): not one of the places and no shell header on its page (it
 * draws Back, Undo, Redo and Export itself), and a chat opened from Library keeps its way back across it, as across a result.
 *
 * Mocked: the router, the network, auth. Real: the stores and every shell component.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useBoardStore } from '@/stores/board-store';
import { useShellStore } from '@/stores/shell-store';
import { useSidebarStore } from '@/stores/sidebar-store';

vi.setConfig({ testTimeout: 20_000 });

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
let pathname = '/edit/e1';
vi.mock('next/navigation', () => ({ usePathname: () => pathname, useRouter: () => router }));
vi.mock('@/hooks/queries', () => ({
  useThreadList: () => ({ data: [], isLoading: false }),
  useArchiveThread: () => ({ mutateAsync: vi.fn() }),
  useRenameThread: () => ({ mutate: vi.fn() }),
  usePinThread: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/hooks/queries/use-profile', () => ({ useProfile: () => ({ data: null }) }));
vi.mock('@/hooks/use-subscription', () => ({ useSubscription: () => ({ usage: null }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signOut: vi.fn() } }) }));
vi.mock('@/components/app/auth-guard', () => ({ AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

import { NextShell } from '../next-shell';
import { backTarget, onPlaceScreen } from '../nav-config';

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

beforeEach(() => {
  pathname = '/edit/e1';
  localStorage.clear();
  useShellStore.setState({ threadOpen: false, autoRail: false, pushedTitle: '', threadBack: null });
  useBoardStore.setState({ activeThreadId: null });
  useSidebarStore.setState({ isCollapsed: false, commandOpen: false });
});

describe('NextShell — the editor', () => {
  it('is not a place and draws no header of its own over the editor', () => {
    expect(onPlaceScreen('/edit/e1', false)).toBe(false);
    expect(backTarget('/edit/e1')).toBe('/home');
    renderShell();
    expect(screen.getByText('page content')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('still draws its header on every other pushed screen', () => {
    pathname = '/simulation/run-1';
    renderShell();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('keeps the way back to Library of the chat it was opened from', () => {
    useShellStore.getState().setThreadBack('/library');
    renderShell();
    expect(useShellStore.getState().threadBack).toBe('/library');
    pathname = '/audience';
    useShellStore.getState().setThreadBack('/library');
    renderShell();
    expect(useShellStore.getState().threadBack).toBeNull();
  });
});
