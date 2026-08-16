/**
 * saved-item-vm — the per-type view-model for a saved Library row (rev 5).
 *
 * Extracted from the old saved-item-card.tsx, which packed the field extraction, the card markup
 * and the row markup into one file. The extraction is the valuable part and both the row and its
 * expansion need it, so it lives here on its own.
 *
 * The snapshot IS the originating block's props (SaveAffordance snapshot={block.props}), so every
 * field is REAL — nothing is invented. Type-differentiated by honest data: Reads lead with the
 * Lever; Hooks carry archetype + rank; simulated types carry a band; outliers are MEASURED (no
 * band — measured ≠ simulated).
 *
 * §R5-3: `metric` is what the right rail renders. Live data drove this — 8 of 10 saved rows carry
 * a band, because hook, idea and script snapshots all persist one, not just reads. So the band is
 * a rail metric shared with the outlier's measured multiplier, rather than a coloured line on
 * almost every row.
 */

import {
  BookOpen,
  Lightbulb,
  Lightning,
  FilmSlate,
  TrendUp,
  Repeat,
  type Icon,
} from "@phosphor-icons/react";
import type { SavedItem, SavedItemType } from "@/lib/shelf/shelf-repo";
import { formatCount } from "@/lib/competitors-utils";

/**
 * Per-type forward action — the thread card's chain step
 * (docs/subsystems/ui-skill-cards.md §1.7 + CHAIN_HANDOFFS pinned endpoints).
 *
 * ⚠️ Only types with a REAL endpoint appear here. The shipped map listed `script: null` and then
 * fell through, for every unlisted type, to a generic "Use in thread →" that pushed `/home` and
 * ignored the row's own `thread_id` — a button that looked like a deep link and wasn't. Types
 * without a forward step now offer "Open the thread" instead, which is a real deep link.
 */
export const FORWARD: Partial<Record<SavedItemType, { label: string; endpoint: string }>> = {
  hook: { label: "Write script", endpoint: "/api/tools/script" },
  idea: { label: "Develop into hooks", endpoint: "/api/tools/ideas/develop" },
  // A remix is an adapted hook concept, so its forward step writes hooks from it — mirroring the
  // remix card's own "Write hooks for this →".
  remix: { label: "Write hooks for this", endpoint: "/api/tools/ideas/develop" },
};

export const TYPE_LABEL: Record<SavedItemType, string> = {
  read: "Read",
  idea: "Idea",
  hook: "Hook",
  script: "Script",
  outlier: "Outlier",
  remix: "Remix",
};

/** Plural group/facet heading. §R5-8: ONE source, so the shelf and a project cannot disagree. */
export const TYPE_PLURAL: Record<SavedItemType, string> = {
  read: "Reads",
  idea: "Ideas",
  hook: "Hooks",
  script: "Scripts",
  outlier: "Outliers",
  remix: "Remixes",
};

export const TYPE_ICON: Record<SavedItemType, Icon> = {
  read: BookOpen,
  idea: Lightbulb,
  hook: Lightning,
  script: FilmSlate,
  outlier: TrendUp,
  remix: Repeat,
};

/**
 * §R5-7 — group order inside a project is the PIPELINE: what you found, what you thought of,
 * what you wrote, what you built, what judged it. Rev 4 asserted "working order" and drew
 * Hooks → Scripts → Read with no Ideas group at all.
 */
export const PIPELINE_ORDER: readonly SavedItemType[] = [
  "outlier",
  "idea",
  "remix",
  "hook",
  "script",
  "read",
];

/**
 * Band → tone. Colour only where a row needs ATTENTION (Apple-grammar pass, 2026-08-16):
 * measured live, 8 of 10 shelf rows carry a band, so tone-per-band painted ten coloured
 * words on one screen and the colour stopped ranking anything. Strong/Mixed read fine as
 * words; Weak is the one verdict that asks for action, so it keeps the error tone.
 * Still NOT the brand accent, which stays liveness-only.
 */
export const BAND_TONE: Record<string, string> = {
  Strong: "var(--color-foreground-muted)",
  Mixed: "var(--color-foreground-muted)",
  Weak: "var(--color-error)",
};

// ─── snapshot field extractors (snapshot = block props, persisted loose) ──────
type Snap = Record<string, unknown>;
const sv = (o: Snap, k: string): string => (typeof o?.[k] === "string" ? (o[k] as string) : "");
const nv = (o: Snap, k: string): number | undefined =>
  typeof o?.[k] === "number" ? (o[k] as number) : undefined;

/** Clean "{n}×" display from a measured multiplier (1 decimal under 10×, integer above). */
function formatMult(m: number): string {
  if (!Number.isFinite(m) || m <= 0) return "";
  return m >= 10 ? `${Math.round(m)}×` : `${m.toFixed(1)}×`;
}

