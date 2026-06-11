"use client";

import { useState } from "react";

import { PillChip } from "@/components/numen/pill-chip";
import { StageBlock } from "@/components/numen/stage-reveal";
import { Surface } from "@/components/numen/surface";

/**
 * KitStageDemo — client island for the showcase's stage-reveal demo (DS-07).
 *
 * Toggles a `StageBlock` so the calm reveal can be seen on the deployed build.
 * Under OS reduced-motion the StageBlock degrades to a static opacity appear
 * (handled inside the primitive via `useReducedMotion`).
 */
export function KitStageDemo() {
  const [show, setShow] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <PillChip intent="instant" onClick={() => setShow((s) => !s)}>
          {show ? "Hide stage" : "Reveal stage"}
        </PillChip>
      </div>
      <StageBlock show={show}>
        <Surface className="p-6">
          <p className="text-base text-numen-text">
            This block materialized with a calm reveal — opacity tween plus a
            high-damping spring, no overshoot.
          </p>
        </Surface>
      </StageBlock>
      <p className="text-sm text-numen-text-muted">
        Toggle OS reduced-motion: the reveal becomes a static appear with no
        slide.
      </p>
    </div>
  );
}
