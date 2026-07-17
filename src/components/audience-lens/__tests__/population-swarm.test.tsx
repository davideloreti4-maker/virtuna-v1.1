/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PersonaNode } from '@/components/board/_kit';
import type { PopulationAggregate } from '@/lib/audience/population';
import { weightedRollup } from '../lens-derive';
import { PopulationSwarm } from '../PopulationSwarm';

afterEach(cleanup);

/**
 * Fixture: 10 archetypes (mirrors buildPersonaNodes output — the only input the swarm
 * consumes). Varied weight + watchThrough; one low-watchThrough accent node = worst cluster.
 */
function tenNodes(): PersonaNode[] {
  return [
    { id: 'p1', label: 'Core fans', weight: 0.95, watchThrough: 0.82 },
    { id: 'p2', label: 'Niche regulars', weight: 0.8, watchThrough: 0.71 },
    { id: 'p3', label: 'New viewers', weight: 0.65, watchThrough: 0.58 },
    { id: 'p4', label: 'Cross-niche', weight: 0.6, watchThrough: 0.49 },
    { id: 'p5', label: 'Loyalists', weight: 0.55, watchThrough: 0.66 },
    { id: 'p6', label: 'Skimmers', weight: 0.5, watchThrough: 0.38 },
    { id: 'p7', label: 'Skeptics', weight: 0.45, watchThrough: 0.31 },
    { id: 'p8', label: 'Bouncers', weight: 0.4, watchThrough: 0.22, tone: 'accent' },
    { id: 'p9', label: 'Drifters', weight: 0.35, watchThrough: 0.44 },
    { id: 'p10', label: 'Lurkers', weight: 0.3, watchThrough: 0.53, quote: 'Lost me at the hook.' },
  ];
}

const SEED = 1337;

describe('PopulationSwarm', () => {
  it('Test 1 — deterministic render: same nodes+seed → identical dot geometry', () => {
    const nodes = tenNodes();
    const { container: a } = render(<PopulationSwarm nodes={nodes} seed={SEED} reducedMotion />);
    const dotsA = Array.from(a.querySelectorAll('[data-dot]')).map(
      (c) => `${c.getAttribute('cx')},${c.getAttribute('cy')},${c.getAttribute('fill')}`,
    );
    cleanup();
    const { container: b } = render(<PopulationSwarm nodes={nodes} seed={SEED} reducedMotion />);
    const dotsB = Array.from(b.querySelectorAll('[data-dot]')).map(
      (c) => `${c.getAttribute('cx')},${c.getAttribute('cy')},${c.getAttribute('fill')}`,
    );
    expect(dotsA.length).toBeGreaterThan(0);
    expect(dotsA).toEqual(dotsB);
  });

  it('Test 2 — counter identity: rendered live counters === weightedRollup(nodes)', () => {
    const nodes = tenNodes();
    const roll = weightedRollup(nodes);
    const { getByTestId } = render(<PopulationSwarm nodes={nodes} seed={SEED} reducedMotion />);
    expect(getByTestId('population-stop-count').textContent).toContain(String(roll.stop));
    expect(getByTestId('population-scroll-count').textContent).toContain(String(roll.scroll));
  });

  it('Test 3 — a11y mirror: sr-only aggregate + archetype breakdown always present', () => {
    const nodes = tenNodes();
    // Render with motion ON to prove the mirror is independent of motion state.
    const { getByTestId, queryByTestId } = render(
      <PopulationSwarm nodes={nodes} seed={SEED} reducedMotion={false} />,
    );
    const mirror = getByTestId('population-sr-mirror');
    expect(mirror).toBeTruthy();
    expect(mirror.className).toContain('sr-only');
    expect(mirror.textContent).toMatch(/\d+ of \d+/);
    // Archetype breakdown drill always present (the v1 drill path — D-01).
    expect(queryByTestId('population-breakdown')).toBeTruthy();
  });

  it('Test 5 — real projection: a `population` aggregate drives counters + label + breakdown, NOT the rollup', () => {
    const nodes = tenNodes();
    const roll = weightedRollup(nodes);
    // A REAL aggregate whose numbers cannot coincide with the rollup of these nodes: a
    // deliberately different stop count + a per-segment split the 10's single verdict can't make.
    const population: PopulationAggregate = {
      total: 1000,
      stop: 347,
      scroll: 653,
      stopPct: 35,
      segments: [
        { archetype: 'community_validator', displayName: 'Community Validators', share: 0.5, total: 500, stop: 495, stopPct: 99 },
        { archetype: 'system_architect', displayName: 'System Architects', share: 0.5, total: 500, stop: 0, stopPct: 0 },
      ],
      reasons: [{ reason: 'interest', count: 347 }],
    };
    // Guard the fixture actually diverges from the rollup, else the test proves nothing.
    expect(roll.stop).not.toBe(347);

    const { getByTestId } = render(
      <PopulationSwarm nodes={nodes} population={population} seed={SEED} reducedMotion />,
    );
    // Counters show the REAL projection, not weightedRollup(nodes).
    expect(getByTestId('population-stop-count').textContent).toContain('347');
    expect(getByTestId('population-scroll-count').textContent).toContain('653');
    // The honesty label flips to the "a projection" framing.
    const swarm = getByTestId('population-swarm');
    expect(swarm.textContent).toContain('a projection');
    expect(swarm.textContent).not.toContain('instantiated from your 10 calibrated archetypes');
    // The per-segment split — the genuine distribution the rollup cannot produce — is rendered.
    const breakdown = getByTestId('population-breakdown');
    expect(breakdown.textContent).toContain('Community Validators');
    expect(breakdown.textContent).toContain('99% stopped');
    expect(breakdown.textContent).toContain('System Architects');
    expect(breakdown.textContent).toContain('0% stopped');
  });

  it('Test 6 — degrade: population.total === 0 falls back to the honest-lean rollup', () => {
    const nodes = tenNodes();
    const roll = weightedRollup(nodes);
    const empty: PopulationAggregate = {
      total: 0, stop: 0, scroll: 0, stopPct: 0, segments: [], reasons: [],
    };
    const { getByTestId } = render(
      <PopulationSwarm nodes={nodes} population={empty} seed={SEED} reducedMotion />,
    );
    // total 0 → `real` guard is null → rollup counters + the original label.
    expect(getByTestId('population-stop-count').textContent).toContain(String(roll.stop));
    expect(getByTestId('population-swarm').textContent).not.toContain('a projection');
  });

  it('Test 4 — no scoring-path touch: source imports nothing from the engine scoring path', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/components/audience-lens/PopulationSwarm.tsx'),
      'utf8',
    );
    // Strip block + line comments so prohibition notes don't trip the assertion.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/runPredictionPipeline/);
    expect(code).not.toMatch(/aggregateScores/);
    expect(code).not.toMatch(/ENGINE_VERSION/);
    expect(code).not.toMatch(/Math\.random/);
    expect(code).not.toMatch(/Date\.now/);
  });
});
