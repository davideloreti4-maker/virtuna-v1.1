"use client";

/**
 * ContentPillars — the creator's recurring themes, with this-month distribution + a
 * proactive "you're neglecting this pillar" nudge (the Stanley-referenced beat: a
 * calendar that knows your pillars, not just your dates).
 *
 * Honesty spine: the SHARE bar is real (derived from the account's posts); the tone dot
 * is a DIRECTIONAL forecast of how the creator's people tend to respond to that pillar —
 * a reserved ambient slot, never a fabricated live reaction. Tapping a pillar seeds the
 * composer scoped to it (Make for that theme). Low-ambient, no Room dependency.
 */

import type { Pillar } from "@/lib/room-contract/mock-room";
import { toneBar, toneDot } from "../tone";
import { cn } from "@/lib/utils";

export function ContentPillars({
  pillars,
  onPillar,
}: {
  pillars: Pillar[];
  onPillar: (pillar: Pillar) => void;
}) {
  const gap = pillars.find((p) => p.gap);

  return (
    <div className="rounded-xl border border-border bg-surface-elevated px-3.5 py-[15px]">
      <div className="mb-2 flex items-baseline gap-2">
        <h3 className="m-0 flex-1 text-[15px] font-semibold tracking-[-0.01em] text-foreground">
          Content pillars
        </h3>
        <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.08em] text-foreground-muted">
          {pillars.length} active
        </span>
      </div>

      <div className="flex flex-col gap-0.5">
        {pillars.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPillar(p)}
            className="group flex items-center gap-2.5 rounded-lg px-1.5 py-[9px] text-left transition-colors hover:bg-[color:var(--color-surface-thread)]"
            aria-label={`Make for the ${p.name} pillar (${Math.round(p.share * 100)}% of this month)`}
          >
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: toneDot[p.tone] }}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[12.5px] text-foreground">{p.name}</span>
                {p.gap && (
                  <span className="shrink-0 rounded-[4px] border border-border px-1 py-px font-mono text-[8.5px] uppercase tracking-[0.05em] text-foreground-muted">
                    gap
                  </span>
                )}
              </span>
              <span className="mt-1.5 flex items-center gap-2">
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-[color:var(--color-surface-thread)]">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${Math.round(p.share * 100)}%`, background: toneBar[p.tone] }}
                  />
                </span>
                <span className="shrink-0 font-mono text-[9.5px] tabular-nums text-foreground-muted">
                  {Math.round(p.share * 100)}%
                </span>
              </span>
            </span>
          </button>
        ))}
      </div>

      <div
        className={cn(
          "mt-3 border-t border-border pt-2.5 font-mono text-[9px] leading-[1.5] text-foreground-muted",
        )}
      >
        {gap ? (
          <>
            {gap.cadence} in <span className="text-foreground-secondary">{gap.name}</span> — tap to make one.
          </>
        ) : (
          <>Balanced across your pillars.</>
        )}{" "}
        · Directional
      </div>
    </div>
  );
}
