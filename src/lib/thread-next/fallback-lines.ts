/**
 * fallback-lines.ts — the fallback card's title and lines for every block type the new renderer
 * has no card of its own for (spec §4.6). The card shows the first three lines and "Show all"
 * lists every line, so ALL lines are returned here, in order.
 *
 * | Type                  | Title              | Lines                                              |
 * |-----------------------|--------------------|----------------------------------------------------|
 * | composed-card         | deliverable.text   | body: bullets, note, column titles, timeline, beats|
 * | account-read          | "Your account"     | patterns.working, then patterns.fix                |
 * | profile-read          | subjectName        | identity.traits, then howTheyReact                 |
 * | multi-audience-read   | concept            | per audience: name · lever                         |
 * | corpus-references     | "Sources"          | @handle · views per source                         |
 * | reaction-distribution | audienceName       | the verdicts (a person's, or group · verdict)      |
 * | prediction-gauge      | scenario           | factor drivers                                     |
 * | persona-chat-turn     | the group's name   | text                                               |
 * | brought-card          | stimulus           | none (see below)                                   |
 * | band, personas, other | "Answer"           | none                                               |
 *
 * brought-card: the spec table names `scrollQuote` as its line, but the plan's binding constraint
 * says no new card ever shows a `scrollQuote`; the constraint wins, so it has a title only.
 *
 * Titles and lines are trimmed; empty ones are dropped; a missing title is "Answer". The block is
 * re-validated here, so a block whose props do not validate is { "Answer", [] } too.
 *
 * Pure: no React.
 */

import { validateBlock } from "@/lib/tools/block-registry";
import type {
  AccountReadBlock,
  BroughtCardBlock,
  CorpusReferencesBlock,
  MultiAudienceReadBlock,
  PersonaChatTurnBlock,
} from "@/lib/tools/blocks";
import type { PredictionGaugeBlock, ProfileReadBlock, ReactionDistributionBlock } from "@/lib/tools/profile-blocks";
import type { ComposedCardBlock, Slot } from "@/lib/tools/composed-card-schema";
import { archetypeDisplayName } from "@/lib/audience/archetype-names";
import { formatCount } from "@/lib/competitors-utils";

export interface FallbackLines {
  title: string;
  lines: string[];
}

export const FALLBACK_TITLE = "Answer";

/** "Quiet Watchers" → "Quiet watchers" (the product writes sentence case). */
function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function groupName(archetype: string): string {
  return sentenceCase(archetypeDisplayName(archetype));
}

function slotLines(slot: Slot): string[] {
  switch (slot.kind) {
    case "bullets":
      return slot.items;
    case "note":
      return [slot.text];
    case "comparison":
      return slot.columns.map((c) => c.title);
    case "script_timeline":
      return slot.lines.map((l) => l.text);
    case "beats":
      return slot.items.map((b) => b.text);
    default:
      return [];
  }
}

function raw(type: string, props: unknown): { title: string | undefined; lines: string[] } {
  switch (type) {
    case "composed-card": {
      const p = props as ComposedCardBlock["props"];
      return { title: p.deliverable.text, lines: p.body.flatMap(slotLines) };
    }
    case "account-read": {
      const p = props as AccountReadBlock["props"];
      return { title: "Your account", lines: [...(p.patterns?.working ?? []), ...(p.patterns?.fix ?? [])] };
    }
    case "profile-read": {
      const p = props as ProfileReadBlock["props"];
      return { title: p.subjectName, lines: [...p.identity.traits, p.howTheyReact] };
    }
    case "multi-audience-read": {
      const p = props as MultiAudienceReadBlock["props"];
      return { title: p.concept, lines: p.audiences.map((a) => `${a.name} · ${a.lever}`) };
    }
    case "corpus-references": {
      const p = props as CorpusReferencesBlock["props"];
      return {
        title: "Sources",
        lines: p.sources.map((s) => {
          const handle = `@${s.handle.trim().replace(/^@+/, "")}`;
          return s.views === null || !Number.isFinite(s.views) ? handle : `${handle} · ${formatCount(s.views)} views`;
        }),
      };
    }
    case "reaction-distribution": {
      const p = props as ReactionDistributionBlock["props"];
      const lines =
        p.subjectKind === "person"
          ? p.read
            ? [p.read.verdict]
            : []
          : (p.reactions ?? []).map((r) => `${groupName(r.archetype)} · ${r.verdict}`);
      return { title: p.audienceName, lines };
    }
    case "prediction-gauge": {
      const p = props as PredictionGaugeBlock["props"];
      return { title: p.scenario, lines: p.factors.map((f) => f.driver) };
    }
    case "persona-chat-turn": {
      const p = props as PersonaChatTurnBlock["props"];
      return { title: groupName(p.archetype), lines: [p.text] };
    }
    case "brought-card": {
      const p = props as BroughtCardBlock["props"];
      return { title: p.stimulus, lines: [] };
    }
    default:
      return { title: undefined, lines: [] };
  }
}

export function fallbackOf(block: { type: string; props: unknown }): FallbackLines {
  const v = validateBlock(block);
  if (!v.ok) return { title: FALLBACK_TITLE, lines: [] };
  const { title, lines } = raw(v.block.type, v.block.props);
  return {
    title: title?.trim() || FALLBACK_TITLE,
    lines: lines.map((l) => l.trim()).filter((l) => l.length > 0),
  };
}
