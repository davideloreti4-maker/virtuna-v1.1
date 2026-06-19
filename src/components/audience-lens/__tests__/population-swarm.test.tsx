import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PersonaNode } from '@/components/board/_kit';
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
