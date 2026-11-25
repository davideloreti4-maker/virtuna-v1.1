/** Progress.tsx — a thin bar that fills as the film plays, along the top or the bottom. */
import { useCurrentFrame, useVideoConfig } from "remotion";
import { progressBox } from "../layout";
import type { PartProps } from "./types";

export const Progress: React.FC<PartProps<"progress">> = ({ settings, at }) => {
  const frame = at + useCurrentFrame(); // the film's frame
  const { durationInFrames, width, height } = useVideoConfig();
  const done = durationInFrames <= 1 ? 1 : frame / (durationInFrames - 1);
  const { h: thick } = progressBox(settings, { w: width, h: height }); // its box is layout.ts's, which `review` reads too
  return (
    <div data-part="progress" style={{ position: "absolute", left: 0, right: 0, height: thick, [settings.edge]: 0, backgroundColor: "rgba(0, 0, 0, 0.25)" }}>
      <div style={{ width: `${Math.min(1, Math.max(0, done)) * 100}%`, height: "100%", backgroundColor: settings.color }} />
    </div>
  );
};
