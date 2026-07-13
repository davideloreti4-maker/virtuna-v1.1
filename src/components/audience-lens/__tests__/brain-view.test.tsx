/** @vitest-environment happy-dom */
/**
 * The brain — the Room's third scale (BrainView), and the DOCK's landing view.
 *
 * Binding here:
 *  - the dock/panel Room lands on the brain (owner call) and offers all three scales, in order;
 *  - the EMBEDDED Room (the video Read + the room drawer) has no brain segment at all and keeps
 *    landing on the people — the brain is a simulated read and does not belong under a real
 *    video's measured Read;
 *  - the honesty label ships with the view (it is a sketch, not a measurement), so the sim can
 *    never quietly present itself as a real neural measurement;
 *  - the render is DETERMINISTIC for a given focus (seeded off the focus id): the same props
 *    produce the same first frame, which is what keeps SSR + hydration in agreement.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, within, fireEvent } from '@testing-library/react';
import { AmbientRoom } from '../AmbientRoom';

// The cortex is WebGL — there is no GL context in happy-dom, and the surface itself is covered by
// its own headless tests (`src/lib/brain/__tests__/cortex-mesh.test.ts`). What matters HERE is that
// the panel mounts it, and that the honesty chrome around it survives.
vi.mock('../CortexCanvas', () => ({
  default: ({ seed }: { seed: number }) => <div data-testid="cortex-canvas" data-seed={seed} />,
}));

afterEach(cleanup);

const PERSONAS = [
  { archetype: 'high_engager', verdict: 'stop' as const, quote: 'got me' },
  { archetype: 'tough_crowd', verdict: 'scroll' as const, quote: 'too preachy' },
];

const room = (extra: Partial<React.ComponentProps<typeof AmbientRoom>> = {}) => (
  <AmbientRoom
    reducedMotion
    conceptText="Stop editing your videos."
    fraction="6/10 stop"
    flatPersonas={PERSONAS}
    focusId="h1"
    {...extra}
  />
);

const scaleGroup = () => screen.getByRole('group', { name: /audience scale/i });

describe('AmbientRoom — the brain scale', () => {
  it('lands on the brain in the dock, with all three scales in order', () => {
    render(room());
    const labels = within(scaleGroup())
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(labels).toEqual(['The brain', 'The people', 'Population · 1,000']);
    expect(screen.getByTestId('brain-view')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'The brain' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('ships the honesty label — a simulation, never a claimed measurement', () => {
    render(room());
    const brain = screen.getByTestId('brain-view');
    expect(brain.dataset.mode).toBe('simulated');
    expect(within(brain).getByText(/predicted cortical response · simulated/i)).toBeInTheDocument();
    expect(within(brain).getByText(/a sketch, not a measurement/i)).toBeInTheDocument();
  });

  it('plays the concept as the stimulus beside the brain (no video in the dock)', () => {
    render(room());
    const brain = screen.getByTestId('brain-view');
    // The text stimulus stands in for the video: the concept's own words, on the scan clock.
    expect(within(brain).getByTestId('brain-stimulus-text')).toBeInTheDocument();
    expect(within(brain).queryByTestId('brain-stimulus-video')).toBeNull();
    expect(within(brain).getByText(/haemodynamic lag/i)).toBeInTheDocument();
  });

  it('mounts the 3D cortical surface as the hero, seeded off the focus', async () => {
    render(room());
    const brain = screen.getByTestId('brain-view');
    // The surface is the object — a thumbnail-sized diagram is what got rejected twice.
    expect(within(brain).getByTestId('brain-surface')).toBeInTheDocument();
    const canvas = await within(brain).findByTestId('cortex-canvas');
    expect(canvas).toBeInTheDocument();
    // It is a real hemisphere in a real projection, and the figure says which.
    expect(within(brain).getByText(/left hemisphere · lateral/i)).toBeInTheDocument();
  });

  it('keeps the brain OUT of the embedded Room (video Read / room drawer), landing on the people', () => {
    render(room({ embedded: true }));
    const labels = within(scaleGroup())
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(labels).toEqual(['The people', 'Population · 1,000']);
    expect(screen.queryByTestId('brain-view')).toBeNull();
    expect(screen.getByRole('button', { name: 'The people' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('swaps to the people and back to the brain on the toggle', () => {
    render(room());
    fireEvent.click(screen.getByRole('button', { name: 'The people' }));
    expect(screen.queryByTestId('brain-view')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'The brain' }));
    expect(screen.getByTestId('brain-view')).toBeInTheDocument();
  });

  it('renders the same first frame for the same focus (deterministic — SSR/hydration safe)', () => {
    // Snapshot BEFORE unmount — cleanup() empties the container it rendered into.
    const { container: a } = render(room());
    const first = a.querySelector('[data-testid="brain-view"]')!.innerHTML;
    cleanup();
    const { container: b } = render(room());
    const second = b.querySelector('[data-testid="brain-view"]')!.innerHTML;
    expect(first).toBe(second);
    // A DIFFERENT focus must produce a different sim (the seed actually feeds the render).
    cleanup();
    const { container: c } = render(room({ focusId: 'h2' }));
    expect(c.querySelector('[data-testid="brain-view"]')!.innerHTML).not.toBe(first);
  });

  it('reads the room honestly: a weak concept blames the drift, a strong one does not', () => {
    const { rerender } = render(room({ fraction: '2/10 stop' }));
    expect(screen.getByText(/default network is winning|attention collapses/i)).toBeInTheDocument();
    rerender(room({ fraction: '9/10 stop' }));
    expect(screen.getByText(/the room keeps watching/i)).toBeInTheDocument();
  });
});
