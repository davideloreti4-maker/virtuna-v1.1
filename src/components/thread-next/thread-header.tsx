"use client";

import { useThreadTitle } from "@/components/shell/use-thread-title";

/**
 * The desktop thread header (thread answers step 1, spec §5; drawing
 * `.scratch/next-look/part3/answers/answers.html`, `axDesk`: `.desk .top` with `.ax-sub2`), md and up.
 * On a phone the shell's pushed header carries the same title and audience (`NextShell`).
 *
 * As `ResultHeader` and the drawing: 68 tall, 12 from the content's left edge, 32 from its right.
 * The thread's title (16 / 640, the page's `<h1>`), then "For {audience}" 10 after it, 13 / 500 in
 * the muted ink (the drawing's `--t3`). A long title truncates; the audience keeps its width. No Share: nothing can be
 * shared yet (no route, no public page).
 *
 * The title is tracked inline: the app-wide `h1 { letter-spacing: -0.02em }` in globals.css is
 * unlayered, so it beats any tracking utility.
 */
const TITLE_TRACKING: React.CSSProperties = { letterSpacing: "-0.014em" };

export function DesktopThreadHeader({ title, audience }: { title: string; audience: string | null }) {
  return (
    <div className="hidden h-[68px] shrink-0 items-center gap-2.5 pl-3 pr-8 md:flex">
      <h1 style={TITLE_TRACKING} className="min-w-0 truncate text-title font-[640] text-foreground">
        {title}
      </h1>
      {audience ? (
        <span className="shrink-0 whitespace-nowrap text-body font-medium text-foreground-muted">For {audience}</span>
      ) : null}
    </div>
  );
}

/** The header of the open thread: its title from the thread list (`useThreadTitle`). */
export function ThreadHeader({ audience }: { audience: string | null }) {
  return <DesktopThreadHeader title={useThreadTitle()} audience={audience} />;
}
