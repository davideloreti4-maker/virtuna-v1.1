"use client";

/**
 * AudienceIndex — the rack (SPEC-2026-07-13 §4).
 *
 * A table, not a feed. Every audience is the same kind of object; they differ only in
 * where they came from, so origin is a COLUMN ("Built from") rather than a section
 * header. This retires YOURS / BASELINE / TEMPLATES / GENERAL TEMPLATES and the
 * six-term badge vocabulary in one move.
 *
 * Two things the old roster could not say, and this one does:
 *  - WHICH audience seeds your work. `user_settings.last_audience_id` was already
 *    returned by GET /api/audiences and rendered nowhere. It's the radio column.
 *  - That a custom (`mode: 'general'`) audience is a different instrument from a social
 *    one — the Social/Custom track switch. (`Audience.mode`'s own doc: "P7 sections the
 *    library and scopes skills by it".)
 *
 * General is IN the table, marked "Always on · as the control", because every Read is
 * scored twice — once by the audience you pick, once by General. That fact teaches
 * itself by being visible instead of being claimed in a rail paragraph.
 */

import { useMemo, useState } from "react";
import type { Audience } from "@/lib/audience/audience-types";
import { AudienceCompositionBar } from "./audience-composition-bar";
import {
  getBuiltFrom,
  getDominantTemperature,
  getPersonaCount,
  getPlatformLabel,
  getTemperatureMix,
  isCustomAudience,
} from "./audience-display";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check } from "@phosphor-icons/react";

export type AudienceTrack = "social" | "custom";

/** Presets beyond this many collapse behind "Show all" — an untouched preset earns one line, not a card. */
const PRESET_PREVIEW = 2;

export interface AudienceIndexProps {
  audiences: Audience[];
  /** The user-level default that seeds new threads. null = General. */
  defaultAudienceId: string | null;
  /** Virtual preset ids aren't UUIDs and can't satisfy the FK — the caller no-ops them. */
  onSetDefault: (audience: Audience) => void;
  onOpen: (audience: Audience) => void;
  /** Compare mode turns the radio column into a checkbox column. */
  selectionMode?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  className?: string;
}

function isOwned(a: Audience): boolean {
  return !a.is_general && !a.is_preset;
}

/** Real rows can be pinned as the default; virtual presets cannot (no UUID → FK fails). */
function canBeDefault(a: Audience): boolean {
  return !a.is_preset;
}

function rowOrder(a: Audience): number {
  if (isOwned(a)) return 0;
  if (a.is_general) return 1;
  return 2;
}

function WhosInIt({ audience }: { audience: Audience }) {
  const count = getPersonaCount(audience);
  const dominant = getDominantTemperature(getTemperatureMix(audience));

  return (
    <div className="min-w-0">
      <AudienceCompositionBar audience={audience} />
      <p className="mt-1.5 truncate text-[11px] text-foreground-muted">
        {count === 0
          ? "empty"
          : `${count} persona${count === 1 ? "" : "s"}${dominant ? ` · ${dominant}` : ""}`}
      </p>
    </div>
  );
}

