"use client";

import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ORACLE_CONFIG } from "@/lib/models";

interface OracleCardProps {
  className?: string;
}

export function OracleCard({ className }: OracleCardProps) {
  return (
    <Card
      className={cn("relative opacity-60 p-4", className)}
      style={{ borderColor: ORACLE_CONFIG.accentColor }}
    >
      <div className="pointer-events-none">
        <Lock className="absolute top-3 right-3 h-4 w-4 text-foreground-muted" />

        <div className="flex items-center gap-2">
          <span
            className="text-sm font-semibold"
            style={{ color: ORACLE_CONFIG.accentColor }}
          >
            {ORACLE_CONFIG.name}
          </span>
          <Badge variant="info" size="sm">
            Coming Soon
          </Badge>
        </div>

        <p className="text-xs text-foreground-muted mt-2">
          {ORACLE_CONFIG.description}
        </p>
      </div>

      <button
        type="button"
        className="mt-3 rounded-lg border border-white/[0.06] bg-transparent px-3 py-1.5 text-xs font-medium text-foreground-secondary hover:bg-white/[0.1] transition-colors"
      >
        Join Waitlist
      </button>
    </Card>
  );
}
