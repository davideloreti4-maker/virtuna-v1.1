/**
 * buildAmbientDescriptors — the ambient room's card LEDGER: which rendered cards the room
 * reacts to, and what the anchored-focus stepper calls them (‹ Hook 2 of 4 ›).
 *
 * Extracted from composer.tsx so the ledger is a pure, directly-testable decision (mirroring
 * `resolveAmbientFocus` in use-ambient-focus.ts, which owns the NEXT decision: given a ledger,
 * which ONE card is in focus). The ledger is derived from the blocks the mounted thread view
 * ALREADY rendered — it never re-runs a model (D-02/D-03 determinism-gate-safe).
 *
 * Honesty spine: the room reacts to what is ON SCREEN. Only the active tool's view is mounted,
 * so the ledger is the mounted view's cards — nothing more (a card the creator cannot see must
 * never move the room) and nothing less (a card they CAN see must).
 */

import type { AmbientCardDescriptor } from '@/components/app/home/use-ambient-focus';

/**
 * Block type → the kind the stepper names it by. These four are exactly the card types that
 * carry a scored reaction (`{ fraction, scrollQuote }`) for the room to read; every other block
 * (markdown, band, personas, grids…) is not a reactable card and is filtered out.
 */
const KIND_BY_BLOCK_TYPE: Record<string, { id: string; label: string }> = {
  'idea-card': { id: 'idea', label: 'Idea' },
  'hook-card': { id: 'hook', label: 'Hook' },
  'script-card': { id: 'script', label: 'Script' },
  'remix-card': { id: 'remix', label: 'Remix' },
};

/** The label when the ledger is empty, or holds kinds that don't share one name. */
const FALLBACK_LABEL = 'Concept';
const MIXED_LABEL = 'Card';

/** The block arrays each thread view renders, in DOM order. */
export interface AmbientLedgerSource {
  activeTool: string;
  /** [...persistedHookBlocks, ...hooksBlocks] — the hooks view's rendered cards. */
  hook: unknown[];
  /** [...persistedIdeaBlocks, ...ideasBlocks] — the ideas view's rendered cards. */
  idea: unknown[];
  /** [...persistedScriptBlocks, ...scriptBlocks] — the script view's rendered cards. */
  script: unknown[];
  /** [...persistedRemixBlocks, ...remixBlocks] — the remix view's rendered cards. */
  remix: unknown[];
  /**
   * The chat view's rendered cards, in DOM order: every persisted turn's blocks followed by this
   * turn's streamed blocks. Non-empty only for a chat-as-agent dispatch (CHAT_AGENT_DISPATCH) —
   * a plain chat turn streams prose and contributes nothing.
   */
  chat: unknown[];
}

export interface AmbientLedger {
  descriptors: AmbientCardDescriptor[];
  /** The singular kind label for the batch — 'Hook', 'Idea', … or 'Card' when kinds are mixed. */
  kindLabel: string;
}

/**
 * One rendered card block → the honest reaction descriptor the spotlight reads, or null when the
 * block is not a reactable card (wrong type, or missing the concept/fraction it would read).
 *
 * `idx` is the block's index in the LEDGER (not within its kind), which keeps ids unique across a
 * mixed-kind chat batch (`idea-0`, `idea-1`, `hook-2`) while staying byte-identical to the old
 * per-tool scheme for a uniform batch (`hook-0`, `hook-1`).
 */
export function toAmbientDescriptor(block: unknown, idx: number): AmbientCardDescriptor | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = block as any;
  const kind = KIND_BY_BLOCK_TYPE[b?.type as string];
  if (!kind) return null;
  const p = b?.props;
  if (!p) return null;
  const concept: string | undefined = p.hookLine ?? p.title ?? p.openingBeatSeed ?? p.adaptedHook;
  const fraction: string | undefined = p.fraction;
  const scrollQuote: string | undefined = p.scrollQuote;
  if (typeof concept !== 'string' || typeof fraction !== 'string') return null;
  // S3′: a generated card carries its own 10-persona reaction (real registry-enum archetypes).
  // Thread it on so the Room's People cast + "Ask them why" list are named/real — never re-runs a
  // model. Absent on pre-S3′ persisted blocks → the presence falls back to fraction-expansion.
  const personas = Array.isArray(p.personas) ? p.personas : undefined;
  // Audience Sim v2 Stage 2 (AUD-SYNC-02): thread the card's own population projection on so the
  // Room's "The population" view shows THIS card's real N-individual numbers instead of the
  // honest-lean "MODELED FROM YOUR 10" fallback (which can DISAGREE with the card's projection).
  const population = p.population ?? undefined;
  return {
    id: `${kind.id}-${idx}`,
    kind: kind.id,
    conceptText: concept,
    fraction,
    scrollQuote: typeof scrollQuote === 'string' ? scrollQuote : '',
    personas,
    population,
  };
}

/**
 * Which descriptor a card's "See the room →" tap opens.
 *
 * THE BUG THIS LOCKS (family of #306 — one fact, two lookups that can disagree): the tap used to
 * resolve on the concept TEXT alone (`.find(d => d.conceptText === text)`), so two cards with an
 * identical concept both opened the FIRST — a thread with idea-15 and idea-16 "The Infinite Coffee
 * Loop" showed idea-15's room no matter which you tapped, while scroll-spy (keyed on the positional
 * `data-card-id`) correctly tracked idea-16. Prefer the LEDGER id (unique per card by construction —
 * `${kind}-${idx}`) and fall back to the concept text only for callers with no id in context
 * (off-composer surfaces, or a pre-anchor persisted card). Returns null when nothing matches.
 */
export function resolveFocusDescriptor(
  descriptors: AmbientCardDescriptor[],
  conceptText: string,
  cardId?: string | null,
): AmbientCardDescriptor | null {
  if (cardId) {
    const byId = descriptors.find((d) => d.id === cardId);
    if (byId) return byId;
  }
  return descriptors.find((d) => d.conceptText === conceptText) ?? null;
}

/** The kind label for a set of blocks: their shared name, 'Card' when mixed, else the fallback. */
function labelFor(blocks: unknown[]): string {
  const labels = new Set(
    blocks
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((b) => KIND_BY_BLOCK_TYPE[(b as any)?.type as string]?.label)
      .filter((l): l is string => l !== undefined),
  );
  if (labels.size === 0) return FALLBACK_LABEL;
  if (labels.size === 1) return [...labels][0]!;
  return MIXED_LABEL;
}

/**
 * The ledger: the mounted view's rendered cards → descriptors + the batch's kind label.
 *
 * Which SET is on screen is keyed by the active tool (only one view mounts at a time). What each
 * card IS comes from the block's own type — never from the chip, which is why a chat-dispatched
 * idea card is correctly named an Idea while the chip reads "chat".
 */
export function buildAmbientDescriptors(source: AmbientLedgerSource): AmbientLedger {
  const { activeTool } = source;
  const blocks =
    activeTool === 'hooks'
      ? source.hook
      : activeTool === 'idea'
        ? source.idea
        : activeTool === 'script'
          ? source.script
          : activeTool === 'remix'
            ? source.remix
            : activeTool === 'chat'
              ? source.chat
              : [];
  const descriptors = blocks
    .map((b, i) => toAmbientDescriptor(b, i))
    .filter((d): d is AmbientCardDescriptor => d !== null);
  return { descriptors, kindLabel: labelFor(blocks) };
}
