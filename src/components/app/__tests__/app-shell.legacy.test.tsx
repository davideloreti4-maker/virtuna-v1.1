/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.setConfig({ testTimeout: 20_000 });

// The flag is not set in this file: this is the production build as it is today.
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

describe('AppShell, flag off', () => {
  it('renders the legacy shell: the drawer opener, and no tab bar', () => {
    render(
      <ToastProvider>
        <TooltipProvider>
          <AppShell>
            <p>page content</p>
          </AppShell>
        </TooltipProvider>
      </ToastProvider>,
    );
    expect(screen.getByRole('button', { name: 'Open sidebar' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Places' })).toBeNull();
    expect(screen.getByRole('main')).toHaveTextContent('page content');
  });
});
