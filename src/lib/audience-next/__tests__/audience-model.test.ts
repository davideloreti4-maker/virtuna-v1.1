/**
 * The Audience page's model (spec 2026-11-25-audience, sections 3 and 4), on made-up audiences, with
 * the real ring (`ringDots`), the real group names (`groupName`) and the real count words (`viewsWord`).
 */
import { describe, expect, it } from "vitest";
import type { AccountSnapshot } from "@/lib/account-metrics/account-metrics";
import { GENERAL_AUDIENCE, PRESET_AUDIENCES } from "@/lib/audience/audience-repo";
import type { Audience, CalibratedPersona, SignaturePersona } from "@/lib/audience/audience-types";
import { ARCHETYPES } from "@/lib/engine/wave3/persona-registry";
import { viewsWord } from "@/lib/posted/posted-words";
import { groupName } from "@/lib/result/format";
import { ringDots } from "@/lib/result/ring-layout";
import {
  AUDIENCE_RING,
  audiencePageOf,
  groupsOf,
  initialOf,
  kindOf,
  lineOf,
  pickAudience,
  splitFirst,
  switcherChoicesOf,
  type AccountRef,
  type AudiencePage,
  type ArchivedPost,
} from "../audience-model";
import * as A from "./audiences";

const NOW = new Date("2026-11-25T12:00:00Z");
const ACCOUNT = A.account();

interface Given {
  audience: Audience;
  audiences?: Audience[];
  accounts?: AccountRef[];
  defaultId?: string | null;
  snapshot?: AccountSnapshot | null;
  posts?: ArchivedPost[];
  pillars?: { name: string; count: number }[];
}
const pageOf = (g: Given, now: Date = NOW): AudiencePage =>
  audiencePageOf(
    {
      audience: g.audience,
      audiences: g.audiences ?? [g.audience],
      accounts: g.accounts ?? [],
      defaultId: g.defaultId ?? null,
      snapshot: g.snapshot ?? null,
      posts: g.posts ?? [],
      pillars: g.pillars ?? [],
    },
    now,
  );
/** The own audience with its account connected. */
const ownPage = (over: Partial<Given> = {}) => pageOf({ audience: A.own(), accounts: [ACCOUNT], ...over });

const persona = (archetype: string, share: number, over: Partial<SignaturePersona> = {}): SignaturePersona => ({
  archetype: archetype as SignaturePersona["archetype"],
  share,
  temperature: "warm",
  disposition: "lurker",
  reaction_frame: "",
  evidence: "",
  ...over,
});
const withPersonas = (personas: SignaturePersona[]) => A.own({}, { personas });

