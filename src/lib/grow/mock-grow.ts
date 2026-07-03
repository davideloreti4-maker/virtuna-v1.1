/**
 * mock-grow — fixtures for the /grow "Grow your business" strategy dashboard (the
 * business-coach surface). MOCK for v1; swap for real account-derived signals + offer
 * generation at the graft.
 *
 * Honesty spine: readiness + offer "would buy" are DIRECTIONAL forecasts (how the
 * creator's people tend to respond, grounded in their pillars) — labeled as such on the
 * surface, NEVER real sales. The surface hosts NO chat engine; every action is the one
 * Seam-4 handoff (make/test in a thread). Offers reuse the pillar ids from mock-room so
 * the "pre-tested on your people" story stays consistent across surfaces.
 */

import type { Tone } from "@/lib/room-contract/types";

/** One monetization-readiness signal (met/not-met), advisory + Directional. */
export interface ReadinessItem {
  id: string;
  label: string;
  met: boolean;
  note: string;
}

/** A pre-tested offer idea. `wouldBuy` is a Directional forecast (of 10), never real sales. */
export interface Offer {
  id: string;
  title: string;
  price: string; // "$29"
  pillarId: string; // → mock-room Pillar.id
  pillarLabel: string;
  tone: Tone; // Directional forecast tone
  wouldBuy: number; // of 10 (Directional)
  lead: string; // a persona-voice line (Directional)
}

export interface FunnelStep {
  label: string;
  sub: string;
  filled: boolean; // a real rung you have vs a gap to add
}

export interface GrowData {
  audienceName: string;
  readiness: ReadinessItem[];
  readinessLine: string;
  offers: Offer[];
  funnel: FunnelStep[];
  funnelGap: string;
}

export function getMockGrow(): GrowData {
  return {
    audienceName: "Fitness Creators",
    readiness: [
      { id: "trust", label: "Your people trust you", met: true, note: "Confessionals land 84% loved — trust is the foundation any offer sells on." },
      { id: "cadence", label: "You post consistently", met: true, note: "A steady cadence keeps buyers warm between launches." },
      { id: "offer", label: "You have something to sell", met: false, note: "No offer yet — you're monetizing nothing. This is the biggest gap." },
      { id: "ladder", label: "A price for every buyer", met: false, note: "No mid-tier — the jump from free to high-ticket loses the middle." },
    ],
    readinessLine: "2 of 4 ready — you have the audience, not yet the offer.",
    offers: [
      { id: "reset", title: "The “No-Gym Reset” — a $29 starter guide", price: "$29", pillarId: "money", pillarLabel: "Money & cost", tone: "loved", wouldBuy: 7, lead: "finally something I'd actually pay for" },
      { id: "cohort", title: "30-day challenge — a $99 paid cohort", price: "$99", pillarId: "challenge", pillarLabel: "Challenges", tone: "loved", wouldBuy: 8, lead: "I'd join a paid version in a heartbeat" },
      { id: "coaching", title: "1:1 coaching — $200 / month", price: "$200", pillarId: "confessional", pillarLabel: "Honest confessionals", tone: "neutral", wouldBuy: 4, lead: "love you, but that's out of my budget" },
    ],
    funnel: [
      { label: "Lead magnet", sub: "free", filled: true },
      { label: "$29 guide", sub: "starter", filled: true },
      { label: "mid-tier", sub: "$49–59 · missing", filled: false },
      { label: "$99 cohort", sub: "core", filled: true },
    ],
    funnelGap: "You jump from a $29 guide to a $99 cohort — most creators add a $49–59 rung so more of your people can say yes.",
  };
}
