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
import { SIMULABLE_SCENES } from "@/lib/engine/flash/flash-prompts";
import { platformLabel } from "@/lib/platforms";

/** The scenes the ENGINE can actually simulate — defined beside the frame each one selects
 *  (`SIMULABLE_SCENES` / `sceneToDomain` in flash-prompts.ts), so this surface can never offer a
 *  scene the engine has no frame for. It offered "Instagram" until 2026-07-28, and that ran the
 *  TikTok simulation under a different name. */
const SCENE_OPTIONS: string[] = [...SIMULABLE_SCENES];

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
    .map((p) => ({
      // The ENGINE key, carried alongside the display label. The label is creator-editable
      // (`p.label`), so matching a run back to a slice by label would be a display string doing
      // an identifier's job — the exact two-namespaces-joined-by-a-cast shape that has bitten
      // this codebase before. The archetype is what reaches the projection.
      archetype: p.archetype,
      label: p.label ?? humanizeArchetype(p.archetype),
      share: p.share,
    }));
  return {
    name: audience.name,
    calibrationBadge: audience.is_general ? "baseline" : "calibrated",
    // PROVENANCE is a fact about calibration — it stays whatever the audience was built from,
    // including platforms the engine has no frame for.
    calibratedFrom: from,
    tier: "flash",
    // SCENE is a choice, and it may only be a scene the engine can actually simulate. An
    // Instagram-calibrated audience therefore opens on TikTok, and the existing mismatch tag
    // says so out loud ("modeled · TikTok scene, Instagram-calibrated") rather than implying
    // an Instagram simulation that never runs.
    scene: SCENE_OPTIONS.includes(from) ? from : "TikTok",
    sceneOptions: SCENE_OPTIONS,
    segments,
  };
}
