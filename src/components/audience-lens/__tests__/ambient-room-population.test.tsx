/** @vitest-environment happy-dom */
/**
 * AmbientRoom — the Population·1,000 view has TWO honest data modes (Audience Sim v2 Stage 2).
 *
 * With a real `population` aggregate it shows a GENUINE 1,000-individual projection (headline
 * counts + a per-segment "who it lands with" split the 10's rollup cannot produce); without one
 * it falls back to the prior honest-lean rollup of the 10 ("modeled from your N"). This locks the
 * upgrade so a future change can't silently drop the real numbers back to the rollup.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AmbientRoom } from '../AmbientRoom';
import type { PopulationAggregate } from '@/lib/audience/population';

afterEach(cleanup);

// Two nodes: 1 stop / 1 scroll → the rollup fallback would read ~500/500. The aggregate below
// reads 640/360, so the headline distinguishes real mode from the fallback.
const flatPersonas = [
  { archetype: 'lurker', verdict: 'scroll' as const, quote: 'not for me' },
  { archetype: 'niche_deep_buyer', verdict: 'stop' as const, quote: 'love this' },
];

const population: PopulationAggregate = {
  total: 1000,
  stop: 640,
  scroll: 360,
  stopPct: 64,
  segments: [
    { archetype: 'lurker', displayName: 'Dopamine Scrollers', share: 0.6, total: 600, stop: 480, stopPct: 80 },
    { archetype: 'niche_deep_buyer', displayName: 'Frame-by-frame editors', share: 0.4, total: 400, stop: 160, stopPct: 40 },
  ],
  reasons: [{ reason: 'strong-hook', count: 480 }, { reason: 'interest', count: 160 }],
};

function renderRoom(pop?: PopulationAggregate) {
  return render(
    <AmbientRoom
      reducedMotion
      conceptText="I zipped open my wall like a tent"
      fraction="6/10 stop"
      flatPersonas={flatPersonas}
      population={pop}
    />,
  );
}

function goToPopulation() {
  fireEvent.click(screen.getByRole('button', { name: /Population/i }));
}

describe('AmbientRoom Population view — real projection vs rollup fallback', () => {
  it('shows the REAL projection numbers + per-segment split when an aggregate is present', () => {
    renderRoom(population);
    goToPopulation();

    // Headline stay/bounce come from the aggregate (640/360), not the 2-node rollup (~500/500).
    expect(screen.getByText('640')).toBeTruthy();
    expect(screen.getByText('360')).toBeTruthy();
    // The honesty framing — a projection, not 1,000 replies.
    expect(screen.getByText(/sampled from your audience · a projection/i)).toBeTruthy();
    // The Stage-2 differentiation: WHICH segments this lands with, by real stop rate.
    expect(screen.getByText(/Who it lands with/i)).toBeTruthy();
    expect(screen.getByText('Dopamine Scrollers')).toBeTruthy();
    expect(screen.getByText('Frame-by-frame editors')).toBeTruthy();
    expect(screen.getByText('80%')).toBeTruthy();
    expect(screen.getByText('40%')).toBeTruthy();
  });

  it('falls back to the honest-lean rollup (no segment split, "modeled from your N") when absent', () => {
    renderRoom(undefined);
    goToPopulation();

    expect(screen.queryByText(/Who it lands with/i)).toBeNull();
    expect(screen.getByText(/modeled from your/i)).toBeTruthy();
  });
});

// ── §3.2 — population counts format under ONE pinned locale ──
// A bare `toLocaleString()` (no locale arg) renders "1.000" under de-DE / most of the EU, colliding
// with the hardcoded "1,000" tab label + honesty copy: two formatters for one number that disagree
// by locale (the #306 family — the same number stated twice from sources that can diverge). Every
// population count must pin the locale so it reads identically everywhere the user is. Comment-
// stripped so a mention in prose can't satisfy the guard.
describe('AmbientRoom / PopulationSwarm — §3.2 pinned-locale population counts', () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  it('never uses a locale-dependent toLocaleString() for a population count', () => {
    for (const f of ['AmbientRoom.tsx', 'PopulationSwarm.tsx']) {
      const src = strip(readFileSync(join(process.cwd(), 'src/components/audience-lens', f), 'utf8'));
      const bare = src.match(/\.toLocaleString\(\s*\)/g) || [];
      expect(bare, `${f} has a locale-dependent toLocaleString() — pin 'en-US'`).toEqual([]);
    }
  });
});
