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
  watching: 'Watching your videos',
  synthesizing: 'Building your audience profile',
};

/**
 * The SAME three phases, named for the DESCRIBED path — a calibration with no handle behind it.
 *
 * That path is not a variant of reading an account, it is a different job: `calibrateFromScrape`
 * takes the `else` branch and runs `scrapeNiche(query)` over the description, then builds a
 * SYNTHETIC profile from whatever the niche search returned. There are no followers to read and
 * no "your top videos" to watch — the creator may not even have an account yet, which is the
 * whole reason the door exists.
 *
 * Reusing the personal names there told a describing user we were "Reading your followers" and
 * "Pulling the account and its posts" while we were doing neither. Caught on the live /welcome
 * run (2026-08-02) once onboarding put this path in front of every new account that skips the
 * handle. Same pipeline, same three boundaries — honest labels.
 */
export const CALIBRATION_STAGE_NAME_DESCRIBED: Record<CalibrationStage, string> = {
  scraping: 'Finding videos in that niche',
  watching: 'Watching what performs there',
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

export const CALIBRATION_PLAN_DESCRIBED: string[] = [
  CALIBRATION_STAGE_NAME_DESCRIBED.scraping,
  CALIBRATION_STAGE_NAME_DESCRIBED.watching,
  CALIBRATION_STAGE_NAME_DESCRIBED.synthesizing,
];

/**
 * Pick the vocabulary from the one fact that decides it: whether a handle was supplied.
 *
 * NOT `type`. The /audience/new "From a handle" door builds a TARGET audience from a real
 * account — that run genuinely is reading an account, so it takes the personal names. The
 * discriminator is the handle, which is exactly what `calibrateFromScrape` itself branches on.
 */
export function calibrationVocabulary(hasHandle: boolean): {
  names: Record<CalibrationStage, string>;
  plan: string[];
} {
  return hasHandle
    ? { names: CALIBRATION_STAGE_NAME, plan: CALIBRATION_PLAN }
    : { names: CALIBRATION_STAGE_NAME_DESCRIBED, plan: CALIBRATION_PLAN_DESCRIBED };
}
