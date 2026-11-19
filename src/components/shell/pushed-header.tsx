"use client";

import { IconButton } from "@/components/ui/icon-button";
import { BackIcon } from "./icons";

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
 * `titleAs="div"` where the screen below already has its own <h1> (the thread has one).
 */
export function PushedHeader({
  title,
  onBack,
  trailing,
  titleAs: Title = "h1",
}: {
  title: string;
  onBack: () => void;
  trailing?: React.ReactNode;
  titleAs?: "h1" | "div";
}) {
  return (
    <header className="grid h-10 grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-x-2">
      <IconButton aria-label="Back" onClick={onBack}>
        <BackIcon aria-hidden />
      </IconButton>
      <Title className="truncate text-center text-title font-[640] tracking-[-0.014em] text-foreground">{title}</Title>
      <div className="flex justify-end">{trailing}</div>
    </header>
  );
}
