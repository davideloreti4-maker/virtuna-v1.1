import type { SVGProps } from "react";
import type { Intent } from "@/lib/result/types";

/**
 * The four glyphs of "What viewers are likely to do", ported from the mock
 * (`.scratch/next-look/part2/design/app.html`: `I.fwd`, `I.chat`, `I.loop`, `I.library`):
 * 24×24 viewBox, 1.75 stroke, round caps and joins, no fill, drawn in `currentColor`.
 * Decorative: the row's label names the action.
 */
type GlyphProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

function Glyph({ size = 18, children, ...props }: GlyphProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Share: the mock's `fwd`. */
function ShareGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M13.5 5.5 20.5 12l-7 6.5v-4c-4.5 0-7.5 1.2-9.5 4 .5-5.5 3.5-9 9.5-9.5z" />
    </Glyph>
  );
}

/** Comment: the mock's `chat`. */
function CommentGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5V16A2.5 2.5 0 0 1 5 13.5z" />
    </Glyph>
  );
}

/** Rewatch: the mock's `loop`. */
function RewatchGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M16.5 3.5 19.5 6.5 16.5 9.5" />
      <path d="M4.5 11.5v-1a4 4 0 0 1 4-4h11" />
      <path d="M7.5 20.5 4.5 17.5 7.5 14.5" />
      <path d="M19.5 12.5v1a4 4 0 0 1-4 4h-11" />
    </Glyph>
  );
}

/** Save: the mock's `library` (a bookmark). */
function SaveGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <path d="M5.5 4.5h13v15l-6.5-3.8-6.5 3.8z" />
    </Glyph>
  );
}

export const INTENT_GLYPHS: Record<Intent["id"], (props: GlyphProps) => React.JSX.Element> = {
  share: ShareGlyph,
  comment: CommentGlyph,
  rewatch: RewatchGlyph,
  save: SaveGlyph,
};
