/**
 * mockRoom — the REMAINING contract-shaped fixtures for the Surfaces build.
 *
 * The daily-ideas, outliers, month plan, calendar reads, the stat row, the loop (receipts +
 * accuracy), AND content pillars are all REAL now (Seams 1/2 + account-metrics + the outcome
 * flywheel + content-pillars clustering), so this module is down to the /start chrome that has no
 * live producer: the greeting, rings, and quick actions. Swap each for live data as its producer
 * lands. The `Pillar` type stays here (the shared rail view-model that build-pillars produces).
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
  icon: "flame" | "calendar" | "trend" | "upright";
  pct: number; // 0..1 arc fill
  value: string; // "84" | "5-day" | "+12%"
  accent: boolean; // the ONE terracotta arc (Score)
  label: string; // caption under the ring + aria/tooltip
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
  quickActions: QuickAction[];
}

export function getMockStartPage(): StartPageData {
  return {
    greeting: {
      headline: "Good afternoon, Davide 👋",
      // No subtitle — the headline carries the moment (less is more). The old
      // "your room reacted to 6 things overnight…" line read as AI filler.
      line: "",
    },
    rings: [
      { icon: "trend", pct: 0.84, value: "84", accent: true, label: "Score" },
      { icon: "flame", pct: 0.71, value: "5-day", accent: false, label: "Streak" },
      { icon: "upright", pct: 0.62, value: "+12%", accent: false, label: "Growth" },
    ],
    quickActions: [
      { icon: "sparkle", label: "Make ideas", desc: "ranked + pre-tested", verb: "Make" },
      { icon: "play", label: "Test a real video", desc: "the full Read before you post", verb: "Test" },
      { icon: "chat", label: "Ask the room", desc: "a raw thought, react instantly", verb: "Ask" },
      { icon: "repeat", label: "Repurpose a winner", desc: "remix a top performer", verb: "Make" },
    ],
  };
}
