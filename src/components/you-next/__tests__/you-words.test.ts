import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NICHE_TREE } from "@/lib/niches/taxonomy";
import {
  CONNECT_OFFLINE, FACTS, GOALS, SET_UP_AUDIENCE, accountLine, countLabel, daysAgo, followersLabel, goalLabel, isGoal, nicheLabel, nicheOptions, notReadLine,
  accountName, disconnectFailed, primaryFailed, readFoot, readHow, whoLine,
} from "../you-words";

const NOW = new Date("2026-11-24T12:00:00.000Z");
const before = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const DAY = 86_400_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("the rows", () => {
  it("are the spec's five free-text rows, in the page's order, with their limits", () => {
    expect(FACTS.map((f) => [f.key, f.label, f.limit])).toEqual([
      ["about", "About you", 200],
      ["sells", "What you sell", 300],
      ["writing_voice_description", "How you sound", 200],
      ["can_film", "What you can film", 200],
      ["never_do", "Never", 300],
    ]);
  });

  it("each row's placeholder is the spec's example", () => {
    expect(FACTS.map((f) => f.placeholder)).toEqual([
      "Nurse, mum of two, started posting last year.",
      "A 12-week meal plan, $49. Affiliate for two blender brands.",
      "Dry, short sentences, a bit of swearing. Never say 'guys'.",
      "Phone only, my kitchen, on camera. No b-roll, no editing beyond cuts.",
      "No before/after bodies. No giveaways. Never name a competitor.",
    ]);
  });

  it("only How you sound carries the hint, and it warns against pasting a post", () => {
    expect(FACTS.filter((f) => f.hint).map((f) => [f.key, f.hint])).toEqual([
      ["writing_voice_description", "Describe it. Don't paste a post: Maven would copy its topic."],
    ]);
  });

  it("the goal chips map to the existing primary_goal values", () => {
    expect(GOALS.map((g) => [g.label, g.value])).toEqual([["Grow", "growth"], ["Engage", "engagement"], ["Brand deals", "brand_deals"], ["Sell", "conversion"]]);
    expect(goalLabel("conversion")).toBe("Sell");
    expect(goalLabel(null)).toBeNull();
    expect(goalLabel("something-else")).toBeNull();
    expect(isGoal("brand_deals")).toBe(true);
    expect(isGoal("sales")).toBe(false);
  });
});

describe("niches", () => {
  it("names a saved niche with the list's words", () => {
    expect(nicheLabel("food-cooking", "meal-prep")).toBe("Food & Cooking · Meal Prep");
    expect(nicheLabel("food-cooking", null)).toBe("Food & Cooking");
    expect(nicheLabel(null, "meal-prep")).toBeNull();
  });

  it("a slug the list no longer has reads as itself", () => {
    expect(nicheLabel("retro-gaming", "speed-runs")).toBe("Retro gaming · Speed runs");
  });

  it("with no search, offers every niche: each primary followed by its subs", () => {
    const all = nicheOptions("");
    expect(all).toHaveLength(NICHE_TREE.reduce((n, p) => n + 1 + p.subs.length, 0));
    expect(all[0]).toEqual({ primary: NICHE_TREE[0]!.slug, sub: null, label: NICHE_TREE[0]!.label, subLabel: null });
    expect(all[1]).toMatchObject({ primary: NICHE_TREE[0]!.slug, sub: NICHE_TREE[0]!.subs[0]!.slug });
  });

  it("a search keeps the niches whose words contain it, case-blind", () => {
    expect(nicheOptions("MEAL")).toEqual([{ primary: "food-cooking", sub: "meal-prep", label: "Food & Cooking · Meal Prep", subLabel: "Meal Prep" }]);
    expect(nicheOptions("food & cooking")[0]).toEqual({ primary: "food-cooking", sub: null, label: "Food & Cooking", subLabel: null });
    expect(nicheOptions("zzz-nothing")).toEqual([]);
  });
});

