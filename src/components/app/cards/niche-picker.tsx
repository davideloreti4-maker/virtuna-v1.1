"use client";

import * as React from "react";
import {
  NICHE_TREE,
  getNicheBranches,
  getPrimaryLabel,
  getSubLabel,
} from "@/lib/niches/taxonomy";
import { cn } from "@/lib/utils";

/**
 * NichePicker — Card 1 of the 9-card creator interview (PROFILE-04).
 *
 * Two-level hierarchical drill-down: primary niche tiles reveal a sub-niche
 * grid when a primary is selected (per Phase 02 decision D-09 the optional
 * level-3 drill-down is intentionally dropped — the Phase 4 AI detector
 * derives the finer specialization automatically from analyzed videos).
 *
 * Pure controlled. Selected tile styling matches the UI-SPEC §Color override
 * (`bg-white/[0.08]` + `border-white/[0.12]`).
 */

export interface NichePickerProps {
  primary: string | null;
  sub: string | null;
  onChange: (next: { primary: string | null; sub: string | null }) => void;
}

export function NichePicker({
  primary,
  sub,
  onChange,
}: NichePickerProps): React.JSX.Element {
  const subBranches = primary ? getNicheBranches(primary) : [];
  const primaryLabel = primary ? getPrimaryLabel(primary) : null;
  const selectedSubLabel = primary && sub ? getSubLabel(primary, sub) : null;
  const hasPrimary = primary !== null && subBranches.length > 0;

  return (
    <div className="space-y-4">
      {/* Primary niche grid */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Pick your primary niche</p>
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          role="group"
          aria-label="Primary niche"
        >
          {NICHE_TREE.map((branch) => {
            const selected = primary === branch.slug;
            return (
              <button
                key={branch.slug}
                type="button"
                aria-pressed={selected}
                data-testid={`card-1-primary-${branch.slug}`}
                onClick={() => onChange({ primary: branch.slug, sub: null })}
                className={cn(
                  "flex h-14 items-center justify-center rounded-xl border px-3 text-center transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10",
                  selected
                    ? "border-white/[0.12] bg-white/[0.08]"
                    : "border-white/[0.06] bg-transparent hover:bg-white/[0.02]"
                )}
              >
                <span className="text-sm font-medium text-foreground">{branch.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-niche reveal — height + opacity transition, CSS only */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-200 ease-out",
          hasPrimary ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
        )}
        aria-hidden={!hasPrimary}
      >
        <div className="space-y-2 pt-2">
          {/* Breadcrumb */}
          <p className="text-xs text-foreground-muted">
            {primaryLabel}
            {selectedSubLabel ? <> &rsaquo; {selectedSubLabel}</> : null}
          </p>
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            role="group"
            aria-label="Sub-niche"
          >
            {subBranches.map((subItem) => {
              const selected = sub === subItem.slug;
              return (
                <button
                  key={subItem.slug}
                  type="button"
                  aria-pressed={selected}
                  data-testid={`card-1-sub-${subItem.slug}`}
                  onClick={() => onChange({ primary, sub: subItem.slug })}
                  className={cn(
                    "flex h-12 items-center justify-center rounded-xl border px-3 text-center transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10",
                    selected
                      ? "border-white/[0.12] bg-white/[0.08]"
                      : "border-white/[0.06] bg-transparent hover:bg-white/[0.02]"
                  )}
                >
                  <span className="text-sm font-medium text-foreground">{subItem.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
