/**
 * mockRoom — the REMAINING contract-shaped fixtures for the Surfaces build.
 *
 * The daily-ideas, outliers, month plan, calendar reads, the stat row, AND the loop (receipts +
 * accuracy) are all REAL now (Seams 1/2 + account-metrics + the outcome flywheel), so this module
 * is down to the /start sections that don't yet have a live producer: the greeting, rings, content
 * pillars, and quick actions. Swap each for live data as its producer lands.
 *
 * `MOCK_PILLARS` stays until account-derived pillars land (a separate follow-up); it feeds the
 * /start pillar rail, the /calendar pillar rail, and /grow.
 */

import type { Tone, Verb } from "./types";

// ── surface view-models ──

export interface StatCard {
  label: string;
  value: string;
  delta: string;
  up: boolean;
  spark: string; // svg polyline points "x,y x,y …" (0..72 × 0..18)
}

export interface RingStat {
  icon: "flame" | "calendar" | "trend";
  pct: number; // 0..1 arc fill
  value: string; // "5-day" | "3 / 7" | "84%"
  accent: boolean; // the ONE terracotta arc (accuracy)
  label: string; // aria + tooltip
}

/**
 * A content pillar — one of the creator's recurring themes (derived from their account,
 * so the SHARE is real; the response `tone` is a Directional forecast of how their people
 * tend to respond to that pillar). `cadence` + `gap` drive the proactive "you're neglecting
 * this pillar" nudge. Low-ambient: the tone dot is the reserved reaction slot, never faked.
 */
export interface Pillar {
  id: string;
  name: string;
  share: number; // 0..1 share of this month's plan (bar + %)
  count: number; // posts this month
  tone: Tone; // Directional: how your people tend to respond to this pillar
  cadence: string; // "posted 2 days ago" | "none in 3 weeks"
  gap?: boolean; // under-served → surface a proactive nudge
}

export interface QuickAction {
  icon: "sparkle" | "play" | "chat" | "repeat";
  label: string;
  desc: string;
  verb: Verb;
}

export interface StartPageData {
  greeting: { headline: string; line: string };
  rings: RingStat[];
  pillars: Pillar[];
  quickActions: QuickAction[];
}

/**
 * The creator's recurring themes (share is real-shaped; the response `tone` is a Directional
 * forecast). Shared by the /start pillar rail, the /calendar workspace, and /grow so all agree.
 */
export const MOCK_PILLARS: Pillar[] = [
  { id: "confessional", name: "Honest confessionals", share: 0.4, count: 5, tone: "loved", cadence: "posted 2 days ago" },
  { id: "money", name: "Money & cost", share: 0.25, count: 3, tone: "loved", cadence: "posted this week" },
  { id: "challenge", name: "Challenges", share: 0.2, count: 2, tone: "loved", cadence: "posted last week" },
  { id: "myth", name: "Myth-busting", share: 0.15, count: 1, tone: "neutral", cadence: "none in 3 weeks", gap: true },
];

export function getMockStartPage(): StartPageData {
  return {
    greeting: {
      headline: "Good afternoon, Davide 👋",
      line: "Your room reacted to 6 things overnight — and last week’s calls landed. Here’s your day.",
    },
    rings: [
      { icon: "flame", pct: 0.71, value: "5-day", accent: false, label: "5-day streak" },
      { icon: "calendar", pct: 0.43, value: "3 / 7", accent: false, label: "3 of 7 planned this week" },
      { icon: "trend", pct: 0.84, value: "84%", accent: true, label: "84% prediction accuracy" },
    ],
    pillars: MOCK_PILLARS,
    quickActions: [
      { icon: "sparkle", label: "Make ideas", desc: "ranked + pre-tested", verb: "Make" },
      { icon: "play", label: "Test a real video", desc: "the full Read before you post", verb: "Test" },
      { icon: "chat", label: "Ask the room", desc: "a raw thought, react instantly", verb: "Ask" },
      { icon: "repeat", label: "Repurpose a winner", desc: "remix a top performer", verb: "Make" },
    ],
  };
}
