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
import type { SimTier } from "@/components/audience-lens/v2/AmbientOverview";
import type { AudienceMeta } from "./ambient-v2-adapters";
import { SIMULABLE_SCENES } from "@/lib/engine/flash/flash-prompts";
import { platformLabel } from "@/lib/platforms";

/**
 * The headcount a tier actually simulates — the room's SIZE, as stated to the creator.
 *
 * Lives here rather than in a component because two surfaces now say it and the owner ruled the
 * wording (2026-08-12): the room's own header, and the phone arrival's audience line. That copy is
 * only true if both read the same number, and a second literal is how they stop doing so.
 *
 * ⚠️ `AmbientSimulate` keeps its own copy on purpose — there the number is multiplied by a
 * segment's share to size a panel, which is a different claim than "this is how big the room is".
 * `import type` on SimTier, so nothing at runtime crosses back into the component.
 */
export const TIER_VIEWERS: Record<SimTier, number> = { flash: 1000, max: 10000 };

/** "1,000 viewers" — the room's size, comma-grouped, in the product's noun. */
export function roomHeadcount(tier: SimTier): string {
  return `${String(TIER_VIEWERS[tier]).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} viewers`;
}

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
      // The calibration-stored reaction frame — the ONLY per-segment string the sim is briefed
      // with. The resting board prints it verbatim (see `deriveSegments`); nothing else reads it
      // from here. Absent on rows written before the field existed → the row prints no frame
      // rather than a fabricated one.
      repaint: p.repaint ?? "",
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