/** Duration in seconds → "m:ss" cover badge ("" when unknown). Mirrors discover/outlier-tile. */
function formatDuration(s: number): string {
  if (!Number.isFinite(s) || s <= 0) return "";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * Stored proof fractions occasionally carry a stray trailing token (e.g. "7/10 stop"), which
 * rendered as "7/10 stop stopped". Keep only the clean N/M.
 */
export function fracNM(f: string): string {
  return f.match(/\d+\s*\/\s*\d+/)?.[0] ?? f;
}

/** Best-effort anchor extraction from a persisted snapshot's block props (forward payload). */
export function anchorFromSnapshot(snapshot: Record<string, unknown>): string {
  const props = (snapshot.props as Record<string, unknown> | undefined) ?? snapshot;
  const pick = (k: string) => (typeof props[k] === "string" ? (props[k] as string) : "");
  const title = pick("title");
  const angle = pick("angle");
  const hookLine = pick("hookLine");
  if (hookLine) return hookLine;
  if (title && angle) return `${title}\n\n${angle}`;
  return title || pick("text") || "";
}

/** What the right rail shows: a simulated band, or a measured multiplier — never both. */
export interface RailMetric {
  /** "Strong" | "Mixed" | "Weak" — coloured, one word only. */
  band?: string;
  bandTone?: string;
  /** "9/10" — cream, tabular. */
  fraction?: string;
  /** Outlier: "14× baseline". Measured, so never toned. */
  measured?: string;
}

/** Normalised view-model — the shared spine, filled per type from real snapshot fields. */
export interface SavedRowVM {
  typeLabel: string;
  /** e.g. "Lever →" on a Read. */
  heroPrefix?: string;
  /** The content line — the sentence the row exists to show. */
  hero: string;
  /** The rail. */
  metric: RailMetric;
  /** Expansion only: the mechanism / why. */
  why?: string;
  /** Expansion only: the lead audience quote. */
  quote?: string;
  /** Expansion only: labelled facts. */
  archetype?: string;
  rank?: number;
  /** Expansion only: script shape ("5 beats, ~42s"). */
  shape?: string;
  /** Outlier cover. */
  coverUrl?: string;
  coverDuration?: string;
  /** Outlier: views, shown in the expansion. */
  views?: string;
}

/** Build the per-type view-model from the saved snapshot (the originating block's props). */
export function buildRowVM(item: SavedItem): SavedRowVM {
  const snap = item.snapshot ?? {};
  const typeLabel = TYPE_LABEL[item.item_type] ?? "Saved";

  /** Simulated band → rail metric. Shared by hook/idea/script/remix/read. */
  const bandMetric = (source: Snap): RailMetric => {
    const band = sv(source, "band");
    if (!band) return {};
    const fraction = fracNM(sv(source, "fraction"));
    return { band, bandTone: BAND_TONE[band], fraction: fraction || undefined };
  };

  switch (item.item_type) {
    case "hook":
    case "remix": {
      return {
        typeLabel,
        hero: sv(snap, "hookLine") || sv(snap, "adaptedHook") || item.title || typeLabel,
        metric: bandMetric(snap),
        why: sv(snap, "mechanism") || undefined,
        quote: sv(snap, "scrollQuote") || undefined,
        archetype: sv(snap, "audienceArchetype") || undefined,
        rank: nv(snap, "rank"),
      };
    }
    case "idea": {
      const angle = sv(snap, "angle");
      const fits = sv(snap, "whyItFits");
      return {
        typeLabel,
        hero: sv(snap, "title") || item.title || typeLabel,
        metric: bandMetric(snap),
        why: [angle, fits].filter(Boolean).join(" — ") || undefined,
        quote: sv(snap, "scrollQuote") || undefined,
      };
    }
    case "script": {
      const beats = Array.isArray(snap.beats) ? (snap.beats as Snap[]) : [];
      const opener = sv(snap, "openingBeatSeed") || (beats[0] ? sv(beats[0], "content") : "");
      const seconds = beats.reduce((sum, b) => sum + (nv(b, "seconds") ?? 0), 0);
      return {
        typeLabel,
        hero: item.title || opener || typeLabel,
        metric: bandMetric(snap),
        why: opener && item.title ? opener : undefined,
        quote: sv(snap, "scrollQuote") || undefined,
        shape: beats.length
          ? `${beats.length} beat${beats.length === 1 ? "" : "s"}${seconds > 0 ? `, ~${Math.round(seconds)}s` : ""}`
          : undefined,
      };
    }
    case "read": {
      // A Read's payload is per-audience; the lead audience carries the headline Lever.
      const auds = Array.isArray(snap.audiences) ? (snap.audiences as Snap[]) : [];
      const lead = auds[0] ?? {};
      const lever = sv(lead, "lever");
      const persona0 = Array.isArray(lead.personas) ? (lead.personas as Snap[])[0] : undefined;
      return {
        typeLabel,
        heroPrefix: lever ? "Lever →" : undefined,
        hero: lever || sv(lead, "interpretation") || item.title || typeLabel,
        metric: bandMetric(lead),
        why: lever ? sv(lead, "interpretation") || undefined : undefined,
        quote: persona0 ? sv(persona0, "quote") || undefined : undefined,
        archetype: sv(lead, "name") || undefined,
      };
    }
    case "outlier": {
      // Snapshot = OutlierTileData (discover/outlier-tile): multiplier/views are NUMBERS.
      const multRaw = nv(snap, "multiplier");
      const multCore = sv(snap, "multiplier") || (multRaw != null ? formatMult(multRaw) : "");
      // D-05 honesty: never a bare multiplier — pair it with its baseline label.
      const baseline = sv(snap, "baselineLabel");
      const mult = multCore ? (baseline ? `${multCore} ${baseline}` : multCore) : "";
      const viewsRaw = nv(snap, "views");
      const durRaw = nv(snap, "durationSeconds");
      return {
        typeLabel,
        hero: sv(snap, "caption") || item.title || typeLabel,
        metric: { measured: mult || undefined },
        coverUrl: sv(snap, "coverUrl") || undefined,
        coverDuration: durRaw != null ? formatDuration(durRaw) || undefined : undefined,
        views: sv(snap, "views") || (viewsRaw != null ? formatCount(viewsRaw) : undefined),
      };
    }
    default: {
      // A legacy `format` row, or anything the union does not know. Title-only, never a crash.
      return { typeLabel, hero: item.title || typeLabel, metric: {} };
    }
  }
}
