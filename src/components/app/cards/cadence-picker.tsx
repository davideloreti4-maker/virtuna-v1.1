"use client";

import * as React from "react";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";

/**
 * CadencePicker — Card 7 of the 9-card creator interview (PROFILE-10).
 *
 * Pure controlled composition: posting-frequency Select + time-of-day
 * awareness Toggle. Skippable per UI-SPEC §Card 7.
 */

export type PostingFrequency =
  | "daily"
  | "3-4_per_week"
  | "1-2_per_week"
  | "few_per_month"
  | "rarely";

export interface CadencePickerProps {
  frequency: PostingFrequency | null;
  todAware: boolean;
  onChange: (next: { frequency: PostingFrequency | null; todAware: boolean }) => void;
}

const FREQUENCY_OPTIONS: { value: PostingFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "3-4_per_week", label: "3-4×/week" },
  { value: "1-2_per_week", label: "1-2×/week" },
  { value: "few_per_month", label: "A few times/month" },
  { value: "rarely", label: "Rarely" },
];

const FREQUENCY_VALUES = FREQUENCY_OPTIONS.map((opt) => opt.value);

function isFrequency(value: string): value is PostingFrequency {
  return (FREQUENCY_VALUES as string[]).includes(value);
}

export function CadencePicker({
  frequency,
  todAware,
  onChange,
}: CadencePickerProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      {/* Frequency Select */}
      <div className="space-y-1.5">
        <label
          className="block text-sm font-medium text-foreground"
          htmlFor="cadence-frequency"
        >
          Posting frequency
        </label>
        <Select
          options={FREQUENCY_OPTIONS}
          value={frequency ?? ""}
          placeholder="How often do you post?"
          onChange={(next) =>
            onChange({
              frequency: isFrequency(next) ? next : null,
              todAware,
            })
          }
        />
      </div>

      {/* Time-of-day awareness Toggle */}
      <div className="flex items-center gap-3">
        <Toggle
          checked={todAware}
          onCheckedChange={(checked) => onChange({ frequency, todAware: checked })}
          aria-label="I pay attention to optimal posting times"
          data-testid="card-7-tod-aware"
        />
        <span className="text-sm text-foreground">
          I pay attention to optimal posting times
        </span>
      </div>
    </div>
  );
}
