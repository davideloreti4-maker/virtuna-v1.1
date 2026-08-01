/**
 * Calibration's three phases as SPINE ROW NAMES — the one thing both the route and the client
 * need to agree on.
 *
 * It lives in its own pure module for a boring but load-bearing reason: the API route emits these
 * names and the client renders them, so whichever side owned the constant would have to be
 * imported by the other. A client component importing `api/audiences/calibrate/route.ts` would
 * drag server-only code into the browser bundle; the route importing a `'use client'` component is
 * the same mistake mirrored. This module has no imports beyond a type (erased at compile), so it
 * is safe from both directions.
 *
 * Names carry NO ellipsis — that belongs to a status line, not to a step label. The `…` copy still
 * exists as STAGE_COPY in the route, which keeps emitting `status` frames alongside `stage` ones.
 */

import type { CalibrationStage } from './calibration';

export const CALIBRATION_STAGE_NAME: Record<CalibrationStage, string> = {
  scraping: 'Reading your followers',
  watching: 'Watching your top videos',
  synthesizing: 'Building your audience profile',
};

/**
 * Ordered plan, so the spine draws all three steps up front rather than revealing them one at a
 * time. Order matters twice over: the route infers "the previous phase finished" from the next one
 * starting, and it reads that neighbour out of this array.
 */
export const CALIBRATION_PLAN: string[] = [
  CALIBRATION_STAGE_NAME.scraping,
  CALIBRATION_STAGE_NAME.watching,
  CALIBRATION_STAGE_NAME.synthesizing,
];
