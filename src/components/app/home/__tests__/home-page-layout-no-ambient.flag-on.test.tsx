/** @vitest-environment happy-dom */
/**
 * HomePageLayout under the new look with AMBIENT_V2 off (final fix B6). Not a configuration that is
 * run, but the two must agree: with AMBIENT_V2 off the composer draws its other branch (Branch B)
 * for an empty /home, not Home, so the layout must not lay the page out for Home either.
 *
 * The composer is stubbed, as in home-page-rail.flag-on.test.tsx: this is the layout's contract.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  NEW_THREAD_SENTINEL,
  clearActiveThreadCookie,
  setActiveThreadCookie,
} from '@/lib/threads/active-thread-cookie';
import { useShellStore } from '@/stores/shell-store';

vi.mock('@/lib/flags/new-look', () => ({ NEW_LOOK_ENABLED: true }));
vi.mock('@/lib/flags/ambient-v2', () => ({ AMBIENT_V2_ENABLED: false }));
vi.mock('@/lib/flags/concept-v8', () => ({ CONCEPT_V8_ENABLED: true }));

vi.mock('../composer', () => ({
  Composer: ({ className }: { className?: string }) => (
    <div data-testid="composer-stub" data-class={className ?? ''} />
  ),
}));
vi.mock('@/hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => true }));
vi.mock('../home-greeting', () => ({ HomeGreeting: () => <div data-testid="greeting-stub" /> }));

import { HomePageLayout } from '../home-page-layout';

beforeEach(() => {
  setActiveThreadCookie(NEW_THREAD_SENTINEL);
  useShellStore.setState({ threadOpen: false });
});
afterEach(() => {
  cleanup();
  clearActiveThreadCookie();
});

describe('HomePageLayout, new look with AMBIENT_V2 off', () => {
  it('an empty /home is not laid out as Home: the composer and its column do not take Home\'s fill', () => {
    render(<HomePageLayout />);
    const composer = screen.getByTestId('composer-stub');
    expect(composer.getAttribute('data-class')?.split(/\s+/) ?? []).not.toContain('flex-1');
    expect((composer.parentElement as HTMLElement).className.split(/\s+/)).not.toContain('flex-1');
  });
});
