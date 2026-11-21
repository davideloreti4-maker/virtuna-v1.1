/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';

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

describe('AppShell, flag on', () => {
  it('renders the new shell: the tab bar, and no drawer opener', () => {
    render(
      <ToastProvider>
        <TooltipProvider>
          <AppShell>
            <p>page content</p>
          </AppShell>
        </TooltipProvider>
      </ToastProvider>,
    );
    expect(screen.getByRole('navigation', { name: 'Places' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open sidebar' })).toBeNull();
    expect(screen.getByRole('main')).toHaveTextContent('page content');
  });
});
