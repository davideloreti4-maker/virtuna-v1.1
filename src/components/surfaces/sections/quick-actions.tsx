"use client";

/**
 * QuickActions — the three verbs (Make · Test · Ask) + Repurpose, each mapping to a
 * composer verb. Line-icons; tapping a row sets the composer verb (Seam 4 entry).
 */

import type { QuickAction } from "@/lib/room-contract/mock-room";
import { SurfaceIcon } from "../icons";

export function QuickActions({
  actions,
  onAction,
}: {
  actions: QuickAction[];
  onAction: (action: QuickAction) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated px-3.5 pb-2.5 pt-0">
      <h3 className="m-0 mb-1 mt-[13px] text-[15px] font-semibold tracking-[-0.01em] text-foreground">Quick actions</h3>
      {actions.map((a, i) => (
        <button
          key={a.label}
          type="button"
          onClick={() => onAction(a)}
          className={`flex w-full items-center gap-3 py-3 text-left transition-[padding] hover:pl-[3px] ${i > 0 ? "border-t border-border" : ""}`}
        >
          <span className="grid size-[34px] shrink-0 place-items-center rounded-[10px] border border-border bg-[color:var(--color-surface-thread)] text-foreground">
            <SurfaceIcon name={a.icon} size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium text-foreground">{a.label}</span>
            <span className="mt-0.5 block text-[10.5px] text-foreground-muted">{a.desc}</span>
          </span>
          <SurfaceIcon name="chevron" size={13} className="text-foreground-muted" />
        </button>
      ))}
    </div>
  );
}
