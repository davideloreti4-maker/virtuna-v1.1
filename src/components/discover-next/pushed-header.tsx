"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { BackIcon } from "@/components/shell/icons";
import { IconButton } from "@/components/ui/icon-button";
import { DISCOVER_PATH } from "@/lib/discover-next/discover-view";

/**
 * The desktop header of a page Discover pushes (a video, a collection, the pull page), as the result
 * page's (`result/result-header.tsx`): from 768, 68 tall, Back then the title as the page's `<h1>`, and
 * at the right an optional action. On a phone the shell's pushed header is the title (the page names
 * itself with `usePushedTitle`), so one `<h1>` is shown at each width.
 *
 * Back goes back in history, to the grid as it was left (its filter, search and scroll live in the
 * hub's history entry); opened directly there is nothing to go back to, so it goes to Discover. The
 * phone's Back follows the same rule (`backInHistory` in the shell).
 */
export interface PushedHeaderProps {
  title: string;
  trailing?: React.ReactNode;
}

/** As an `<h1>` the app-wide `h1` tracking (unlayered) would beat a utility: inline. */
const TITLE_TRACKING: React.CSSProperties = { letterSpacing: "-0.014em" };

export function PushedHeader({ title, trailing }: PushedHeaderProps): React.JSX.Element {
  const router = useRouter();
  const back = () => (window.history.length > 1 ? router.back() : router.push(DISCOVER_PATH));
  return (
    <div className="hidden h-[68px] items-center gap-2.5 pl-3 pr-8 md:flex">
      <IconButton aria-label="Back" onClick={back}>
        <BackIcon aria-hidden />
      </IconButton>
      <h1 style={TITLE_TRACKING} className="min-w-0 flex-1 truncate text-title font-[640] text-foreground">
        {title}
      </h1>
      {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
    </div>
  );
}
