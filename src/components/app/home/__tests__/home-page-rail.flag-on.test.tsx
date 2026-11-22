/** @vitest-environment happy-dom */
/**
 * HomePageLayout under the new look (thread answers step 1, Task 6): the audience side panel is
 * gone. No right column in a thread or on the arrival, the composer is handed no portal host, and
 * the work column still fills the row (it centres its own content), so no empty column is left.
 *
 * The flag-off rail is held by home-page-rail.test.tsx. The composer is stubbed, as there, so the
 * layout's contract is tested without the composer's streams.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/lib/flags/new-look', () => ({ NEW_LOOK_ENABLED: true }));
vi.mock('@/lib/flags/ambient-v2', () => ({ AMBIENT_V2_ENABLED: true }));
vi.mock('@/lib/flags/concept-v8', () => ({ CONCEPT_V8_ENABLED: true }));

vi.mock('../composer', () => ({
  Composer: ({
    onThreadChange,
    railHost,
  }: {
    onThreadChange?: (v: boolean) => void;
    railHost?: HTMLElement | null;
  }) => (
    <button
      data-testid="composer-stub"
      data-has-rail={railHost ? 'yes' : 'no'}
      onClick={() => onThreadChange?.(true)}
    >
      stub
    </button>
  ),
}));
vi.mock('@/hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => true }));
vi.mock('../home-greeting', () => ({ HomeGreeting: () => <div data-testid="greeting-stub" /> }));

import { HomePageLayout } from '../home-page-layout';

afterEach(() => cleanup());

const railAside = () => document.querySelector('aside[aria-label="Your audience"]');
const workColumn = () => screen.getByTestId('composer-stub').parentElement as HTMLElement;

describe('HomePageLayout, flag on: no audience side panel', () => {
  it('a thread: no rail <aside>, the composer gets no portal host, and its column fills the row', () => {
    render(<HomePageLayout />);
    act(() => {
      fireEvent.click(screen.getByTestId('composer-stub'));
    });
    expect(railAside()).toBeNull();
    expect(screen.queryByRole('separator', { name: /resize the audience rail/i })).toBeNull();
    expect(screen.getByTestId('composer-stub').getAttribute('data-has-rail')).toBe('no');
    const classes = workColumn().className.split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(['flex-1', 'min-w-0', 'min-h-0']));
    expect(classes).not.toContain('max-w-[760px]');
  });

  it('the arrival (v8): no rail <aside> either', () => {
    render(<HomePageLayout />);
    expect(railAside()).toBeNull();
    expect(screen.getByTestId('composer-stub').getAttribute('data-has-rail')).toBe('no');
  });
});
