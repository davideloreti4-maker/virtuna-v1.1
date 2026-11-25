"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

export type PanelId = "brain" | "engagement" | "audience";

/** The three panels, in the order the switch shows them. */
const PANELS: ReadonlyArray<{ id: PanelId; label: string }> = [
  { id: "brain", label: "Brain" },
  { id: "engagement", label: "Engagement" },
  { id: "audience", label: "Audience" },
];

export const tabId = (base: string, id: PanelId) => `${base}-tab-${id}`;
export const panelId = (base: string) => `${base}-panel`;

/**
 * Brain · Engagement · Audience: a segmented control (the mock's `.tabs`). A 4px tint track
 * (radius 16), three equal segments (radius 12), 36 tall on the phone and 38 on desktop; the
 * selected one is the card surface with the control shadow.
 *
 * Keyboard (WAI-ARIA tabs, automatic activation): only the selected tab is in the Tab order; left
 * and right arrows move the selection and the focus and wrap; Home and End go to the ends.
 */
export function PanelSwitch({
  value,
  onChange,
  idBase,
  className,
}: {
  value: PanelId;
  onChange: (id: PanelId) => void;
  idBase: string;
  className?: string;
}) {
  const refs = useRef<Partial<Record<PanelId, HTMLButtonElement | null>>>({});

  const move = (to: number) => {
    const next = PANELS[(to + PANELS.length) % PANELS.length]!.id;
    onChange(next);
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const at = PANELS.findIndex((panel) => panel.id === value);
    if (event.key === "ArrowRight") move(at + 1);
    else if (event.key === "ArrowLeft") move(at - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(PANELS.length - 1);
    else return;
    event.preventDefault();
  };

  return (
    <div
      role="tablist"
      aria-label="Panels"
      data-result="tabs"
      onKeyDown={onKeyDown}
      className={cn("flex rounded-xl bg-surface-sunken p-1", className)}
    >
      {PANELS.map((panel) => {
        const selected = panel.id === value;
        return (
          <button
            key={panel.id}
            ref={(el) => {
              refs.current[panel.id] = el;
            }}
            type="button"
            role="tab"
            id={tabId(idBase, panel.id)}
            aria-selected={selected}
            aria-controls={panelId(idBase)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(panel.id)}
            className={cn(
              "tap-44 flex h-9 min-w-0 flex-1 items-center justify-center rounded-lg text-ui font-[560] md:h-[38px]",
              "motion-safe:transition-[color,background-color,box-shadow] motion-safe:duration-150",
              selected
                ? "bg-surface text-foreground shadow-[var(--shadow-control)] dark:bg-surface-elevated"
                : "text-foreground-secondary hover:text-foreground",
            )}
          >
            {panel.label}
          </button>
        );
      })}
    </div>
  );
}
