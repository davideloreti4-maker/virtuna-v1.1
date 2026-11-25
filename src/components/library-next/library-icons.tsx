import type { ShellIcon, ShellIconProps } from "@/components/shell/icons";

/**
 * Library's own glyphs, which neither the shell's set, the field's nor the answers' has: search,
 * the three dots of a row's More, and the mark of a plain chat. Same drawing rules as
 * `src/components/shell/icons.tsx` (24×24 viewBox, `currentColor`, 1.75 stroke, round caps and
 * joins, sized with `size`). The paths are the v11 reference's (`app.html`, `I.search`, `I.more`,
 * `I.chat`).
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

/** Search: a lens. */
export const SearchIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </Glyph>
);

/** More: three dots, filled. */
export const DotsIcon: ShellIcon = (props) => (
  <Glyph fill="currentColor" stroke="none" {...props}>
    <circle cx="5.5" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="18.5" cy="12" r="1.6" />
  </Glyph>
);

/** A plain chat (only messages): a speech bubble. The tile's mark for half of a creator's chats. */
export const ChatIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5V16A2.5 2.5 0 0 1 5 13.5z" />
  </Glyph>
);
