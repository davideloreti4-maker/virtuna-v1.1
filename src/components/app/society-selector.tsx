"use client";

import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, X, Plus, Info, Briefcase, Coins, Users } from "lucide-react";
import { useSocietyStore } from "@/stores/society-store";
import { CardActionMenu } from "./card-action-menu";
import { CreateSocietyModal } from "./create-society-modal";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogClose,
} from "@/components/ui/dialog";
import { GlassCard } from "@/components/primitives/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Society, PersonalSociety, TargetSociety } from "@/types/society";

interface SocietySelectorProps {
  className?: string;
}

/**
 * Society Selector modal component.
 * Opens a modal dialog for selecting between Personal and Target societies.
 * Uses design system Dialog for accessibility and Zustand store for state management.
 */
export function SocietySelector({ className }: SocietySelectorProps) {
  const [open, setOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Get store state and actions
  const store = useSocietyStore();

  // Hydrate from localStorage on mount
  useEffect(() => {
    store._hydrate();
  }, []);

  // Derive filtered arrays with useMemo (with safety check for SSR)
  const societies = store.societies ?? [];
  const selectedSociety = useMemo(
    () => societies.find((s) => s.id === store.selectedSocietyId),
    [societies, store.selectedSocietyId]
  );
  const personalSocieties = useMemo(
    () => societies.filter((s): s is PersonalSociety => s.type === 'personal'),
    [societies]
  );
  const targetSocieties = useMemo(
    () => societies.filter((s): s is TargetSociety => s.type === 'target'),
    [societies]
  );

  const handleSelectSociety = (society: Society) => {
    store.selectSociety(society.id);
    setOpen(false);
  };

  const handleCreateSociety = () => {
    setOpen(false);
    setCreateModalOpen(true);
  };

  const handleEdit = (id: string) => {
    console.log("Edit society:", id);
  };

  const handleRefresh = (id: string) => {
    console.log("Refresh society:", id);
  };

  const handleDelete = (id: string) => {
    store.deleteSociety(id);
  };

  // Show loading state until hydrated
  if (!store._isHydrated) {
    return (
      <Button
        variant="secondary"
        disabled
        className={cn("w-full justify-between", className)}
      >
        <span>Loading...</span>
        <ChevronDown className="h-4 w-4 text-foreground-muted" />
      </Button>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="secondary"
            className={cn("w-full justify-between", className)}
          >
            <span>{selectedSociety?.name ?? "Select Society"}</span>
            <ChevronDown className="h-4 w-4 text-foreground-secondary" />
          </Button>
        </DialogTrigger>

        <DialogContent size="full" className="max-w-[800px] p-6">
          {/* Close button */}
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-4 top-4"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Button>
          </DialogClose>

          {/* Personal Societies Section */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Personal Societies
              </h3>
              <Info className="h-4 w-4 cursor-help text-foreground-muted" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {personalSocieties.map((society) => (
                <PersonalSocietyCard
                  key={society.id}
                  society={society}
                  isSelected={selectedSociety?.id === society.id}
                  onSelect={() => handleSelectSociety(society)}
                />
              ))}
            </div>
          </div>

          {/* Separator */}
          <div className="my-6 border-t border-border" />

          {/* Target Societies Section */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Target Societies
              </h3>
              <Info className="h-4 w-4 cursor-help text-foreground-muted" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* Create Target Society Card */}
              <GlassCard
                hover="lift"
                padding="md"
                className={cn(
                  "min-h-[180px] border-dashed",
                  "hover:border-border-hover"
                )}
                onClick={handleCreateSociety}
              >
                <div className="flex h-full flex-col items-center justify-center">
                  <Plus className="mb-3 h-8 w-8 text-foreground-muted" />
                  <span className="text-sm font-medium text-foreground-secondary">
                    Create Target Society
                  </span>
                </div>
              </GlassCard>

              {targetSocieties.map((society) => (
                <TargetSocietyCard
                  key={society.id}
                  society={society}
                  isSelected={selectedSociety?.id === society.id}
                  onSelect={() => handleSelectSociety(society)}
                  onEdit={handleEdit}
                  onRefresh={handleRefresh}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CreateSocietyModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />
    </>
  );
}

/**
 * Personal Society Card component.
 * Vertically stacked layout with large icon matching reference design.
 */
function PersonalSocietyCard({
  society,
  isSelected,
  onSelect,
}: {
  society: PersonalSociety;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <GlassCard
      hover="lift"
      padding="md"
      className={cn(
        "min-h-[180px] border-dashed",
        isSelected && "border-solid border-accent ring-2 ring-accent/50"
      )}
      onClick={onSelect}
    >
      <div className="flex h-full flex-col text-left">
        {/* Setup badge */}
        {society.needsSetup && (
          <Badge variant="accent" size="sm" className="mb-4 w-fit rounded-md">
            Setup
          </Badge>
        )}

        {/* Large platform icon */}
        <div className="mb-3">
          <PlatformIcon platform={society.platform} size="large" />
        </div>

        {/* Title */}
        <h4 className="mb-2 text-base font-medium text-foreground">
          {society.name}
        </h4>

        {/* Description */}
        <p className="text-sm leading-relaxed text-foreground-secondary line-clamp-3">
          {society.description}
        </p>
      </div>
    </GlassCard>
  );
}

/**
 * Target Society Card component.
 * Vertically stacked layout with badge and three-dot menu matching reference.
 */
function TargetSocietyCard({
  society,
  isSelected,
  onSelect,
  onEdit,
  onRefresh,
  onDelete,
}: {
  society: TargetSociety;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: (id: string) => void;
  onRefresh: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <GlassCard
      hover="lift"
      padding="md"
      className={cn(
        "min-h-[180px]",
        isSelected && "border-accent ring-2 ring-accent/50"
      )}
      onClick={onSelect}
    >
      <div className="relative flex h-full flex-col text-left">
        {/* Badge in top-left */}
        <Badge variant="secondary" size="sm" className="mb-4 w-fit rounded-md capitalize">
          {society.societyType}
        </Badge>

        {/* Action menu in top-right */}
        <div className="absolute right-0 top-0">
          <CardActionMenu
            societyId={society.id}
            onEdit={onEdit}
            onRefresh={onRefresh}
            onDelete={onDelete}
          />
        </div>

        {/* Large icon */}
        <div className="mb-3">
          <SocietyIcon icon={society.icon} size="large" />
        </div>

        {/* Title */}
        <h4 className="mb-2 text-base font-medium text-foreground">
          {society.name}
        </h4>

        {/* Description */}
        <p className="text-sm leading-relaxed text-foreground-secondary line-clamp-3">
          {society.description}
        </p>
      </div>
    </GlassCard>
  );
}

/**
 * Platform icon component for personal societies.
 */
function PlatformIcon({
  platform,
  size = "default"
}: {
  platform: PersonalSociety["platform"];
  size?: "default" | "large";
}) {
  const isLarge = size === "large";

  if (platform === "linkedin") {
    return (
      <div className={cn(
        "flex items-center justify-center text-foreground",
        isLarge ? "h-12 w-12" : "h-6 w-6"
      )}>
        <span className={cn("font-bold", isLarge ? "text-4xl" : "text-xs")}>in</span>
      </div>
    );
  }

  if (platform === "x") {
    return (
      <div className={cn(
        "flex items-center justify-center text-foreground",
        isLarge ? "h-12 w-12" : "h-6 w-6"
      )}>
        <span className={cn("font-bold", isLarge ? "text-4xl" : "text-sm")}>&#x1D54F;</span>
      </div>
    );
  }

  return null;
}

/**
 * Society icon component for target societies.
 */
function SocietyIcon({
  icon,
  size = "default"
}: {
  icon: TargetSociety["icon"];
  size?: "default" | "large";
}) {
  const iconClass = size === "large"
    ? "h-10 w-10 text-foreground-secondary"
    : "h-5 w-5 text-foreground";

  if (icon === "briefcase") {
    return <Briefcase className={iconClass} />;
  }

  if (icon === "coins") {
    return <Coins className={iconClass} />;
  }

  if (icon === "users") {
    return <Users className={iconClass} />;
  }

  return <Briefcase className={iconClass} />;
}
