/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import {
  Delta,
  FrameHero,
  StatTile,
  StatTileRow,
  FrameTabs,
  FrameTabPanel,
  DataTable,
  MiniSparkline,
  PersonaGraph,
  TrendChart,
  KeyframeImage,
  resolveKeyframeUrl,
  type PersonaNode,
  type KeyframeSegmentLike,
} from '../index';

describe('Delta', () => {
  it('renders an up arrow + success tone for positive values', () => {
    render(<Delta value={6} suffix="%" />);
    const el = screen.getByTestId('delta');
    expect(el.className).toContain('text-success');
    expect(el).toHaveTextContent('6%');
  });

  it('renders error tone for negative values', () => {
    render(<Delta value={-3} />);
    expect(screen.getByTestId('delta').className).toContain('text-error');
  });

  it('inverts polarity so down reads good', () => {
    render(<Delta value={-3} invert />);
    expect(screen.getByTestId('delta').className).toContain('text-success');
  });

  it('renders nothing for zero by default', () => {
    render(<Delta value={0} />);
    expect(screen.queryByTestId('delta')).toBeNull();
  });
});

describe('FrameHero', () => {
  it('renders label, value, unit', () => {
    render(<FrameHero label="Virality score" value={87} unit="/100" />);
    const hero = screen.getByTestId('frame-hero');
    expect(hero).toHaveTextContent('Virality score');
    expect(hero).toHaveTextContent('87');
    expect(hero).toHaveTextContent('/100');
  });

  it('uses the children slot as the hero visual when provided', () => {
    render(
      <FrameHero label="Audience">
        <div data-testid="hero-visual">graph</div>
      </FrameHero>,
    );
    expect(screen.getByTestId('hero-visual')).toBeTruthy();
  });
});

describe('StatTile / StatTileRow', () => {
  it('renders a tile with value + unit', () => {
    render(<StatTile k="Share" v="72" u="%" />);
    const t = screen.getByTestId('stat-tile');
    expect(t).toHaveTextContent('Share');
    expect(t).toHaveTextContent('72');
  });

  it('renders one tile per datum', () => {
    render(
      <StatTileRow
        tiles={[
          { k: 'A', v: '1' },
          { k: 'B', v: '2' },
          { k: 'C', v: '3' },
        ]}
      />,
    );
    expect(screen.getAllByTestId('stat-tile')).toHaveLength(3);
  });
});

describe('FrameTabs', () => {
  it('renders a trigger per tab and the default panel', () => {
    render(
      <FrameTabs
        tabs={[
          { value: 'a', label: 'Breakdown' },
          { value: 'b', label: 'Distribution' },
        ]}
      >
        <FrameTabPanel value="a">
          <span>panel-a</span>
        </FrameTabPanel>
        <FrameTabPanel value="b">
          <span>panel-b</span>
        </FrameTabPanel>
      </FrameTabs>,
    );
    expect(screen.getByText('Breakdown')).toBeTruthy();
    expect(screen.getByText('Distribution')).toBeTruthy();
    expect(screen.getByText('panel-a')).toBeTruthy();
  });
});

describe('DataTable', () => {
  it('renders header labels and a row per datum', () => {
    render(
      <DataTable
        columns={[
          { key: 'name', label: 'Persona' },
          { key: 'wt', label: 'Watch', align: 'right' },
        ]}
        rows={[
          { name: 'Skeptic', wt: '41%' },
          { name: 'Fan', wt: '88%' },
        ]}
        rowKey={(r) => r.name}
      />,
    );
    expect(screen.getByTestId('data-table')).toHaveTextContent('Persona');
    expect(screen.getAllByTestId('data-row')).toHaveLength(2);
  });
});

describe('MiniSparkline', () => {
  it('renders an svg path for >=2 points', () => {
    const { container } = render(<MiniSparkline points={[1, 4, 2, 8, 5]} />);
    expect(container.querySelector('path')).toBeTruthy();
  });
  it('renders nothing for <2 points', () => {
    const { container } = render(<MiniSparkline points={[1]} />);
    expect(container.querySelector('svg')).toBeNull();
  });
});

