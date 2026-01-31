"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X, Plus } from "lucide-react";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";
import type { TestType } from "@/types/test";

interface TestTypeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectType: (type: TestType) => void;
}

// Custom X logo component (Lucide Twitter is old bird logo)
function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// Custom TikTok logo component
function TikTokLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

export function TestTypeSelector({
  open,
  onOpenChange,
  onSelectType,
}: TestTypeSelectorProps) {
  const handleSelectType = (type: TestType) => {
    onSelectType(type);
  };

  const handleRequestNewContext = () => {
    console.log("Request a new context clicked");
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[770px] -translate-x-1/2 -translate-y-1/2",
            "rounded-lg border border-[rgb(40,40,40)] bg-[rgba(6,6,6,0.667)] p-3 shadow-[0_4px_10px_rgba(0,0,0,0.5)] backdrop-blur-[8px]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
        >
          {/* Close button */}
          <Dialog.Close asChild>
            <button
              type="button"
              className="absolute right-3 top-3 text-white/60 transition-colors hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </Dialog.Close>

          {/* Title */}
          <Dialog.Title className="py-3 text-center text-[18px] font-semibold leading-[30.6px] text-white">
            What would you like to simulate?
          </Dialog.Title>

          {/* 3-column layout matching Societies.io exactly */}
          <div className="grid grid-cols-3 gap-6 px-3">
            {/* Column 1: Survey + Marketing Content */}
            <div className="space-y-4">
              {/* Survey */}
              <div>
                <p className="mb-1.5 text-xs font-normal uppercase leading-[18px] text-[rgb(184,184,184)]">
                  Survey
                </p>
                <MenuItem
                  icon={Icons.ClipboardList}
                  label="Survey"
                  onClick={() => handleSelectType("survey")}
                />
              </div>

              {/* Marketing Content */}
              <div>
                <p className="mb-1.5 text-xs font-normal uppercase leading-[18px] text-[rgb(184,184,184)]">
                  Marketing Content
                </p>
                <div className="space-y-0.5">
                  <MenuItem
                    icon={Icons.Pencil}
                    label="Article"
                    onClick={() => handleSelectType("article")}
                  />
                  <MenuItem
                    icon={Icons.AppWindow}
                    label="Website Content"
                    onClick={() => handleSelectType("website-content")}
                  />
                  <MenuItem
                    icon={Icons.Megaphone}
                    label="Advertisement"
                    onClick={() => handleSelectType("advertisement")}
                  />
                </div>
              </div>
            </div>

            {/* Column 2: Social Media Posts */}
            <div>
              <p className="mb-1.5 text-xs font-normal uppercase leading-[18px] text-[rgb(184,184,184)]">
                Social Media Posts
              </p>
              <div className="space-y-0.5">
                <MenuItem
                  icon={Icons.Linkedin}
                  label="LinkedIn Post"
                  onClick={() => handleSelectType("linkedin-post")}
                />
                <MenuItem
                  icon={Icons.Instagram}
                  label="Instagram Post"
                  onClick={() => handleSelectType("instagram-post")}
                />
                <MenuItem
                  customIcon={<XLogo className="h-5 w-5" />}
                  label="X Post"
                  onClick={() => handleSelectType("x-post")}
                />
                <MenuItem
                  customIcon={<TikTokLogo className="h-5 w-5" />}
                  label="TikTok Script"
                  onClick={() => handleSelectType("tiktok-script")}
                />
              </div>
            </div>

            {/* Column 3: Communication + Product */}
            <div className="space-y-4">
              {/* Communication */}
              <div>
                <p className="mb-1.5 text-xs font-normal uppercase leading-[18px] text-[rgb(184,184,184)]">
                  Communication
                </p>
                <div className="space-y-0.5">
                  <MenuItem
                    icon={Icons.Mail}
                    label="Email Subject Line"
                    onClick={() => handleSelectType("email-subject-line")}
                  />
                  <MenuItem
                    icon={Icons.Mail}
                    label="Email"
                    onClick={() => handleSelectType("email")}
                  />
                </div>
              </div>

              {/* Product */}
              <div>
                <p className="mb-1.5 text-xs font-normal uppercase leading-[18px] text-[rgb(184,184,184)]">
                  Product
                </p>
                <MenuItem
                  icon={Icons.Lightbulb}
                  label="Product Proposition"
                  onClick={() => handleSelectType("product-proposition")}
                />
              </div>
            </div>
          </div>

          {/* Footer separator and Request button */}
          <div className="border-t border-[rgb(40,40,40)] pt-3">
            <button
              type="button"
              onClick={handleRequestNewContext}
              className="flex items-center gap-2 px-3 py-2 text-sm text-[rgb(221,221,221)] transition-colors hover:text-white"
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
 * Menu item component matching Societies.io exactly
 */
function MenuItem({
  icon: Icon,
  customIcon,
  label,
  onClick,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  customIcon?: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[52px] w-full items-center gap-3 rounded-lg p-1.5 text-left transition-colors hover:bg-white/5"
    >
      {customIcon ? (
        <span className="flex h-6 w-6 items-center justify-center text-white">
          {customIcon}
        </span>
      ) : Icon ? (
        <Icon className="h-6 w-6 text-white" />
      ) : null}
      <span className="text-sm text-white">{label}</span>
    </button>
  );
}
