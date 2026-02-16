"use client";

import { UsersThree } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

/**
 * Empty state displayed when user has no tracked competitors.
 *
 * Shows a centered layout with icon, title, description, and CTA button.
 * Matches Raycast empty state conventions with subtle surface background.
 */
export function CompetitorEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] mb-4">
        <UsersThree
          size={32}
          weight="thin"
          className="text-foreground-muted"
        />
      </div>
      <h2 className="text-lg font-medium text-foreground mb-1">
        No competitors tracked yet
      </h2>
      <p className="text-sm text-foreground-muted mb-6 text-center max-w-sm">
        Add your first TikTok competitor to start tracking their growth,
        engagement, and content strategy.
      </p>
      <Button variant="primary">Add Competitor</Button>
    </div>
  );
}
