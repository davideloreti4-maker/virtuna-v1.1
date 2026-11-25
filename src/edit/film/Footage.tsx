/**
 * Footage.tsx — one run of footage: a clip or a picture, played at the run's speed, and framed,
 * coloured and heard on every frame as the shot on that frame says.
 *
 * A run is drawn as one piece of media, however many shots it is cut into, so a cut inside a run
 * cannot hitch or click. Everything here comes from the edit's own functions; nothing is timed
 * by this file.
 */
import { colorCorrection } from "@remotion/effects/color-correction";
import { Video } from "@remotion/media";
import { useId } from "react";
import { AbsoluteFill, Img, cancelRender, useCurrentFrame, useRemotionEnvironment } from "remotion";
import { FPS, assetOf, framingAt, lookOf, momentOf, shotOn, type Layout, type Run } from "../../lib/edit";
import { colourPassFailed } from "./grading";
import { gradeOf, standInOf } from "./looks";
import { addressOf, type FilmProps } from "./props";

/** How many frames a run's sound takes to come in and to go out at a plain cut, so that a cut never clicks. */
const EDGE = 2;

export interface FootageProps {
  props: FilmProps;
  lay: Layout;
  run: Run;
  /** The frames the run shares with the run before it in a transition: none at a plain cut. Over them its sound comes in, so two voices cross instead of talking over each other. */
  into: number;
  /** The same towards the run after it. */
  outOf: number;
  /** Whether the look is drawn by the colour pass itself. If not (a preview in a browser that cannot run it), by the nearest stand-in. */
  exact: boolean;
  /** Called when the colour pass itself fails: the film then goes on without it. */
  onLost: () => void;
}

export const Footage: React.FC<FootageProps> = ({ props, lay, run, into, outOf, exact, onLost }) => {
  const local = useCurrentFrame(); // frames since the run's first
  const { isRendering } = useRemotionEnvironment();
  const filter = `look-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const { edit } = props;
  const shotAt = (frame: number) => edit.shots[shotOn(lay, run, run.at + frame)];
  const shot = shotAt(local);
  const asset = assetOf(edit, run.asset);
  // A clip the browser cannot read itself (its codec, or a read that failed) the engine draws by a fall-back that has no
  // colour pass, without a word, and it falls back once for the whole run, which is one piece of media across its shots.
  // So whether a render may let it is asked of the run's shots, not of this frame's (X73).
  const strict = isRendering && edit.shots.slice(run.first, run.last + 1).some((each) => gradeOf(lookOf(edit, each)) !== null);
  if (!shot || !asset || asset.kind === "audio") return null;

  const framing = framingAt(shot, momentOf(run, run.at + local));
  // Zoom enlarges the picture from its centre; x and y say how much of the room that leaves is used, towards which side.
  const shift = (side: number) => (-side * (framing.zoom - 1) * 50) / framing.zoom;
  const grade = gradeOf(lookOf(edit, shot));
  const effects = grade && exact ? [colorCorrection(grade)] : [];
  const standIn = grade && !exact ? standInOf(grade) : null;
  const fill = { width: "100%", height: "100%" } as const;

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#000000" }}>
      {standIn ? (
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
          <filter id={filter} x="0" y="0" width="1" height="1">
            <feColorMatrix type="matrix" values={standIn.light.join(" ")} colorInterpolationFilters="linearRGB" />
            <feColorMatrix type="matrix" values={standIn.encoded.join(" ")} colorInterpolationFilters="sRGB" />
          </filter>
        </svg>
      ) : null}
      <AbsoluteFill style={{ transform: `scale(${framing.zoom}) translate(${shift(framing.x)}%, ${shift(framing.y)}%)`, ...(standIn ? { filter: `url(#${filter})` } : {}) }}>
        {asset.kind === "image" ? (
          <Img src={addressOf(props, asset)} style={{ ...fill, objectFit: "cover" }} effects={effects} />
        ) : (
          <Video
            key={exact ? "pass" : "plain"}
            disallowFallbackToOffthreadVideo={strict}
            onError={(error) => {
              // What is posted is never a stand-in: a render of a run with a look stops here, naming the file (the engine,
              // told not to fall back, would stop it too, with its own words).
              if (strict) {
                const why = error.message.replaceAll(addressOf(props, asset), "the file");
                cancelRender(new Error(`the look cannot be drawn on the file "${asset.id}": the browser cannot read it itself (${why})`, { cause: error }));
              }
              if (effects.length > 0 && colourPassFailed(error)) onLost();
              return undefined; // in the Player, and in a render of a run with no look, the engine falls back by itself
            }}
            src={addressOf(props, asset)}
            trimBefore={(run.fromMs * FPS) / 1000}
            playbackRate={run.speed}
            muted={!asset.sound}
            volume={(frame) => (shotAt(frame)?.volume ?? 0) * Math.min(1, (frame + 1) / Math.max(EDGE, into), (run.frames - frame) / Math.max(EDGE, outOf))}
            objectFit="cover"
            style={fill}
            effects={effects}
          />
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
