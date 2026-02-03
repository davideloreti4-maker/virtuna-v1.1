"use client";

import { useState, useMemo, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { ChevronDown, X, Plus, Info, Briefcase, Coins, Users } from "lucide-react";
import { useSocietyStore } from "@/stores/society-store";
import { CardActionMenu } from "./card-action-menu";
import { CreateSocietyModal } from "./create-society-modal";
import type { Society, PersonalSociety, TargetSociety } from "@/types/society";

interface SocietySelectorProps {
  className?: string;
}

/**
 * Society Selector modal component.
 * Opens a modal dialog for selecting between Personal and Target societies.
 * Uses Radix Dialog for accessibility and Zustand store for state management.
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
      <button
        type="button"
        disabled
        className={cn(
          "flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-500",
          className
        )}
      >
        <span>Loading...</span>
        <ChevronDown className="h-4 w-4 text-zinc-600" />
      </button>
    );
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white transition-colors hover:border-zinc-700",
              className
            )}
          >
            <span>{selectedSociety?.name ?? "Select Society"}</span>
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          </button>
        </Dialog.Trigger>

        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-[800px] min-w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-800 bg-[#18181B] p-6 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
            {/* Close button */}
            <Dialog.Close asChild>
              <button
                type="button"
                className="absolute right-4 top-4 text-zinc-500 transition-colors hover:text-zinc-400"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>

            {/* Personal Societies Section */}
            <div>
              <div className="mb-4 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">
                  Personal Societies
                </h3>
                <Info className="h-4 w-4 cursor-help text-zinc-500" />
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
            <div className="my-6 border-t border-zinc-800" />

            {/* Target Societies Section */}
            <div>
              <div className="mb-4 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">
                  Target Societies
                </h3>
                <Info className="h-4 w-4 cursor-help text-zinc-500" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* Create Target Society Card */}
                <button
                  type="button"
                  onClick={handleCreateSociety}
                  className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 p-6 transition-colors hover:border-zinc-600 hover:bg-zinc-900/30"
                >
                  <Plus className="mb-3 h-8 w-8 text-zinc-500" />
                  <span className="text-sm font-medium text-zinc-400">
                    Create Target Society
                  </span>
                </button>

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
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

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
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex min-h-[180px] cursor-pointer flex-col rounded-xl border border-dashed border-zinc-700 bg-transparent p-5 text-left transition-all hover:border-zinc-500 hover:bg-zinc-800/30",
        isSelected && "border-solid border-orange-500 ring-2 ring-orange-500/50"
      )}
    >
      {/* Setup badge */}
      {society.needsSetup && (
        <span className="mb-4 inline-block w-fit rounded-md bg-orange-500 px-3 py-1 text-xs font-medium text-white">
          Setup
        </span>
      )}

      {/* Large platform icon */}
      <div className="mb-3">
        <PlatformIcon platform={society.platform} size="large" />
      </div>

      {/* Title */}
      <h4 className="mb-2 text-base font-medium text-white">{society.name}</h4>

      {/* Description */}
      <p className="text-sm leading-relaxed text-zinc-400 line-clamp-3">
        {society.description}
      </p>
    </button>
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
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex min-h-[180px] cursor-pointer flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-left transition-all hover:border-zinc-600 hover:bg-zinc-800/50",
        isSelected && "border-orange-500 ring-2 ring-orange-500/50"
      )}
    >
      {/* Badge in top-left */}
      <span className="mb-4 inline-block w-fit rounded-md bg-zinc-800 px-2.5 py-1 text-xs font-medium capitalize text-zinc-300">
        {society.societyType}
      </span>

      {/* Action menu in top-right */}
      <div className="absolute right-3 top-4">
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
      <h4 className="mb-2 text-base font-medium text-white">{society.name}</h4>

      {/* Description */}
      <p className="text-sm leading-relaxed text-zinc-400 line-clamp-3">
        {society.description}
      </p>
    </button>
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
        "flex items-center justify-center text-white",
        isLarge ? "h-12 w-12" : "h-6 w-6"
      )}>
        <span className={cn("font-bold", isLarge ? "text-4xl" : "text-xs")}>in</span>
      </div>
    );
  }

  if (platform === "x") {
    return (
      <div className={cn(
        "flex items-center justify-center text-white",
        isLarge ? "h-12 w-12" : "h-6 w-6"
      )}>
        <span className={cn("font-bold", isLarge ? "text-4xl" : "text-sm")}>𝕏</span>
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
  const iconClass = size === "large" ? "h-10 w-10 text-zinc-400" : "h-5 w-5 text-white";

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
