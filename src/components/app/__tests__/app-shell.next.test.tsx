/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useShellStore } from '@/stores/shell-store';

vi.setConfig({ testTimeout: 20_000 });

// The flag is a build-time constant; this file is the flag-on build.
vi.mock('@/lib/flags/new-look', () => ({ NEW_LOOK_ENABLED: true }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/library',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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

import { AppShell } from '../app-shell';

// The window width the shell measures; a phone here, where the drawer is the one way around.
const realWidth = window.innerWidth;
const setWidth = (value: number) =>
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value });

describe('AppShell, flag on', () => {
  afterEach(() => {
    setWidth(realWidth);
    useShellStore.setState({ drawerOpen: false });
  });

  it("renders the new shell: on a phone its drawer is the way around (no tab bar), and the legacy shell's opener is not there", async () => {
    setWidth(390);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <TooltipProvider>
            <AppShell>
              <p>page content</p>
            </AppShell>
          </TooltipProvider>
        </ToastProvider>
      </QueryClientProvider>,
    );
    expect(screen.queryByRole('navigation', { name: 'Places', hidden: true })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open sidebar' })).toBeNull();
    expect(screen.getByRole('main')).toHaveTextContent('page content');
    await act(async () => useShellStore.getState().openDrawer());
    expect(await screen.findByRole('dialog', { name: 'Menu' })).toBeInTheDocument();
  });
});
