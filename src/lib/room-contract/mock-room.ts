/**
 * mockRoom — contract-shaped fixtures for the Surfaces build (docs/THE-CONTRACT.md).
 *
 * Every card carries a real `CardReaction` (Seam 1) + a full `Read` (Seam 2) so each
 * section designs against the real interface. Data is lifted VERBATIM from the v3
 * prototype (`docs/prototypes/start-page-prototype-v3.html`) — same named people
 * (Maya/Jordan/Priya/Dev/Sam/Kai), same ideas/outliers/receipts — so the real page
 * matches the signed-off spec. Swap this module for live data at the graft; the
 * surface components never learn it was fake.
 */

import type {
  ActiveAudience,
  CardReaction,
  Person,
  Reaction,
  Read,
  Tone,
  Verb,
} from "./types";

// ── surface view-models (wrap the seam types with what each section renders) ──

export type IdeaType = "Carousel" | "Reel";

export interface IdeaCard {
  cardId: string;
  type: IdeaType;
  title: string;
  thumb: string; // the caption baked into the thumbnail
  metric: string; // "would watch" | "would join"
  reaction: CardReaction;
  read: Read;
}

export interface OutlierCard {
  cardId: string;
  handle: string;
  caption: string;
  mult: string; // "1.8x" outlier multiplier
  views: string; // "118K"
  light: boolean; // lighter thumbnail treatment
  insight: string; // the one-line "for your people" verdict
  metric: string; // "for your people"
  reaction: CardReaction;
  read: Read;
}

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

