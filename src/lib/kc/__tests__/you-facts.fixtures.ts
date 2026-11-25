/**
 * Rows and inputs shared by the You-facts tests of the writers' bundle (plan 2026-11-24-you, Task 8).
 *
 * Rows are the shapes the live `creator_profiles` table hands back (`select("*")`): the five columns
 * exist there and are all empty. Inputs are the shapes the routes send, including the largest each
 * lets through (ask 2,000, anchor 5,000) and the plain chat's 20-turn history: together they reach
 * every path of the cap (whole, profile lines shed, the fenced rebuild).
 *
 * `you-facts.unchanged.test.ts` keys its recorded snapshot on these names and values: change none of
 * them. Add a new row or input under a new name, and expect that file's snapshot to need it.
 */
import { buildConversationDigest } from "@/lib/tools/conversation-digest";
import type { AssemblerInput } from "../assembler";
import type { ProfileRow } from "../profile-role-map";

export const MODES = ["idea", "hooks", "script", "chat", "remix"] as const;

/** The other columns `select("*")` returns, invented. The writers read none of them. */
export const ROW_REST = {
  id: "0b6f3c1e-2a4d-4f7e-9c1a-5d8e7f6a3b21",
  user_id: "7d2e9a40-1c3b-4e5f-8a6b-9c0d1e2f3a4b",
  tiktok_handle: "nia.tests",
  display_name: "Nia Test",
  bio: "Nurse. Cooking for night shifts.",
  content_style: "talking-head",
  created_at: "2026-11-01T09:00:00.000Z",
  updated_at: "2026-11-20T09:00:00.000Z",
};
/** The five columns as the live table holds them today: present, empty. */
export const FIVE_EMPTY = { about: null, sells: null, writing_voice_description: null, can_film: null, never_do: null };
export const FIVE_BLANK = { about: "", sells: "   ", writing_voice_description: " \n ", can_film: "", never_do: "  " };

export const PROD_SHAPE = {
  niche_primary: "comedy",
  niche_sub: "storytelling",
  primary_goal: "engagement",
  creator_stage: "established",
  target_audience: { age_range: "18-24", gender_skew: "balanced", geo: "United States", language: "English" },
  past_wins: [{ url: "https://example.com/video/1" }, { url: "https://example.com/video/2" }],
  past_flops: [{ url: "https://example.com/video/3" }],
  target_platforms: ["tiktok"],
};

export const ROWS: Record<string, ProfileRow | null> = {
  "no row": null,
  "an empty row": {
    ...ROW_REST,
    niche_primary: null,
    niche_sub: null,
    target_audience: null,
    primary_goal: null,
    creator_stage: null,
    past_wins: null,
    past_flops: null,
    target_platforms: null,
    ...FIVE_EMPTY,
  } as ProfileRow,
  "a full row": { ...ROW_REST, ...PROD_SHAPE, ...FIVE_EMPTY } as ProfileRow,
  "a full row, the five absent": { ...PROD_SHAPE },
  "a full row, the five blank": { ...ROW_REST, ...PROD_SHAPE, ...FIVE_BLANK } as ProfileRow,
  "niche only": { ...ROW_REST, niche_primary: "food-cooking", niche_sub: "meal-prep", target_platforms: ["instagram"], ...FIVE_EMPTY } as ProfileRow,
  "an audience of nulls": { ...ROW_REST, target_audience: { age_range: null, gender_skew: null, geo: null, language: null }, ...FIVE_EMPTY } as ProfileRow,
};

export const ASK = "give me 5 hooks about morning focus routines that actually stick";
export const OVERRIDES = [
  "Generate for this audience — 18-24 US English, balanced skew; they scroll fast and reward a punchline in the first 2 seconds.",
  "Creator — makes observational comedy story-times from real life. Context: shoots handheld, talks to camera, no b-roll.",
  "Write hook 1 for the-sceptic, hook 2 for the-loyalist, hook 3 for the-newcomer, hook 4 for the-lurker, hook 5 for the-sceptic.",
].join("\n");
export const CARDS = [
  "Everyone told me to wake at 5am. Here's what 90 days of it did to my brain.",
  "The productivity advice that made me worse at my job",
  "I tracked my focus for 30 days. The winner wasn't caffeine.",
  "Your morning routine is fine. Your evening is what's broken.",
  "Stop optimising your mornings until you fix this one thing",
];
export const BUDGET_MAX_TURNS = buildConversationDigest(
  Array.from({ length: 12 }, (_, i) => ({ role: "user" as const, text: `${i} `.padEnd(160, "constraint word ").slice(0, 160) })),
)!.turns!;
/** The plain chat's anchor: 20 prior turns serialised as chat-runner does, assistant prose included. */
export const LONG_HISTORY = Array.from({ length: 20 }, (_, i) =>
  `${i % 2 === 0 ? "Creator" : "Numen"}: ${`turn ${i} `.padEnd(i % 2 === 0 ? 120 : 520, "and then the answer went on ")}`,
).join("\n");

export type Input = Omit<AssemblerInput, "mode">;
export const INPUTS: Record<string, Input> = {
  "an ask": { ask: ASK, platform: "tiktok" },
  "instagram, calibrated overrides": { ask: ASK, platform: "instagram", overrides: OVERRIDES },
  "youtube, an anchor": { ask: "write it", platform: "youtube", anchor: "The 5am myth is costing you your best creative hours" },
  "the worst grounded run": {
    ask: ASK,
    platform: "tiktok",
    corpus: "C".repeat(2800),
    overrides: OVERRIDES,
    anchor: "The 5am myth is costing you your best creative hours",
    cards: CARDS,
    conversation: { turns: BUDGET_MAX_TURNS },
  },
  "a long ask that sheds profile lines": { ask: "y".repeat(5600), platform: "tiktok" },
  "the largest a route lets through": { ask: "a".repeat(2000), platform: "tiktok", overrides: OVERRIDES, anchor: "b".repeat(5000) },
  "a 20-turn chat history": { ask: ASK, platform: "tiktok", anchor: LONG_HISTORY, overrides: OVERRIDES },
  "the copilot label and a digest": { ask: ASK, platform: "tiktok", modeLabel: "copilot", conversation: { turns: BUDGET_MAX_TURNS } },
  "a rewrite pack": { ask: "punch these up", platform: "tiktok", overrides: OVERRIDES, cards: CARDS },
};
