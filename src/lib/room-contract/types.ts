/**
 * The Room ⇄ Surfaces contract — the four shared seams (docs/THE-CONTRACT.md §3).
 *
 * The Room (`~/virtuna-the-room`) owns the REAL implementations of the card /
 * presence / composer atoms; the Surfaces session builds against THESE interfaces
 * and stubs them with contract-shaped mock data (see `mock-room.ts`) until the atom
 * lands, then grafts stub → real. Both halves must render the SAME shapes so the
 * product reads as one thing at integration.
 *
 * ⚠️ Keep these shapes in lock-step with The Room's copy. If a seam changes, it is a
 * cross-session reconciliation (THE-CONTRACT.md §6), not a unilateral edit.
 */

/** Dot color on a card verdict: green / terracotta / muted. */
export type Tone = "loved" | "bounced" | "neutral";

/** The whole app collapses ~13 skills into three verbs (THE-CONTRACT.md §2). */
export type Verb = "Make" | "Test" | "Ask";

/** Calibration tier, from `resolve-tier.ts`. Honest about how grounded a Read is. */
export type Tier = "Directional" | "Validated";

/**
 * Seam 1 — the card's inline verdict (the "Glance" tier: a door to the Room).
 * Identical on a thread card, feed tile, calendar slot, saved card, briefing item.
 * Tapping the card opens The Room anchored on `cardId` (their "anchored focus").
 *
 * `stop` is ONE blended number of 10 (THE-CONTRACT.md §6.3 RESOLVED — the two-signal
 * Craft/Room breakdown lives inside the Room drill, never on the card face).
 */
export interface CardReaction {
  cardId: string;
  tone: Tone;
  stop: number; // headline metric, of 10 → "7/10 would watch"
  lead: string; // one lead verbatim, in a Person's voice → "finally, honest"
}

/** A named Person — never the archetype enum (THE-CONTRACT.md §2). */
export interface Person {
  id: string;
  name: string;
  segment: string; // "gym rat", "nervous beginner", …
}

/** Seam 2a — how ONE Person responds to a piece of Content, in voice. */
export interface Reaction {
  person: Person;
  tone: Tone;
  verdict: string; // their take, in voice → "cancelling? instant unfollow"
  moment?: string; // where/when they reacted → "drop at 0:07"
}

/** Seam 2b — the room's aggregate Read behind a card when it opens. */
export interface Read {
  contentId: string;
  stop: number; // headline metric (of 10)
  split: { loved: number; bounced: number; neutral: number }; // %, sum ~100
  weakSpot: string; // the problem
  fix: string; // the lever (feeds Rewrite steering)
  reactions: Reaction[]; // the named people
  population?: { modeledFrom: number; total: number }; // honest: 1,000 modeled from 10
}

/**
 * Seam 3 — the active audience the app-wide presence/dock represents.
 * Non-thread surfaces read a USER-LEVEL active audience (THE-CONTRACT.md §6.2 — the
 * proposed, still-open reconciliation; assumed here to unblock the shell).
 */
export interface ActiveAudience {
  id: string;
  name: string;
  people: Person[]; // ~10, named
  tier: Tier;
  pulse?: string; // "6 of 10 would stop" | idle "General · 10 people ready"
  /** Intent rides the audience's goal — NOT a separate control (THE-CONTRACT.md §2). */
  goal?: "Grow" | "Sell";
  platform?: string; // "tiktok"
}
