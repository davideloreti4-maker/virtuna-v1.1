/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { HeatmapPayload } from '@/lib/engine/types';

import { ThumbnailStrip } from '../thumbnail-strip';
import { makeReadingResult } from './fixtures/reading-fixture';

const SIGNED_URL =
  'https://storage.example.com/keyframes/abc123.jpg?token=signed-secret&exp=999';

/** Heatmap whose first segment carries a real (signed) keyframe_uri. */
function heatmapWithKeyframe(): HeatmapPayload {
  const hm = makeReadingResult().heatmap as HeatmapPayload;
  const segments = hm.segments.map((s, i) =>
    i === 0 ? { ...s, keyframe_uri: SIGNED_URL } : s,
  );
  return { ...hm, segments } as HeatmapPayload;
}

/** Heatmap with no resolvable keyframe (the fixture default — all null). */
function heatmapNoKeyframe(): HeatmapPayload {
  return makeReadingResult().heatmap as HeatmapPayload;
}

describe('ThumbnailStrip — static keyframe poster gated on real video (READ-03, D-03)', () => {
  it('real keyframe → one <img> with the signed src and decorative alt=""', () => {
    const { container } = render(<ThumbnailStrip heatmap={heatmapWithKeyframe()} />);
    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0]?.getAttribute('src')).toBe(SIGNED_URL);
    expect(imgs[0]?.getAttribute('alt')).toBe('');
  });

  it('no keyframe → renders nothing (no <img>, no placeholder box)', () => {
    const { container } = render(<ThumbnailStrip heatmap={heatmapNoKeyframe()} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it('null heatmap → renders nothing (gated, no crash)', () => {
    const { container } = render(<ThumbnailStrip heatmap={null} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it('on <img> onError → the img is removed (failed state, no broken box)', () => {
    const { container } = render(<ThumbnailStrip heatmap={heatmapWithKeyframe()} />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    fireEvent.error(img!);
    expect(container.querySelector('img')).toBeNull();
  });

  it('a11y: decorative alt="" raises no missing-alt violation; axe passes', async () => {
    const { container } = render(<ThumbnailStrip heatmap={heatmapWithKeyframe()} />);
    // sanity: the poster is present and decorative
    expect(screen.getByRole('presentation', { hidden: true })).toBeTruthy();
    const results = await axe(container);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(results).toHaveNoViolations();
  });
});
