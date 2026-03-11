"use client";

import { Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { APOLLO_TIERS } from "@/lib/models";
import { useSimulationStore } from "@/stores/simulation-store";

interface ApolloTierSelectorProps {
  className?: string;
}

export function ApolloTierSelector({ className }: ApolloTierSelectorProps) {
  const apolloTier = useSimulationStore((s) => s.apolloTier);
  const setApolloTier = useSimulationStore((s) => s.setApolloTier);

  return (
    <div
      role="radiogroup"
      aria-label="Apollo model tier"
      className={cn("grid grid-cols-1 sm:grid-cols-3 gap-2", className)}
    >
      {APOLLO_TIERS.map((tier) => {
        const isSelected = apolloTier === tier.id;

        return (
          <Card
            key={tier.id}
            role="radio"
            tabIndex={0}
            aria-checked={isSelected}
            onClick={() => setApolloTier(tier.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setApolloTier(tier.id);
              }
            }}
            className={cn(
              "cursor-pointer text-left p-3",
              isSelected && "border-accent bg-white/[0.04]"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {tier.name}
              </span>
              <Badge
                variant={isSelected ? "accent" : "default"}
                size="sm"
              >
                {tier.nodeCount.toLocaleString()} nodes
              </Badge>
            </div>

            <p className="text-xs text-foreground-secondary mt-1">
              {tier.fullName}
            </p>

            <p className="text-xs text-foreground-muted mt-1">
              {tier.description}
            </p>

            <p className="flex items-center gap-1 text-[11px] text-foreground-muted mt-2">
              <Database className="h-3 w-3 shrink-0" />
              {tier.databaseCopy}
            </p>

            {tier.recommended && (
              <Badge variant="accent" size="sm" className="mt-2">
                Recommended
              </Badge>
            )}
          </Card>
        );
      })}
    </div>
  );
}
