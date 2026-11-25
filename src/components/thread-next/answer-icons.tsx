import type { ShellIcon, ShellIconProps } from "@/components/shell/icons";

/**
 * The answer cards' own glyphs, which neither the shell's set nor the field's has: upload ("Add
 * your take"), play ("Watch it run"), expand ("Open simulation"), video (a tile with no picture),
 * film ("How to film it"), and the details sheet's copy, bookmark (Save) and external (a proof's
 * video). Same drawing rules as `field-icons.tsx` (24×24 viewBox, `currentColor`, round caps and
 * joins, sized with `size`). The paths and stroke weights are the drawing's
 * (`.scratch/next-look/part3/answers/answers.html`, `I`; the film's from the step 2 film,
 * `.scratch/next-look/part11/thread-ux/proto/index.html`, `IC.film`).
 */
function Glyph({ size = 24, children, ...props }: ShellIconProps & { children: React.ReactNode }) {
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
      {...props}
    >
      {children}
    </svg>
  );
}

/** Add your take: an arrow up out of a tray (`I.upload`, stroke 1.9). */
export const UploadIcon: ShellIcon = (props) => (
  <Glyph strokeWidth={1.9} {...props}>
    <path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9" />
    <path d="M5 15v3a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 18v-3" />
  </Glyph>
);

/** Watch it run: the filled play triangle (`I.play`). */
export const PlayIcon: ShellIcon = (props) => (
  <Glyph fill="currentColor" stroke="none" {...props}>
    <path d="M8 5.2v13.6a.6.6 0 0 0 .9.5l11-6.8a.6.6 0 0 0 0-1L8.9 4.7a.6.6 0 0 0-.9.5z" />
  </Glyph>
);

/** Open simulation: two corners pulled apart (`I.exp`, stroke 1.9). */
export const ExpandIcon: ShellIcon = (props) => (
  <Glyph strokeWidth={1.9} {...props}>
    <path d="M14 4.5h5.5V10M10 19.5H4.5V14M19.5 4.5l-6.5 6.5M4.5 19.5l6.5-6.5" />
  </Glyph>
);

/**
 * A video with no picture to show: a frame with a play mark. In the tile of a video whose stored
 * frame is gone, so the tile still reads as a video and never as an empty box (review 2026-11-23).
 */
export const VideoIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="3" />
    <path d="M10.4 9.6v4.8l4-2.4z" />
  </Glyph>
);

/** How to film it (`IC.film`, stroke 2): a camera's body and its lens. */
export const FilmIcon: ShellIcon = (props) => (
  <Glyph strokeWidth={2} {...props}>
    <path d="M4 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    <path d="M16 11l4-2.5v7L16 13" />
  </Glyph>
);

/** Copy (`I.copy`): two sheets. */
export const CopyIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
    <path d="M5.5 15.5v-9a2 2 0 0 1 2-2h9" />
  </Glyph>
);

/** Save (`I.library`): the bookmark, filled in ink once saved (never the accent). */
export function BookmarkIcon({ filled = false, ...props }: ShellIconProps & { filled?: boolean }) {
  return (
    <Glyph fill={filled ? "currentColor" : "none"} {...props}>
      <path d="M5.5 4.5h13v15l-6.5-3.8-6.5 3.8z" />
    </Glyph>
  );
}

/** Opens elsewhere (`I.ext`): a proof's video, in a new tab. */
export const ExternalIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M13.5 5.5h5v5M18.5 5.5l-8 8M10 6.5H7.5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V14" />
  </Glyph>
);

/** Done: a check. The script's Copy turns into it for a moment, so a finger sees that it copied. */
export const CheckIcon: ShellIcon = (props) => (
  <Glyph strokeWidth={2} {...props}>
    <path d="M5 12.5 10 17.5 19 7.5" />
  </Glyph>
);
