"use client";

/**
 * LaneQuestion — the one conversational question on the day-0 describe path (spec §4.1).
 *
 * "A niche is chosen by reacting to concrete content, never by filling out a form." This is
 * the single exception the spec allows, and it is deliberately ONE open question, not a form.
 * The question is a VOICE MOMENT → Newsreader serif (spec §8); everything else is chrome.
 *
 * Zero accent (locked). Type comes from the roles, never a raw px size. The submit stays
 * disabled while a run is in flight — the busy guard IS the debounce (fire-on-demand law).
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LaneQuestion({
  onSubmit,
  submitting,
  error,
}: {
  onSubmit: (answer: string) => void;
  submitting: boolean;
  error?: string | null;
}) {
  const [answer, setAnswer] = useState("");
  const trimmed = answer.trim();

  return (
    <div className="w-full space-y-6">
      <label
        htmlFor="lane-answer"
        className="block font-serif text-subhead leading-snug text-foreground"
      >
        What could you talk about for 20 minutes without notes?
      </label>

      <div className="space-y-4">
        <textarea
          id="lane-answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="e.g. how to actually stick to a budget when your income moves every month"
          rows={4}
          maxLength={500}
          className={cn(
            "w-full resize-none rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-body text-foreground",
            "placeholder:text-foreground-muted",
            "focus:border-white/[0.10] focus:outline-none focus:ring-2 focus:ring-white/10",
          )}
        />

        {error && <p className="text-label text-error">{error}</p>}

        {/* Primary action, neutral cream — primary actions never carry the accent (locked). */}
        <Button
          variant="primary"
          className="w-full"
          disabled={trimmed.length === 0 || submitting}
          onClick={() => onSubmit(trimmed)}
        >
          {submitting ? "Finding your lanes…" : "Find my lanes"}
        </Button>
      </div>
    </div>
  );
}
