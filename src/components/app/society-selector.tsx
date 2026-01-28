"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { ChevronDown, X, Plus, Info, MoreVertical, Briefcase, Coins } from "lucide-react";

/**
 * Mock data for societies.
 * Will be replaced with real data from API in Phase 5.
 */
const MOCK_SOCIETIES = {
  personal: [
    {
      id: "linkedin",
      name: "LinkedIn",
      description: "Your personal LinkedIn network built around your connections.",
      platform: "linkedin",
      needsSetup: true,
    },
    {
      id: "x",
      name: "X (formerly Twitter)",
      description: "Your X network built around your followers.",
      platform: "x",
      needsSetup: true,
    },
  ],
  target: [
    {
      id: "zurich-founders",
      name: "Zurich Founders",
      description: "Entrepreneurs and startup founders in Zurich.",
      type: "custom",
      icon: "briefcase",
      members: 156,
    },
    {
      id: "startup-investors",
      name: "Startup Investors",
      description: "Individuals investing in early-stage companies.",
      type: "example",
      icon: "coins",
      members: 342,
    },
  ],
};

interface Society {
  id: string;
  name: string;
  description?: string;
  platform?: string;
  needsSetup?: boolean;
  type?: string;
  icon?: string;
  members?: number;
}

interface SocietySelectorProps {
  className?: string;
  onSelect?: (society: Society) => void;
}

/**
 * Society Selector modal component.
 * Opens a modal dialog for selecting between Personal and Target societies.
 * Uses Radix Dialog for accessibility and keyboard navigation.
 */
export function SocietySelector({ className, onSelect }: SocietySelectorProps) {
  const [open, setOpen] = useState(false);
  const [selectedSociety, setSelectedSociety] = useState<Society>(
    MOCK_SOCIETIES.target[0]!
  );

  const handleSelectSociety = (society: Society) => {
    setSelectedSociety(society);
    onSelect?.(society);
    setOpen(false);
  };

  const handleCreateSociety = (type: "personal" | "target") => {
    // Placeholder - functionality in Phase 5
    console.log(`Create ${type} society clicked`);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white transition-colors hover:border-zinc-700",
            className
          )}
        >
          <span>{selectedSociety.name}</span>
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
              {MOCK_SOCIETIES.personal.map((society) => (
                <PersonalSocietyCard
                  key={society.id}
                  society={society}
                  isSelected={selectedSociety.id === society.id}
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
                onClick={() => handleCreateSociety("target")}
                className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 p-6 transition-colors hover:border-zinc-600"
              >
                <Plus className="mb-2 h-6 w-6 text-zinc-500" />
                <span className="text-sm text-zinc-400">
                  Create Target Society
                </span>
              </button>

              {MOCK_SOCIETIES.target.map((society) => (
                <TargetSocietyCard
                  key={society.id}
                  society={society}
                  isSelected={selectedSociety.id === society.id}
                  onSelect={() => handleSelectSociety(society)}
                />
              ))}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
  society: Society;
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
 * Displays a target society with icon, badge, and menu.
 */
function TargetSocietyCard({
  society,
  isSelected,
  onSelect,
}: {
  society: Society;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Placeholder - menu functionality in Phase 5
    console.log("Menu clicked for:", society.name);
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative cursor-pointer rounded-xl border border-zinc-800 bg-[#18181B] p-4 text-left transition-all hover:border-zinc-600",
        isSelected && "border-indigo-500 ring-2 ring-indigo-500"
      )}
    >
      {/* Menu button */}
      <button
        type="button"
        onClick={handleMenuClick}
        className="absolute right-3 top-3 text-zinc-500 transition-colors hover:text-zinc-400"
        aria-label="More options"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {/* Badge */}
      <span className="mb-3 inline-block rounded bg-zinc-800 px-2 py-0.5 text-[11px] font-medium capitalize text-zinc-400">
        {society.type}
      </span>

      <div className="mb-2 flex items-center gap-2">
        <SocietyIcon icon={society.icon} />
        <span className="text-sm font-medium text-white">{society.name}</span>
      </div>

      <p className="text-xs text-zinc-400 line-clamp-2">{society.description}</p>

      {society.members && (
        <p className="mt-2 text-xs text-zinc-500">
          {society.members.toLocaleString()} members
        </p>
      )}
    </button>
  );
}

/**
 * Platform icon component for personal societies.
 */
function PlatformIcon({ platform }: { platform?: string }) {
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
function SocietyIcon({ icon }: { icon?: string }) {
  if (icon === "briefcase") {
    return <Briefcase className="h-5 w-5 text-white" />;
  }

  if (icon === "coins") {
    return <Coins className="h-5 w-5 text-white" />;
  }

  return <Briefcase className="h-5 w-5 text-white" />;
}
