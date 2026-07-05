/**
 * mockRoom — the REMAINING contract-shaped fixtures for the Surfaces build.
 *
 * The daily-ideas, outliers, month plan, and calendar reads are all REAL now (Seams 1/2 —
 * `surface_reactions` + `buildLivePlan`), so this module is down to the /start sections that don't
 * yet have a live producer: the greeting, rings, stat fixtures, content pillars, quick actions,
 * and the loop (receipts + accuracy). Swap each for live data as its producer lands.
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

export interface Receipt {
  title: string;
  said: number; // "we said 7"
  got: string; // "you got 7.2"
  posted: string; // "Mon"
  delta: string; // "+3% followers"
}

export interface Accuracy {
  pct: string; // "84%"
  up: string; // "6 pts this month"
  line: string;
}

export interface StartPageData {
  greeting: { headline: string; line: string };
  rings: RingStat[];
  stats: StatCard[];
  pillars: Pillar[];
  quickActions: QuickAction[];
  receipts: Receipt[];
  accuracy: Accuracy;
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
    stats: [
      { label: "Views", value: "42.1K", delta: "+12%", up: true, spark: "0,14 12,11 24,13 36,7 48,9 60,4 72,6" },
      { label: "New followers", value: "+820", delta: "+31%", up: true, spark: "0,15 12,13 24,10 36,11 48,6 60,7 72,3" },
      { label: "Interactions", value: "3.4K", delta: "flat", up: false, spark: "0,9 12,8 24,10 36,9 48,8 60,9 72,8" },
      { label: "Posts", value: "12", delta: "+3", up: true, spark: "0,13 12,12 24,10 36,9 48,7 60,6 72,5" },
    ],
    pillars: MOCK_PILLARS,
    quickActions: [
      { icon: "sparkle", label: "Make ideas", desc: "ranked + pre-tested", verb: "Make" },
      { icon: "play", label: "Test a real video", desc: "the full Read before you post", verb: "Test" },
      { icon: "chat", label: "Ask the room", desc: "a raw thought, react instantly", verb: "Ask" },
      { icon: "repeat", label: "Repurpose a winner", desc: "remix a top performer", verb: "Make" },
    ],
    receipts: [
      { title: "gym cancellation story", said: 7, got: "7.2", posted: "Mon", delta: "+3% followers" },
      { title: "“what I eat, honestly” reel", said: 6, got: "5.8", posted: "Wed", delta: "held" },
    ],
    accuracy: {
      pct: "84%",
      up: "6 pts this month",
      line: "Your room’s predictions vs what actually happened. Sharper every post.",
    },
  };
}
