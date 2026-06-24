"use client";

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
              "cursor-pointer text-left p-2.5",
              isSelected && "border-border-hover bg-white/[0.04]"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm font-medium text-foreground">
                  {tier.name}
                </span>
                {tier.recommended && (
                  <Badge variant="default" size="sm">
                    Recommended
                  </Badge>
                )}
              </div>
              <Badge
                variant={isSelected ? "accent" : "default"}
                size="sm"
                className="shrink-0"
              >
                {tier.nodeCount.toLocaleString()} nodes
              </Badge>
            </div>

            <p className="text-xs text-foreground-muted mt-1 leading-snug">
              {tier.description}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
