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
import { archetypeDisplayName } from "@/lib/audience/archetype-names";

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
  // `mode==='general'` authored templates (analyst/hiring) are Directional-by-design —
  // no scrape, no calibration behind them. Routed FIRST (A6, mirroring groupAudiences)
  // so they never fall through to "calibrated" and render a confident "Calibrated" chip
  // beside their honest "Directional" badge (WR-01 honesty self-contradiction).
  if (audience.mode === "general") return "template";
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

/**
 * The user-facing name for a persona archetype. Delegates to the SSOT map
 * (`@/lib/audience/archetype-names`) so the workspace and the hook cards call the same person the
 * same thing — before this, both title-cased the raw slug and the app said "Cross Niche Curiosity"
 * at the user. An unknown slug still title-cases (those rows exist — #282).
 *
 * ⚠️ Display only. The engine binds on `archetype`; the model is briefed with `repaint`. This
 * string must never reach a prompt (F7).
 */
export function formatArchetype(archetype: string): string {
  return archetypeDisplayName(archetype);
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

// ─── The honesty column (SPEC-2026-07-13 §4) ─────────────────────────────────

/**
 * Where this audience came from — the one fact that replaces the retired six-term
 * badge vocabulary (Validated/Directional/Calibrated/Baseline/Template/Limited data).
 *
 * It states the provenance in plain words instead of encoding it: a scraped audience
 * says which handle and how many videos; a described one says nobody read an account;
 * an empty one says so and asks to be filled. Never claims data we don't hold.
 */
export interface BuiltFrom {
  label: string;
  sub: string | null;
  /** True when the honest answer is "nothing yet" — the only state that earns colour. */
  needsAction: boolean;
}

export function getBuiltFrom(audience: Audience): BuiltFrom {
  if (audience.is_general) {
    return {
      label: "Maven's baseline",
      sub: "Same for every user",
      needsAction: false,
    };
  }
  if (audience.is_preset) {
    return { label: "Ready-made mix", sub: "Authored by Maven", needsAction: false };
  }

  // A signature alone does NOT prove a scrape: the authored custom audiences (Marcus, Maya)
  // carry one with an EMPTY provenance handle, which rendered as "Read from @" — a claim to
  // account data that does not exist. The handle is the evidence; without it, we don't claim.
  const prov = audience.signature?.provenance;
  if (prov?.handle) {
    const videos =
      prov.videos_analyzed > 0 ? `${prov.videos_analyzed} videos` : "your account";
    return { label: `Read from @${prov.handle}`, sub: videos, needsAction: false };
  }

  // A scrape without a signature still knows its handle (legacy calibration rows).
  if (audience.calibration?.source === "scrape" && audience.calibration.handle) {
    return {
      label: `Read from @${audience.calibration.handle}`,
      sub: null,
      needsAction: false,
    };
  }

  if (getPersonaRoster(audience).length > 0) {
    return {
      label: "A description you wrote",
      sub: "No account data behind it",
      needsAction: false,
    };
  }

  return {
    label: "Nothing yet",
    sub: "Read your @handle to fill it",
    needsAction: true,
  };
}

/**
 * The single honest axis, replacing the two-badge muddle: how real is this audience?
 * `described` — personas inferred from text. `read` — built from a real scrape.
 * `proven` is the unreached rung (the outcome loop can't be queried yet — SPEC §9).
 */
export type SourceRung = "described" | "read" | "proven";

export function getRung(audience: Audience): SourceRung {
  // Same rule as getBuiltFrom: the handle is what makes a signature a *reading* of a real
  // account. A signature with no handle is authored, not read.
  if (audience.signature?.provenance.handle) return "read";
  if (audience.calibration?.source === "scrape") return "read";
  return "described";
}

/** `mode: 'general'` audiences are the horizontal track — no social account behind them. */
export function isCustomAudience(audience: Audience): boolean {
  return audience.mode === "general";
}

// ─── Account ↔ audience pairing (the ACCOUNTS zone + the detail page) ─────────

/** The slice of a connected account the pairing reads (client- and server-safe). */
export interface AccountLike {
  id: string;
  handle: string;
  platform: "tiktok" | "instagram" | "youtube";
}

function isOwnedAudience(a: Audience): boolean {
  return !a.is_general && !a.is_preset;
}

/**
 * The audience a connected account manifests as. Matches by `source_account_id` OR by
 * scrape handle+platform (audiences calibrated before connected_accounts existed carry
 * no FK). Among candidates the CALIBRATED one wins — the connect deep-link can leave an
 * empty shell with the FK set, and it must not shadow the audience that actually
 * carries the account's reading (live-caught 2026-07-16).
 */
export function audienceForAccount(
  account: AccountLike,
  audiences: Audience[],
): Audience | undefined {
  const candidates = audiences.filter(
    (a) =>
      isOwnedAudience(a) &&
      (a.source_account_id === account.id ||
        (a.platform === account.platform &&
          a.calibration?.source === "scrape" &&
          a.calibration.handle?.toLowerCase() === account.handle.toLowerCase())),
  );
  if (candidates.length <= 1) return candidates[0];
  return [...candidates].sort((x, y) => getPersonaCount(y) - getPersonaCount(x))[0];
}

/** The inverse pairing: which connected account stands behind this audience. */
export function accountForAudience<A extends AccountLike>(
  audience: Audience,
  accounts: A[],
  audiences: Audience[],
): A | undefined {
  return accounts.find((acc) => audienceForAccount(acc, audiences)?.id === audience.id);
}

/**
 * The composition mark: one segment per persona, width = share, tone = temperature.
 * Replaces the dot-scatter thumb, which encoded nothing on the rows that had no
 * personas (they all rendered the same static placeholder).
 *
 * General carries no persona rows but is a real 10-persona baseline, so it renders an
 * even 10-segment bar. An audience with nothing behind it returns [] — the caller
 * shows an explicitly empty bar rather than decorating a void.
 */
export interface CompositionSegment {
  share: number;
  temperature: Temperature;
}

const GENERAL_SEGMENT_TEMPS: Temperature[] = [
  "cold", "warm", "warm", "cold", "warm", "hot", "cold", "warm", "hot", "warm",
];

export function getCompositionSegments(audience: Audience): CompositionSegment[] {
  const roster = getPersonaRoster(audience);
  if (roster.length > 0) {
    return roster.map((p) => ({ share: p.share, temperature: p.temperature }));
  }
  if (audience.is_general) {
    return GENERAL_SEGMENT_TEMPS.map((temperature) => ({
      share: 1 / GENERAL_PERSONA_COUNT,
      temperature,
    }));
  }
  return [];
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
