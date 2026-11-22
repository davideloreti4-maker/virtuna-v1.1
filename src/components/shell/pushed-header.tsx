"use client";

import { IconButton } from "@/components/ui/icon-button";
import { BackIcon } from "./icons";

/** -0.014em, inline: as an <h1> the app-wide `h1 { letter-spacing: -0.02em }` in globals.css
 *  (unlayered) would beat a tracking utility. */
const TITLE_TRACKING: React.CSSProperties = { letterSpacing: "-0.014em" };

/**
 * Pushed header (new look, spec §6.1): 40 tall. Back on the left, the title centred on one
 * line (it truncates), one trailing action on the right. Used by every screen that is pushed
 * on top of a place: a thread, a result, a video, settings.
 *
 * As in the reference: both controls are white round buttons (38px, hairline and a soft
 * shadow) with an 18px glyph; the title is 16 / 640, tracked -0.014em. An 8px column gap keeps
 * a long title 10px clear of either button.
 *
 * Focus: these two buttons keep the app-wide outside ring, not SHELL_FOCUS (the inset ring the
 * sidebar rows use). The sidebar scrolls and would clip an outside ring; this header and its
 * fixed wrapper clip nothing, and an inset ring on a white 38px circle would crowd its glyph.
 *
 * `titleAs="div"` where the screen below already has its own <h1>.
 *
 * `subtitle`: a second line under the title (a thread's "For @nia.tests"; reference
 * `.scratch/next-look/part3/answers/answers.html`, `.ax .nav b` and `.ax-sub`): 12 / 500 in the
 * muted ink (the drawing's `--t3`), 2 under the title, both centred and truncated, the two lines at
 * 1.15 so they stack inside the 40px band. Without one the title keeps its own line height.
 *
 * The title's tracking is inline (`TITLE_TRACKING`).
 */
export function PushedHeader({
  title,
  subtitle,
  onBack,
  trailing,
  titleAs: Title = "h1",
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  trailing?: React.ReactNode;
  titleAs?: "h1" | "div";
}) {
  const titleClass = "truncate text-center text-title font-[640] text-foreground";
  return (
    <header className="grid h-10 grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-x-2">
      <IconButton aria-label="Back" onClick={onBack}>
        <BackIcon aria-hidden />
      </IconButton>
      {subtitle ? (
        <div className="flex min-w-0 flex-col items-center">
          <Title style={TITLE_TRACKING} className={`w-full leading-[1.15] ${titleClass}`}>
            {title}
          </Title>
          <span className="mt-0.5 w-full truncate text-center text-label font-medium leading-[1.15] text-foreground-muted">
            {subtitle}
          </span>
        </div>
      ) : (
        <Title style={TITLE_TRACKING} className={titleClass}>
          {title}
        </Title>
      )}
      <div className="flex justify-end">{trailing}</div>
    </header>
  );
}
