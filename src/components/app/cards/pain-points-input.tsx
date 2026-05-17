"use client";

import * as React from "react";
import { Textarea } from "@/components/ui/textarea";

/**
 * PainPointsInput — Card 8 of the 9-card creator interview (PROFILE-11).
 *
 * Pure controlled free-text Textarea with a hard 500-character cap (enforced both
 * by `maxLength={500}` on the element AND by `slice(0, 500)` in the change handler
 * so paste events that exceed the cap also truncate cleanly) and a live counter.
 */

const MAX_LENGTH = 500;

export interface PainPointsInputProps {
  value: string;
  onChange: (next: string) => void;
}

export function PainPointsInput({
  value,
  onChange,
}: PainPointsInputProps): React.JSX.Element {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    onChange(e.target.value.slice(0, MAX_LENGTH));
  };

  return (
    <div className="space-y-1.5">
      <Textarea
        size="md"
        rows={4}
        value={value}
        maxLength={500}
        placeholder="What's your biggest challenge as a creator right now?"
        onChange={handleChange}
        data-testid="card-8-textarea"
      />
      <p
        className="text-xs text-foreground-muted text-right"
        data-testid="card-8-counter"
      >
        {value.length} / 500
      </p>
    </div>
  );
}
