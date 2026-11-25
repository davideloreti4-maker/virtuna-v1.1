/** Cutaway.tsx — a clip or a picture over the speaker while the voice goes on. It comes and goes on a cut. */
import { Video } from "@remotion/media";
import { AbsoluteFill, Img } from "remotion";
import { FPS } from "../../../lib/edit";
import type { PartProps } from "./types";

export const Cutaway: React.FC<PartProps<"cutaway">> = ({ settings, src, kind, fileMs }) => {
  if (!src || kind === "audio" || kind === null) return null;
  const fill = { width: "100%", height: "100%" } as const;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {kind === "image" ? (
        <Img src={src} style={{ ...fill, objectFit: settings.fit }} />
      ) : (
        <Video src={src} trimBefore={((fileMs ?? 0) * FPS) / 1000} volume={settings.volume} muted={settings.volume === 0} objectFit={settings.fit} style={fill} />
      )}
    </AbsoluteFill>
  );
};
