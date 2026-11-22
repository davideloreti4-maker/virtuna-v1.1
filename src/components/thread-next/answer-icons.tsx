import type { ShellIcon, ShellIconProps } from "@/components/shell/icons";

/**
 * The answer cards' own glyphs, which neither the shell's set nor the field's has: upload ("Add
 * your take"), play ("Watch it run") and expand ("Open simulation"). Same drawing rules as
 * `field-icons.tsx` (24×24 viewBox, `currentColor`, round caps and joins, sized with `size`). The
 * paths and stroke weights are the drawing's (`.scratch/next-look/part3/answers/answers.html`, `I`).
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
