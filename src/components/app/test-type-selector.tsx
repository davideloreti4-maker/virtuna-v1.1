"use client";

import { Plus } from "lucide-react";
import * as Icons from "lucide-react";
import type { TestType } from "@/types/test";
import { TEST_TYPES } from "@/lib/test-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

/**
 * Icon mapping for test types.
 * Maps TestType id to the appropriate icon component or custom SVG.
 */
const ICON_MAP: Record<
  TestType,
  { icon?: React.ComponentType<{ className?: string }>; custom?: React.ReactNode }
> = {
  survey: { icon: Icons.ClipboardList },
  article: { icon: Icons.FileText },
  "website-content": { icon: Icons.Globe },
  advertisement: { icon: Icons.Megaphone },
  "linkedin-post": { icon: Icons.Linkedin },
  "instagram-post": { icon: Icons.Instagram },
  "x-post": { custom: <XLogo className="h-6 w-6" /> },
  "tiktok-script": { custom: <TikTokLogo className="h-6 w-6" /> },
  "email-subject-line": { icon: Icons.Mail },
  email: { icon: Icons.Send },
  "product-proposition": { icon: Icons.Package },
};

/**
 * Badge configuration for specific test types.
 */
const BADGE_MAP: Partial<
  Record<TestType, { label: string; variant: "accent" | "success" | "warning" | "error" | "default" }>
> = {
  survey: { label: "Popular", variant: "accent" },
  "tiktok-script": { label: "New", variant: "accent" },
};

/** All test type ids in display order */
const TEST_TYPE_ORDER: TestType[] = [
  "survey",
  "article",
  "website-content",
  "advertisement",
  "linkedin-post",
  "instagram-post",
  "x-post",
  "tiktok-script",
  "email-subject-line",
  "email",
  "product-proposition",
];

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="xl"
        className="max-w-[680px] border-white/[0.06]"
        style={{
          background: "linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%)",
          backdropFilter: "blur(5px)",
          WebkitBackdropFilter: "blur(5px)",
          boxShadow: "rgba(255,255,255,0.15) 0px 1px 1px 0px inset, 0 20px 40px rgba(0,0,0,0.4)",
        }}
      >
        <DialogHeader className="text-center px-5 pt-5 pb-0">
          <DialogTitle>What would you like to simulate?</DialogTitle>
          <DialogDescription>
            Select a test type to begin
          </DialogDescription>
        </DialogHeader>

        {/* Responsive card grid */}
        <div className="grid grid-cols-1 gap-2.5 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          {TEST_TYPE_ORDER.map((typeId) => {
            const config = TEST_TYPES[typeId];
            const iconEntry = ICON_MAP[typeId];
            const badge = BADGE_MAP[typeId];
            const IconComponent = iconEntry.icon;

            return (
              <button
                key={typeId}
                type="button"
                className={cn(
                  "group rounded-[10px] border border-white/[0.06] bg-white/[0.03] p-3.5 text-left",
                  "transition-all duration-200",
                  "hover:-translate-y-0.5 hover:border-white/[0.1] hover:bg-white/[0.06]"
                )}
                style={{
                  boxShadow: "rgba(255,255,255,0.08) 0px 1px 0px 0px inset",
                }}
                onClick={() => handleSelectType(typeId)}
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-start justify-between">
                    {/* Icon */}
                    <span className="text-foreground-secondary">
                      {iconEntry.custom ? (
                        <span className="flex h-6 w-6 items-center justify-center">
                          {iconEntry.custom}
                        </span>
                      ) : IconComponent ? (
                        <IconComponent className="h-6 w-6" />
                      ) : null}
                    </span>

                    {/* Optional badge */}
                    {badge && (
                      <Badge variant={badge.variant} size="sm">
                        {badge.label}
                      </Badge>
                    )}
                  </div>

                  {/* Title */}
                  <span className="text-sm font-semibold text-foreground">
                    {config.name}
                  </span>

                  {/* Description */}
                  <span className="line-clamp-1 text-xs text-foreground-secondary">
                    {config.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer with request button */}
        <div className="border-t border-white/[0.06] px-5 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRequestNewContext}
          >
            <Plus className="h-4 w-4" />
            Request a new context
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
