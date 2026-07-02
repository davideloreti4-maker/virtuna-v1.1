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

  it('exposes top-level nav items: New Thread, Audience, Library, Feed + the surfaced routes (IA-01)', () => {
    render(<Sidebar />);
    // Top-level nav nouns: New Thread (CTA) + Audience · Library · Feed and the
    // refine-lane surfaced routes (Competitors · Referrals).
    // The CTA's accessible name includes its ⌘N badge ("New Thread ⌘N"), so
    // anchor on the noun rather than an exact string.
    expect(screen.getByRole('button', { name: /^New Thread\b/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Audience' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Library' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Feed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Competitors' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Referrals' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
    // The relabeled history section header reads "Thread" (the old "Simulations"
    // copy is gone — the positive New Thread / Thread assertions above prove it).
    expect(screen.getByText('Threads')).toBeInTheDocument();
  });
});
