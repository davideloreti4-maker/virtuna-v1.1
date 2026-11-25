import * as React from "react";

/**
 * A sentence in place of a pushed page (a video or a collection that is gone, or could not be read), and
 * the ways on under it. An alert for a failure; the page as it arrives otherwise. Presentational.
 */
export function PageNotice({ line, alert, children }: { line: string; alert?: boolean; children: React.ReactNode }): React.JSX.Element {
  return (
    <div role={alert ? "alert" : undefined} className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <p className="text-ui text-foreground-secondary">{line}</p>
      {children}
    </div>
  );
}

/** A link drawn as a chip (Back to Discover, a watch link), with room for a leading glyph. */
export const CHIP_LINK =
  "tap-44 inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-surface px-3.5 text-reading font-[560] leading-none text-foreground shadow-[var(--shadow-control)] transition-[scale] duration-150 motion-safe:active:scale-[0.98] [&_svg]:size-[17px]";
