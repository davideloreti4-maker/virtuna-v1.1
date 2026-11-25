import type { ShellIcon, ShellIconProps } from "@/components/shell/icons";

/**
 * Discover's own glyphs, which the shell's, the field's and Library's sets do not have: the filter
 * mark, the order menu's chevron, and the multiple's up mark. Same drawing rules as
 * `src/components/shell/icons.tsx` (24×24 viewBox, `currentColor`, 1.75 stroke, round caps and joins,
 * sized with `size`). The filter mark and the chevron are the drawing's (`discover-audience.html`,
 * `I.filter`, `I.down`).
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

/** Filter: three lines, each shorter than the one above. */
export const FilterIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M4 7h16M7 12h10M10 17h4" />
  </Glyph>
);

/** A menu that opens downward. */
export const ChevronDownIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="m6 9 6 6 6-6" />
  </Glyph>
);

/** The multiple's mark: a small solid triangle pointing up. Drawn, never a text glyph, so it is the
 *  same in every font; always hidden from screen readers (the number says it). */
export function UpMark({ size = 8 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size * 0.875} viewBox="0 0 8 7" fill="currentColor" className="shrink-0">
      <path d="M4 0 8 7H0z" />
    </svg>
  );
}
