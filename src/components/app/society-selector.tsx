"use client";

import { useState, useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { ChevronDown, X, Plus, Info, Briefcase, Coins, Users } from "lucide-react";
import { useSocietyStore, useHasHydrated } from "@/stores/society-store";
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

  // Wait for hydration to avoid SSR mismatch
  const hasHydrated = useHasHydrated();

  // Select raw state (stable references)
  const societies = useSocietyStore((s) => s.societies);
  const selectedSocietyId = useSocietyStore((s) => s.selectedSocietyId);
  const selectSociety = useSocietyStore((s) => s.selectSociety);
  const deleteSociety = useSocietyStore((s) => s.deleteSociety);

  // Derive filtered arrays with useMemo to avoid creating new refs each render
  const selectedSociety = useMemo(
    () => societies.find((s) => s.id === selectedSocietyId),
    [societies, selectedSocietyId]
  );
  const personalSocieties = useMemo(
    () => societies.filter((s): s is PersonalSociety => s.type === 'personal'),
    [societies]
  );
  const targetSocieties = useMemo(
    () => societies.filter((s): s is TargetSociety => s.type === 'target'),
    [societies]
  );

  // Show loading state until hydrated
  if (!hasHydrated) {
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

  const handleSelectSociety = (society: Society) => {
    selectSociety(society.id);
    setOpen(false);
  };

  const handleCreateSociety = () => {
    setOpen(false); // Close selector FIRST
    setCreateModalOpen(true); // Then open create modal
  };

  const handleEdit = (id: string) => {
    // Placeholder - edit modal not in Phase 5 scope
    console.log("Edit society:", id);
  };

  const handleRefresh = (id: string) => {
    // Simulate refresh with brief loading (no-op for mock data)
    console.log("Refresh society:", id);
  };

  const handleDelete = (id: string) => {
    deleteSociety(id);
  };

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
                className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 p-6 transition-colors hover:border-zinc-600"
              >
                <Plus className="mb-2 h-6 w-6 text-zinc-500" />
                <span className="text-sm text-zinc-400">
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
 * Displays a personal society with platform icon and setup badge.
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
        "relative cursor-pointer rounded-xl border border-dashed border-zinc-700 bg-transparent p-4 text-left transition-all hover:border-zinc-600 hover:border-solid",
        isSelected && "border-solid border-indigo-500 ring-2 ring-indigo-500"
      )}
    >
      {society.needsSetup && (
        <span className="mb-3 inline-block rounded-md bg-orange-500 px-3 py-1 text-xs font-medium text-white">
          Setup
        </span>
      )}

      <div className="mb-2 flex items-center gap-2">
        <PlatformIcon platform={society.platform} />
        <span className="text-sm font-medium text-white">{society.name}</span>
      </div>

      <p className="text-xs text-zinc-400 line-clamp-2">{society.description}</p>
    </button>
  );
}

/**
 * Target Society Card component.
 * Displays a target society with icon, badge, and action menu.
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
        "relative cursor-pointer rounded-xl border border-zinc-800 bg-[#18181B] p-4 text-left transition-all hover:border-zinc-600",
        isSelected && "border-indigo-500 ring-2 ring-indigo-500"
      )}
    >
      {/* Action menu */}
      <div className="absolute right-3 top-3">
        <CardActionMenu
          societyId={society.id}
          onEdit={onEdit}
          onRefresh={onRefresh}
          onDelete={onDelete}
        />
      </div>

      {/* Badge */}
      <span className="mb-3 inline-block rounded bg-zinc-800 px-2 py-0.5 text-[11px] font-medium capitalize text-zinc-400">
        {society.societyType}
      </span>

      <div className="mb-2 flex items-center gap-2">
        <SocietyIcon icon={society.icon} />
        <span className="text-sm font-medium text-white">{society.name}</span>
      </div>

      <p className="text-xs text-zinc-400 line-clamp-2">{society.description}</p>

      <p className="mt-2 text-xs text-zinc-500">
        {society.members.toLocaleString()} members
      </p>
    </button>
  );
}

/**
 * Platform icon component for personal societies.
 */
function PlatformIcon({ platform }: { platform: PersonalSociety["platform"] }) {
  if (platform === "linkedin") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded bg-[#0A66C2] text-white">
        <span className="text-xs font-bold">in</span>
      </div>
    );
  }

  if (platform === "x") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded bg-white text-black">
        <span className="text-sm font-bold">X</span>
      </div>
    );
  }

  return null;
}

/**
 * Society icon component for target societies.
 */
function SocietyIcon({ icon }: { icon: TargetSociety["icon"] }) {
  if (icon === "briefcase") {
    return <Briefcase className="h-5 w-5 text-white" />;
  }

  if (icon === "coins") {
    return <Coins className="h-5 w-5 text-white" />;
  }

  if (icon === "users") {
    return <Users className="h-5 w-5 text-white" />;
  }

  return <Briefcase className="h-5 w-5 text-white" />;
}
