import {
  driveFor,
  hashSeed,
  predictedBold,
  RESTING_BOLD,
  type DriveInput,
  type NetworkId,
} from "@/lib/brain/cortex-sim";
import { watchingAt } from "./curve";
import type { VideoModel } from "./types";

/**
 * The Brain panel's reading of a run: the existing model (`cortex-sim`), grounded on the run's
 * still-watching line, as four plain signals (spec §5 "Brain"). A model of attention, not a scan.
 */
export interface BrainSignal {
  id: NetworkId;
  label: string;
  /** The model's resting level for this network, 0 to 100 (the dashed line, "at rest"). */
  rest: number;
  /** `perSecond[s]`: the predicted level at second s of the clip, 0 to 100, from 0:00 to the end. */
  perSecond: number[];
}

export interface BrainTrack {
  /** Drifts the parcel borders on the surface (`CortexCanvas`); it never changes a value. */
  seed: number;
  /** What the canvas is driven with: `predictedBold(drive, t)`. */
  drive: DriveInput;
  signals: BrainSignal[];
}

/** The four signals the panel speaks about, in the order it shows them. */
const BRAIN_SIGNALS: ReadonlyArray<{ id: NetworkId; label: string }> = [
  { id: "visual", label: "Eyes" },
  { id: "dorsal_attention", label: "Focus" },
  { id: "limbic", label: "Feeling" },
  { id: "default", label: "Wandering" },
];

/** The opening the stored "would stop" share is read over: the first two seconds. */
const HOLD_S = 2;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export function brainTrackOf(model: VideoModel): BrainTrack {
  const { clipS, audience } = model;

  // The still-watching line, sampled evenly over the clip, once per second (exactly once per
  // second when the clip is a whole number of seconds). `driveFor` reads sample i at the share
  // i / (n - 1) of the clip, so the samples must be spread over the clip, not over whole seconds.
  const steps = Math.max(1, Math.round(clipS));
  const retentionCurve = Array.from({ length: steps + 1 }, (_, i) => clamp01(watchingAt(audience.points, (i * clipS) / steps) / 100));

  // `buildBrainFrameData` takes `clamp(stopPct / 100, 0, 1)`, where stopPct is the stored hook hold
  // (the first-2s hold). That number is not on the page's model, so the line's share at 0:02 stands
  // in for it. In a grounded drive the model does not read it (only a text concept's simulated
  // envelope does); the test holds that.
  const stopRatio = clamp01(watchingAt(audience.points, Math.min(HOLD_S, clipS)) / 100);

  const drive = driveFor({ seedKey: model.id, stopRatio, durationS: clipS, retentionCurve });

  const seconds = Math.floor(clipS);
  const bold = Array.from({ length: seconds + 1 }, (_, s) => predictedBold(drive, s));

  return {
    seed: hashSeed(model.id),
    drive,
    signals: BRAIN_SIGNALS.map(({ id, label }) => ({
      id,
      label,
      rest: RESTING_BOLD[id] * 100,
      perSecond: bold.map((b) => b[id] * 100),
    })),
  };
}
