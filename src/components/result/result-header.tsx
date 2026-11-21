"use client";

import { useRouter } from "next/navigation";
import { BackIcon } from "@/components/shell/icons";
import { IconButton } from "@/components/ui/icon-button";

/**
 * Desktop header row of the result page (md and up; on the phone the shell's pushed header shows
 * the same title). As in `spec-11-desktop.png` and the mock's `.desk .top`: 68 tall, 12 from the
 * content's left edge, Back then the title, 10 apart.
 *
 * Back returns to where the creator came from (a thread, a card, Library); opened directly there
 * is nothing to go back to, so it goes Home. Same rule as the phone header (NextShell).
 */
export function ResultHeader({ title }: { title: string }) {
  const router = useRouter();
  const back = () => (window.history.length > 1 ? router.back() : router.push("/home"));
  return (
    <div className="hidden h-[68px] items-center gap-2.5 pl-3 pr-8 md:flex">
      <IconButton aria-label="Back" onClick={back}>
        <BackIcon aria-hidden />
      </IconButton>
      <h1 className="min-w-0 truncate text-title font-[640] tracking-[-0.014em] text-foreground tabular-nums">
        {title}
      </h1>
    </div>
  );
}
