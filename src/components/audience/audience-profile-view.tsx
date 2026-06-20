"use client";

/**
 * AudienceProfileView — Audience Profile + persona display (D-03), now with per-persona
 * editing on CALIBRATED audiences (AUD-EDIT-01 / D-06).
 * Hero: PersonaGraph node-cloud.
 * Profile header: StatTileRow (platform / goal / temperature mix / top dispositions).
 * Persona list: DataTable (Name · Temperature Badge · Disposition Badge · Share % · Edit).
 * - Calibrated (personal/target) audiences: each persona row has an Edit affordance that
 *   opens the PersonaEditForm inline; the display name honors the edited `label`.
 * - General / preset: NO Edit affordance + the D-06 protected-baseline caption (read-only).
 */

import { useMemo, useState } from "react";
import type { Audience, CalibratedPersona, Temperature } from "@/lib/audience/audience-types";
import { PersonaGraph, type PersonaNode } from "@/components/board/_kit/PersonaGraph";
import { StatTileRow, type StatTileData } from "@/components/board/_kit/StatTile";
import { DataTable, type DataColumn } from "@/components/board/_kit/DataTable";
import { Badge } from "@/components/ui/badge";
import { PersonaEditForm, archetypeDerivedName } from "./persona-edit-form";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";

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

/** Display name: the edited `label`, falling back to the archetype-derived string. */
function personaDisplayName(p: CalibratedPersona): string {
  return p.label ?? archetypeDerivedName(p.archetype);
}

interface AudienceProfileViewProps {
  audience: Audience;
  className?: string;
}

export function AudienceProfileView({ audience: audienceProp, className }: AudienceProfileViewProps) {
  const reducedMotion = usePrefersReducedMotion();

  // Local copy so a saved persona edit refreshes the display without a hard reload.
  const [audience, setAudience] = useState<Audience>(audienceProp);
  // Index of the persona currently being edited (null = no edit open). Calibrated only.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const personas = audience.personas;
  const profile = audience.profile;

  // Calibrated personal/target audiences are editable; General + preset are read-only (D-06).
  const isEditable = !audience.is_general && !audience.is_preset;

  // Map personas → PersonaNode for the graph (honors the edited label)
  const personaNodes: PersonaNode[] = useMemo(
    () =>
      personas.map((p) => ({
        id: p.archetype,
        label: p.label ?? archetypeDerivedName(p.archetype),
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

  // DataTable columns — the trailing Edit column is added only for calibrated audiences (D-06)
  const columns: DataColumn<CalibratedPersona>[] = [
    {
      key: "archetype",
      label: "Persona",
      render: (p) => (
        <span className="text-[13px] text-foreground">{personaDisplayName(p)}</span>
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
    // Per-persona Edit affordance — calibrated audiences ONLY (D-06).
    ...(isEditable
      ? [
          {
            key: "edit",
            label: "",
            align: "right" as const,
            render: (p: CalibratedPersona) => {
              const idx = personas.indexOf(p);
              return (
                <button
                  type="button"
                  onClick={() => setEditingIndex(idx)}
                  aria-label={`Edit ${personaDisplayName(p)}`}
                  className="flex items-center justify-center w-7 h-7 rounded-md text-foreground-secondary hover:bg-white/[0.06] hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              );
            },
          } satisfies DataColumn<CalibratedPersona>,
        ]
      : []),
  ];

  const editingPersona = editingIndex !== null ? personas[editingIndex] : undefined;

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

      {/* Inline persona-edit form (calibrated only) — opens for the selected persona */}
      {isEditable && editingPersona && editingIndex !== null && (
        <PersonaEditForm
          audience={audience}
          persona={editingPersona}
          index={editingIndex}
          onClose={() => setEditingIndex(null)}
          onSaved={(updated) => {
            setAudience(updated);
            setEditingIndex(null);
          }}
        />
      )}

      {/* Read-only General/preset caption (D-06 protected baseline). Calibrated = no caption. */}
      {!isEditable && (
        <p className="text-xs text-foreground-muted text-center pb-2">
          General is Numen&apos;s protected baseline — read-only. Calibrate a personal or target audience to edit its personas.
        </p>
      )}
    </div>
  );
}
