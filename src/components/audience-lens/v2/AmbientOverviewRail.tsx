"use client";

/**
 * AmbientOverviewRail — the Ambient Audience v2 surfaces, mounted in the composer's ≥xl thread rail
 * (parallel-run behind `AMBIENT_V2_ENABLED`; the legacy `AudiencePresence` stays the default).
 *
 * Fed the REAL live inputs already in composer scope — the active `Audience` (→ `AudienceMeta`) and
 * the thread's projected-card ledger (`AmbientCardDescriptor[]`). Overview + Simulate render on real
 * data (zero fabrication; queued ranks come from the shipped projection). Two seams are explicitly
 * LATER phases, marked below:
 *   - firing the real sim (`onSimulate`) — Phase D (the sealed verdict replaces the projection);
 *   - the Brain/Population depth detail (`onOpenStimulus`) — Phase C (its producers aren't real yet),
 *     so a rank tap opens Simulate in develop mode rather than a fixture-backed depth view.
 *
 * Build spec: docs/HANDOFF-2026-07-22-ambient-v2-wiring-provenance-audit.md
 */

import { useState } from "react";
import { AMBIENT_PANEL_HEIGHT, AmbientOverview } from "./AmbientOverview";
import { AmbientSimulate, type StimulusKind } from "./AmbientSimulate";
import { buildOverviewData, buildSimulateData, parsePersonaStops } from "@/lib/surfaces/ambient-v2-adapters";
import { audienceToMeta } from "@/lib/surfaces/ambient-v2-audience-meta";
import type { Audience } from "@/lib/audience/audience-types";
import type { AmbientCardDescriptor } from "@/components/app/home/use-ambient-focus";

/** The descriptor kind → the Simulate stimulus kind (script/remix are drafts under test). */
function stimulusKindOf(kind?: string): StimulusKind {
  switch (kind) {
    case "hook":
      return "hook";
    case "idea":
      return "idea";
    default:
      return "draft"; // script · remix · unknown
  }
}

/** A rough band word for the develop tie-back, from the projection's /10 (shares the 6/3 bands). */
function bandFromStops(stops: number): string {
  if (stops >= 6) return "Strong";
  if (stops >= 3) return "Fair";
  return "Weak";
}

export function AmbientOverviewRail({
  audience,
  descriptors,
  reducedMotion = false,
}: {
  audience: Audience;
  descriptors: AmbientCardDescriptor[];
  reducedMotion?: boolean;
}) {
  const meta = audienceToMeta(audience);
  // "develop" carries the tapped rank into Simulate; null ⇒ Overview.
  const [developId, setDevelopId] = useState<string | null>(null);

  const openDevelop = (id: string) => setDevelopId(id);

  if (developId !== null) {
    const d = descriptors.find((x) => x.id === developId);
    const stops = d ? parsePersonaStops(d.fraction) : 0;
    const simData = buildSimulateData({
      audience: meta,
      stimulus: { text: d?.conceptText ?? "", kind: stimulusKindOf(d?.kind) },
      develop: { band: bandFromStops(stops), value: `${stops}/10`, lensLabel: "would stop" },
    });
    return (
      <div className="flex w-full items-start justify-center">
        <AmbientSimulate
          data={simData}
          mode="develop"
          onClose={() => setDevelopId(null)}
          // Phase D: fire the real runSimulate here → sealed verdict replaces the projection.
          onSimulate={() => setDevelopId(null)}
        />
      </div>
    );
  }

  const overview = buildOverviewData({ audience: meta, descriptors });
  return (
    <div style={{ height: AMBIENT_PANEL_HEIGHT }} className="flex w-full justify-center">
      <AmbientOverview
        data={overview}
        reducedMotion={reducedMotion}
        // Phase C: a rank tap should open the Brain/Population depth — its producers aren't real yet,
        // so for now it routes to Simulate (develop) for that rank instead of a fixture depth view.
        onOpenStimulus={openDevelop}
        onQuickSimulate={openDevelop}
        onTestVariant={() => descriptors[0] && openDevelop(descriptors[0].id)}
      />
    </div>
  );
}
