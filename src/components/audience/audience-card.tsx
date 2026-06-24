"use client";

import type { MouseEvent } from "react";
import type { Audience } from "@/lib/audience/audience-types";
import { READING_CARD } from "@/components/reading/reading-section";
import { AudienceConstellationThumb } from "./audience-constellation-thumb";
import { AudienceStatusChip } from "./audience-status-chip";
import { AudienceTempBar } from "./audience-temp-bar";
import {
  getAudienceCardSubtitle,
  getCalibrationStatus,
  getDominantTemperature,
  getTemperatureMix,
  getTopArchetypes,
} from "./audience-display";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";
import { Check, DotsThree } from "@phosphor-icons/react";

export interface AudienceCardProps {
  audience: Audience;
  selectionMode?: boolean;
  isSelected?: boolean;
  menuOpen?: boolean;
  onSelect?: () => void;
  onNavigate?: () => void;
  onMenuToggle?: (e: MouseEvent) => void;
  onMenuEdit?: (e: MouseEvent) => void;
  onMenuDelete?: (e: MouseEvent) => void;
  showMenu?: boolean;
  className?: string;
}

export function AudienceCard({
  audience,
  selectionMode = false,
  isSelected = false,
  menuOpen = false,
  onSelect,
  onNavigate,
  onMenuToggle,
  onMenuEdit,
  onMenuDelete,
  showMenu = false,
  className,
}: AudienceCardProps) {
  const reducedMotion = usePrefersReducedMotion();
  const status = getCalibrationStatus(audience);
  const subtitle = getAudienceCardSubtitle(audience);
  const tempMix = getTemperatureMix(audience);
  const dominant = getDominantTemperature(tempMix);
  const topArchetypes = getTopArchetypes(audience, 2);
  const isUserOwned = !audience.is_general && !audience.is_preset;
  const isNavigable = selectionMode || isUserOwned;

  const handleClick = () => {
    if (selectionMode) onSelect?.();
    else if (isUserOwned) onNavigate?.();
  };

  return (
    <div
      className={cn(
        READING_CARD,
        "group relative flex items-start gap-4 p-4 transition-colors pointer-coarse:min-h-[88px]",
        isNavigable && "cursor-pointer hover:bg-white/[0.02]",
        selectionMode && isSelected && "bg-white/[0.04]",
        className,
      )}
      onClick={handleClick}
      role={selectionMode ? "checkbox" : undefined}
      aria-checked={selectionMode ? isSelected : undefined}
      aria-label={selectionMode ? `Select ${audience.name}` : undefined}
    >
      {selectionMode && (
        <span
          aria-hidden="true"
          className={cn(
            "mt-1 flex shrink-0 items-center justify-center rounded-md border w-5 h-5 pointer-coarse:w-6 pointer-coarse:h-6 transition-colors",
            isSelected
              ? "border-white/[0.12] bg-white/[0.06]"
              : "border-white/[0.12] bg-transparent",
          )}
        >
          {isSelected && (
            <Check weight="bold" className="w-3.5 h-3.5 text-cream-secondary" />
          )}
        </span>
      )}

      <AudienceConstellationThumb
        audience={audience}
        reducedMotion={reducedMotion}
        width={72}
        className="mt-0.5"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[15px] font-medium text-foreground truncate">
            {audience.name}
          </p>
          <AudienceStatusChip status={status} />
        </div>

        <p className="mt-0.5 text-xs text-foreground-secondary truncate">
          {subtitle}
        </p>

        {topArchetypes.length > 0 && (
          <p className="mt-1.5 text-[11px] text-foreground-muted truncate">
            {topArchetypes.join(" · ")}
          </p>
        )}

        {tempMix && (
          <div className="mt-2 flex items-center gap-2">
            <AudienceTempBar mix={tempMix} />
            {dominant && (
              <span className="text-[10px] text-foreground-muted">{dominant}</span>
            )}
          </div>
        )}
      </div>

      {showMenu && !selectionMode && (
        <div className="relative shrink-0" data-audience-menu>
          <button
            type="button"
            aria-label="Audience options"
            onClick={onMenuToggle}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-lg pointer-coarse:w-10 pointer-coarse:h-10",
              "text-foreground-secondary hover:bg-white/[0.06] hover:text-foreground transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10",
            )}
          >
            <DotsThree weight="bold" className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-1 z-10 w-36 rounded-lg border border-white/[0.06] bg-surface-elevated shadow-float overflow-hidden"
              data-audience-menu
            >
              {isUserOwned && onMenuEdit && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={onMenuEdit}
                  className="w-full flex items-center px-3 min-h-[40px] text-sm text-foreground-secondary hover:bg-white/[0.05] hover:text-foreground transition-colors"
                >
                  Edit
                </button>
              )}
              {onMenuDelete && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={onMenuDelete}
                  className="w-full flex items-center px-3 min-h-[40px] text-sm text-error hover:bg-white/[0.05] transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
