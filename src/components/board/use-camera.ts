'use client';
import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CAMERA_MIN_SCALE,
  CAMERA_MAX_SCALE,
} from './board-constants';
import type { Camera, CameraPresetKey, Rect } from './board-types';

/** Cubic-out interpolation (≈ --ease-out-quart but close enough). */
export function easeOutQuart(t: number): number {
  const u = 1 - Math.max(0, Math.min(1, t));
  return 1 - u * u * u * u;
}

export function easeCameraTowards(from: Camera, to: Camera, t: number): Camera {
  const k = easeOutQuart(t);
  return {
    x: from.x + (to.x - from.x) * k,
    y: from.y + (to.y - from.y) * k,
    scale: from.scale + (to.scale - from.scale) * k,
  };
}

const VIEWPORT_MARGIN = 48; // px of breathing room around fit-to-content
const ZOOM_STEP_IN = 1.05;
const ZOOM_STEP_OUT = 0.95;
const VALID_PRESET_KEYS: readonly CameraPresetKey[] = [
  'overview', 'engine', 'verdict', 'audience', 'content-analysis',
];

export function clampScale(s: number): number {
  return Math.max(CAMERA_MIN_SCALE, Math.min(CAMERA_MAX_SCALE, s));
}

/** Compute a camera transform that fits `target` rect inside `viewport`. */
export function computeFitCamera(
  target: Rect,
  viewport: { width: number; height: number },
): Camera {
  const availableW = Math.max(1, viewport.width - VIEWPORT_MARGIN * 2);
  const availableH = Math.max(1, viewport.height - VIEWPORT_MARGIN * 2);
  const scale = clampScale(
    Math.min(availableW / target.width, availableH / target.height),
  );
  const x = viewport.width / 2 - (target.x + target.width / 2) * scale;
  const y = viewport.height / 2 - (target.y + target.height / 2) * scale;
  return { x, y, scale };
}

/** Zoom around the pointer position (RESEARCH Pattern 2). */
export function computeZoomAtPointer(
  camera: Camera,
  pointerScreen: { x: number; y: number },
  deltaY: number,
): Camera {
  const oldScale = camera.scale;
  const mousePointTo = {
    x: (pointerScreen.x - camera.x) / oldScale,
    y: (pointerScreen.y - camera.y) / oldScale,
  };
  const step = deltaY > 0 ? ZOOM_STEP_OUT : ZOOM_STEP_IN;
  const newScale = clampScale(oldScale * step);
  return {
    scale: newScale,
    x: pointerScreen.x - mousePointTo.x * newScale,
    y: pointerScreen.y - mousePointTo.y * newScale,
  };
}

export function parseCameraSearchParams(
  query: string,
): { preset: CameraPresetKey | null; zoom: number | null } {
  const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
  const rawFocus = params.get('focus');
  const rawZoom = params.get('zoom');
  const preset = (VALID_PRESET_KEYS as readonly string[]).includes(rawFocus ?? '')
    ? (rawFocus as CameraPresetKey)
    : null;
  const parsedZoom = rawZoom != null ? parseFloat(rawZoom) : NaN;
  const zoom = Number.isFinite(parsedZoom) ? clampScale(parsedZoom) : null;
  return { preset, zoom };
}

export function serializeCamera(
  state: { preset: CameraPresetKey | null; zoom: number },
): string {
  const params = new URLSearchParams();
  if (state.preset) params.set('focus', state.preset);
  params.set('zoom', state.zoom.toFixed(2));
  return params.toString();
}

/**
 * useCamera — wraps Camera state, syncs to URL via replaceState (debounced 200ms).
 * Caller passes camera + setCamera (sourced from board-store in plan 4, or
 * useState locally until plan 4 lands).
 */
export function useCamera(args: {
  camera: Camera;
  setCamera: (c: Camera) => void;
  viewport: { width: number; height: number };
  /** WR-05: true once ResizeObserver has written a real viewport (not 800×600 default). */
  viewportReady: boolean;
  activePreset: CameraPresetKey | null;
  setActivePreset: (k: CameraPresetKey | null) => void;
  reducedMotion: boolean;
  /** Live preset targets recomputed from the dynamic (auto-height) layout. */
  presetTargets: Record<string, Rect>;
}) {
  const { camera, setCamera, viewport, viewportReady, setActivePreset } = args;

  // CR-01: keep a ref to the latest camera so goToPreset always reads
  // a fresh snapshot at call time, avoiding the one-frame stale-closure
  // glitch when a pan fires mid-glide.
  const cameraRef = useRef(camera);
  useEffect(() => { cameraRef.current = camera; }, [camera]);

  // Preset targets read via a ref so goToPreset keeps a STABLE identity as the
  // layout grows. If presetTargets were a goToPreset dependency, the Board effect
  // `useEffect(() => goToPreset(activePreset), [activePreset, goToPreset])` would
  // re-fire on every content-driven reflow and snap the camera mid-stream.
  const presetTargetsRef = useRef(args.presetTargets);
  useEffect(() => { presetTargetsRef.current = args.presetTargets; }, [args.presetTargets]);

  const rafRef = useRef<number | null>(null);
  const cancelGlide = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const goToPreset = useCallback((key: CameraPresetKey) => {
    const target = presetTargetsRef.current[key];
    if (!target) return;
    const final = computeFitCamera(target, viewport);
    setActivePreset(key);

    if (args.reducedMotion) {
      // D-23: instant set; no easing, no RAF
      cancelGlide();
      setCamera(final);
      return;
    }

    cancelGlide();
    const start = { ...cameraRef.current }; // always fresh at call time (CR-01)
    const startedAt = performance.now();
    const DURATION = 300; // UI-SPEC §Animation Contract "Camera glide"
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / DURATION);
      setCamera(easeCameraTowards(start, final, t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else rafRef.current = null;
    };
    rafRef.current = requestAnimationFrame(tick);
    // camera removed from deps — read via cameraRef instead (CR-01)
  }, [setCamera, setActivePreset, viewport, args.reducedMotion, cancelGlide]);

  // Read initial camera from URL — deferred until viewport is real (WR-05).
  // Firing at 800×600 default would compute a wrong fit; guard on viewportReady.
  const appliedInitialRef = useRef(false);
  const searchParams = useSearchParams();
  useEffect(() => {
    if (!viewportReady) return; // WR-05: wait for real viewport measurement
    if (appliedInitialRef.current) return;
    appliedInitialRef.current = true;
    const { preset, zoom } = parseCameraSearchParams(searchParams.toString());
    if (preset) {
      const target = presetTargetsRef.current[preset];
      if (target) {
        const fit = computeFitCamera(target, viewport);
        setCamera(zoom != null ? { ...fit, scale: zoom } : fit);
        setActivePreset(preset);
      }
    }
    // intentionally one-shot after viewportReady: do not depend on searchParams
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportReady]);

  // NOTE: URL sync (replaceState) was moved to Board.tsx as a unified atomic
  // effect (CR-02). useCamera no longer owns URL writes.

  return { goToPreset };
}
