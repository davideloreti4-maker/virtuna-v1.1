/**
 * Callout.tsx — one or two words that land on a moment of the picture. One line, fitted to the
 * stage, and held inside it wherever it is put. Its size and its place are `layout.ts`'s, which
 * `review` reads too. A label's box is dark under light letters and near-white under dark ones
 * (`labelFill`).
 */
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily, measuredIn } from "../fonts";
import { calloutBox, labelFill } from "../layout";
import type { PartProps } from "./types";

/** How many frames it takes to go out. */
const OUT = 4;
/** How strong a label's dark box is, its opacity (`labelFill`); the light box is always `LIGHT_STRENGTH`. */
const LABEL = 0.8;

export const Callout: React.FC<PartProps<"callout">> = ({ settings, frames, skip, toEnd }) => {
  const run = useCurrentFrame() + skip;
  const { fps, width, height } = useVideoConfig();
  const family = fontFamily(settings.font);
  const label = settings.look === "label";
  // Its size, its box in whole, even pixels, and its place, by the kit's own rules (layout.ts).
  const laid = calloutBox(settings, measuredIn(settings.font), { w: width, h: height });
  const { size: fontSize, side, h: pitch } = laid;
  const [left, top] = [laid.x + laid.w / 2, laid.y + laid.h / 2];

  const come = settings.look === "pop" ? spring({ frame: run, fps, config: { damping: 11, mass: 0.6 }, durationInFrames: 12 }) : spring({ frame: run, fps, config: { damping: 200 }, durationInFrames: 8 });
  const go = toEnd ? 1 : interpolate(run, [skip + frames - OUT, skip + frames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = settings.look === "pop" ? 0.6 + 0.4 * come : 0.94 + 0.06 * come;

  return (
    <div
      data-part="callout"
      style={{
        position: "absolute", left, top, width: laid.w, height: pitch, padding: `0 ${side}px`,
        transform: `translate(-50%, -50%) scale(${scale})`, opacity: Math.min(1, come * 2, go),
        whiteSpace: "nowrap", textAlign: "center", fontFamily: family, fontWeight: laid.weight, fontSize, lineHeight: `${pitch}px`, color: settings.color,
        ...(label
          ? { backgroundColor: labelFill(settings.color, LABEL), borderRadius: Math.round(0.3 * fontSize) }
          : { WebkitTextStroke: `${fontSize * 0.09}px rgba(0, 0, 0, 0.92)`, paintOrder: "stroke fill", textShadow: "0 5px 22px rgba(0, 0, 0, 0.5)" }),
      }}
    >
      {settings.text}
    </div>
  );
};