describe("lines", () => {
  it("counts against the limit", () => {
    expect(countLabel(57, 200)).toBe("57 / 200");
  });

  it("followers, compact; a YouTube channel has subscribers", () => {
    expect(followersLabel(12400, "tiktok")).toBe("12.4K followers");
    expect(followersLabel(980, "instagram")).toBe("980 followers");
    expect(followersLabel(1_200_000, "youtube")).toBe("1.2M subscribers");
    expect(followersLabel(null, "tiktok")).toBeNull();
  });

  it("under the name: the primary account and its followers, or that there is none", () => {
    expect(whoLine({ handle: "nia.tests", platform: "tiktok" }, 12400)).toBe("@nia.tests · 12.4K followers");
    expect(whoLine({ handle: "nia.tests", platform: "tiktok" }, null)).toBe("@nia.tests");
    expect(whoLine(null, null)).toBe("No account connected");
  });

  it("an account's line is its platform's name alone: no sync time (rulings 4 and 10)", () => {
    expect(accountLine("tiktok")).toBe("TikTok");
    expect(accountLine("instagram")).toBe("Instagram");
    expect(accountLine("youtube")).toBe("YouTube");
  });

  it("when the account was read, in words", () => {
    expect(daysAgo(before(2 * 3_600_000))).toBe("today");
    expect(daysAgo(before(DAY + 1000))).toBe("yesterday");
    expect(daysAgo(before(3 * DAY))).toBe("3 days ago");
    expect(daysAgo(before(15 * DAY))).toBe("2 weeks ago");
    expect(daysAgo(before(130 * DAY))).toBe("4 months ago");
    expect(daysAgo(null)).toBeNull();
    expect(daysAgo(new Date(NOW.getTime() + DAY).toISOString())).toBeNull();
  });

  it("the read card's foot", () => {
    expect(readFoot("nia.tests", before(3 * DAY))).toBe("Read from @nia.tests, 3 days ago");
    expect(readFoot("nia.tests", null)).toBe("Read from @nia.tests");
    expect(readFoot(null, before(DAY))).toBeNull();
  });

  it("an account connected but not read yet: what the card says in place of the read, and its link (ruling 5)", () => {
    expect(notReadLine("nia.tests")).toBe("Maven hasn't read @nia.tests yet. It reads an account when you set up its audience.");
    expect(SET_UP_AUDIENCE).toBe("Set up audience");
  });

  it("a connect whose request never came back: the existing dialog's sentence, verbatim", () => {
    expect(CONNECT_OFFLINE).toBe("Couldn't connect. Check your connection and try again.");
  });
});

describe("readHow: the read's one line, made readable", () => {
  it("turns its parts into sentences and the model's AVOID into a word", () => {
    expect(readHow("audience is global and family-friendly; voice is playful; formats are short; AVOID long intros or low-effort trends.")).toBe(
      "Audience is global and family-friendly. Voice is playful. Formats are short. Avoids long intros or low-effort trends.",
    );
    expect(readHow("students on a budget · fast and friendly · AVOID: anything that needs an oven")).toBe(
      "Students on a budget. Fast and friendly. Avoids anything that needs an oven.",
    );
  });

  it("leaves a plain sentence as it is, and nothing as nothing", () => {
    expect(readHow("Fast, friendly, talks straight to camera.")).toBe("Fast, friendly, talks straight to camera.");
    expect(readHow("  ")).toBeNull();
    expect(readHow(null)).toBeNull();
  });
});

describe("accountName: how an account is named in its menu and in what is said about it", () => {
  const tiktok = { handle: "nia.tests", platform: "tiktok" as const };
  const insta = { handle: "nia.tests", platform: "instagram" as const };
  const other = { handle: "nia.tests.kitchen", platform: "tiktok" as const };

  it("is the handle alone when no other listed account shares it", () => {
    expect(accountName(other, [tiktok, other])).toBe("@nia.tests.kitchen");
  });

  it("adds the platform when two listed accounts share a handle, so each can be told apart", () => {
    expect(accountName(tiktok, [tiktok, insta, other])).toBe("@nia.tests on TikTok");
    expect(accountName(insta, [tiktok, insta, other])).toBe("@nia.tests on Instagram");
  });

  it("a refused action says which one and for which account", () => {
    expect(disconnectFailed("@nia.tests on Instagram")).toBe("Couldn't disconnect @nia.tests on Instagram. Try again.");
    expect(primaryFailed("@nia.tests.kitchen")).toBe("Couldn't make @nia.tests.kitchen primary. Try again.");
  });
});
