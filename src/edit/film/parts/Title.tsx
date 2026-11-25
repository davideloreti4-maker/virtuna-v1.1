/**
 * Title.tsx — the hook: a line or two over the picture. Words wrapped in asterisks, like *this*,
 * take the accent colour. It is set on at most three lines, as large as asked or as fits, and
 * never leaves the stage. The lines are the kit's own (`lines.ts`), so every browser draws the
 * same ones. Its size, its lines and its place are `layout.ts`'s, which `review` reads too. A
 * label's box is dark under light letters and near-white under dark ones (`labelFill`); its accent
 * is a marker behind the word where it would not read as letters on that box (`accentFill`). A
 * label of two or three lines is one shape under its letters, each line its own width, the joins
 * rounded, and two lines whose edges at a side are closer than two corner radii drawn at the outer
 * edge (`labelShape`, shape.ts); a label of one line keeps its own rounded box.
 */
import { useMemo, type CSSProperties } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily, measuredIn } from "../fonts";
import { TITLE_TRACKING_EM, accentFill, labelFill, lineSpans, titleBox } from "../layout";
import { labelShape } from "../shape";
import type { PartProps } from "./types";

/** How many frames it takes to go out. */
const OUT = 6;
/** How strong a label's dark box is, its opacity (`labelFill`); the light box is always `LIGHT_STRENGTH`. */
const LABEL = 0.78;
/** Its letters sit a little closer than the typeface sets them. */
const TRACKING = `${TITLE_TRACKING_EM}em`;

export const Title: React.FC<PartProps<"title">> = ({ settings, frames, skip, toEnd }) => {
  const run = useCurrentFrame() + skip; // how long it has been running
  const { fps, width, height } = useVideoConfig();
  const family = fontFamily(settings.font);
  const label = settings.look === "label";

  // The size it is set in, its lines and its place, by the kit's own rules (layout.ts).
  const laid = useMemo(() => titleBox(settings, measuredIn(settings.font), { w: width, h: height }), [settings, width, height]);
  const { size: fontSize, side, pitch } = laid;
  const top = laid.y + laid.h / 2;
  const radius = Math.round(0.24 * fontSize);
  // A label of two or three lines is one shape (shape.ts); one line keeps its own box, as it always had.
  const merged = label && laid.lines.length > 1;
  const spans = lineSpans(laid.lines, side, laid.room); // as `margin: 0 auto` sets them, by the rule `titleBox` places them by

  const come = spring({ frame: run, fps, config: { damping: 200 }, durationInFrames: 10 });
  const go = toEnd ? 1 : interpolate(run, [skip + frames - OUT, skip + frames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const stroke = settings.look === "outline" ? fontSize * 0.1 : settings.look === "bold" ? fontSize * 0.05 : 0;
  // The marked words: coloured letters, or on a label where the accent would not read on its box, a marker of it behind the word (`accentFill`).
  const accent = settings.accent ?? settings.color;
  const reach = Math.round(0.1 * fontSize); // how far a marker reaches past its letters, taking no room: padding given back by a margin
  const marked: CSSProperties = label && accentFill(accent, settings.color, LABEL) === "block"
    ? { color: settings.color, backgroundColor: accent, padding: `0 ${reach}px`, margin: `0 ${-reach}px`, borderRadius: Math.round(0.14 * fontSize) }
    : { color: accent };

  return (
    <div
      data-part="title"
      style={{
        position: "absolute", left: "50%", top, width: laid.room,
        transform: `translate(-50%, -50%) translateY(${(1 - come) * 24}px)`, opacity: Math.min(come, go),
        fontFamily: family, fontWeight: laid.weight, fontSize, lineHeight: `${pitch}px`, letterSpacing: TRACKING, color: settings.color, whiteSpace: "nowrap",
        ...(stroke > 0 ? { WebkitTextStroke: `${stroke}px rgba(0, 0, 0, 0.9)`, paintOrder: "stroke fill" } : {}),
        ...(settings.look === "bold" ? { textShadow: "0 6px 28px rgba(0, 0, 0, 0.55)" } : {}),
      }}
    >
      {merged ? (
        <svg aria-hidden width={laid.room} height={laid.lines.length * pitch} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <path d={labelShape(spans, pitch, radius)} fill={labelFill(settings.color, LABEL)} />
        </svg>
      ) : null}
      {laid.lines.map((line, i) => (
        <div
          key={i}
          data-line=""
          style={{
            width: line.width + 2 * side, height: pitch, margin: "0 auto", padding: `0 ${side}px`, textAlign: "center",
            ...(label && !merged ? { backgroundColor: labelFill(settings.color, LABEL), borderRadius: radius } : {}),
            ...(merged ? { position: "relative" as const } : {}),
          }}
        >
          {laid.words.slice(line.from, line.to).map((word, w) => (
            <span key={w}>
              {w > 0 ? " " : null}
              {word.bits.map((bit, b) => (bit.marked ? <span key={b} style={marked}>{bit.text}</span> : bit.text))}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};
