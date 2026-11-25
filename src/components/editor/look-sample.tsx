"use client";

import type { CSSProperties } from "react";
import type { StyleProfile } from "@/lib/edit/style/profile";

/**
 * look-sample.tsx — a look drawn on the take's own frame (spec §3 screens 2 and 9, §5.2; plan 2026-11-24-editor-screens-a, Task 13):
 * the poster (black and white for the mono look), the look's label where its title sits when it stays to the film's end, and two
 * of the take's words set as its captions set them, on as many lines as they need (the drawing of the dev page's `Sample.tsx`, at
 * the tile's height). Before the take's words are heard (it is
 * still sending or being listened to) two stand-in words take their place, so the looks differ from the first moment. Its
 * colours are the film's own (the kit's white words, their dark edge and box, the look's highlight, the label's light box and
 * dark ink): a picture of the video, as the stage is, not the app's. It is the one file of the editor the colour guard leaves
 * out (Task 15).
 */
const WHITE = "#ffffff";
const EDGE = "rgba(0, 0, 0, 0.9)";
const BOX = "rgba(0, 0, 0, 0.78)";
const INK = "#111111";

/** What a sample says before the take's words are heard. */
const STAND_IN = ["Your", "words"] as const;

type Shown = Pick<StyleProfile, "captions" | "title" | "look">;

/** A size on the film's 1920-tall stage at the tile's height, half as large again so it is read; 6 at least. */
const scaled = (size: number, tall: number) => Math.max(6, Math.round(((size * tall) / 1920) * 1.5));
/** A type size held to the tile's width (a fifth of it), so one large word is not cut at the tile's edges. */
const fitted = (px: number) => `min(${px}px, 19cqw)`;
const edged = (px: number): CSSProperties => ({ WebkitTextStroke: `${(px * 0.09).toFixed(2)}px ${EDGE}`, paintOrder: "stroke fill" });

export function LookSample({ style, poster, words, tall }: { style: Shown; poster: string | null; words: readonly string[]; tall: number }) {
  const two = (words.length > 0 ? words : STAND_IN).slice(0, 2);
  const px = scaled(style.captions.size, tall);
  // A look of one word at a time shows the one being said: the second, or the only one there is.
  const said = style.captions.maxWords === 1 ? two.slice(-1) : two;
  const mark = style.captions.highlight ?? WHITE;
  // A title over the opening only is not on the frame where the words are said; one that stays to the end is (the drawing's).
  const title = style.title?.on && style.title.stays ? style.title : null;
  const titlePx = title ? Math.round(scaled(title.size, tall) * 0.8) : 0;
  return (
    <span
      aria-hidden data-sample=""
      className="relative block w-full overflow-hidden rounded-lg bg-surface-sunken"
      style={{
        height: tall,
        containerType: "inline-size",
        ...(poster ? { backgroundImage: `url(${JSON.stringify(poster)})`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
        ...(style.look.preset === "mono" ? { filter: "grayscale(1)" } : {}),
      }}
    >
      {/* The title sets on as many lines as it needs, as the film's does, a label's box around each line. */}
      {title && (
        <span data-part="title" className="absolute inset-x-1 block text-center" style={{ top: `${Math.round(title.y * 100) - 4}%`, lineHeight: 1.45 }}>
          <span
            style={{
              fontSize: fitted(titlePx), fontWeight: title.weight ?? 700, borderRadius: 2.5, padding: "1px 3px", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone",
              ...(title.look === "label" ? { background: WHITE, color: title.ink ?? INK } : { color: WHITE, ...edged(titlePx) }),
            }}
          >
            {two.join(" ")}
          </span>
        </span>
      )}
      {style.captions.on && (
        <span className="absolute inset-x-1 flex justify-center" style={{ top: `${Math.round(style.captions.y * 100) - 3}%` }}>
          <span
            data-part="said"
            className="inline-flex max-w-full flex-wrap justify-center"
            style={{
              columnGap: px * 0.3, fontSize: fitted(px), fontWeight: style.captions.weight ?? 800, lineHeight: 1.3, color: WHITE,
              ...(style.captions.look === "pill" ? { backgroundColor: BOX, borderRadius: px * 0.42, padding: `0 ${(px * 0.5).toFixed(1)}px` } : edged(px)),
            }}
          >
            {said.map((word, i) => {
              const now = i === said.length - 1;
              const onBox = style.captions.look === "highlight" && now;
              return (
                <span
                  key={`${word}-${i}`}
                  style={onBox ? { color: INK, backgroundColor: mark, borderRadius: px * 0.22, padding: `0 ${(px * 0.18).toFixed(1)}px`, WebkitTextStroke: "0px" } : { color: now ? mark : WHITE }}
                >
                  {word}
                </span>
              );
            })}
          </span>
        </span>
      )}
    </span>
  );
}
