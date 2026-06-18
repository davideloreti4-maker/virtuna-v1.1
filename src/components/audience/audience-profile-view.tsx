"use client";

/**
 * AudienceProfileView — read-only Audience Profile + persona display (D-03).
 * Hero: PersonaGraph node-cloud.
 * Profile header: StatTileRow (platform / goal / temperature mix / top dispositions).
 * Persona list: DataTable (Name · Temperature Badge · Disposition Badge · Share %).
 * No edit affordances — intentional (D-03). Build so an edit column can be added later.
 * Read-only caption per Copywriting Contract.
 */

import { useMemo } from "react";
import type { Audience, CalibratedPersona, Temperature } from "@/lib/audience/audience-types";
import { PersonaGraph, type PersonaNode } from "@/components/board/_kit/PersonaGraph";
import { StatTileRow, type StatTileData } from "@/components/board/_kit/StatTile";
import { DataTable, type DataColumn } from "@/components/board/_kit/DataTable";
import { Badge } from "@/components/ui/badge";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  custom: "Custom",
};

function tempVariant(temperature: Temperature) {
  switch (temperature) {
    case "cold": return "info" as const;
    case "hot": return "success" as const;
    default: return "default" as const;
  }
}

interface AudienceProfileViewProps {
  audience: Audience;
  className?: string;
}

export function AudienceProfileView({ audience, className }: AudienceProfileViewProps) {
  const reducedMotion = usePrefersReducedMotion();

  const personas = audience.personas;
  const profile = audience.profile;

  // Map personas → PersonaNode for the graph
  const personaNodes: PersonaNode[] = useMemo(
    () =>
      personas.map((p) => ({
        id: p.archetype,
        label: p.archetype.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        weight: p.share,
        watchThrough: p.share, // use share as proxy for watch-through in read-only v1
        tone: "default" as const, // v1: no coral cluster (values untuned)
      })),
    [personas],
  );

  // StatTiles: platform, goal, temperature mix, top dispositions
  const tiles: StatTileData[] = useMemo(() => {
    const result: StatTileData[] = [];

    result.push({
      k: "Platform",
      v: PLATFORM_LABELS[audience.platform] ?? audience.platform,
    });

    if (audience.goal_label) {
      result.push({ k: "Goal", v: audience.goal_label, s: audience.goal_intent ?? undefined });
    }

    if (profile?.temperature_mix) {
      const { cold, warm, hot } = profile.temperature_mix;
      const pct = (n: number) => `${Math.round(n * 100)}%`;
      result.push({
        k: "Temp mix",
        v: `${pct(warm)} warm`,
        s: `${pct(cold)} cold · ${pct(hot)} hot`,
      });
    }

    if (profile?.top_dispositions && profile.top_dispositions.length > 0) {
      result.push({
        k: "Top dispositions",
        v: profile.top_dispositions[0] ?? "—",
        s: profile.top_dispositions.slice(1).join(" · ") || undefined,
      });
    }

    return result;
  }, [audience, profile]);

  // DataTable columns — no edit column (D-03); structured to add one later
  const columns: DataColumn<CalibratedPersona>[] = [
    {
      key: "archetype",
      label: "Persona",
      render: (p) => (
        <span className="text-[13px] text-foreground">
          {p.archetype.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
        </span>
      ),
    },
    {
      key: "temperature",
      label: "Temp",
      render: (p) => (
        <Badge variant={tempVariant(p.temperature)} size="sm">
          {p.temperature}
        </Badge>
      ),
    },
    {
      key: "disposition",
      label: "Disposition",
      render: (p) => (
        <Badge variant="default" size="sm" className="bg-white/[0.06] text-foreground-secondary border-transparent">
          {p.disposition}
        </Badge>
      ),
    },
    {
      key: "share",
      label: "Share",
      align: "right" as const,
      render: (p) => `${Math.round(p.share * 100)}%`,
    },
  ];

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* PersonaGraph hero */}
      {personaNodes.length > 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-surface px-4 py-4">
          <p className="text-xs text-foreground-muted mb-3 uppercase tracking-wider">
            Audience map
          </p>
          <PersonaGraph
            personas={personaNodes}
            height={220}
            reducedMotion={reducedMotion}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] bg-surface px-4 py-8 text-center">
          <p className="text-sm text-foreground-secondary">
            No calibrated audience data yet.
          </p>
        </div>
      )}

      {/* StatTileRow */}
      {tiles.length > 0 && <StatTileRow tiles={tiles} />}

      {/* Persona DataTable */}
      {personas.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-surface px-4 py-4">
          <p className="text-xs text-foreground-muted mb-3 uppercase tracking-wider">
            Personas
          </p>
          <DataTable<CalibratedPersona>
            columns={columns}
            rows={personas}
            rowKey={(p) => p.archetype}
          />
        </div>
      )}

      {/* Read-only caption (D-03 honesty) */}
      <p className="text-xs text-foreground-muted text-center pb-2">
        Read-only for now. Editing arrives once values are tuned.
      </p>
    </div>
  );
}
