/**
 * Presentation-only helpers for the audience surface.
 * Reads Audience fields — no lib mutations, no API calls.
 */

import type {
  Audience,
  CalibratedPersona,
  CreatorPersona,
  SignaturePersona,
  Temperature,
} from "@/lib/audience/audience-types";

export type CalibrationStatus =
  | "baseline"
  | "template"
  | "thin"
  | "calibrated"
  | "needs_calibration";

export type PersonaRosterEntry = SignaturePersona | CalibratedPersona;

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  custom: "Custom",
};

const GENERAL_PERSONA_COUNT = 10;

/**
 * A persona is GROUNDED iff it carries a non-empty, trimmed `evidence` quote
 * (mirrors the spike's empty-evidence predicate — RESEARCH § Code Examples /
 * Pitfall 5). `CalibratedPersona` carries no `evidence` field at all, so template
 * personas are ungrounded-by-construction; only scrape-derived `SignaturePersona`
 * reactors carry the engagement receipt. Presentation-only — never mutates.
 */
export function isPersonaGrounded(p: { evidence?: string }): boolean {
  return typeof p.evidence === "string" && p.evidence.trim().length > 0;
}

/** Prefer signature reactors, then calibrated personas, else empty. */
export function getPersonaRoster(audience: Audience): PersonaRosterEntry[] {
  const sigPersonas = audience.signature?.audience.personas;
  if (sigPersonas && sigPersonas.length > 0) return sigPersonas;
  if (audience.personas.length > 0) return audience.personas;
  return [];
}

/** Persona count for display — General always reads as 10 universal personas. */
export function getPersonaCount(audience: Audience): number {
  if (audience.is_general) return GENERAL_PERSONA_COUNT;
  const roster = getPersonaRoster(audience);
  return roster.length;
}

export function getTemperatureMix(
  audience: Audience,
): Record<Temperature, number> | null {
  return (
    audience.signature?.audience.temperature_mix ??
    audience.profile?.temperature_mix ??
    null
  );
}

export function getCalibrationStatus(audience: Audience): CalibrationStatus {
  if (audience.is_general) return "baseline";
  if (audience.is_preset) return "template";
  const roster = getPersonaRoster(audience);
  const hasSignature = Boolean(audience.signature);
  if (!hasSignature && roster.length === 0) return "needs_calibration";
  if (audience.calibration?.thin) return "thin";
  return "calibrated";
}

export function getTypeLabel(audience: Audience): string {
  if (audience.is_general) return "General";
  if (audience.is_preset) return "Template";
  return audience.type === "personal" ? "Personal" : "Target";
}

export function getPlatformLabel(audience: Audience): string {
  return PLATFORM_LABELS[audience.platform] ?? audience.platform;
}

export function formatArchetype(archetype: string): string {
  return archetype.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Top-N personas by share for card preview lines. */
export function getTopArchetypes(audience: Audience, n = 2): string[] {
  const roster = [...getPersonaRoster(audience)].sort((a, b) => b.share - a.share);
  return roster.slice(0, n).map((p) => {
    const name = "label" in p && p.label ? p.label : formatArchetype(p.archetype);
    return `${name} ${Math.round(p.share * 100)}%`;
  });
}

export function getCreatorPersona(audience: Audience): CreatorPersona | null {
  return audience.creator_persona ?? audience.signature?.creator_persona ?? null;
}

/** Dominant temperature label for muted card subline. */
export function getDominantTemperature(
  mix: Record<Temperature, number> | null,
): string | null {
  if (!mix) return null;
  const entries: [Temperature, number][] = [
    ["cold", mix.cold],
    ["warm", mix.warm],
    ["hot", mix.hot],
  ];
  const top = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  if (top[1] <= 0) return null;
  return `${top[0]}-heavy`;
}

/** Group audiences for the list page sections. */
export function groupAudiences(audiences: Audience[]): {
  baseline: Audience[];
  templates: Audience[];
  generalTemplates: Audience[];
  yours: Audience[];
} {
  const baseline: Audience[] = [];
  const templates: Audience[] = [];
  const generalTemplates: Audience[] = [];
  const yours: Audience[] = [];
  for (const a of audiences) {
    // `mode==='general'` (the analyst/hiring authored templates) routes to its own
    // bucket BEFORE the is_preset check (A6) so it never mixes into the socials
    // `templates` bucket. GENERAL_AUDIENCE is mode='socials' (Pitfall 1) → baseline.
    if (a.mode === "general") generalTemplates.push(a);
    else if (a.is_general) baseline.push(a);
    else if (a.is_preset) templates.push(a);
    else yours.push(a);
  }
  return { baseline, templates, generalTemplates, yours };
}

/**
 * Provenance subline for a `mode==='general'` authored template card. These panels
 * carry no scrape behind them (signature null, evidence-free) → honest Directional.
 */
export function getTemplateProvenanceLabel(audience: Audience): string | null {
  if (audience.mode !== "general") return null;
  return "Authored template — Directional";
}

/** Card subline under the audience name. */
export function getAudienceCardSubtitle(audience: Audience): string {
  if (audience.is_general) return "10 universal personas";
  if (audience.is_preset) return "Ready-made weight mix";
  const count = getPersonaCount(audience);
  const platform = getPlatformLabel(audience);
  const type = getTypeLabel(audience);
  if (count === 0) return `${platform} · ${type}`;
  return `${count} persona${count === 1 ? "" : "s"} · ${platform} · ${type}`;
}