/** A seeded random number source (mulberry32), so the 50 sets are the same on every run. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("kindOf", () => {
  it("an account behind it makes it the creator's own, whatever it was read from", () => {
    expect(kindOf(A.described(), ACCOUNT)).toBe("own");
    expect(kindOf(A.other(), ACCOUNT)).toBe("own");
  });

  it("a read of a handle: the creator's own for type personal, another creator's for target", () => {
    expect(kindOf(A.own({ source_account_id: null }), undefined)).toBe("own");
    expect(kindOf(A.other(), undefined)).toBe("other");
  });

  it("a description is described, also when its provenance handle holds its own name (as calibrateFromScrape stores it)", () => {
    const a = A.described();
    expect(a.signature?.provenance.handle).toBe("busy parents who meal-prep");
    expect(kindOf(a, undefined)).toBe("described");
    expect(kindOf(A.audience({ calibration: null }), undefined)).toBe("described");
  });

  it("a thin read of a handle (stored as a description with a handle and no text) is another creator's", () => {
    const thin = A.other({ calibration: { source: "description", handle: "leo.makes", scraped_at: "2026-08-14T10:00:00Z" }, goal_label: null });
    expect(kindOf(thin, undefined)).toBe("other");
    expect(kindOf({ ...thin, goal_label: "  " }, undefined)).toBe("other");
    // The same thin read of the creator's own handle, with no account behind it any more, stays theirs.
    expect(kindOf({ ...thin, type: "personal" }, undefined)).toBe("own");
    // A description with text is described, a handle beside it or not.
    expect(kindOf({ ...thin, goal_label: "Parents who cook" }, undefined)).toBe("described");
  });

  it("the page finds the account behind an audience by the existing pairing", () => {
    expect(ownPage().kind).toBe("own");
    expect(pageOf({ audience: A.other() }).kind).toBe("other");
    expect(pageOf({ audience: A.described() }).kind).toBe("described");
    // Paired by handle and platform, with no link stored (audiences read before accounts existed).
    const unlinked = A.own({ source_account_id: null, type: "target" });
    expect(pageOf({ audience: unlinked, accounts: [ACCOUNT] }).kind).toBe("own");
  });

  it("whose viewers they are, by kind", () => {
    expect(ownPage().whose).toBe("your");
    expect(pageOf({ audience: A.other() }).whose).toBe("their");
    expect(pageOf({ audience: A.described() }).whose).toBe("the");
  });
});

describe("groupsOf", () => {
  it("the read's personas win over the legacy ones", () => {
    const legacy: CalibratedPersona[] = [{ archetype: "saver", repaint: "", temperature: "warm", disposition: "lurker", share: 1 }];
    const a = A.own({ personas: legacy });
    expect(groupsOf(a).groups.map((g) => g.group)).toEqual(ARCHETYPES);
  });

  it("drops unknown groups, repeats, and shares that are not finite or are negative", () => {
    const a = withPersonas([
      persona("saver", 0.3),
      persona("saver", 0.2),
      persona("not_a_group", 0.2),
      persona("lurker", Number.NaN),
      persona("sharer", -0.1),
      persona("loyalist", Number.POSITIVE_INFINITY),
      persona("tough_crowd", 0.5),
      { ...persona("purposeful_viewer", 0.1), share: "0.1" as unknown as number },
    ]);
    const { groups, wedges } = groupsOf(a);
    expect(groups.map((g) => g.group)).toEqual(["tough_crowd", "saver"]);
    expect(wedges.map((w) => w.group)).toEqual(["tough_crowd", "saver"]);
  });

  it("orders by share, largest first; equal shares in the app's group order", () => {
    const a = withPersonas([
      persona("cross_niche_curiosity", 0.1),
      persona("lurker", 0.1),
      persona("saver", 0.3),
      persona("high_engager", 0.1),
      persona("loyalist", 0.4),
    ]);
    expect(groupsOf(a).groups.map((g) => g.group)).toEqual(["loyalist", "saver", "high_engager", "lurker", "cross_niche_curiosity"]);
  });

  it("names each group as the new look does, and gives the ring a wedge per group: the share × 100, present", () => {
    const page = ownPage();
    expect(page.groups.map((g) => g.name)).toEqual(page.groups.map((g) => groupName(g.group)));
    expect(page.groups[0]!.name).toBe(groupName("high_engager"));
    expect(page.wedges).toEqual(page.groups.map((g, i) => ({ group: g.group, weight: A.SHARES[i]! * 100, present: true })));
  });

  it("every count is the ring's own, the counts add up to 1,000, and each percent is its count / 10", () => {
    const page = ownPage();
    const layout = ringDots(page.wedges, AUDIENCE_RING);
    expect(page.groups.map((g) => g.count)).toEqual(layout.wedges.map((w) => w.dots.length));
    expect(page.groups.reduce((s, g) => s + g.count, 0)).toBe(1000);
    for (const g of page.groups) expect(g.percent).toBe(Math.round(g.count / 10));
    expect(page.groups.map((g) => g.count)).toEqual([130, 110, 105, 100, 100, 95, 90, 90, 90, 90]);
  });

  it("a group with a share of exactly 0 is left out: no empty wedge, no 0 of 1,000 row", () => {
    const shares = [0.2, 0, 0.15, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.05];
    const page = pageOf({ audience: A.own({}, { personas: A.readPersonas(shares) }) });
    expect(page.groups).toHaveLength(9);
    expect(page.groups.map((g) => g.group)).not.toContain("saver");
    expect(page.wedges.map((w) => w.group)).not.toContain("saver");
    expect(page.groups.every((g) => g.count > 0)).toBe(true);
    expect(page.groups.reduce((s, g) => s + g.count, 0)).toBe(1000);
    expect(page.groups.map((g) => g.count)).toEqual(ringDots(page.wedges, AUDIENCE_RING).wedges.map((w) => w.dots.length));
  });

  it("adds up to 1,000 for shares that sum to 0.97", () => {
    const shares = [0.13, 0.11, 0.1, 0.1, 0.1, 0.095, 0.09, 0.085, 0.08, 0.08];
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(0.97, 10);
    const page = pageOf({ audience: A.own({}, { personas: A.readPersonas(shares) }) });
    const layout = ringDots(page.wedges, AUDIENCE_RING);
    expect(page.groups.map((g) => g.count)).toEqual(layout.wedges.map((w) => w.dots.length));
    expect(page.groups.reduce((s, g) => s + g.count, 0)).toBe(1000);
  });

  it("for 50 random sets of ten shares: 1,000 in all, each count within one of share × 1,000, the ring's own", () => {
    const random = seeded(20261125);
    for (let set = 0; set < 50; set++) {
      const raw = Array.from({ length: 10 }, () => 0.02 + random());
      const sum = raw.reduce((a, b) => a + b, 0);
      const shares = raw.map((r) => r / sum);
      const page = pageOf({ audience: A.own({}, { personas: A.readPersonas(shares) }) });
      const layout = ringDots(page.wedges, AUDIENCE_RING);
      expect(page.groups.reduce((s, g) => s + g.count, 0)).toBe(1000);
      expect(page.groups.map((g) => g.count)).toEqual(layout.wedges.map((w) => w.dots.length));
      const shareOf = new Map(A.readPersonas(shares).map((p) => [p.archetype, p.share]));
      for (const g of page.groups) {
        expect(Math.abs(g.count - shareOf.get(g.group)! * 1000)).toBeLessThanOrEqual(1);
        expect(g.percent).toBe(Math.round(g.count / 10));
      }
    }
  });

  it("all shares 0: no groups and no wedges", () => {
    const page = pageOf({ audience: A.own({}, { personas: A.readPersonas(Array(10).fill(0)) }) });
    expect(page.groups).toEqual([]);
    expect(page.wedges).toEqual([]);
    expect(groupsOf(A.audience()).groups).toEqual([]);
  });

  it("legacy personas only: names and shares, nothing the read wrote", () => {
    const legacy: CalibratedPersona[] = [
      { archetype: "saver", repaint: "Keeps recipes", temperature: "warm", disposition: "collector", share: 0.6 },
      { archetype: "lurker", repaint: "Watches quietly", temperature: "cold", disposition: "lurker", share: 0.4 },
    ];
    const { groups } = groupsOf(A.audience({ personas: legacy }));
    expect(groups.map((g) => [g.name, g.count, g.percent])).toEqual([
      [groupName("saver"), 600, 60],
      [groupName("lurker"), 400, 40],
    ]);
    for (const g of groups) expect([g.line, g.judge, g.seen]).toEqual([null, null, null]);
  });

  it("each group carries the read's line, how they judge a video and what was seen in the numbers", () => {
    const a = withPersonas([
      persona("saver", 0.6, { blurb: '"Saving this".', reaction_frame: " Judges by the recipe. ", evidence: "Saves 2.1× the category." }),
      persona("lurker", 0.4, { blurb: "  ", reaction_frame: "", evidence: "   " }),
    ]);
    const [saver, lurker] = groupsOf(a).groups;
    expect(saver).toMatchObject({ line: "Saving this", judge: "Judges by the recipe.", seen: "Saves 2.1× the category." });
    expect(lurker).toMatchObject({ line: null, judge: null, seen: null });
  });
});

describe("lineOf: the read's one-liner without its outer quotes (the screen adds its own)", () => {
  it.each([
    ['"If it looks like sci-fi, I\'ll watch it."', "If it looks like sci-fi, I'll watch it."],
    ["“Saving this”", "Saving this"],
    ['"Saving this".', "Saving this"],
    ["'single'", "single"],
    ["'I'll watch it'", "I'll watch it"],
    ["It's fine", "It's fine"],
    ['"Saving this', '"Saving this'],
    ['"One" and "two"', '"One" and "two"'],
    ["  Plain line  ", "Plain line"],
  ])("%j → %j", (raw, line) => {
    expect(lineOf(raw)).toBe(line);
  });

  it.each(["", "   ", '""', null, undefined, 42])("%j → null", (raw) => {
    expect(lineOf(raw)).toBeNull();
  });
});

describe("where it came from", () => {
  it("the creator's own account: the handle, the platform, the read date and the videos read", () => {
    expect(ownPage().source).toEqual({ title: "@nia.tests", line: "TikTok · read 14 Aug · 12 videos", description: null });
  });

  it("read another year, with no date, one video, no videos", () => {
    const line = (spec: A.SignatureSpec, calibration?: Audience["calibration"]) =>
      pageOf({ audience: A.own({ ...(calibration !== undefined ? { calibration } : {}) }, spec), accounts: [ACCOUNT] }).source.line;
    expect(line({ scrapedAt: "2025-08-14T10:00:00Z" })).toBe("TikTok · read 14 Aug 2025 · 12 videos");
    expect(line({ scrapedAt: "" }, { source: "scrape", handle: "nia.tests" })).toBe("TikTok · 12 videos");
    expect(line({ scrapedAt: "" }, { source: "scrape", handle: "nia.tests", scraped_at: "2026-09-02T10:00:00Z" })).toBe(
      "TikTok · read 2 Sep · 12 videos",
    );
    expect(line({ videos: 1 })).toBe("TikTok · read 14 Aug · 1 video");
    expect(line({ videos: 0 })).toBe("TikTok · read 14 Aug");
  });

  it("another creator's: the same, the line starting with Another creator", () => {
    expect(pageOf({ audience: A.other() }).source).toEqual({
      title: "@leo.makes",
      line: "Another creator · TikTok · read 14 Aug · 12 videos",
      description: null,
    });
  });

  it("a thin read of another creator says Another creator with the date, never a video count", () => {
    // Its normal signature: the niche search's count (12) is stored, and must not be shown as theirs.
    const thin = A.other({ calibration: { source: "description", handle: "leo.makes" }, goal_label: null });
    expect(thin.signature?.provenance.videos_analyzed).toBe(12);
    const page = pageOf({ audience: thin });
    expect(page.kind).toBe("other");
    expect(page.source).toEqual({ title: "@leo.makes", line: "Another creator · TikTok · read 14 Aug", description: null });
    expect(page.label).toBe("@leo.makes");
    // With no date known either: the kind and the platform only.
    const undated = A.other({ calibration: { source: "description", handle: "leo.makes" }, goal_label: null }, { scrapedAt: "" });
    expect(pageOf({ audience: undated }).source.line).toBe("Another creator · TikTok");
  });

  it("own side: a thin read of the creator's own handle shows no video count either", () => {
    const thin = A.own({ calibration: { source: "description", handle: "nia.tests" }, goal_label: null });
    expect(thin.signature?.provenance.videos_analyzed).toBe(12);
    // With the account behind it (kind own by the account) and without it (kind own by type personal).
    expect(pageOf({ audience: thin, accounts: [ACCOUNT] }).source.line).toBe("TikTok · read 14 Aug");
    expect(pageOf({ audience: { ...thin, source_account_id: null } }).source.line).toBe("TikTok · read 14 Aug");
  });

  it("a thin read shows no figures: the niche search stood in, and the snapshot seeded from it is not the account's", () => {
    const thin = A.own({ calibration: { source: "description", handle: "nia.tests" }, goal_label: null });
    const snapshot = A.snapshot();
    expect(pageOf({ audience: thin, accounts: [ACCOUNT], snapshot, posts: A.posts([1_000, 2_000, 3_000]) }).figures).toEqual([]);
    // A full read of the same account, with the same snapshot, shows them.
    expect(ownPage({ snapshot, posts: A.posts([1_000, 2_000, 3_000]) }).figures.length).toBeGreaterThan(0);
  });

  it("a thin read lists no videos either: the posts archived with it are the niche search's, not the account's", () => {
    const thin = A.own({ calibration: { source: "description", handle: "nia.tests" }, goal_label: null });
    const posts = A.posts([1_000, 2_000, 3_000]);
    const pillars = [{ name: "Future tech", count: 6 }];
    expect(pageOf({ audience: thin, accounts: [ACCOUNT], posts, pillars }).videos).toBeNull();
    // Another creator's thin read too.
    const other = A.other({ calibration: { source: "description", handle: "leo.makes" }, goal_label: null });
    expect(pageOf({ audience: other, posts, pillars }).videos).toBeNull();
    // A full read with the same posts lists them.
    expect(ownPage({ posts, pillars }).videos).not.toBeNull();
  });

  it("nothing known gives an empty line, which the screen does not draw (a decision, not an accident)", () => {
    const bare = A.own(
      { platform: "custom", source_account_id: null, calibration: { source: "scrape", handle: "nia.tests" } },
      { scrapedAt: "", videos: 0 },
    );
    const page = pageOf({ audience: bare });
    expect(page.kind).toBe("own");
    expect(page.source).toEqual({ title: "@nia.tests", line: "", description: null });
  });

  it("a description: the name, Described by you, and the description only when it was built from one", () => {
    expect(pageOf({ audience: A.described() }).source).toEqual({
      title: "Busy parents who meal-prep",
      line: "Described by you",
      description: "Parents who cook for the week on Sunday.",
    });
    const authored = A.described({ calibration: null });
    expect(pageOf({ audience: authored }).source.description).toBeNull();
    expect(pageOf({ audience: A.described({ goal_label: "  " }) }).source.description).toBeNull();
  });
});

describe("the figures", () => {
  const usualPosts = A.posts([12_000, 12_800, 13_000]);

  it("Followers, Likes, Posts from the newest snapshot, then Usual views, through viewsWord", () => {
    const page = ownPage({ snapshot: A.snapshot(), posts: usualPosts });
    expect(page.figures).toEqual([
      { key: "followers", label: "Followers", value: "424K" },
      { key: "likes", label: "Likes", value: "20.6M" },
      { key: "posts", label: "Posts", value: "613" },
      { key: "usual", label: "Usual views", value: "12.8K" },
    ]);
    expect(page.figures.map((f) => f.value)).toEqual([viewsWord(424_000), viewsWord(20_612_345), viewsWord(613), viewsWord(12_800)]);
  });

  it("Likes only for a TikTok account", () => {
    const ig = A.account({ platform: "instagram" });
    const page = pageOf({ audience: A.own({ platform: "instagram" }), accounts: [ig], snapshot: A.snapshot(), posts: usualPosts });
    expect(page.figures.map((f) => f.key)).toEqual(["followers", "posts", "usual"]);
  });

  it("no snapshot: only the usual; no posts either: no figures", () => {
    expect(ownPage({ posts: usualPosts }).figures.map((f) => f.key)).toEqual(["usual"]);
    expect(ownPage().figures).toEqual([]);
  });

  const usual = (views: number[], pinned: number[] = []) =>
    ownPage({ posts: A.posts(views, pinned) }).figures.find((f) => f.key === "usual")?.value ?? null;

  it("the usual: the middle value of the posts read, from three posts up", () => {
    expect(usual([100, 900])).toBeNull();
    expect(usual([100, 900, 5_000])).toBe("900");
    expect(usual([100, 900, 1_000, 5_000])).toBe("950");
    expect(usual([100, 901, 1_000, 5_000])).toBe(viewsWord(951)); // 950.5, rounded
    expect(usual([0, 0, 5_000])).toBeNull(); // a middle value of 0
  });

  it("pinned posts are left out of the usual, which needs three posts that are not pinned", () => {
    expect(usual([100, 900, 5_000], [2])).toBeNull();
    expect(usual([100, 900, 1_000, 900_000], [3])).toBe("900");
  });
});

describe("the videos Maven read", () => {
  it("none for an audience with no posts, and none for a described one", () => {
    expect(ownPage().videos).toBeNull();
    expect(pageOf({ audience: A.described(), posts: A.posts([1, 2, 3]) }).videos).toBeNull();
  });

  it("the three most viewed, pinned ones listed too; no count of posts (the archive can hold more than one read)", () => {
    const page = ownPage({ posts: A.posts([500, 259_000, 1_000, 80_000, 3_000], [1]) });
    expect(page.videos!.heading).toBe("Your videos Maven read");
    expect(page.videos).not.toHaveProperty("count");
    expect(page.videos!.rows.map((r) => r.views)).toEqual(["259K", "80K", "3K"]);
    expect(page.videos!.rows.map((r) => r.key)).toEqual(["7300000000000000011", "7300000000000000013", "7300000000000000014"]);
  });

  it("a row's cover: the post's stored cover_url (https only), else null", () => {
    const url = "https://proj.supabase.co/storage/v1/object/public/covers/account/tiktok/7300000000000000001.jpg";
    const cover = (over: Parameters<typeof A.post>[0]) => ownPage({ posts: [A.post(over)] }).videos!.rows[0]!.cover;
    expect(cover({ cover_url: url })).toBe(url);
    expect(cover({ cover_url: null })).toBeNull();
    expect(cover({})).toBeNull();
    expect(cover({ cover_url: "http://insecure.test/a.jpg" })).toBeNull();
  });

  it("a row's text: the caption's first line without hashtags, else No caption", () => {
    const rows = (caption: string) => ownPage({ posts: [A.post({ caption })] }).videos!.rows[0]!.text;
    expect(rows("Robots farm now #ai #tech\nsecond line")).toBe("Robots farm now");
    expect(rows("#ai #tech #fyp")).toBe("No caption");
    expect(rows("#ai#tech")).toBe("No caption");
    expect(rows("   ")).toBe("No caption");
    expect(rows("#fyp\nThe second line speaks")).toBe("The second line speaks");
    expect(rows("Learn C# in a   week")).toBe("Learn C# in a week");
  });

  it("a # before a digit is no hashtag", () => {
    const rows = (caption: string) => ownPage({ posts: [A.post({ caption })] }).videos!.rows[0]!.text;
    expect(rows("#1 fan of robots #fyp")).toBe("#1 fan of robots");
    expect(rows("Day #12 of the build #robots")).toBe("Day #12 of the build");
    expect(rows("#fyp #2026")).toBe("#2026");
  });

  it("a long line is cut at 160 characters on a whole word, with …", () => {
    const rows = (caption: string) => ownPage({ posts: [A.post({ caption })] }).videos!.rows[0]!.text;
    const words = Array.from({ length: 40 }, (_, i) => `word${String(i).padStart(2, "0")}`).join(" "); // 279 long
    const cut = rows(words);
    expect(cut.endsWith("…")).toBe(true);
    const lead = cut.slice(0, -1);
    expect(lead.length).toBeLessThanOrEqual(160);
    expect(words.startsWith(lead)).toBe(true);
    expect(words[lead.length]).toBe(" "); // ends on a whole word
    expect(lead).toBe(words.slice(0, words.lastIndexOf(" ", 160))); // the most whole words that fit
    // Exactly 160: as it is.
    const exact = `${"a".repeat(80)} ${"b".repeat(79)}`;
    expect(exact).toHaveLength(160);
    expect(rows(exact)).toBe(exact);
    // One long token, no word to cut on: cut at 160.
    expect(rows("x".repeat(300))).toBe(`${"x".repeat(160)}…`);
    // The hashtags go before the line is measured.
    expect(rows(`${"a".repeat(150)} #${"t".repeat(40)}`)).toBe("a".repeat(150));
    // Characters, not code units: an emoji is not cut in half.
    const emoji = "🤖".repeat(200);
    expect(Array.from(rows(emoji))).toEqual([...Array.from({ length: 160 }, () => "🤖"), "…"]);
  });

  it("a post read twice is one row, and the first one wins", () => {
    const first = A.post({ post_id: "7300000000000000777", views: 2_000, caption: "First copy" });
    const again = A.post({ post_id: "7300000000000000777", views: 90_000, caption: "Second copy" });
    const page = ownPage({ posts: [first, ...A.posts([1_000, 500]), again] });
    expect(page.videos!.rows.map((r) => [r.key, r.text, r.views])).toEqual([
      ["7300000000000000777", "First copy", "2K"],
      ["7300000000000000010", "Post 0", "1K"],
      ["7300000000000000011", "Post 1", "500"],
    ]);
  });

  it("the multiple against the usual, its tone decided on the value shown", () => {
    const times = (views: number[]) => ownPage({ posts: A.posts(views) }).videos!.rows.map((r) => r.times);
    expect(times([20_000, 1_000, 300])).toEqual([
      { words: "20× your usual", tone: "above" },
      { words: "1× your usual", tone: "around" },
      { words: "0.3× your usual", tone: "below" },
    ]);
    expect(times([1_450, 1_000, 50])).toEqual([
      { words: "1.5× your usual", tone: "above" },
      { words: "1× your usual", tone: "around" },
      { words: "under 0.1× your usual", tone: "below" },
    ]);
  });

  it("another creator's: their videos and their usual", () => {
    const page = pageOf({ audience: A.other(), posts: A.posts([1_900, 1_000, 300]) });
    expect(page.videos!.heading).toBe("Their videos Maven read");
    expect(page.videos!.rows[0]!.times).toEqual({ words: "1.9× their usual", tone: "above" });
  });

  it("no usual: no multiple", () => {
    expect(ownPage({ posts: A.posts([1_900, 1_000]) }).videos!.rows.map((r) => r.times)).toEqual([null, null]);
  });

  it("what the account posts about: by count, largest first, empty ones left out", () => {
    const page = ownPage({
      posts: A.posts([1, 2, 3]),
      pillars: [
        { name: "Future tech", count: 6 },
        { name: "Robots at home", count: 9 },
        { name: "Old drafts", count: 0 },
        { name: "  ", count: 4 },
        { name: "Garden builds", count: 6 },
      ],
    });
    expect(page.videos!.topics).toEqual(["Robots at home · 9", "Future tech · 6", "Garden builds · 6"]);
  });
});

describe("the read's two texts", () => {
  it("splitFirst: the first sentence, then the rest", () => {
    expect(splitFirst("Bold claims win. Slow intros lose.")).toEqual({ first: "Bold claims win.", rest: "Slow intros lose." });
    expect(splitFirst("Bold claims win.")).toEqual({ first: "Bold claims win.", rest: null });
    expect(splitFirst("Things like e.g. robots work well")).toEqual({ first: "Things like e.g. robots work well", rest: null });
    expect(splitFirst("")).toBeNull();
    expect(splitFirst("  ")).toBeNull();
    expect(splitFirst(null)).toBeNull();
    expect(splitFirst(undefined)).toBeNull();
  });

  it("what works with them and what falls flat, from the read", () => {
    const page = pageOf({ audience: A.own({}, { works: "Bold claims win. Slow intros lose.", flat: "" }), accounts: [ACCOUNT] });
    expect(page.texts).toEqual({ works: { first: "Bold claims win.", rest: "Slow intros lose." }, flat: null });
    expect(pageOf({ audience: A.audience() }).texts).toEqual({ works: null, flat: null });
  });
});

describe("the rest of the page", () => {
  it("isDefault: the audience new chats use", () => {
    expect(ownPage({ defaultId: A.uuid(1) }).isDefault).toBe(true);
    expect(ownPage({ defaultId: A.uuid(2) }).isDefault).toBe(false);
    expect(ownPage({ defaultId: null }).isDefault).toBe(false);
  });

  it("removal: disconnect with the account behind it, else delete", () => {
    expect(ownPage().removal).toEqual({ kind: "disconnect", accountId: ACCOUNT.id, handle: "nia.tests" });
    expect(pageOf({ audience: A.other() }).removal).toEqual({ kind: "delete" });
    expect(pageOf({ audience: A.described() }).removal).toEqual({ kind: "delete" });
  });

  it("Read again: an account's audience with a handle on TikTok; the goal defaults to grow", () => {
    expect(ownPage().readAgain).toEqual({ audienceId: A.uuid(1), handle: "nia.tests", type: "personal", goalIntent: "grow", name: "@nia.tests" });
    expect(ownPage({ audience: A.own({ goal_intent: "sell" }) }).readAgain?.goalIntent).toBe("sell");
    expect(pageOf({ audience: A.other() }).readAgain).toEqual({
      audienceId: A.uuid(2),
      handle: "leo.makes",
      type: "target",
      goalIntent: "grow",
      name: "@leo.makes",
    });
    expect(pageOf({ audience: A.described() }).readAgain).toBeNull();
    const handleless = A.own({ source_account_id: null, calibration: { source: "scrape" }, signature: A.signature({ handle: "" }) });
    expect(pageOf({ audience: handleless }).kind).toBe("own");
    expect(pageOf({ audience: handleless }).readAgain).toBeNull();
    const ig = A.account({ platform: "instagram" });
    expect(pageOf({ audience: A.own({ platform: "instagram" }), accounts: [ig] }).readAgain).toBeNull();
  });

  it("Read again: none for the creator's own audience with no account behind it (a read would connect the account they disconnected)", () => {
    const unlinked = A.own({ source_account_id: null });
    expect(pageOf({ audience: unlinked }).kind).toBe("own");
    expect(pageOf({ audience: unlinked }).handle).toBe("nia.tests");
    expect(pageOf({ audience: unlinked }).readAgain).toBeNull();
    expect(ownPage().readAgain).not.toBeNull();
  });

  it("the name, the label, the handle and the face: the account's picture when it stores one, and its platform", () => {
    const mine = ownPage();
    expect([mine.id, mine.name, mine.label, mine.handle]).toEqual([A.uuid(1), "@nia.tests", "@nia.tests", "nia.tests"]);
    expect(mine.face).toEqual({ initial: "N", picture: null, platform: "tiktok" });
    const pictured = ownPage({ accounts: [A.account({ picture: "https://proj.supabase.co/storage/v1/object/public/avatars/account/tiktok/nia.tests.jpg" })] });
    expect(pictured.face).toEqual({
      initial: "N",
      picture: "https://proj.supabase.co/storage/v1/object/public/avatars/account/tiktok/nia.tests.jpg",
      platform: "tiktok",
    });
    // Only an https address is drawn.
    expect(ownPage({ accounts: [A.account({ picture: "javascript:alert(1)" })] }).face.picture).toBeNull();
    expect(ownPage({ accounts: [A.account({ picture: "" })] }).face.picture).toBeNull();
    // Another creator's audience has no connected account behind it: the initial, with its platform's badge.
    expect(pageOf({ audience: A.other(), accounts: [A.account({ picture: "https://x.test/a.jpg" })] }).face).toEqual({
      initial: "L",
      picture: null,
      platform: "tiktok",
    });
    const renamed = ownPage({ audience: A.own({ name: "My people" }) });
    expect([renamed.name, renamed.label]).toEqual(["My people", "@nia.tests"]);
    const desc = pageOf({ audience: A.described({ name: "busy parents" }) });
    expect([desc.name, desc.label, desc.handle]).toEqual(["busy parents", "busy parents", null]);
    expect(desc.face).toEqual({ initial: "B", picture: null, platform: null });
    // The handle comes from the account, lower case and without "@".
    const shouting = pageOf({ audience: A.own(), accounts: [A.account({ handle: "@Nia.Tests" })] });
    expect(shouting.handle).toBe("nia.tests");
  });

  it("is serialisable: no Map, no Date, nothing lost through JSON", () => {
    const page = ownPage({ snapshot: A.snapshot(), posts: A.posts([1_000, 2_000, 3_000]), pillars: [{ name: "Future tech", count: 6 }] });
    expect(JSON.parse(JSON.stringify(page))).toEqual(page);
  });
});

describe("switcherChoicesOf", () => {
  const mine = A.own();
  const second = A.own({ id: A.uuid(4), name: "@nia.second", source_account_id: null, calibration: { source: "scrape", handle: "nia.second" } }, { handle: "nia.second", videos: 0 });
  const leo = A.other();
  const parents = A.described();
  const analyst = A.audience({ id: A.uuid(5), name: "Analyst panel", mode: "general" });
  const list = [GENERAL_AUDIENCE, ...PRESET_AUDIENCES, analyst, parents, leo, mine, second];

  it("the creator's own audiences only; own-account ones first, then the rest, each in list order", () => {
    const choices = switcherChoicesOf(list, [ACCOUNT], mine.id);
    expect(choices.map((c) => c.id)).toEqual([mine.id, second.id, parents.id, leo.id]);
  });

  it("each with name, label, line and face; the check only on the default", () => {
    const choices = switcherChoicesOf(list, [ACCOUNT], leo.id);
    expect(choices).toEqual([
      { id: mine.id, name: "@nia.tests", label: "@nia.tests", line: "TikTok · 12 videos read", face: { initial: "N", picture: null, platform: "tiktok" }, selected: false },
      { id: second.id, name: "@nia.second", label: "@nia.second", line: "TikTok", face: { initial: "N", picture: null, platform: "tiktok" }, selected: false },
      {
        id: parents.id,
        name: "Busy parents who meal-prep",
        label: "Busy parents who meal-prep",
        line: "Described by you",
        face: { initial: "B", picture: null, platform: null },
        selected: false,
      },
      { id: leo.id, name: "@leo.makes", label: "@leo.makes", line: "Another creator · TikTok", face: { initial: "L", picture: null, platform: "tiktok" }, selected: true },
    ]);
    expect(switcherChoicesOf(list, [ACCOUNT], null).every((c) => !c.selected)).toBe(true);
    expect(switcherChoicesOf(list, [ACCOUNT], "general").every((c) => !c.selected)).toBe(true);
  });

  it("an own-account row shows the account's stored picture", () => {
    const url = "https://proj.supabase.co/storage/v1/object/public/avatars/account/tiktok/nia.tests.jpg";
    const choices = switcherChoicesOf(list, [A.account({ picture: url })], null);
    expect(choices.find((c) => c.id === mine.id)!.face.picture).toBe(url);
    expect(choices.find((c) => c.id === leo.id)!.face.picture).toBeNull();
  });

  it("no audience of their own: no rows", () => {
    expect(switcherChoicesOf([GENERAL_AUDIENCE, ...PRESET_AUDIENCES], [], null)).toEqual([]);
  });

  it("a thin read's line carries no video count, own or another creator's", () => {
    const thinOwn = A.own({ calibration: { source: "description", handle: "nia.tests" }, goal_label: null });
    const thinOther = A.other({ calibration: { source: "description", handle: "leo.makes" }, goal_label: null });
    expect(thinOwn.signature?.provenance.videos_analyzed).toBe(12);
    expect(thinOther.signature?.provenance.videos_analyzed).toBe(12);
    const lines = (accounts: AccountRef[]) =>
      Object.fromEntries(switcherChoicesOf([thinOwn, thinOther], accounts, null).map((c) => [c.label, c.line]));
    expect(lines([ACCOUNT])).toEqual({ "@nia.tests": "TikTok", "@leo.makes": "Another creator · TikTok" });
    expect(lines([])).toEqual({ "@nia.tests": "TikTok", "@leo.makes": "Another creator · TikTok" });
  });
});

describe("pickAudience: which audience /audience shows", () => {
  const empty = (over: Partial<Audience>) => A.audience({ signature: null, personas: [], ...over });
  const mine = A.own({ created_at: "2026-10-01T00:00:00Z" });
  const newerOwn = A.own({ id: A.uuid(6), source_account_id: null, created_at: "2026-10-05T00:00:00Z" });
  const leo = A.other({ created_at: "2026-11-02T00:00:00Z" });
  const shell = empty({ id: A.uuid(7), name: "Empty shell", created_at: "2026-11-20T00:00:00Z" });

  it("the default, when it is one of the creator's with groups", () => {
    expect(pickAudience([GENERAL_AUDIENCE, mine, leo, shell], [ACCOUNT], leo.id)?.id).toBe(leo.id);
  });

  it("else the newest own-account audience with groups", () => {
    expect(pickAudience([GENERAL_AUDIENCE, mine, newerOwn, leo, shell], [ACCOUNT], null)?.id).toBe(newerOwn.id);
    expect(pickAudience([mine, leo, shell], [ACCOUNT], shell.id)?.id).toBe(mine.id); // the default has no groups
    expect(pickAudience([mine, leo], [ACCOUNT], "general")?.id).toBe(mine.id);
    expect(pickAudience([mine, leo], [ACCOUNT], PRESET_AUDIENCES[0]!.id)?.id).toBe(mine.id);
  });

  it("else the newest with groups, else the newest", () => {
    const olderLeo = A.other({ id: A.uuid(8), created_at: "2026-09-01T00:00:00Z" });
    expect(pickAudience([GENERAL_AUDIENCE, olderLeo, leo, shell], [], null)?.id).toBe(leo.id);
    const older = empty({ id: A.uuid(9), created_at: "2026-09-01T00:00:00Z" });
    expect(pickAudience([GENERAL_AUDIENCE, shell, older], [], null)?.id).toBe(shell.id);
  });

  it("an equal date: the later in the list (the list is oldest first)", () => {
    const twin = A.other({ id: A.uuid(10), created_at: leo.created_at });
    expect(pickAudience([leo, twin], [], null)?.id).toBe(twin.id);
  });

  it("none of the creator's own: null", () => {
    expect(pickAudience([GENERAL_AUDIENCE, ...PRESET_AUDIENCES], [], null)).toBeNull();
    expect(pickAudience([A.audience({ mode: "general" })], [], null)).toBeNull();
    expect(pickAudience([], [], null)).toBeNull();
  });
});

describe("initialOf: the letter a face shows, the one rule for the page and the switcher", () => {
  it.each([
    ["@nia.tests", "N"],
    ["Night owls", "N"],
    ["9lives.tests", "9"],
    ["“élan crowd”", "É"],
    [" — ", "—"],
    ["", ""],
  ])("%j gives %j", (label, initial) => {
    expect(initialOf(label)).toBe(initial);
  });

  it("is the rule the page's face and the switcher's rows are made with", () => {
    const leo = A.other();
    const page = audiencePageOf({ audience: leo, audiences: [leo], accounts: [], defaultId: null, snapshot: null, posts: [], pillars: [] }, NOW);
    expect(page.face.initial).toBe(initialOf(page.label));
    const [choice] = switcherChoicesOf([leo], [], null);
    expect(choice!.face.initial).toBe(initialOf(choice!.label));
  });
});
