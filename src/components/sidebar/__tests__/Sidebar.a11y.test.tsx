/** @vitest-environment happy-dom */
import { ToastProvider } from "@/components/ui/toast";
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';

vi.mock('@/hooks/queries', () => ({
  useThreadList: () => ({ data: [], isLoading: false }),
  useCreateThread: () => ({ mutateAsync: vi.fn() }),
  useActivateThread: () => ({ mutateAsync: vi.fn() }),
  useArchiveThread: () => ({ mutateAsync: vi.fn() }),
  useRenameThread: () => ({ mutate: vi.fn() }),
  usePinThread: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/hooks/queries/use-profile', () => ({
  useProfile: () => ({ data: null, isLoading: false }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/analyze',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// Sidebar instantiates a Supabase browser client at module load; without env
// vars the real createClient throws. Stub it out — the a11y check doesn't
// exercise any auth flows.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => Promise.resolve({ error: null }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    }),
  }),
}));

import { Sidebar } from '../Sidebar';

describe('Sidebar a11y', () => {
  it('no violations expanded', async () => {
    const { container } = render(<ToastProvider><Sidebar /></ToastProvider>);
    const results = await axe(container);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(results).toHaveNoViolations();
  });

  it('exposes the top-level nav items: New Thread, Discover, Audience, Library', () => {
    render(<ToastProvider><Sidebar /></ToastProvider>);
    // Discover + Library were reactivated 2026-07-29 (they had redirected to /home since the
    // 2026-07-15 launch cut), so the destinations are Discover · Audience · Library.
    // The CTA's accessible name includes its ⌘N badge ("New Thread ⌘N"), so
    // anchor on the noun rather than an exact string.
    expect(screen.getByRole('button', { name: /^New Thread\b/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discover' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Audience' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Library' })).toBeInTheDocument();
    // Still hidden from the MVP launch cut → no standalone nav items (routes → /home).
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Home' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Calendar' })).not.toBeInTheDocument();
    // Dissolved / collapsed into hubs → no longer standalone nav items. Feed + Competitors are
    // LIVE again, but as the Discover hub and one of its tabs — never under their own names.
    expect(screen.queryByRole('button', { name: 'Grow' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Analytics' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Referrals' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Feed' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Competitors' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
    // The chat-history section header.
    expect(screen.getByText('Threads')).toBeInTheDocument();
  });

  it('keeps the destinations a flat list — no Create / Analyze / Assets group labels', () => {
    render(<ToastProvider><Sidebar /></ToastProvider>);
    // The umbrella labels existed to chunk five items across three groups. Reactivating Discover +
    // Library brings the list back to three, which doesn't need chunking — a label per pair would
    // just echo its own item. Kept flat deliberately; this asserts they stay gone.
    expect(screen.queryByText('Create')).not.toBeInTheDocument();
    expect(screen.queryByText('Analyze')).not.toBeInTheDocument();
    expect(screen.queryByText('Assets')).not.toBeInTheDocument();
  });
});
