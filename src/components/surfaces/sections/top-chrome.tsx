"use client";

/**
 * TopChrome — the top utility bar: a layout toggle (left) and the theme toggle
 * (right).
 *
 * The gamified streak / planned / accuracy rings were removed in the premium
 * elevation pass (2026-07-05): they were cryptic, unlabeled consumer-app chrome
 * that spent visual weight three times over. The accuracy proof now lives in the
 * greeting line ("84% of last week's calls landed"), this-week planning lives in
 * the calendar widget, and the streak was retired as off-brand.
 */

import { SurfaceIcon } from "../icons";
import { cn } from "@/lib/utils";

export function TopChrome({
  onLayout,
  onTheme,
}: {
  onLayout?: () => void;
  onTheme?: () => void;
}) {
  const btn =
    "grid size-[30px] place-items-center rounded-[9px] text-foreground-secondary transition-colors hover:bg-surface-elevated";

  return (
    <div className="flex items-center justify-between px-1 pb-2.5 pt-1">
      <button type="button" onClick={onLayout} className={cn(btn)} aria-label="Layout options">
        <SurfaceIcon name="layout" size={18} />
      </button>
      <button type="button" onClick={onTheme} className={cn(btn)} aria-label="Toggle theme">
        <SurfaceIcon name="sun" size={17} />
      </button>
    </div>
  );
}
