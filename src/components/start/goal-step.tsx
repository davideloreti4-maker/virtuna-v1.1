"use client";

/** Your 90-day goal (funnel spec §3.2, screen 4): one of four, the app's radio on a card row, then Continue. */
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { GOALS, type Goal, type StartAnswers } from "@/lib/onboarding/answers";
import { cn } from "@/lib/utils";

import { PICKED, Push, RADIO, REST, StepTitle } from "./start-parts";
import { START_WORDS as W } from "./start-words";

export function GoalStep({ answers, onDone }: { answers: StartAnswers; onDone: (patch: Partial<StartAnswers>) => void }) {
  const [picked, setPicked] = useState<Goal | null>(answers.goal ?? null);
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (picked) onDone({ goal: picked });
      }}
      className="flex flex-1 flex-col"
    >
      <StepTitle title={W.goalTitle} line={W.goalLine} />
      <fieldset className="mt-6">
        <legend className="sr-only">{W.goalTitle}</legend>
        <div className="flex flex-col gap-2.5">
          {GOALS.map((goal) => (
            <label
              key={goal}
              className={cn(
                "flex min-h-16 cursor-pointer items-center gap-3.5 rounded-3xl bg-surface px-[18px] py-3",
                picked === goal ? PICKED : REST,
              )}
            >
              <input type="radio" name="start-goal" value={goal} checked={picked === goal} onChange={() => setPicked(goal)} className={RADIO} />
              <span className={cn("text-title text-foreground", picked === goal ? "font-[640]" : "font-[560]")}>{W.goal[goal]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Push />
      <Button type="submit" variant="primary" size="xl" className="w-full" disabled={picked === null}>
        {W.continue}
      </Button>
    </form>
  );
}