describe('PersonaGraph', () => {
  const personas: PersonaNode[] = [
    { id: 'p1', label: 'Skeptic', weight: 0.3, watchThrough: 0.41, segment: 'Cold', tone: 'accent', dropAt: '0:08' },
    { id: 'p2', label: 'Fan', weight: 0.8, watchThrough: 0.88, segment: 'Warm' },
    { id: 'p3', label: 'Lurker', weight: 0.5, watchThrough: 0.6 },
  ];
  it('renders a node circle per persona plus an sr-only mirror list', () => {
    render(<PersonaGraph personas={personas} reducedMotion />);
    const graph = screen.getByTestId('persona-graph');
    // 70 starfield + 3 persona nodes = 73 circles
    expect(graph.querySelectorAll('circle').length).toBeGreaterThanOrEqual(73);
    expect(within(graph).getByText(/Skeptic: 41% watch-through/)).toBeTruthy();
  });

  it('exposes an accessible labelled image role for the cloud', () => {
    render(<PersonaGraph personas={personas} reducedMotion />);
    const graph = screen.getByTestId('persona-graph');
    const svg = graph.querySelector('svg[role="img"]');
    expect(svg).toBeTruthy();
    expect(svg!.getAttribute('aria-label')).toMatch(/3 .*personas/);
  });

  it('gates the node pulse on reduced motion', () => {
    // Default: the <animate> pulse is present (one per persona node).
    const { unmount } = render(<PersonaGraph personas={personas} />);
    expect(
      screen.getByTestId('persona-graph').querySelectorAll('animate').length,
    ).toBe(personas.length);
    unmount();
    // reducedMotion: every <animate> is stripped (no pulse).
    render(<PersonaGraph personas={personas} reducedMotion />);
    expect(
      screen.getByTestId('persona-graph').querySelectorAll('animate').length,
    ).toBe(0);
  });
});

describe('TrendChart', () => {
  it('mounts without throwing', () => {
    render(
      <TrendChart
        data={[
          { x: 0, current: 10, previous: 8 },
          { x: 1, current: 14, previous: 9 },
        ]}
      />,
    );
    expect(screen.getByTestId('trend-chart')).toBeTruthy();
  });
});

describe('resolveKeyframeUrl', () => {
  const segs: KeyframeSegmentLike[] = [
    { idx: 0, t_start: 0, t_end: 3 },
    { idx: 1, t_start: 3, t_end: 6, keyframe_uri: 'seg1-fallback' },
    { idx: 2, t_start: 6, t_end: 9 },
  ];
  const strips = { 0: 'url0', 2: 'url2' };

  it("'first' returns the earliest available frame", () => {
    expect(resolveKeyframeUrl(strips, segs, 'first')).toBe('url0');
  });
  it('maps a millisecond moment to the segment that contains it', () => {
    expect(resolveKeyframeUrl(strips, segs, 7000)).toBe('url2'); // 7s → seg idx2
  });
  it('falls back to a segment keyframe_uri when no filmstrip url', () => {
    expect(resolveKeyframeUrl(strips, segs, 4000)).toBe('seg1-fallback'); // 4s → seg idx1
  });
  it('returns null when there are no frames at all', () => {
    expect(resolveKeyframeUrl({}, [], 1000)).toBeNull();
  });
  it('uses nearest-midpoint when no segment contains the moment', () => {
    expect(resolveKeyframeUrl(strips, segs, 99000)).toBe('url2'); // past end → nearest = seg2
  });
});

describe('KeyframeImage', () => {
  it('renders a filmic fallback (no <img>) when src is absent', () => {
    const { container } = render(<KeyframeImage ratio="wide" timecode="0:03" />);
    expect(screen.getByTestId('keyframe')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByTestId('keyframe')).toHaveTextContent('0:03');
  });
  it('renders the <img> when src is provided', () => {
    const { container } = render(<KeyframeImage src="https://x/y.jpg" alt="frame" />);
    expect(container.querySelector('img')).toBeTruthy();
  });
});
