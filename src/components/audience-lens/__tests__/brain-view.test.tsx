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

  it('ships the honesty label — modeled from real votes, never a claimed measurement', () => {
    render(room());
    const brain = screen.getByTestId('brain-view');
    expect(brain.dataset.mode).toBe('simulated');
    expect(within(brain).getByText(/predicted cortex/i)).toBeInTheDocument();
    expect(within(brain).getByText(/not a brain measurement/i)).toBeInTheDocument();
  });

  it('the response is driven by the ROOM, and the specimen paints in both modes', () => {
    // The specimen was briefly benched at RESTING_BOLD in the text mode, because the simulated
    // drive was wobbled by hash(seedKey) — so its regional pattern was arbitrary and painting it
    // was a lie. The fix was to delete the HASH (cortex-sim), not the MAP: the response is now a
    // pure function of the room's real stop-ratio, so the figure can honestly paint again. The
    // instrument that reports it comes back with it.
    render(room());
    const brain = screen.getByTestId('brain-view');
    expect(within(brain).queryByText(/at rest/i)).toBeNull();
    expect(within(brain).getByText(/haemodynamic lag/i)).toBeInTheDocument();
    expect(within(brain).getByTestId('brain-colorbar-marker')).toBeInTheDocument();
  });

  it('INSTANT: the instrument is a NAMED METRIC on real votes, not a contingency table', () => {
    render(room());
    const brain = screen.getByTestId('brain-view');
    const readout = within(brain).getByTestId('brain-readout');
    // The hero: a display number, from the FOCUS's own "6/10 stop" aggregate — not the node count.
    // The card must never disagree with the Room it sits inside (the other two scales show 6/10).
    expect(within(readout).getByText('Attention hold')).toBeInTheDocument();
    // Twice, deliberately: the visible line and its screen-reader twin.
    expect(within(readout).getAllByText(/6 of 10 stopped/).length).toBeGreaterThanOrEqual(1);
    // The receipt is VERBATIM and attributed — the tough_crowd persona actually scrolled.
    expect(within(readout).getByText(/too preachy/)).toBeInTheDocument();
  });

  it('INSTANT: no batch → NO scale. A bar with one point on it is not a bar', () => {
    render(room()); // the default fixture has no siblings
    const readout = within(screen.getByTestId('brain-view')).getByTestId('brain-readout');
    expect(within(readout).queryByTestId('brain-readout-scale')).toBeNull();
  });

  it('INSTANT: a real batch IS a real scale — "#N of your M", never an invented threshold', () => {
    render(
      room({
        focusId: 'h2',
        fraction: '6/10 stop',
        // With a batch, the Room lands on the ranked-compare overview first (that IS the product:
        // "how the room ranked your N"). A targeted entry drills straight into the focused card,
        // which is where the brain scale — and therefore the scale bar — actually lives.
        initialCompareOpen: false,
        siblings: [
          { id: 'h1', conceptText: 'a', fraction: '9/10 stop' },
          { id: 'h2', conceptText: 'b', fraction: '6/10 stop' },
          { id: 'h3', conceptText: 'c', fraction: '2/10 stop' },
        ],
      }),
    );
    const readout = within(screen.getByTestId('brain-view')).getByTestId('brain-readout');
    const scaleEl = within(readout).getByTestId('brain-readout-scale');
    // 6/10 sits second of three. This is the reference's SCAN marker, on the one benchmark we
    // actually have — the batch the composer just generated.
    expect(within(scaleEl).getByText(/#2 of your 3/)).toBeInTheDocument();
  });

  it('mounts the 3D cortical surface as the hero, seeded off the focus', async () => {
    render(room());
    const brain = screen.getByTestId('brain-view');
    // The surface is the object — a thumbnail-sized diagram is what got rejected twice.
    expect(within(brain).getByTestId('brain-surface')).toBeInTheDocument();
    const canvas = await within(brain).findByTestId('cortex-canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('does NOT claim a fixed projection — the specimen is yours to turn', () => {
    render(room());
    const brain = screen.getByTestId('brain-view');
    // This used to assert the figure said "left hemisphere · lateral", and that label was false
    // TWICE OVER by the time it was deleted:
    //   • the shipped mesh is a WHOLE BRAIN — both hemispheres and the cerebellum (cortex-field's own
    //     test asserts the anchors are bilateral, precisely because half the specimen would otherwise
    //     go dark the moment it turned). "Left hemisphere" described the retired procedural mesh.
    //   • the specimen now has OrbitControls, so the projection is whatever the viewer last turned it
    //     to. A caption claiming "lateral" becomes a lie on the first drag.
    // A claim the UI cannot keep is worse than no claim, so it is gone — and stays gone.
    expect(within(brain).queryByText(/left hemisphere/i)).toBeNull();
    expect(within(brain).queryByText(/lateral/i)).toBeNull();
  });

  it('does NOT ship a fake `Inflated` view — it is cut until the geometry is real', () => {
    render(room());
    // TRIBE's Normal | Inflated toggle is their best idea and we want it. It was BUILT (a Taubin
    // inflation baked as a glTF morph target, scripts/build-inflated-mesh.mjs) and then CUT, because
    // our asset cannot carry it: the mesh is a DECIMATED WHOLE BRAIN, its sulci are full of slivers,
    // and smoothing turns them inside out — 2.3% of triangles inverted after 20 steps, and a
    // back-facing triangle is culled, so the inflated brain rendered as a perforated shell.
    //
    // It passed every statistic it was gated on (roughness fell 80%, the shape held to 1.00) and was
    // obviously broken on sight. Hence this test: an inflated toggle must not come back until it is
    // driven by a REAL inflated surface. FreeSurfer emits one (lh/rh.inflated) alongside the surface
    // this mesh was reconstructed from — source that, and the toggle becomes trivial and correct.
    expect(screen.queryByTestId('brain-inflate-toggle')).toBeNull();
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

  it('SCRIPT: scopes the claim to the opening beat — the room never voted on the rest', () => {
    // ScriptCardBlockSchema, in as many words: "band/fraction describe the OPENER beat only — NOT
    // the full-watch retention", and the per-beat retentionMarker is "prose, never a numeric score".
    // So "6 of 10 stopped" on a script is a verdict on the first three seconds. Unscoped, a creator
    // reads it as a verdict on their whole script.
    render(room({ kindLabel: 'Script' }));
    const readout = within(screen.getByTestId('brain-view')).getByTestId('brain-readout');
    expect(within(readout).getByText(/opening beat/i)).toBeInTheDocument();
  });

  it('does NOT scope the claim on a hook — the hook IS the whole stimulus', () => {
    render(room({ kindLabel: 'Hook' }));
    const readout = within(screen.getByTestId('brain-view')).getByTestId('brain-readout');
    expect(within(readout).queryByText(/opening beat/i)).toBeNull();
  });

  it('THE COUNTERFACTUAL: acts on the objection it is SHOWING, not on a different one', async () => {
    const onRewrite = vi.fn().mockResolvedValue(undefined);
    render(room({ canRewrite: true, onRewrite }));
    const readout = within(screen.getByTestId('brain-view')).getByTestId('brain-readout');
    // The lever is the verbatim the card just quoted. The card must never recommend one thing and
    // act on another — so it is steered by the SAME objection the readout displays.
    expect(within(readout).getByText(/too preachy/)).toBeInTheDocument();
    fireEvent.click(within(readout).getByTestId('brain-rewrite'));
    expect(onRewrite).toHaveBeenCalledWith('too preachy');
  });

  it('THE COUNTERFACTUAL: no lever without a real objection to steer by', () => {
    // A room where the scroller said NOTHING. There is no quote, so there is nothing honest to
    // steer a rewrite by — and the CTA must not invent a direction.
    render(
      room({
        canRewrite: true,
        onRewrite: vi.fn(),
        flatPersonas: [
          { archetype: 'high_engager', verdict: 'stop' as const, quote: 'got me' },
          { archetype: 'tough_crowd', verdict: 'scroll' as const, quote: '' },
        ],
      }),
    );
    const readout = within(screen.getByTestId('brain-view')).getByTestId('brain-readout');
    expect(within(readout).queryByTestId('brain-rewrite')).toBeNull();
  });

  it('THE COUNTERFACTUAL: gated off when the skill cannot be reseeded (Remix)', () => {
    render(room({ canRewrite: false, onRewrite: vi.fn() }));
    const readout = within(screen.getByTestId('brain-view')).getByTestId('brain-readout');
    expect(within(readout).queryByTestId('brain-rewrite')).toBeNull();
  });

  it('reads the room honestly: the verdict follows the real vote, not the seeded cortex', () => {
    // INSTANT's verdict is now read off the personas' actual votes. It used to be read off the
    // simulated network response — which is a function of (stopRatio, hash(seedKey)), so the card
    // could narrate a "drift" that no one in the room had reported.
    const { rerender } = render(room({ fraction: '2/10 stop' }));
    expect(screen.getByText(/the room walks, and it walks together/i)).toBeInTheDocument();
    rerender(room({ fraction: '9/10 stop' }));
    expect(screen.getByText(/the room stops, and it stops together/i)).toBeInTheDocument();
  });
});
