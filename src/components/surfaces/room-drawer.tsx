"use client";

/**
 * RoomDrawer — STUB of "tap a card → the Room opens anchored on it" (Seam 1 → Seam 2).
 *
 * A bottom sheet showing the anchored card's Read: the blended headline stop, the named
 * people's reactions in voice, the weak spot + the fix, and the loved/bounced split — the
 * SAME drill you get in-thread. "Develop / Remix in a thread →" is the Seam 4 handoff.
 *
 * ⚠️ STUB: the FULL Room (persona chat · population swarm · rewrite loop) is The Room's,
 * grafted at integration ("open full room →" is a placeholder here). This renders the
 * contract-shaped Read (mock) so every card is already a real door.
 */

import { useEffect } from "react";
import { X } from "lucide-react";
import type { Read } from "@/lib/room-contract/types";
import { toneBar } from "./tone";
import { SurfaceIcon } from "./icons";
import { cn } from "@/lib/utils";

export interface RoomFocus {
  read: Read;
  title: string;
  kind: "Idea" | "Outlier";
  metric: string;
}

export function RoomDrawer({
  focus,
  onClose,
  onDevelop,
  onOpenFull,
  onAskPerson,
}: {
  focus: RoomFocus | null;
  onClose: () => void;
  onDevelop: (focus: RoomFocus) => void;
  onOpenFull: () => void;
  onAskPerson: (name: string) => void;
}) {
  const open = Boolean(focus);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!focus) return null;
  const { read, title, kind, metric } = focus;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close the room"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/45"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`The room · ${title}`}
        className="rv-in relative flex max-h-[78vh] w-full max-w-[640px] flex-col rounded-t-[20px] border border-b-0 border-border-hover bg-background shadow-[0_-18px_44px_rgba(0,0,0,0.42)]"
      >
        <div className="flex justify-center pb-0.5 pt-2">
          <span className="h-1 w-[34px] rounded-full bg-white/20" />
        </div>

        <div className="flex items-start justify-between gap-2 px-3 pb-1.5 pr-3">
          <div className="min-w-0 flex-1">
            <div className="flex min-h-6 items-center gap-2">
              <span className="font-mono text-[11px] text-foreground">
                <span className="text-foreground-muted">{kind} · your people</span>
              </span>
              <button
                type="button"
                onClick={onOpenFull}
                className="ml-auto inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[7px] border border-border px-2 py-[3px] font-mono text-[10.5px] text-foreground-muted transition-colors hover:text-foreground-secondary"
              >
                open full room
                <SurfaceIcon name="chevron" size={11} />
              </button>
            </div>
            <div className="mt-[5px] font-serif text-[21px] leading-[1.1] text-foreground">
              {read.stop} of 10 {metric}
              <small className="mt-[3px] block font-sans text-[10.5px] leading-[1.35] text-foreground-muted">
                {title}
              </small>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="mt-0.5 grid size-[26px] shrink-0 place-items-center rounded-md bg-surface text-foreground-muted transition-colors hover:text-foreground-secondary"
          >
            <X className="size-[13px]" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {read.reactions.map((r, i) => (
            <button
              key={r.person.id}
              type="button"
              onClick={() => onAskPerson(r.person.name)}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-lg px-1.5 py-2.5 text-left transition-colors hover:bg-surface",
                i > 0 && "border-t border-border",
              )}
            >
              <span
                className="grid size-[29px] shrink-0 place-items-center rounded-full text-[12px] font-bold text-[color:var(--color-background)]"
                style={{ background: toneBar[r.tone] }}
              >
                {r.person.name[0]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold text-foreground">{r.person.name}</span>
                <span className="block text-[10.5px] text-foreground-muted">{r.person.segment}</span>
                <span className="mt-[3px] block text-[11.5px] leading-[1.4] text-foreground-secondary">“{r.verdict}”</span>
              </span>
              <span className="shrink-0 self-center font-mono text-[10.5px] text-foreground-muted">ask →</span>
            </button>
          ))}
          <div className="py-2.5 text-center font-mono text-[11px] text-foreground-muted">
            {read.population
              ? `modeled from your ${read.population.modeledFrom} people`
              : "the people who make up your room"}
          </div>
        </div>

        <div className="shrink-0 border-t border-border px-3.5 py-2.5">
          <div className="mb-2.5 text-[11px] leading-[1.5] text-foreground-secondary">
            <b className="font-semibold text-foreground">Weak spot:</b> {read.weakSpot}
            <br />
            <b className="font-semibold text-foreground">The fix:</b> {read.fix}
          </div>
          <SplitRow k="Loved it" pct={read.split.loved} tone="loved" />
          <SplitRow k="Bounced" pct={read.split.bounced} tone="bounced" />
        </div>

        <button
          type="button"
          onClick={() => onDevelop(focus)}
          className="mx-3 mb-3 mt-2 shrink-0 rounded-[10px] bg-accent px-3 py-[11px] text-center text-[12.5px] font-semibold text-[color:var(--color-accent-foreground)] transition-colors hover:bg-accent-hover"
        >
          {kind === "Outlier" ? "Remix this in a thread →" : "Develop this in a thread →"}
        </button>
      </div>
    </div>
  );
}

function SplitRow({ k, pct, tone }: { k: string; pct: number; tone: "loved" | "bounced" }) {
  return (
    <div className="mb-[5px] flex items-center gap-2 text-[10.5px] text-foreground-secondary last:mb-0">
      <span className="w-[52px] text-foreground-muted">{k}</span>
      <span className="h-[7px] rounded-[5px]" style={{ background: toneBar[tone], width: `${pct}%` }} />
      <span className="ml-auto [font-variant-numeric:tabular-nums]">{pct}%</span>
    </div>
  );
}
