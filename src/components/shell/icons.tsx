import type { SVGProps } from "react";

/**
 * The shell's own glyphs, taken from the accepted v11 reference: 24×24 viewBox, 1.75 stroke,
 * round caps and joins, no fill. They are drawn in `currentColor` and sized with `size`.
 * (The rest of the app still uses Phosphor; the new look's navigation uses these.)
 */
export type ShellIconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };
export type ShellIcon = (props: ShellIconProps) => React.JSX.Element;

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

export const HomeIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M4.5 10.8 12 4.5l7.5 6.3V19a1 1 0 0 1-1 1h-4.2v-5.5h-4.6V20H5.5a1 1 0 0 1-1-1z" />
  </Glyph>
);

export const DiscoverIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m15.2 8.8-1.9 4.5-4.5 1.9 1.9-4.5z" />
  </Glyph>
);

export const LibraryIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M3.5 7.5a2 2 0 0 1 2-2h3.8l2.2 2.3h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
  </Glyph>
);

export const AudienceIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <circle cx="9" cy="9" r="3.2" />
    <path d="M3.2 19c.5-3.2 2.9-5 5.8-5s5.3 1.8 5.8 5" />
    <path d="M15.5 6.1a3.2 3.2 0 0 1 0 5.8M17.8 14.6c1.7.7 2.7 2.2 3 4.4" />
  </Glyph>
);

export const PlusIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M12 5.5v13M5.5 12h13" />
  </Glyph>
);

/** Back, on a pushed screen: the reference's chevron. */
export const BackIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="m14.5 6-6 6 6 6" />
  </Glyph>
);

/** New chat on desktop: a sheet with a pencil. */
export const ComposeIcon: ShellIcon = (props) => (
  <Glyph {...props}>
    <path d="M12 5H7.5A2.5 2.5 0 0 0 5 7.5v9A2.5 2.5 0 0 0 7.5 19h9a2.5 2.5 0 0 0 2.5-2.5V12" />
    <path d="M17.7 4.3a1.8 1.8 0 0 1 2.5 2.5L12.5 14.5l-3.2.7.7-3.2z" />
  </Glyph>
);
