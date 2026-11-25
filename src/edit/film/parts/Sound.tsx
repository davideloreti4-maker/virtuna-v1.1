/** Sound.tsx — a sound: an effect on a moment, or a voice over the film. It fades in and out as its settings say, and never longer than it lasts. */
import { Audio } from "@remotion/media";
import { FPS } from "../../../lib/edit";
import type { PartProps } from "./types";

export const Sound: React.FC<PartProps<"sound">> = ({ settings, frames, skip, src, fileMs }) => {
  if (!src) return null;
  const total = skip + frames; // its whole run, in frames
  const fadeIn = Math.min(total / 2, (settings.fadeInMs * FPS) / 1000);
  const fadeOut = Math.min(total / 2, (settings.fadeOutMs * FPS) / 1000);
  return (
    <Audio
      src={src}
      trimBefore={((fileMs ?? 0) * FPS) / 1000}
      volume={(frame) => {
        const run = frame + skip;
        return settings.volume * Math.min(1, fadeIn > 0 ? (run + 1) / fadeIn : 1, fadeOut > 0 ? (total - run) / fadeOut : 1);
      }}
    />
  );
};
