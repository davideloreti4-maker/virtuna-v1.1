/**
 * useTestRunStages — the in-flight Test run's 3-step progress spine, shared by BOTH Test entry
 * points so they read identically: the in-thread upload field (input-request-block.tsx) AND the
 * top-level composer's Test send (composer.tsx). Both run the FULL /api/analyze Max pipeline
 * (~2 min) then seal the video-test-card in the open thread — no navigate-out — so both show the
 * SAME spine (the SAME plan names as the flagship /analyze skeleton) instead of a bare spinner.
 *
 * Derived from what the caller really knows (no reveal signals), so elapsed time carries the spine:
 *  - staging (before analyzing: the clip is uploading) → the clock hasn't started: step 1 active.
 *  - analyzing → elapsed floors advance steps 1→2→3 (the ~2-minute stretch).
 *  - carding  → the pipeline finished, the card adapter is running: every step done. Building the
 *    card is a sub-second tail — a step that flashes is worse than no step.
 * Advancing on time is an estimate, not an invention (the pipeline order is fixed + known); no
 * number, picture or reaction is fabricated by it.
 */

import { useEffect, useState } from 'react';
import { type StageState } from './progress-checklist';
import { SKILL_RUN_META } from './run-capsule';

/** Per-step elapsed floors (mirrors reading-skeleton.tsx STEP_FALLBACK_MS). */
const TEST_STEP_FALLBACK_MS = [12_000, 75_000] as const;

export function useTestRunStages(opts: { analyzing: boolean; carding: boolean }): StageState[] {
  const { analyzing, carding } = opts;
  const plan = SKILL_RUN_META.test!.plan;
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!analyzing) {
      // Idle (a fresh submit resets the clock). `carding` keeps the finished timestamp — the
      // spine is all-done there and the elapsed value no longer matters.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!carding) setStartedAt(null);
      return;
    }
    setStartedAt((t) => t ?? Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [analyzing, carding]);

  const elapsed = startedAt == null ? 0 : now - startedAt;
  const gotVideo = carding || (analyzing && elapsed > TEST_STEP_FALLBACK_MS[0]);
  const footageRead = carding || (analyzing && elapsed > TEST_STEP_FALLBACK_MS[1]);

  return [
    { name: plan[0]!, status: gotVideo ? 'done' : 'active' },
    { name: plan[1]!, status: footageRead ? 'done' : gotVideo ? 'active' : 'pending' },
    { name: plan[2]!, status: carding ? 'done' : footageRead ? 'active' : 'pending' },
  ];
}