export interface PlanItem {
  day: string; // "Wed 8"
  title: string;
  cardId: string;
  predicted: number; // predicted stop (of 10)
  tone: Tone;
  pillar: string; // short content-pillar label → "Money & cost"
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

export interface CalendarDay {
  day: number;
  tone?: Tone; // planned-slot predicted tone (dot); undefined = empty day
}

export interface StartPageData {
  greeting: { headline: string; line: string };
  rings: RingStat[];
  stats: StatCard[];
  ideas: IdeaCard[];
  outliers: OutlierCard[];
  calendar: { month: string; today: number; days: CalendarDay[] };
  pillars: Pillar[];
  plan: PlanItem[];
  quickActions: QuickAction[];
  receipts: Receipt[];
  accuracy: Accuracy;
}

// ── named people (the recurring room) ──

export const MOCK_PEOPLE: Record<string, Person> = {
  maya: { id: "maya", name: "Maya", segment: "burnt-out professional" },
  jordan: { id: "jordan", name: "Jordan", segment: "gym rat" },
  priya: { id: "priya", name: "Priya", segment: "nervous beginner" },
  dev: { id: "dev", name: "Dev", segment: "weekend warrior" },
  sam: { id: "sam", name: "Sam", segment: "busy parent" },
  kai: { id: "kai", name: "Kai", segment: "aesthetics-focused" },
};

const TONE: Record<string, Tone> = { g: "loved", r: "bounced", n: "neutral" };

/** rows: [personId, toneCode, verdict] → Reaction[] (mirror of the prototype's `rx`). */
function rx(rows: [string, keyof typeof TONE, string][]): Reaction[] {
  return rows.map(([id, t, verdict]) => ({
    person: MOCK_PEOPLE[id]!,
    tone: TONE[t]!,
    verdict,
  }));
}

/** Compute the loved/bounced/neutral split (%) from the named reactions. */
function splitOf(reactions: Reaction[]): Read["split"] {
  const total = reactions.length || 1;
  const pct = (t: Tone) =>
    Math.round((reactions.filter((r) => r.tone === t).length / total) * 100);
  return { loved: pct("loved"), bounced: pct("bounced"), neutral: pct("neutral") };
}

/** Assemble a card's CardReaction (Seam 1) + Read (Seam 2) from prototype fields. */
function build(input: {
  cardId: string;
  stop: number;
  tone: keyof typeof TONE;
  lead: string;
  weakSpot: string;
  fix: string;
  reactions: Reaction[];
}): { reaction: CardReaction; read: Read } {
  return {
    reaction: {
      cardId: input.cardId,
      tone: TONE[input.tone]!,
      stop: input.stop,
      lead: input.lead,
    },
    read: {
      contentId: input.cardId,
      stop: input.stop,
      split: splitOf(input.reactions),
      weakSpot: input.weakSpot,
      fix: input.fix,
      reactions: input.reactions,
      population: { modeledFrom: 10, total: 1000 },
    },
  };
}

// ── audiences (user-level active audience — THE-CONTRACT.md §6.2) ──

const peopleRoster: Person[] = Object.values(MOCK_PEOPLE);

export const MOCK_AUDIENCES: ActiveAudience[] = [
  {
    id: "fitness",
    name: "Fitness Creators",
    people: peopleRoster,
    tier: "Validated",
    pulse: "10 people · reacted overnight",
    goal: "Grow",
    platform: "tiktok · your following",
  },
  {
    id: "buyers",
    name: "Conversion Audience",
    people: peopleRoster,
    tier: "Directional",
    pulse: "10 people · reacted overnight",
    goal: "Sell",
    platform: "tiktok · buyers",
  },
  {
    id: "beginners",
    name: "Nervous Beginners",
    people: peopleRoster,
    tier: "Directional",
    pulse: "10 people · reacted overnight",
    goal: "Grow",
    platform: "tiktok · niche segment",
  },
];

// ── ideas ──

const ideaFixtures: (Omit<IdeaCard, "reaction" | "read"> & {
  stop: number;
  tone: keyof typeof TONE;
  lead: string;
  weakSpot: string;
  fix: string;
  reactions: Reaction[];
})[] = [
  {
    cardId: "idea-cancel",
    type: "Carousel",
    title: "The gym cancellation story no one tells honestly",
    thumb: "The laptop lifestyle is a lie.",
    metric: "would watch",
    stop: 7,
    tone: "g",
    lead: "finally, honest",
    weakSpot: "Jordan & Kai (gym rats) read it as quitting on them.",
    fix: "Say “swapped” not “cancelled” — lead with the result.",
    reactions: rx([
      ["maya", "g", "finally someone honest — saved it"],
      ["jordan", "r", "cancelling? instant unfollow"],
      ["priya", "g", "literally me, sending to my sister"],
      ["dev", "n", "eh, keep scrolling"],
      ["sam", "g", "no time for the gym anyway, this helps"],
      ["kai", "r", "home workouts won’t build a physique"],
    ]),
  },
  {
    cardId: "idea-cost",
    type: "Reel",
    title: "The Real Cost of Your Gym vs What You Actually Used It For",
    thumb: "gym $ vs what you used",
    metric: "would watch",
    stop: 7,
    tone: "g",
    lead: "the money angle",
    weakSpot: "Kai wants the numbers to be real, not vibes.",
    fix: "Put the actual receipt on screen in the first 2 seconds.",
    reactions: rx([
      ["maya", "g", "oof, that math would hurt (the good way)"],
      ["jordan", "n", "if the numbers are real, ok"],
      ["priya", "g", "I need to see this"],
      ["dev", "g", "money angle always works on me"],
      ["sam", "g", "the receipts, yes"],
      ["kai", "n", "depends how real it is"],
    ]),
  },
  {
    cardId: "idea-challenge",
    type: "Reel",
    title: "What If I Ran a 30-Day No-Gym Challenge?",
    thumb: "30 days · no gym",
    metric: "would join",
    stop: 8,
    tone: "g",
    lead: "now THIS I’d follow",
    weakSpot: "Sam needs the daily time cost up front.",
    fix: "Name the minutes-per-day in the hook — “15 min, 30 days”.",
    reactions: rx([
      ["maya", "g", "now THIS I’d follow along with"],
      ["jordan", "g", "a challenge? ok you have me"],
      ["priya", "g", "I’d join day one"],
      ["dev", "g", "challenges always pull me in"],
      ["sam", "n", "depends on the time commitment"],
      ["kai", "n", "if there’s a real transformation, sure"],
    ]),
  },
];

const MOCK_IDEAS: IdeaCard[] = ideaFixtures.map((f) => {
  const { reaction, read } = build(f);
  return {
    cardId: f.cardId,
    type: f.type,
    title: f.title,
    thumb: f.thumb,
    metric: f.metric,
    reaction,
    read,
  };
});

// ── outliers to remix ──

const outlierFixtures: (Omit<OutlierCard, "reaction" | "read"> & {
  stop: number;
  tone: keyof typeof TONE;
  lead: string;
  weakSpot: string;
  fix: string;
  reactions: Reaction[];
})[] = [
  {
    cardId: "perf-cows",
    handle: "lynnngugi",
    caption: "How This 24 Year Old Makes KSh 450,000 Rearing 42 Cows",
    mult: "1.8x",
    views: "118K",
    light: false,
    insight: "Blew up, but off your lane. Your people wouldn’t follow the farming angle.",
    metric: "for your people",
    stop: 6,
    tone: "n",
    lead: "not your niche",
    weakSpot: "Dev & Kai bounce — wrong topic for them.",
    fix: "Only the “start with nothing” framing transfers to your niche.",
    reactions: rx([
      ["maya", "n", "not really my thing"],
      ["jordan", "n", "cool but not for me"],
      ["priya", "g", "the underdog story is nice"],
      ["dev", "r", "wrong niche entirely"],
      ["sam", "n", "eh"],
      ["kai", "r", "irrelevant to me"],
    ]),
  },
  {
    cardId: "perf-parents",
    handle: "samaraaalam",
    caption: "no one talks about how brown parents STOP you from…",
    mult: "1.2x",
    views: "419K",
    light: false,
    insight: "This is your lane — the honest-confessional format your people reward. Remix it.",
    metric: "for your people",
    stop: 8,
    tone: "g",
    lead: "this is exactly us",
    weakSpot: "Kai wants a takeaway, not just venting.",
    fix: "End on the reframe you found, not the complaint.",
    reactions: rx([
      ["maya", "g", "felt this in my soul"],
      ["jordan", "g", "real"],
      ["priya", "g", "saving this"],
      ["dev", "g", "the honesty lands"],
      ["sam", "g", "so true"],
      ["kai", "n", "needs a payoff though"],
    ]),
  },
  {
    cardId: "perf-road",
    handle: "abbyindian_",
    caption: "Not AI, just a view",
    mult: "1.4x",
    views: "459K",
    light: true,
    insight: "Aesthetic reach, but your people come for substance, not scenery.",
    metric: "for your people",
    stop: 5,
    tone: "n",
    lead: "pretty, but off-brand",
    weakSpot: "Maya & Sam scroll past — no hook for them.",
    fix: "If you use it, overlay a story — the view alone won’t hold your room.",
    reactions: rx([
      ["maya", "n", "pretty but so what"],
      ["jordan", "r", "not why I follow you"],
      ["priya", "g", "gorgeous tbh"],
      ["dev", "n", "meh"],
      ["sam", "n", "scrolled past"],
      ["kai", "g", "clean visual"],
    ]),
  },
];

const MOCK_OUTLIERS: OutlierCard[] = outlierFixtures.map((f) => {
  const { reaction, read } = build(f);
  return {
    cardId: f.cardId,
    handle: f.handle,
    caption: f.caption,
    mult: f.mult,
    views: f.views,
    light: f.light,
    insight: f.insight,
    metric: f.metric,
    reaction,
    read,
  };
});

// ── the rest of the surface ──

const CALENDAR_DOTS: Record<number, Tone> = {
  6: "loved", 8: "loved", 10: "neutral", 13: "bounced", 15: "bounced",
  17: "loved", 20: "bounced", 22: "loved", 24: "neutral", 27: "bounced",
  29: "loved", 31: "loved",
};

/** Every card keyed by id, so a surface can open the Room on a tapped card. */
export const MOCK_READS: Record<string, Read> = Object.fromEntries(
  [...MOCK_IDEAS, ...MOCK_OUTLIERS].map((c) => [c.cardId, c.read]),
);

export function getReadByCardId(cardId: string): Read | undefined {
  return MOCK_READS[cardId];
}

export function getMockStartPage(): StartPageData {
  const days: CalendarDay[] = Array.from({ length: 31 }, (_, i) => ({
    day: i + 1,
    tone: CALENDAR_DOTS[i + 1],
  }));

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
    ideas: MOCK_IDEAS,
    outliers: MOCK_OUTLIERS,
    calendar: { month: "July 2026", today: 3, days },
    pillars: [
      { id: "confessional", name: "Honest confessionals", share: 0.4, count: 5, tone: "loved", cadence: "posted 2 days ago" },
      { id: "money", name: "Money & cost", share: 0.25, count: 3, tone: "loved", cadence: "posted this week" },
      { id: "challenge", name: "Challenges", share: 0.2, count: 2, tone: "loved", cadence: "posted last week" },
      { id: "myth", name: "Myth-busting", share: 0.15, count: 1, tone: "neutral", cadence: "none in 3 weeks", gap: true },
    ],
    plan: [
      { day: "Wed 8", title: "money-angle Reel", cardId: "idea-cost", predicted: 7, tone: "loved", pillar: "Money & cost" },
      { day: "Sat 11", title: "30-day challenge kickoff", cardId: "idea-challenge", predicted: 8, tone: "loved", pillar: "Challenges" },
    ],
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
