"use client";

import type { MouseEvent } from "react";
import type { Audience } from "@/lib/audience/audience-types";
import { READING_CARD } from "@/components/reading/reading-section";
import { AudienceConstellationThumb } from "./audience-constellation-thumb";
import { AudienceStatusChip } from "./audience-status-chip";
import { AudienceTempBar } from "./audience-temp-bar";
import { TrustBadge } from "./trust-badge";
import {
  getAudienceCardSubtitle,
  getCalibrationStatus,
  getDominantTemperature,
  getPersonaRoster,
  getTemperatureMix,
  getTemplateProvenanceLabel,
  getTopArchetypes,
  isPersonaGrounded,
} from "./audience-display";
import { resolveTier } from "@/lib/audience/resolve-tier";
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
  const tier = resolveTier(audience);
  const subtitle = getAudienceCardSubtitle(audience);
  const tempMix = getTemperatureMix(audience);
  const dominant = getDominantTemperature(tempMix);
  const topArchetypes = getTopArchetypes(audience, 2);

  // Honesty layer (D-05/TRUST-02): surface persona provenance at a glance.
  // Grounded personas (non-empty evidence) show their receipt inline; an
  // evidence-free card shows ONE muted ungrounded affordance — never both.
  const groundedPersonas = getPersonaRoster(audience).filter((p) =>
    isPersonaGrounded(p as { evidence?: string }),
  );
  const templateProvenance = getTemplateProvenanceLabel(audience);
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
        "group relative flex items-start gap-4 p-4 pointer-coarse:min-h-[88px]",
        // Matte depth (folds the approved seed): a resting floor on every card; navigable
        // cards additionally lift + brighten on hover and settle on press (.elev-lift).
        isNavigable
          ? "elev-lift cursor-pointer hover:border-white/[0.10] hover:bg-white/[0.03]"
          : "elev-rest",
        selectionMode && isSelected && "border-white/[0.14] bg-white/[0.05]",
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
        {/* <sm the badge pair moves under the name — side-by-side it wins the
            width contest and crushes the name to "Fit…" at 390px. */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <p className="min-w-0 text-[15px] font-medium text-foreground truncate">
            {audience.name}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <TrustBadge tier={tier} />
            <AudienceStatusChip status={status} />
          </div>
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
              <span className="shrink-0 whitespace-nowrap text-[10px] text-foreground-muted">
                {dominant}
              </span>
            )}
          </div>
        )}

        {/* Persona provenance — honest at a glance (D-05/TRUST-02). */}
        {groundedPersonas.length > 0 ? (
          <div className="mt-2 flex flex-col gap-0.5">
            {groundedPersonas.slice(0, 2).map((p, i) => (
              <p
                key={`${p.archetype}-${i}`}
                className="text-[11px] text-foreground-muted truncate"
              >
                {(p as { evidence?: string }).evidence}
              </p>
            ))}
          </div>
        ) : templateProvenance ? (
          <p className="mt-2 text-[11px] text-foreground-muted truncate">
            {templateProvenance}
          </p>
        ) : isUserOwned ? (
          // Evidence state — NOT a tier. The top badge already carries the model tier
          // (Validated/Directional); this line describes THIS audience's persona receipts,
          // so it must not re-use the tier word (that read as "Validated … Directional").
          // User-owned only: on presets/General "receipts pending" reads as broken —
          // their provenance is already the subtitle.
          <p className="mt-2 text-[11px] text-foreground-muted/80 truncate">
            personas modeled · receipts pending
          </p>
        ) : null}
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
