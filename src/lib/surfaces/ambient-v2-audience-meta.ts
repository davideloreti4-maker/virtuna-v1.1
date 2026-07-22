/**
 * audienceToMeta — map a live calibrated `Audience` → the `AudienceMeta` the v2 surfaces read.
 *
 * Shared by every v2 surface wrapper (Overview rail · Start home · …). The signature's calibrated
 * personas ARE the segments (each with a real share). `tier` is the SIM FIDELITY (flash|max — a run
 * setting, not an audience property), defaulted to flash here.
 *
 * Build spec: docs/HANDOFF-2026-07-22-ambient-v2-wiring-provenance-audit.md
 */

import type { Audience } from "@/lib/audience/audience-types";
import type { AudienceMeta } from "./ambient-v2-adapters";
import { platformLabel } from "@/lib/platforms";

const SCENE_OPTIONS = ["TikTok", "Instagram", "No feed"];

/** A calibrated persona's human label — the creator-edited name, else the archetype slug titled. */
export function humanizeArchetype(slug: string): string {
  return slug
    .split(/[_\s-]+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function audienceToMeta(audience: Audience): AudienceMeta {
  const from = platformLabel(audience.platform);
  const segments = (audience.personas ?? [])
    .filter((p) => p.share > 0)
    .map((p) => ({ label: p.label ?? humanizeArchetype(p.archetype), share: p.share }));
  return {
    name: audience.name,
    calibrationBadge: audience.is_general ? "baseline" : "calibrated",
    calibratedFrom: from,
    tier: "flash",
    scene: from,
    sceneOptions: SCENE_OPTIONS,
    segments,
  };
}
