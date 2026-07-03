/**
 * recommendations — the /analytics "what to do next" cards. Pure over (pillars, metrics).
 *
 * Honesty spine: each card is TAGGED by its grounding — "From your numbers" only when it
 * keys off a REAL metric delta (e.g. posting cadence), otherwise "Directional" (advice
 * grounded in the creator's pillars / how their people tend to respond, never a claimed
 * data finding). Every card carries a Seam-4 action (make a thread) or routes to /calendar.
 */

import type { Pillar } from "@/lib/room-contract/mock-room";
import type { RangeMetric } from "@/lib/account-metrics/account-metrics";

export interface Recommendation {
  id: string;
  title: string;
  rationale: string;
  tag: "Directional" | "From your numbers";
  actionLabel: string;
  action: "make" | "plan"; // make → Seam-4 launch · plan → /calendar
  seed?: string; // composer seed for `make`
}

export function buildRecommendations(
  pillars: Pillar[],
  metrics: RangeMetric[] | null,
): Recommendation[] {
  const recs: Recommendation[] = [];

  // 1. From your numbers — posting cadence (only when a real delta exists).
  const posts = metrics?.find((m) => m.key === "posts");
  if (posts && posts.delta !== "—" && (!posts.up || posts.delta === "flat")) {
    recs.push({
      id: "cadence",
      title: "Your posting has stalled",
      rationale: `Posts are ${posts.delta === "flat" ? "flat" : "down"} this range — consistency compounds. Line up the next few.`,
      tag: "From your numbers",
      actionLabel: "Plan posts →",
      action: "plan",
    });
  }

  // 2. Directional — turn your highest-trust pillar into an offer (the monetization beat).
  const top = [...pillars]
    .filter((p) => p.tone === "loved")
    .sort((a, b) => b.share - a.share)[0];
  if (top) {
    recs.push({
      id: "offer",
      title: `Turn “${top.name}” into an offer`,
      rationale: "It’s your highest-trust pillar with your people — the natural thing to monetize.",
      tag: "Directional",
      actionLabel: "Make it →",
      action: "make",
      seed: `an offer built around my “${top.name}” pillar`,
    });
  }

  // 3. Directional — fill the neglected pillar (the proactive gap nudge).
  const gap = pillars.find((p) => p.gap);
  if (gap) {
    recs.push({
      id: "gap",
      title: `You’re neglecting “${gap.name}”`,
      rationale: `${gap.cadence} — your people haven’t heard from this lane. Plan one.`,
      tag: "Directional",
      actionLabel: "Plan one →",
      action: "plan",
    });
  }

  return recs;
}
