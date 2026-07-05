"use client";

/**
 * AudienceProfileView — rich detail surface for a single audience.
 * Hero constellation, signature summary, creator voice, persona roster.
 * A1 honesty: calibration shapes who reacts in a Read, not generation output.
 */

import { useMemo, useState } from "react";
import type { Audience, CalibratedPersona, Temperature } from "@/lib/audience/audience-types";
import { PersonaGraph, type PersonaNode } from "@/components/board/_kit/PersonaGraph";
import { StatTileRow, type StatTileData } from "@/components/board/_kit/StatTile";
import { DataTable, type DataColumn } from "@/components/board/_kit/DataTable";
import { ReadingSection } from "@/components/reading/reading-section";
import { ConstellationMark } from "@/components/brand/constellation-mark";
import { Badge } from "@/components/ui/badge";
import { PersonaEditForm, archetypeDerivedName } from "./persona-edit-form";
import {
  getCreatorPersona,
  getPersonaRoster,
  getPlatformLabel,
  formatArchetype,
} from "./audience-display";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";

function tempVariant(temperature: Temperature) {
  switch (temperature) {
    case "cold": return "info" as const;
    case "hot": return "success" as const;
    default: return "default" as const;
  }
}

function personaDisplayName(p: CalibratedPersona): string {
  return p.label ?? archetypeDerivedName(p.archetype);
}

function truncate(text: string, max = 200): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

interface AudienceProfileViewProps {
  audience: Audience;
  className?: string;
}

export function AudienceProfileView({ audience: audienceProp, className }: AudienceProfileViewProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [audience, setAudience] = useState<Audience>(audienceProp);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const roster = getPersonaRoster(audience);
  const personas = audience.personas;
  const profile = audience.profile;
  const signature = audience.signature ?? null;
  const creatorPersona = getCreatorPersona(audience);
  const isEditable = !audience.is_general && !audience.is_preset;

  const personaNodes: PersonaNode[] = useMemo(
    () =>
      roster.map((p) => ({
        id: p.archetype,
        label: "label" in p && p.label ? p.label : formatArchetype(p.archetype),
        weight: p.share,
        watchThrough: p.share,
        tone: "default" as const,
        archetype: p.archetype,
      })),
    [roster],
  );

  const tiles: StatTileData[] = useMemo(() => {
    const result: StatTileData[] = [];
    result.push({ k: "Platform", v: getPlatformLabel(audience) });

    if (audience.goal_label) {
      result.push({ k: "Goal", v: audience.goal_label, s: audience.goal_intent ?? undefined });
    }

    const tempMix =
      signature?.audience.temperature_mix ?? profile?.temperature_mix;
    if (tempMix) {
      const pct = (n: number) => `${Math.round(n * 100)}%`;
      result.push({
        k: "Temp mix",
        v: `${pct(tempMix.warm)} warm`,
        s: `${pct(tempMix.cold)} cold · ${pct(tempMix.hot)} hot`,
      });
    }

    const dispositions =
      profile?.top_dispositions ??
      (signature
        ? [...roster]
            .sort((a, b) => b.share - a.share)
            .slice(0, 3)
            .map((p) => p.disposition)
        : []);
    if (dispositions.length > 0) {
      result.push({
        k: "Top dispositions",
        v: dispositions[0] ?? "—",
        s: dispositions.slice(1).join(" · ") || undefined,
      });
    }

    return result;
  }, [audience, profile, roster, signature]);

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
                  className="flex items-center justify-center w-7 h-7 rounded-md text-foreground-secondary hover:bg-white/[0.06] hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10"
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
  const provenanceHandle =
    signature?.provenance.handle ?? audience.calibration?.handle;

  return (
    // Matte resting depth on each ReadingSection card (targets `section > div` — the
    // READING_CARD — so the shared component itself is untouched). No glow, no coral.
    <div className={cn("flex flex-col gap-6 [&_section>div]:shadow-[var(--shadow-rest)]", className)}>
      <ReadingSection label="Audience map">
        {personaNodes.length > 0 ? (
          <div className="px-4 py-3">
            <PersonaGraph
              personas={personaNodes}
              height={184}
              reducedMotion={reducedMotion}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <ConstellationMark width={72} litNodeIndex={-1} className="mb-4 opacity-80" />
            <p className="text-sm text-foreground-secondary">
              {audience.is_general
                ? "General — Numen's universal baseline with 10 personas."
                : audience.is_preset
                  ? "Template audience — ready-made weight mix."
                  : "No calibrated audience data yet."}
            </p>
          </div>
        )}
      </ReadingSection>

      {signature?.summary && (
        <ReadingSection label="Summary">
          <div className="px-5 py-4">
            <p className="text-[13px] leading-relaxed text-foreground-secondary">
              {signature.summary}
            </p>
            {signature.audience.interest_tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {signature.audience.interest_tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-xs text-foreground-secondary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </ReadingSection>
      )}

      {creatorPersona && (
        <ReadingSection label="Your voice">
          <div className="px-5 py-4 space-y-3">
            {creatorPersona.content_description && (
              <p className="text-[13px] font-medium text-foreground">
                {creatorPersona.content_description}
              </p>
            )}
            {creatorPersona.context && (
              <p className="text-[12px] leading-relaxed text-foreground-secondary">
                {truncate(creatorPersona.context, 280)}
              </p>
            )}
          </div>
        </ReadingSection>
      )}

      {tiles.length > 0 && (
        <div className="px-0.5">
          <StatTileRow tiles={tiles} />
        </div>
      )}

      {personas.length > 0 ? (
        <ReadingSection label="Who reacts">
          <div className="px-4 py-4">
            {/* A1-COUPLED-COPY: revise "not how Numen writes" when weights→generation wires */}
            <p className="mb-3 text-[11px] text-foreground-muted">
              Shapes who reacts in a Read — not how Numen writes.
            </p>
            <DataTable<CalibratedPersona>
              columns={columns}
              rows={personas}
              rowKey={(p) => p.archetype}
            />
          </div>
        </ReadingSection>
      ) : roster.length > 0 ? (
        <ReadingSection label="Who reacts">
          <div className="px-5 py-4">
            <p className="mb-3 text-[11px] text-foreground-muted">
              Shapes who reacts in a Read — not how Numen writes.
            </p>
            <ul className="flex flex-col gap-2">
              {roster.map((p) => (
                <li
                  key={p.archetype}
                  className="flex items-center justify-between gap-3 text-[13px]"
                >
                  <span className="text-foreground">{formatArchetype(p.archetype)}</span>
                  <span className="text-foreground-muted tabular-nums">
                    {Math.round(p.share * 100)}% · {p.temperature}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </ReadingSection>
      ) : null}

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

      {(signature?.provenance || provenanceHandle) && (
        <p className="text-[11px] text-foreground-muted px-0.5">
          {signature?.provenance ? (
            <>
              Read {signature.provenance.videos_analyzed} posts · watched{" "}
              {signature.provenance.videos_watched} · subtitles{" "}
              {signature.provenance.sub_coverage}
              {provenanceHandle ? ` · @${provenanceHandle}` : ""}
            </>
          ) : (
            provenanceHandle && `@${provenanceHandle}`
          )}
        </p>
      )}

      {!isEditable && (
        <p className="text-xs text-foreground-muted text-center pb-2">
          General is Numen&apos;s protected baseline — read-only. Calibrate a personal or target audience to edit its personas.
        </p>
      )}
    </div>
  );
}
