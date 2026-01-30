"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X, Plus } from "lucide-react";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";
import { TEST_CATEGORIES, TEST_TYPES } from "@/lib/test-types";
import type { TestType, TestTypeIcon } from "@/types/test";

interface TestTypeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectType: (type: TestType) => void;
}

/**
 * Map Lucide icon names to actual icon components
 */
const iconMap: Record<TestTypeIcon, React.ComponentType<{ className?: string }>> = {
  ClipboardList: Icons.ClipboardList,
  FileText: Icons.FileText,
  Globe: Icons.Globe,
  Megaphone: Icons.Megaphone,
  Linkedin: Icons.Linkedin,
  Instagram: Icons.Instagram,
  Twitter: Icons.Twitter,
  Video: Icons.Video,
  Mail: Icons.Mail,
  Send: Icons.Send,
  Package: Icons.Package,
};

export function TestTypeSelector({
  open,
  onOpenChange,
  onSelectType,
}: TestTypeSelectorProps) {
  const handleSelectType = (type: TestType) => {
    // Only call onSelectType - the modal will close automatically
    // because the parent controls `open` based on status
    onSelectType(type);
  };

  const handleRequestNewContext = () => {
    console.log("Request a new context clicked");
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2",
            "max-h-[90vh] overflow-y-auto",
            "rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
        >
          {/* Close button */}
          <Dialog.Close asChild>
            <button
              type="button"
              className="absolute right-6 top-6 text-zinc-400 transition-colors hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </Dialog.Close>

          {/* Role Level Legend */}
          <div className="mb-6 flex items-center justify-center gap-6">
            <LegendItem color="#6366F1" label="Executive Level" />
            <LegendItem color="#EC4899" label="Mid Level" />
            <LegendItem color="#10B981" label="Senior Level" />
            <LegendItem color="#F97316" label="Entry Level" />
            <LegendItem color="#71717A" label="Unknown" />
          </div>

          {/* Header */}
          <Dialog.Title className="mb-8 text-center text-xl font-medium text-white">
            What would you like to simulate?
          </Dialog.Title>

          {/* Categories in 2-column grid */}
          <div className="grid grid-cols-2 gap-8">
            {TEST_CATEGORIES.map((category) => (
              <div
                key={category.id}
                className={cn(
                  // Survey category spans full width
                  category.id === 'survey' && "col-span-2"
                )}
              >
                {/* Category label */}
                <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  {category.name}
                </h3>

                {/* Type cards - vertical list for better readability */}
                <div className="space-y-1">
                  {category.types.map((typeId) => {
                    const typeConfig = TEST_TYPES[typeId];
                    const IconComponent = iconMap[typeConfig.icon];

                    return (
                      <button
                        key={typeId}
                        type="button"
                        onClick={() => handleSelectType(typeId)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5",
                          "text-left transition-all duration-150",
                          "hover:bg-zinc-800"
                        )}
                      >
                        <IconComponent className="h-5 w-5 shrink-0 text-zinc-400" />
                        <span className="text-sm text-white">{typeConfig.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-8 border-t border-zinc-800 pt-6">
            <button
              type="button"
              onClick={handleRequestNewContext}
              className={cn(
                "flex items-center gap-2 text-sm text-zinc-400",
                "transition-colors hover:text-white"
              )}
            >
              <Plus className="h-4 w-4" />
              Request a new context
            </button>
          </div>

          <Dialog.Description className="sr-only">
            Select a test type to simulate content with your target society
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Legend item component showing role level with colored dot
 */
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-zinc-400">{label}</span>
    </div>
  );
}
