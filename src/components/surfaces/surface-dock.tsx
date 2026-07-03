"use client";

/**
 * SurfaceDock — STUB of the app-wide living-presence dock (Seam 3, THE-CONTRACT.md §3).
 *
 * The Room's always-visible presence, made mountable OUTSIDE the thread
 * (`AudiencePresence variant='surface'`). Shows the breathing constellation + the
 * active audience + its pulse + tier, and opens an audience switcher. On non-thread
 * surfaces it reads a USER-LEVEL active audience (THE-CONTRACT.md §6.2, still open).
 *
 * ⚠️ STUB: The Room owns the real component (portals its switcher to <body> +
 * position:fixed to escape overflow). This mirrors the shape + interactions so the
 * shell is ambient-READY; swap stub → real at the graft.
 */

import { useState } from "react";
import { ChevronUp } from "lucide-react";
import type { ActiveAudience } from "@/lib/room-contract/types";
import { cn } from "@/lib/utils";
import { AudienceConstellation } from "./audience-constellation";

export interface SurfaceDockProps {
  audience: ActiveAudience | null;
  audiences: ActiveAudience[];
  onSwitch: (audienceId: string) => void;
  /** The card the room is anchored on (null = honest idle). Drives the "reacting" pulse. */
  reacting?: boolean;
  className?: string;
}

export function SurfaceDock({
  audience,
  audiences,
  onSwitch,
  reacting = false,
  className,
}: SurfaceDockProps) {
  const [open, setOpen] = useState(false);
  const idle = !audience;

  return (
    <div className={cn("relative", className)}>
      {open && !idle && (
        <>
          <button
            type="button"
            aria-label="Close audience switcher"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-[calc(100%+8px)] z-20 rounded-2xl border border-border-hover bg-surface-elevated p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="px-2.5 pb-1 pt-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-foreground-muted">
              Your audiences
            </div>
            {audiences.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  onSwitch(a.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-[9px] rounded-lg px-2.5 py-[9px] text-left transition-colors hover:bg-[color:var(--color-surface-thread)]"
              >
                <span
                  className="grid size-[22px] shrink-0 place-items-center rounded-full text-[10px] font-bold text-[color:var(--color-background)]"
                  style={{ background: a.goal === "Sell" ? "#8a857b" : "#8ea68a" }}
                >
                  {a.name[0]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium text-foreground">
                    {a.name}
                  </span>
                  <span className="block truncate text-[10.5px] text-foreground-muted">
                    {a.platform}
                  </span>
                </span>
                <span className="shrink-0 rounded-[5px] border border-border px-1.5 py-px font-mono text-[9.5px] uppercase text-foreground-muted">
                  {a.goal}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => !idle && setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-[9px] rounded-2xl border px-[11px] py-[9px] text-left transition-colors",
          "border-border-hover bg-[color:var(--color-surface-thread)]",
          idle ? "cursor-default opacity-60" : "cursor-pointer hover:border-[color:var(--color-border-hover)]",
        )}
        aria-label={idle ? "No audience connected" : `Active audience: ${audience.name}`}
      >
        <AudienceConstellation reacting={reacting} className="shrink-0" />
        <span className="min-w-0 flex-1 overflow-hidden">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
            <span className="truncate">{idle ? "No audience yet" : audience.name}</span>
            {!idle && <span className="shrink-0 text-[9px] text-foreground-muted">▾</span>}
          </span>
          <span className="mt-px block truncate text-[11px] text-foreground-secondary">
            {idle ? "connect to bring your room alive" : audience.pulse}
          </span>
        </span>
        {!idle && (
          <span className="shrink-0 rounded-[5px] border border-border px-1.5 py-0.5 font-mono text-[8.5px] tracking-[0.04em] text-foreground-muted">
            {audience.tier}
          </span>
        )}
        {!idle && <ChevronUp aria-hidden className="size-[13px] shrink-0 text-foreground-muted" />}
      </button>
    </div>
  );
}
