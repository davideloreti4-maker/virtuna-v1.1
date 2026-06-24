"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * AudiencePicker — Card 2 of the 9-card creator interview (PROFILE-05).
 *
 * Composite controlled form: age-range Select, gender-skew toggle row,
 * geo free-text Input, language free-text Input. All four fields are
 * optional (skippable card per UI-SPEC §Card 2). Each onChange spreads
 * the existing `value` and overwrites a single slot.
 */

export type AgeRange = "13-17" | "18-24" | "25-34" | "35-44" | "45+";
export type GenderSkew = "female" | "balanced" | "male";

export interface TargetAudience {
  age_range: AgeRange | null;
  gender_skew: GenderSkew | null;
  geo: string | null;
  language: string | null;
}

export interface AudiencePickerProps {
  value: TargetAudience;
  onChange: (next: TargetAudience) => void;
}

const AGE_OPTIONS: { value: AgeRange; label: string }[] = [
  { value: "13-17", label: "13-17" },
  { value: "18-24", label: "18-24" },
  { value: "25-34", label: "25-34" },
  { value: "35-44", label: "35-44" },
  { value: "45+", label: "45+" },
];

const GENDER_OPTIONS: { id: GenderSkew; label: string }[] = [
  { id: "female", label: "Female-skewed" },
  { id: "balanced", label: "Balanced" },
  { id: "male", label: "Male-skewed" },
];

const AGE_VALUES = AGE_OPTIONS.map((opt) => opt.value);

function isAgeRange(value: string): value is AgeRange {
  return (AGE_VALUES as string[]).includes(value);
}

export function AudiencePicker({
  value,
  onChange,
}: AudiencePickerProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      {/* Age range */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground" htmlFor="audience-age">
          Age range
        </label>
        <Select
          options={AGE_OPTIONS}
          value={value.age_range ?? ""}
          placeholder="Select age range"
          onChange={(next) =>
            onChange({
              ...value,
              age_range: isAgeRange(next) ? next : null,
            })
          }
        />
      </div>

      {/* Gender skew — tile toggle row */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Gender skew</p>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Gender skew">
          {GENDER_OPTIONS.map(({ id, label }) => {
            const selected = value.gender_skew === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                data-testid={`card-2-gender-${id}`}
                onClick={() => onChange({ ...value, gender_skew: id })}
                className={cn(
                  "flex h-12 items-center justify-center rounded-xl border px-3 text-center transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10",
                  selected
                    ? "border-white/[0.12] bg-white/[0.08]"
                    : "border-white/[0.06] bg-transparent hover:bg-white/[0.02]"
                )}
              >
                <span className="text-sm font-medium text-foreground">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Geo */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground" htmlFor="audience-geo">
          Geography
        </label>
        <Input
          id="audience-geo"
          data-testid="card-2-geo"
          value={value.geo ?? ""}
          placeholder="Country or region (e.g. United States)"
          onChange={(e) =>
            onChange({ ...value, geo: e.target.value === "" ? null : e.target.value })
          }
        />
      </div>

      {/* Language */}
      <div className="space-y-1.5">
        <label
          className="block text-sm font-medium text-foreground"
          htmlFor="audience-language"
        >
          Language
        </label>
        <Input
          id="audience-language"
          data-testid="card-2-language"
          value={value.language ?? ""}
          placeholder="Primary language (e.g. English)"
          onChange={(e) =>
            onChange({
              ...value,
              language: e.target.value === "" ? null : e.target.value,
            })
          }
        />
      </div>
    </div>
  );
}
