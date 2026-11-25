/**
 * Sample.tsx — the small picture at the left of each way to say how the video should look (Task 13b): 44 by 56, a tile with
 * two mock caption words drawn as the kit draws that look (`src/edit/film/Captions.tsx`: white edged letters, the word being
 * said in the look's colour, on a box of it, or all on a dark box), so the look is seen and not described. For a video, a play
 * mark; for words, a quote mark; for the presets before one is chosen, three looks at once, without colour.
 *
 * The colour in a sample is the look's own, read from its profile: a picture of the video, as the phone is. The page has none.
 */
import { Play, Quotes } from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import type { StyleProfile } from "@/lib/edit/style/profile";

type Shown = { show: "look"; style: Pick<StyleProfile, "captions" | "look"> } | { show: "looks" } | { show: "play" } | { show: "quote" };

/** The tile's height, and the mock words: the second is the one being said. */
const TALL = 56;
const WORDS = ["go", "now"] as const;
const WHITE = "#ffffff";
const EDGE = "rgba(0, 0, 0, 0.9)";
const BOX = "rgba(0, 0, 0, 0.78)";

/** A caption's type size on the tile: the kit's size on its 1920 stage, held to what can be read and what fits. */
const typeOf = (size: number) => Math.max(7, Math.min(16, Math.round(size / 9)));
const edged = (px: number): CSSProperties => ({ WebkitTextStroke: `${(px * 0.09).toFixed(2)}px ${EDGE}`, paintOrder: "stroke fill" });

export function Sample(props: Shown) {
  const mono = props.show === "look" && props.style.look.preset === "mono";
  return (
    <span
      aria-hidden
      data-sample={props.show}
      className="relative block h-14 w-11 flex-none overflow-hidden rounded-sm border border-border bg-surface-elevated"
      // Black and white footage: the tile in two greys, a lighter one and the tile's own.
      style={mono ? { background: "linear-gradient(135deg, #6f6f6f 0 50%, var(--color-surface-elevated) 50% 100%)" } : undefined}
    >
      {props.show === "look" ? <Words captions={props.style.captions} /> : null}
      {props.show === "looks" ? <Looks /> : null}
      {props.show === "play" ? <Play weight="fill" size={16} className="absolute inset-0 m-auto text-foreground-secondary" /> : null}
      {props.show === "quote" ? <Quotes weight="fill" size={18} className="absolute inset-0 m-auto text-foreground-secondary" /> : null}
    </span>
  );
}

/** Two words in the look, where its captions sit: large type on two rows, as a page of large captions is. */
function Words({ captions }: { captions: StyleProfile["captions"] }) {
  const px = typeOf(captions.size);
  const words = captions.maxWords === 1 ? WORDS.slice(1) : WORDS;
  const mark = captions.highlight ?? WHITE;
  const boxed = captions.look === "pill";
  const rows = !boxed && px >= 10 && words.length > 1;
  return (
    <span className="absolute inset-x-0 flex justify-center" style={{ bottom: Math.round((1 - captions.y) * TALL - px * (rows ? 0.9 : 0.6)) }}>
      <span
        className={`inline-flex whitespace-nowrap font-extrabold ${rows ? "flex-col items-center" : ""}`}
        style={{
          columnGap: px * 0.3, fontSize: px, lineHeight: rows ? 1.08 : 1.3, color: WHITE,
          ...(boxed ? { backgroundColor: BOX, borderRadius: px * 0.42, padding: `${(px * 0.12).toFixed(1)}px ${(px * 0.5).toFixed(1)}px` } : edged(px)),
          // The captions' own weight where they carry one (the house's 600); with none, `font-extrabold` as the kit's 800.
          ...(captions.weight !== undefined && { fontWeight: captions.weight }),
        }}
      >
        {words.map((word, i) => {
          const said = i === words.length - 1;
          const onBox = captions.look === "highlight" && said;
          return (
            <span
              key={word}
              style={onBox ? { color: "#111111", backgroundColor: mark, borderRadius: px * 0.22, padding: `0 ${(px * 0.18).toFixed(1)}px`, WebkitTextStroke: "0px" } : { color: said ? mark : WHITE }}
            >
              {word}
            </span>
          );
        })}
      </span>
    </span>
  );
}

/** Three looks at once, without colour: on a dark box, edged, and on a light block. */
function Looks() {
  const px = 9;
  const line: CSSProperties = { fontSize: px, lineHeight: 1.3, color: WHITE };
  return (
    <span className="absolute inset-0 flex flex-col items-center justify-center gap-[3px] font-extrabold">
      <span style={{ ...line, backgroundColor: BOX, borderRadius: px * 0.42, padding: `0 ${px * 0.5}px` }}>Aa</span>
      <span style={{ ...line, ...edged(px) }}>Aa</span>
      <span className="bg-foreground" style={{ ...line, color: "#111111", borderRadius: px * 0.22, padding: `0 ${px * 0.4}px` }}>Aa</span>
    </span>
  );
}
