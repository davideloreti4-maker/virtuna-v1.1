import type { ShellIcon, ShellIconProps } from "@/components/shell/icons";

/**
 * editor-icons.tsx — the editor's glyphs (plan 2026-11-24-editor-screens-a, Task 11): the drawing's own paths
 * (`.scratch/editor/drawing/editor-v2.html`, `I`) on its 20 × 20 box, `currentColor`, 1.7 stroke, round caps and joins, sized
 * with `size` (20 unless told). Scissors and More live with the field's glyphs (`field-icons.tsx`), where Home's cards take them.
 */
function Glyph({ size = 20, children, ...props }: ShellIconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {children}
    </svg>
  );
}

export const UndoIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M7.5 4.5 4 8l3.5 3.5" />
    <path d="M4 8h7.5a4 4 0 0 1 0 8H9" />
  </Glyph>
);

export const RedoIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M12.5 4.5 16 8l-3.5 3.5" />
    <path d="M16 8H8.5a4 4 0 0 0 0 8H11" />
  </Glyph>
);

export const PlayIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M6.5 4v12l10-6z" fill="currentColor" stroke="none" />
  </Glyph>
);

export const SoundIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M3 8v4h3l4 3.5v-11L6 8z" />
    <path d="M13.5 7.5a3.5 3.5 0 0 1 0 5" />
  </Glyph>
);

export const MutedIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M3 8v4h3l4 3.5v-11L6 8z" />
    <path d="M13.5 8l4 4M17.5 8l-4 4" />
  </Glyph>
);

export const LookIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <circle cx="10" cy="10" r="6.5" />
    <path d="M10 3.5a6.5 6.5 0 0 1 0 13z" fill="currentColor" stroke="none" />
  </Glyph>
);

export const CaptionsIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <rect x="2.5" y="4.5" width="15" height="11" rx="3" />
    <path d="M6 9.2h2.5M11 9.2h3M6 12h8" />
  </Glyph>
);

export const EyeIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M2.5 10s2.8-5 7.5-5 7.5 5 7.5 5-2.8 5-7.5 5-7.5-5-7.5-5z" />
    <circle cx="10" cy="10" r="2.2" />
  </Glyph>
);

export const LinkIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-1 1M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l1-1" />
  </Glyph>
);

export const QuoteIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M4 11.5c0-3 1.5-5 4-6M11 11.5c0-3 1.5-5 4-6" />
    <circle cx="6" cy="12.5" r="2" fill="currentColor" stroke="none" />
    <circle cx="13" cy="12.5" r="2" fill="currentColor" stroke="none" />
  </Glyph>
);

export const SaveIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M10 3.5v9M6 9l4 4 4-4M4 16.5h12" />
  </Glyph>
);

export const ChevronRightIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M7.5 4.5 13 10l-5.5 5.5" />
  </Glyph>
);

/** The preview as it will be posted: four corners (the drawing's `expand`). */
export const ExpandIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M4 8V4h4M16 8V4h-4M4 12v4h4M16 12v4h-4" />
  </Glyph>
);

/** The drawing's `x`. */
export const CloseIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
  </Glyph>
);

/*
 * The apps' buttons as drawn over the preview (Task 6): our own plain shapes, filled, none an app's own icon. Heart, chat,
 * bookmark and forward are the drawing's (`heart`, `chat`, `mark`, `fwd`); repost and the sound disc are drawn here in the same
 * manner. The bookmark is the post's Save; `SaveIcon` above is the file's.
 */
export const HeartIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M10 16.5S3.5 12.6 3.5 8.2A3.4 3.4 0 0 1 10 6.6a3.4 3.4 0 0 1 6.5 1.6c0 4.4-6.5 8.3-6.5 8.3z" fill="currentColor" stroke="none" />
  </Glyph>
);

export const ChatIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M3.5 9.5a6.5 5.5 0 1 1 3 4.6l-3 1.4.9-3a5.2 5.2 0 0 1-.9-3z" fill="currentColor" stroke="none" />
  </Glyph>
);

export const BookmarkIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M6 3.5h8v13l-4-3-4 3z" fill="currentColor" stroke="none" />
  </Glyph>
);

export const ShareIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M11 4.5 17 10l-6 5.5v-3.3c-4 0-6.3 1.2-8 3.8.4-4.6 3-7.6 8-8.2z" fill="currentColor" stroke="none" />
  </Glyph>
);

/** Two arrows that turn round each other. */
export const RepostIcon: ShellIcon = (props) => (
  <Glyph strokeWidth={2} {...props}>
    <path d="M4.5 10V8.5a3 3 0 0 1 3-3H15M12.5 3 15 5.5 12.5 8M15.5 10v1.5a3 3 0 0 1-3 3H5M7.5 12 5 14.5 7.5 17" />
  </Glyph>
);

/** A record with its hole. */
export const DiscIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M10 2a8 8 0 1 1 0 16a8 8 0 1 1 0-16zm0 5.6a2.4 2.4 0 1 0 0 4.8a2.4 2.4 0 1 0 0-4.8z" fill="currentColor" fillRule="evenodd" stroke="none" />
  </Glyph>
);
