"use client";

import * as React from "react";
import { useId, useLayoutEffect, useRef } from "react";

import { Chip } from "@/components/ui/chip";

import { CancelButton, ErrorLine, RowButton, cancelOnEscape } from "./row-parts";
import { GOALS, SAVE_FAILED, goalLabel, type GoalValue } from "./you-words";

/** Goal (spec §3.1): open, four chips, saved on tap; the saved chip takes the focus. */
export interface GoalRowProps {
  goal: GoalValue | null;
  open: boolean;
  busy: boolean;
  failed: boolean;
  onOpen(): void;
  onPick(goal: GoalValue): void;
  onCancel(): void;
  buttonRef?: React.Ref<HTMLButtonElement>;
}

export function GoalRow(props: GoalRowProps): React.JSX.Element {
  if (!props.open) return <RowButton label="Goal" value={goalLabel(props.goal)} onOpen={props.onOpen} buttonRef={props.buttonRef} />;
  return <GoalPicker {...props} />;
}

function GoalPicker({ goal, busy, failed, onPick, onCancel }: GoalRowProps) {
  const id = useId();
  const groupRef = useRef<HTMLDivElement>(null);
  // Opened: the saved chip takes the focus, or the first when nothing is saved.
  useLayoutEffect(() => {
    const chips = groupRef.current?.querySelectorAll<HTMLButtonElement>("button");
    const chosen = groupRef.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    (chosen ?? chips?.[0])?.focus();
  }, []);
  return (
    <div className="pb-4 pt-3.5" onKeyDown={cancelOnEscape(busy, onCancel)}>
      <p id={`${id}-label`} className="text-title font-[640] text-foreground">
        Goal
      </p>
      <div ref={groupRef} role="group" aria-labelledby={`${id}-label`} aria-busy={busy || undefined} className="mt-2.5 flex flex-wrap gap-2">
        {GOALS.map((g) => (
          <Chip
            key={g.value}
            selected={goal === g.value}
            onClick={() => {
              if (busy) return;
              if (goal === g.value) onCancel();
              else onPick(g.value);
            }}
          >
            {g.label}
          </Chip>
        ))}
      </div>
      {failed && <ErrorLine>{SAVE_FAILED}</ErrorLine>}
      <CancelButton busy={busy} onCancel={onCancel} />
    </div>
  );
}
