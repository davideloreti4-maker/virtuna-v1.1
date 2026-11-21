import type { ShellIcon, ShellIconProps } from "@/components/shell/icons";

/**
 * The message field's own glyphs, which the shell's set does not have: send, stop, close, and
 * the More sheet's row icons. Same drawing rules as `src/components/shell/icons.tsx` (24×24
 * viewBox, `currentColor`, 1.75 stroke, round caps and joins, sized with `size`). The paths are
 * the reference's (`.scratch/next-look/part3/design/field.html`, `I`). Where the reference draws
 * a glyph heavier (send 2.3, close 2.6), the caller passes `strokeWidth`.
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

/** Send: an arrow up. */
export const SendIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M12 19V5.5M6 11l6-6 6 6" />
  </Glyph>
);

/** Stop: a filled square with soft corners, 10px when drawn at 24. */
export const StopIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor" stroke="none" />
  </Glyph>
);

/** Close / remove: a cross. */
export const CloseIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </Glyph>
);

/** A row that leads on: the reference's chevron. */
export const ChevronIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="m9.5 6 6 6-6 6" />
  </Glyph>
);

/** Ideas. */
export const BulbIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M9 17.5h6M10 20.5h4M8.2 14.5a6 6 0 1 1 7.6 0c-.6.5-.8 1.2-.8 2H9c0-.8-.2-1.5-.8-2z" />
  </Glyph>
);

/** Your account. */
export const PersonIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <circle cx="12" cy="8.5" r="3.6" />
    <path d="M5 19.5c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6" />
  </Glyph>
);

/** Read a file (and the staged evidence chip). */
export const DocIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M7 3.5h7l4.5 4.5V19a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z" />
    <path d="M9 12.5h6M9 16h4" />
  </Glyph>
);
