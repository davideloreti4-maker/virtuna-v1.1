/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';

vi.mock('@/hooks/queries', () => ({
  useThreadList: () => ({ data: [], isLoading: false }),
  useCreateThread: () => ({ mutateAsync: vi.fn() }),
  useActivateThread: () => ({ mutateAsync: vi.fn() }),
  useArchiveThread: () => ({ mutateAsync: vi.fn() }),
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
    const { container } = render(<Sidebar />);
    const results = await axe(container);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(results).toHaveNoViolations();
  });

  it('exposes the launch-cut top-level nav items: New Thread, Start, Audience', () => {
    render(<Sidebar />);
    // MVP launch cut (lane/launch-prep, 2026-07-15): the nav is New Thread (CTA) + Start +
    // Audience — the two surfaces the core prediction loop needs. Calendar · Discover ·
    // Library are hidden (route-guarded → /home); Grow/Analytics/Referrals/Feed/Competitors
    // were already folded into hubs.
    // The CTA's accessible name includes its ⌘N badge ("New Thread ⌘N"), so
    // anchor on the noun rather than an exact string.
    expect(screen.getByRole('button', { name: /^New Thread\b/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Audience' })).toBeInTheDocument();
    // Hidden for the MVP launch cut → no longer standalone nav items.
    expect(screen.queryByRole('button', { name: 'Calendar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Discover' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Library' })).not.toBeInTheDocument();
    // Dissolved / collapsed into hubs → no longer standalone nav items.
    expect(screen.queryByRole('button', { name: 'Grow' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Analytics' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Referrals' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Feed' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Competitors' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
    // The chat-history section header.
    expect(screen.getByText('Threads')).toBeInTheDocument();
  });

  it('drops the Create / Analyze / Assets group labels after the launch cut', () => {
    render(<Sidebar />);
    // With Calendar/Discover/Library hidden, each umbrella group had a single child, so the
    // labels were removed — the nav is now a flat Start · Audience list.
    expect(screen.queryByText('Create')).not.toBeInTheDocument();
    expect(screen.queryByText('Analyze')).not.toBeInTheDocument();
    expect(screen.queryByText('Assets')).not.toBeInTheDocument();
  });
});
