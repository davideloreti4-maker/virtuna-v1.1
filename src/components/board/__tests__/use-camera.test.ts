import { describe, it, expect } from 'vitest';
import {
  computeFitCamera,
  computeZoomAtPointer,
  parseCameraSearchParams,
  serializeCamera,
  clampScale,
} from '../use-camera';
import { CAMERA_MIN_SCALE, CAMERA_MAX_SCALE } from '../board-constants';

describe('computeFitCamera', () => {
  it('Test 1: fits a rect inside the viewport with margin, clamped to MIN/MAX scale', () => {
    const camera = computeFitCamera(
      { x: 0, y: 0, width: 1000, height: 500 },
      { width: 800, height: 600 },
    );
    // Scale should be clamped to valid range
    expect(camera.scale).toBeGreaterThanOrEqual(CAMERA_MIN_SCALE);
    expect(camera.scale).toBeLessThanOrEqual(CAMERA_MAX_SCALE);
    // Scale should fit 1000px in 800-96=704px available width OR 500px in 600-96=504px
    // min(704/1000, 504/500) = min(0.704, 1.008) = 0.704
    expect(camera.scale).toBeCloseTo(0.704, 2);
  });

  it('Test 2: centers the target rect — midpoint maps to viewport midpoint', () => {
    const target = { x: 0, y: 0, width: 1000, height: 500 };
    const viewport = { width: 800, height: 600 };
    const camera = computeFitCamera(target, viewport);
    // World midpoint of target: (500, 250)
    // Mapped to screen: (500 * scale + camera.x, 250 * scale + camera.y)
    // Should equal viewport midpoint: (400, 300)
    const screenMidX = target.width / 2 * camera.scale + camera.x;
    const screenMidY = target.height / 2 * camera.scale + camera.y;
    expect(screenMidX).toBeCloseTo(viewport.width / 2, 1);
    expect(screenMidY).toBeCloseTo(viewport.height / 2, 1);
  });
});

describe('computeZoomAtPointer', () => {
  it('Test 3: zooms in (newScale > 1) when deltaY is negative, preserving world point under pointer', () => {
    const camera = { scale: 1, x: 0, y: 0 };
    const pointer = { x: 400, y: 300 };
    const result = computeZoomAtPointer(camera, pointer, -100);
    expect(result.scale).toBeGreaterThan(1);
    // The world point under the pointer before and after should be the same
    const worldBefore = {
      x: (pointer.x - camera.x) / camera.scale,
      y: (pointer.y - camera.y) / camera.scale,
    };
    const worldAfter = {
      x: (pointer.x - result.x) / result.scale,
      y: (pointer.y - result.y) / result.scale,
    };
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 0);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 0);
  });

  it('Test 4: clamps to CAMERA_MIN_SCALE and CAMERA_MAX_SCALE', () => {
    const camera = { scale: 0.21, x: 0, y: 0 };
    const pointer = { x: 400, y: 300 };
    // Zoom out past min
    const zoomedOut = computeZoomAtPointer(camera, pointer, 100);
    expect(zoomedOut.scale).toBeGreaterThanOrEqual(CAMERA_MIN_SCALE);

    // Zoom in past max from near-max
    const cameraMax = { scale: 3.99, x: 0, y: 0 };
    const zoomedIn = computeZoomAtPointer(cameraMax, pointer, -100);
    expect(zoomedIn.scale).toBeLessThanOrEqual(CAMERA_MAX_SCALE);
  });
});

describe('parseCameraSearchParams', () => {
  it('Test 5: parses valid focus + zoom', () => {
    const result = parseCameraSearchParams('?focus=audience&zoom=2.4');
    expect(result.preset).toBe('audience');
    expect(result.zoom).toBeCloseTo(2.4, 2);
  });

  it('Test 5b: unknown preset returns null', () => {
    const result = parseCameraSearchParams('?focus=unknown&zoom=1.0');
    expect(result.preset).toBeNull();
  });

  it('Test 6: clamps zoom to MAX_SCALE', () => {
    const result = parseCameraSearchParams('?focus=audience&zoom=99999');
    expect(result.zoom).toBe(CAMERA_MAX_SCALE);
  });

  it('Test 7: rejects XSS preset', () => {
    const result = parseCameraSearchParams('?focus=<script>');
    expect(result.preset).toBeNull();
  });

  it('Test 7b: rejects javascript: preset', () => {
    const result = parseCameraSearchParams('?focus=javascript:alert(1)');
    expect(result.preset).toBeNull();
  });
});

describe('serializeCamera', () => {
  it('Test 8: serializes preset and zoom to query string', () => {
    const result = serializeCamera({ preset: 'audience', zoom: 2.4 });
    expect(result).toBe('focus=audience&zoom=2.40');
  });

  it('Test 8b: serializes null preset without focus param', () => {
    const result = serializeCamera({ preset: null, zoom: 1.0 });
    expect(result).toBe('zoom=1.00');
  });
});