export function AudienceIndex({
  audiences,
  defaultAudienceId,
  onSetDefault,
  onOpen,
  selectionMode = false,
  selectedIds = [],
  onToggleSelect,
  className,
}: AudienceIndexProps) {
  const [track, setTrack] = useState<AudienceTrack>("social");
  const [showAllPresets, setShowAllPresets] = useState(false);

  const hasCustom = useMemo(() => audiences.some(isCustomAudience), [audiences]);

  const inTrack = useMemo(
    () =>
      audiences
        .filter((a) => (track === "custom" ? isCustomAudience(a) : !isCustomAudience(a)))
        .sort((a, b) => rowOrder(a) - rowOrder(b)),
    [audiences, track],
  );

  const presets = inTrack.filter((a) => a.is_preset);
  const hiddenPresets = showAllPresets ? 0 : Math.max(0, presets.length - PRESET_PREVIEW);
  const visible = useMemo(() => {
    if (hiddenPresets === 0) return inTrack;
    const keep = new Set(presets.slice(0, PRESET_PREVIEW).map((a) => a.id));
    return inTrack.filter((a) => !a.is_preset || keep.has(a.id));
  }, [inTrack, presets, hiddenPresets]);

  return (
    <div className={cn("min-w-0", className)}>
      {hasCustom && !selectionMode && (
        <div
          role="tablist"
          aria-label="Audience track"
          className="mb-3 inline-flex rounded-lg border border-border bg-surface-elevated p-0.5"
        >
          {(
            [
              { id: "social", label: "Social" },
              { id: "custom", label: "Custom" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={track === t.id}
              onClick={() => setTrack(t.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                track === t.id
                  ? "bg-[color:var(--color-action)] text-[color:var(--color-action-foreground)]"
                  : "text-foreground-secondary hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {track === "custom" && !selectionMode && (
        <p className="mb-3 text-xs text-foreground-muted">
          Audiences with no social account behind them — a panel or a person you described.
          They aren&apos;t compared against General.
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface">
        {/* Header row — hidden on mobile, where each row stacks. */}
        <div className="hidden items-center gap-4 border-b border-white/[0.06] bg-white/[0.015] px-4 py-2.5 lg:grid lg:grid-cols-[26px_minmax(0,1fr)_190px_170px_136px_76px]">
          <span />
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground-muted">
            Audience
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground-muted">
            Built from
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground-muted">
            Who&apos;s in it
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground-muted">
            Used for
          </span>
          <span />
        </div>

        {visible.map((audience) => {
          const built = getBuiltFrom(audience);
          const isDefault = audience.is_general
            ? defaultAudienceId === null
            : defaultAudienceId === audience.id;
          const selected = selectedIds.includes(audience.id);
          const owned = isOwned(audience);
          const empty = getPersonaCount(audience) === 0 && owned;
          const metaLine = audience.is_general
            ? "The control every Read is compared against"
            : isCustomAudience(audience)
              ? audience.goal_label
              : [
                  getPlatformLabel(audience),
                  audience.goal_label ?? (audience.type === "personal" ? "personal" : "target"),
                ]
                  .filter(Boolean)
                  .join(" · ");

          return (
            <div
              key={audience.id}
              role={selectionMode ? "checkbox" : undefined}
              aria-checked={selectionMode ? selected : undefined}
              aria-label={selectionMode ? `Select ${audience.name}` : undefined}
              onClick={selectionMode ? () => onToggleSelect?.(audience.id) : undefined}
              className={cn(
                "grid grid-cols-1 items-center gap-3 border-b border-white/[0.06] px-4 py-3.5 last:border-b-0",
                "lg:grid-cols-[26px_minmax(0,1fr)_190px_170px_136px_76px] lg:gap-4",
                "transition-colors hover:bg-white/[0.017]",
                selectionMode && "cursor-pointer",
                selectionMode && selected && "bg-white/[0.04]",
              )}
            >
              {/* Default radio (or compare checkbox) */}
              <div className="hidden lg:flex lg:items-center lg:justify-center">
                {selectionMode ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-[18px] w-[18px] items-center justify-center rounded-md border transition-colors",
                      selected
                        ? "border-white/[0.14] bg-white/[0.07]"
                        : "border-white/[0.12] bg-transparent",
                    )}
                  >
                    {selected && <Check weight="bold" className="h-3 w-3 text-cream-secondary" />}
                  </span>
                ) : canBeDefault(audience) ? (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isDefault}
                    aria-label={
                      isDefault
                        ? `${audience.name} seeds new threads`
                        : `Make ${audience.name} seed new threads`
                    }
                    onClick={() => onSetDefault(audience)}
                    className={cn(
                      "h-[15px] w-[15px] rounded-full border transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10",
                      isDefault
                        ? "border-[color:var(--color-accent)] shadow-[inset_0_0_0_3px_var(--color-accent)]"
                        : "border-white/[0.14] hover:border-white/[0.28]",
                    )}
                  />
                ) : (
                  <span className="h-[15px] w-[15px]" />
                )}
              </div>

              {/* Name */}
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{audience.name}</p>
                  {audience.is_general && (
                    <span className="shrink-0 rounded border border-white/[0.06] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-foreground-muted">
                      Maven
                    </span>
                  )}
                  {audience.is_preset && (
                    <span className="shrink-0 rounded border border-white/[0.06] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-foreground-muted">
                      Preset
                    </span>
                  )}
                </div>
                {/* A custom audience has no social account, so `platform` ("Custom") and `type`
                    ("target") are data artefacts, not facts a user needs. Show its goal if it has
                    one and otherwise say NOTHING — "Built from" already states the provenance, and
                    repeating it here is the same reassurance-twice tic the audit called out. */}
                {metaLine && (
                  <p className="mt-0.5 truncate text-xs text-foreground-secondary">{metaLine}</p>
                )}
              </div>

              {/* Built from — the honesty column */}
              <div className="min-w-0">
                <p
                  className={cn(
                    "truncate text-[12.5px]",
                    built.needsAction
                      ? "text-[color:var(--color-warning-raw)]"
                      : "text-foreground-secondary",
                  )}
                >
                  {built.label}
                </p>
                {built.sub && (
                  <p className="mt-0.5 truncate text-[11px] text-foreground-muted">{built.sub}</p>
                )}
              </div>

              {/* Who's in it */}
              <WhosInIt audience={audience} />

              {/* Used for */}
              <div className="min-w-0 text-xs">
                {audience.is_general ? (
                  <>
                    <p className="text-foreground-secondary">Always on</p>
                    <p className="mt-0.5 text-[11px] text-foreground-muted">as the control</p>
                  </>
                ) : isDefault ? (
                  <>
                    <p className="font-medium text-foreground">Default</p>
                    <p className="mt-0.5 text-[11px] text-foreground-muted">seeds new threads</p>
                  </>
                ) : (
                  <p className="text-foreground-muted">—</p>
                )}
              </div>

              {/* Action */}
              <div className="flex justify-start lg:justify-end">
                {!selectionMode && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(audience);
                    }}
                    className="pointer-coarse:h-10"
                  >
                    {empty ? "Build" : owned ? "Open" : "View"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hiddenPresets > 0 && (
        <button
          type="button"
          onClick={() => setShowAllPresets(true)}
          className="mt-2.5 text-xs text-foreground-muted transition-colors hover:text-foreground-secondary"
        >
          Show {hiddenPresets} more preset{hiddenPresets === 1 ? "" : "s"}
        </button>
      )}
    </div>
  );
}
