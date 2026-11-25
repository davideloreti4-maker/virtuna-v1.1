import type { ShellIcon, ShellIconProps } from "@/components/shell/icons";

/**
 * The message field's own glyphs, which the shell's set does not have: send, stop, close, the
 * More sheet's row icons, and the skills' icons Home's cards and the "/" menu share. Same drawing rules as `src/components/shell/icons.tsx` (24×24
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

/** Read a file (and the staged evidence chip); Script on Home's cards and in the "/" menu. */
export const DocIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M7 3.5h7l4.5 4.5V19a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z" />
    <path d="M9 12.5h6M9 16h4" />
  </Glyph>
);

/** Simulate (Home's cards, the "/" menu): a heartbeat line. */
export const PulseIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M3.5 12h3.6l2.2-4.6 4.2 9.2 2.2-4.6h4.8" />
  </Glyph>
);

/** Hooks (Home's cards, the "/" menu): a pencil. */
export const PenIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M15.8 5.2a2.2 2.2 0 0 1 3.1 3.1L8.6 18.6l-4.1 1 1-4.1z" />
    <path d="m14.2 6.8 3.1 3.1" />
  </Glyph>
);

/** Remix (Home's cards, the "/" menu): two arrows in a loop. */
export const LoopIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M16.5 3.5 20 7l-3.5 3.5" />
    <path d="M4 11.5V10a3 3 0 0 1 3-3h13" />
    <path d="M7.5 20.5 4 17l3.5-3.5" />
    <path d="M20 12.5V14a3 3 0 0 1-3 3H4" />
  </Glyph>
);
