/**
 * Captions.tsx — the captions of one run: its words, a page at a time, in one of four looks.
 *
 * A page is there, whole and at full strength, from its first frame: nothing fades in, so the
 * first frame of a film is never without its words. Only the word being said moves. The rows of
 * a page are the kit's own (`lines.ts`), set from measured widths in whole pixels, so every
 * browser draws the same ones; a word too long for the row sets its page's type smaller. How a
 * page is set and where it sits are `layout.ts`'s, which `review` reads too.
 */
import { useMemo } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Captions as CaptionSettings, SaidWord } from "../../lib/edit";
import { fontFamily, measuredIn } from "./fonts";
import { captionPages, captionWeights, edgeOf, wordLight } from "./layout";
import type { CaptionPage } from "./pages";

const WHITE = "#ffffff";
const DARK = "rgba(0, 0, 0, 0.9)";

export const Captions: React.FC<{ settings: CaptionSettings; pages: CaptionPage[] }> = ({ settings, pages }) => {
  const frame = useCurrentFrame(); // frames since the run's first
  const { fps, width, height } = useVideoConfig();
  const family = fontFamily(settings.font);
  // Each page set and placed by the kit's own rules (layout.ts): held inside the stage by the tallest page of the run, so that pages of fewer rows do not jump.
  const set = useMemo(() => captionPages(settings, pages.map((page) => page.words), measuredIn(settings.font), { w: width, h: height }), [pages, settings, width, height]);
  const at = pages.findIndex((candidate) => frame >= candidate.from && frame < candidate.to);
  const page = pages[at];
  const laid = set[at];
  if (!page || !laid) return null;

  const { size } = laid;
  const weights = captionWeights(settings);
  const mark = settings.highlight ?? WHITE;
  /** The word being said: the last one that has started. */
  const now = page.words.reduce<SaidWord | null>((said, word) => (frame >= word.from ? word : said), null);
  const boxed = settings.look === "pill";
  const top = laid.y + laid.h / 2;

  return (
    <div
      data-part="captions"
      style={{
        position: "absolute", left: "50%", top, width: laid.w, height: laid.h, transform: "translate(-50%, -50%)",
        padding: `${laid.pad}px ${laid.side}px`,
        display: "flex", flexDirection: "column", rowGap: laid.rowGap,
        fontFamily: family, fontSize: size, lineHeight: `${laid.pitch}px`, fontWeight: weights.plain, color: WHITE, whiteSpace: "nowrap",
        ...(boxed ? { backgroundColor: "rgba(0, 0, 0, 0.78)", borderRadius: Math.round(0.42 * size) } : { WebkitTextStroke: `${edgeOf(settings, size)}px ${DARK}`, paintOrder: "stroke fill", textShadow: "0 5px 20px rgba(0, 0, 0, 0.45)" }),
      }}
    >
      {laid.rows.map((row, r) => (
        <div key={r} style={{ display: "flex", columnGap: laid.gap, width: row.width, height: laid.pitch, margin: "0 auto" }}>
          {page.words.slice(row.from, row.to).map((word, i) => {
            const wide = laid.widths[row.from + i] ?? 0;
            const said = word === now;
            const pop = settings.look === "pop" && said ? spring({ frame: frame - word.from, fps, config: { damping: 12, mass: 0.5 }, durationInFrames: 8 }) : 0;
            const { lit, onBox } = wordLight(settings.look, said, word.stress === true);
            const reach = Math.round(0.16 * size); // how far the highlighted word's box reaches past its letters
            return (
              <span
                key={`${word.from}-${i}`}
                style={{
                  position: "relative", display: "block", flex: "none", width: wide, textAlign: "center", transform: `scale(${1 + 0.07 * pop})`, transformOrigin: "50% 80%",
                  fontWeight: word.stress ? weights.stressed : weights.plain,
                  color: onBox ? "#111111" : lit ? mark : WHITE,
                  ...(onBox ? { WebkitTextStroke: "0px", textShadow: "none" } : {}),
                }}
              >
                {onBox ? <span style={{ position: "absolute", top: 0, bottom: 0, left: -reach, right: -reach, backgroundColor: mark, borderRadius: Math.round(0.22 * size) }} /> : null}
                <span style={{ position: "relative" }}>{word.text}</span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};
