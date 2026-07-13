"use client";

/**
 * BacklogRail — the /calendar right-rail pool. Two tabs:
 *   - Ideas: the creator's fresh pre-tested ideas (the /start ideas cache) NOT yet on a
 *     day — draggable, or tap to place. Each card shows its real reaction: tone + a
 *     stop-meter + one verbatim line from the sim (personasToCardFace).
 *   - Scheduled: what's on the calendar, soonest first, each with its day + an unschedule ×.
 *
 * Scheduling an idea moves it from Ideas → Scheduled (it leaves the pool because its
 * contentId now has a planned_posts row). Honesty spine: every face is the REAL sim.
 */

import type { LiveIdeaCard } from "@/lib/surfaces/live-cards";
import type { PlannedPostRow } from "@/lib/planned-posts/planned-posts-repo";
import { personasToCardFace } from "@/lib/surfaces/live-cards";
import { labelWhen } from "@/lib/calendar/planned-plan";
import { toneDot, toneBar, toneLabel } from "@/components/surfaces/tone";
import { cn } from "@/lib/utils";

export function BacklogRail({
  activeTab,
  onTab,
  pool,
  scheduled,
  placingId,
  warming,
  onTapIdea,
  onDragStartIdea,
  onDragEndIdea,
  onUnschedule,
}: {
  activeTab: "ideas" | "scheduled";
  onTab: (tab: "ideas" | "scheduled") => void;
  pool: LiveIdeaCard[];
  scheduled: PlannedPostRow[];
  placingId: string | null;
  warming: boolean;
  onTapIdea: (contentId: string) => void;
  onDragStartIdea: (contentId: string) => void;
  onDragEndIdea: () => void;
  onUnschedule: (rowId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated">
      <div className="flex gap-1 border-b border-border p-1">
        {(["ideas", "scheduled"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTab(tab)}
            className={cn(
              "flex-1 rounded-lg py-[7px] text-center text-[12px] font-medium capitalize transition-colors",
              activeTab === tab
                ? "bg-[color:var(--color-surface-thread)] text-foreground"
                : "text-foreground-muted hover:text-foreground-secondary",
            )}
          >
            {tab}{" "}
            <span className="font-mono text-[9.5px] opacity-80">
              {tab === "ideas" ? pool.length : scheduled.length}
            </span>
          </button>
        ))}
      </div>

      {activeTab === "ideas" && pool.length > 0 && (
        <p className="px-3.5 pb-0.5 pt-2 font-mono text-[9px] leading-[1.4] text-foreground-muted">
          <span className="text-[color:var(--color-accent-text)]">★</span> = Maven’s pick
        </p>
      )}

      <div className="flex max-h-[440px] flex-col gap-1.5 overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {activeTab === "ideas" ? (
          pool.length === 0 ? (
            <p className="px-3 py-6 text-center text-[11.5px] leading-[1.5] text-foreground-muted">
              {warming
                ? "Testing today’s ideas on your people…"
                : "Every tested idea is on the calendar. Maven warms a fresh batch each day."}
            </p>
          ) : (
            pool.map((idea) => {
              const face = personasToCardFace(idea.personas);
              const selected = placingId === idea.contentId;
              return (
                <div
                  key={idea.contentId}
                  role="button"
                  tabIndex={0}
                  draggable
                  onClick={() => onTapIdea(idea.contentId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onTapIdea(idea.contentId);
                    }
                  }}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", `idea:${idea.contentId}`);
                    onDragStartIdea(idea.contentId);
                  }}
                  onDragEnd={onDragEndIdea}
                  aria-label={`${idea.title} — tap to place on the calendar`}
                  className={cn(
                    "group cursor-grab rounded-[10px] border bg-surface p-[10px_11px] transition-shadow active:cursor-grabbing",
                    selected
                      ? "border-[color:var(--color-accent)] shadow-[0_0_0_1px_var(--color-accent)]"
                      : "border-border hover:border-border-hover",
                  )}
                >
                  <IdeaFace
                    tone={face.tone}
                    stop={face.stop}
                    format={idea.type}
                    title={idea.title}
                    lead={face.lead}
                  />
                  {selected ? (
                    <div className="mt-2 flex items-center">
                      <span className="font-mono text-[9px] uppercase tracking-[0.04em] text-[color:var(--color-accent-text)]">
                        ★ pick a day
                      </span>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      <span className="font-mono text-[9px] uppercase tracking-[0.04em] text-foreground-muted">
                        tap to place
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )
        ) : scheduled.length === 0 ? (
          <p className="px-3 py-6 text-center text-[11.5px] leading-[1.5] text-foreground-muted">
            Nothing scheduled yet. Tap an idea, then a day.
          </p>
        ) : (
          scheduled.map((row) => {
            const face = personasToCardFace(row.personas);
            const { md, dow } = labelWhen(row.scheduled_date);
            return (
              <div
                key={row.id}
                className="rounded-[10px] border border-border bg-surface p-[10px_11px]"
              >
                <IdeaFace
                  tone={face.tone}
                  stop={face.stop}
                  format={row.format}
                  title={row.title}
                  lead={face.lead}
                />
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-[5px] border border-[color:var(--color-accent)]/40 px-1.5 py-px font-mono text-[9px] text-[color:var(--color-accent-text)]">
                    {dow} {md}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUnschedule(row.id)}
                    aria-label={`Unschedule ${row.title}`}
                    className="ml-auto grid size-5 place-items-center rounded-md text-[15px] leading-none text-foreground-muted transition-colors hover:bg-[color:var(--color-surface-thread)] hover:text-foreground"
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Shared card face — tone label, stop-meter, title, one verbatim reaction. */
function IdeaFace({
  tone,
  stop,
  format,
  title,
  lead,
}: {
  tone: "loved" | "bounced" | "neutral";
  stop: number;
  format: string;
  title: string;
  lead: string;
}) {
  return (
    <>
      <div className="mb-2 flex items-center gap-2">
        <span aria-hidden className="size-[7px] shrink-0 rounded-full" style={{ background: toneDot[tone] }} />
        <span className="text-[11px] font-semibold capitalize text-foreground">{toneLabel[tone]}</span>
        <span className="ml-auto rounded-[4px] border border-border px-1.5 py-px font-mono text-[8px] uppercase tracking-[0.05em] text-foreground-muted">
          {format}
        </span>
      </div>
      <p className="m-0 mb-2 text-[12.5px] leading-[1.32] text-foreground">{title}</p>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
          <span className="block h-full rounded-full" style={{ width: `${stop * 10}%`, background: toneBar[tone] }} />
        </span>
        <span className="shrink-0 font-mono text-[9.5px] tabular-nums text-foreground-secondary">
          {stop}/10 would stop
        </span>
      </div>
      {lead && (
        <p className="m-0 text-[11px] italic leading-[1.45] text-foreground-muted">“{lead}”</p>
      )}
    </>
  );
}
