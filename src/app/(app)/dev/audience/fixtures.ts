/**
 * The Audience dev preview's fixtures: made-up audiences, one made-up account with a snapshot, twelve
 * made-up posts and three topics, each page made by the real model
 * (`audiencePageOf`) at a fixed "now". Every handle, name, caption and line here is invented (`nia.tests`,
 * `leo.makes`); nothing stands for a real account. `__tests__/fixtures.test.ts` holds them to that, and to
 * the real model's output.
 *
 * The pages:
 * - own: @nia.tests, the creator's own account, the default: every block (figures, the usual from twelve
 *   posts, the read videos, both texts, ten groups with lines)
 * - other: @leo.makes, another creator, the default: as the route stores one (no figures, no posts)
 * - described: "Busy parents who meal-prep", described by the creator, a description of four lines
 * - few: @nia.tests with two posts read: no usual, so no "Usual views" and no multiples
 * - bare: an older read of @nia.tests with the legacy groups only (no lines), no snapshot, posts or texts
 * - not-default: @nia.tests opened by its own address while another audience is the default (pushed)
 */
import type { AccountSnapshot } from "@/lib/account-metrics/account-metrics";
import {
  audiencePageOf,
  switcherChoicesOf,
  type AccountRef,
  type ArchivedPost,
  type AudiencePage,
  type PageInput,
  type PostedTopic,
  type SwitcherChoice,
} from "@/lib/audience-next/audience-model";
import type { Archetype, Audience, AudienceSignature, CalibratedPersona, SignaturePersona } from "@/lib/audience/audience-types";

/** The preview's "now": dates on the page are read against it. */
export const DEV_NOW = new Date("2026-11-25T12:00:00Z");

/** Made-up ids, one per number. */
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const DEV_ACCOUNT: AccountRef = { id: id(100), handle: "nia.tests", platform: "tiktok", is_primary: true };

const WEIGHTS = { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 };

const BASE: Audience = {
  id: id(1),
  user_id: "dev-user",
  name: "",
  type: "target",
  mode: "socials",
  platform: "tiktok",
  goal_label: null,
  goal_intent: "grow",
  is_general: false,
  is_preset: false,
  source_account_id: null,
  persona_weights: WEIGHTS,
  personas: [],
  profile: null,
  calibration: null,
  created_at: "2026-08-14T10:00:00Z",
  updated_at: "2026-08-14T10:00:00Z",
};

/** One group of a read: its share and the read's three texts (the line in the quotes it is stored in). */
type Read = [archetype: Archetype, share: number, line: string, judge: string, seen: string];

function readGroups(rows: readonly Read[]): SignaturePersona[] {
  return rows.map(([archetype, share, line, judge, seen]) => ({
    archetype,
    share,
    temperature: "warm",
    disposition: "scanner",
    reaction_frame: judge,
    evidence: seen,
    blurb: `"${line}"`,
  }));
}

function signature(handle: string, scrapedAt: string, videos: number, groups: SignaturePersona[], works: string, flat: string): AudienceSignature {
  return {
    creator_persona: { content_description: "", context: "", writing_style_sample: "", format_signature: "" },
    audience: {
      follower_tier: null,
      maturity: "growing",
      temperature_mix: { cold: 0.3, warm: 0.5, hot: 0.2 },
      interest_tags: [],
      what_resonates: works,
      what_falls_flat: flat,
      persona_weights: WEIGHTS,
      personas: groups,
    },
    summary: "",
    provenance: { handle, scraped_at: scrapedAt, videos_analyzed: videos, videos_watched: 6, sub_coverage: "6/8" },
  };
}

// ─── @nia.tests: the creator's own account ──────────────────────────────────

/** Ten shares that add up to 1, largest first, on a cooking account's groups. */
const NIA_GROUPS: readonly Read[] = [
  ["lurker", 0.13, "I'll watch the whole thing and never say a word.", "Stays for the finished dish; leaves when the intro talks before it cooks.", "Watch time on the prep videos runs 1.4× the account's other posts."],
  ["high_engager", 0.11, "Wait, does this work with frozen veg? Asking for real.", "Judges by whether there is something to ask or add in the comments.", "Comments per view are twice as high on the videos that end on a question."],
  ["saver", 0.105, "Saving this for Sunday, I need the shopping list.", "Saves what they can use later: a list on screen, the amounts, the price.", "Saves run 2.3× the account's average on the videos with a list on screen."],
  ["loyalist", 0.1, "Sunday prep videos are how my week starts.", "Comes back for the series; a new format has to earn its place.", "Returning viewers make up most of the first hour's views on the Sunday posts."],
  ["sharer", 0.1, "Sending this to the flat group chat right now.", "Shares what saves a friend money or time, the cheaper the better.", "Shares climb on the posts with a cost per portion in the first line."],
  ["niche_deep_scout", 0.095, "Is there a cheaper way to do the sauce?", "Hunts for the trick other cooking accounts leave out.", "Their comments ask for swaps and prices more than for the recipe."],
  ["purposeful_viewer", 0.09, "Just tell me the cost per portion.", "Wants the number early and the steps without detours.", "Views drop least on the videos that give the price in the first three seconds."],
  ["niche_deep_buyer", 0.09, "I bought the same rice cooker after the last one.", "Trusts a tool once they have seen it used for weeks.", "Link taps spike on the posts that show the same pan again."],
  ["cross_niche_curiosity", 0.09, "I don't cook, but this was oddly calming.", "Stays for the rhythm and the sound more than for the food.", "A share of the views comes from outside the cooking feed, mostly late at night."],
  ["tough_crowd", 0.09, "Nobody eats the same pasta five days in a row.", "Looks for the flaw and says so; a fair point wins them over.", "Their comments argue with the claim in the first line more than with the food."],
];

const NIA_WORKS =
  "Cheap, specific numbers win: a price per portion on screen keeps them watching. The week's boxes lined up at the end get saved and sent on.";
const NIA_FLAT =
  "Long stories before the cooking starts lose them in the first seconds. A gadget they would have to buy reads as an advert.";

const NIA: Audience = {
  ...BASE,
  id: id(1),
  name: "@nia.tests",
  type: "personal",
  source_account_id: DEV_ACCOUNT.id,
  calibration: { source: "scrape", handle: "nia.tests", scraped_at: "2026-08-14T10:00:00Z", thin: false },
  signature: signature("nia.tests", "2026-08-14T10:00:00Z", 12, readGroups(NIA_GROUPS), NIA_WORKS, NIA_FLAT),
  created_at: "2026-08-14T10:00:00Z",
};

const DEV_SNAPSHOT: AccountSnapshot = {
  snapshot_date: "2026-11-24",
  follower_count: 48_200,
  heart_count: 1_930_000,
  video_count: 214,
  recent_views: null,
};

/** Twelve read posts: the middle two are 12.7K and 12.9K, so the usual is 12.8K; one caption is hashtags only. */
const POSTS: readonly [views: number, caption: string][] = [
  [259_000, "I fed four flatmates for a week on £20 #mealprep #budget\nFull list in the comments"],
  [24_900, "The one-pan pasta my landlord asked for #onepan #pasta"],
  [19_200, "Sunday prep in 40 minutes, five lunches done #mealprep"],
  [15_100, "#fyp #foodtok #mealprep"],
  [13_400, "Rice cooker chilli, no stove needed #ricecooker"],
  [12_900, "What £1 of lentils turns into #lentils #cheapeats"],
  [12_700, "Freezer burritos that actually reheat well"],
  [11_800, "My cheapest breakfast this month #oats"],
  [9_600, "Trying a viral three-ingredient bread #bread"],
  [8_400, "Leftover rice, three ways #leftovers"],
  [6_100, "Batch soup for exam week #soup"],
  [3_900, "How I plan the shopping list"],
];

const DEV_POSTS: ArchivedPost[] = POSTS.map(([views, caption], i) => ({
  post_id: `73000000000000000${String(10 + i)}`,
  caption,
  views,
  is_pinned: false,
}));

const DEV_TOPICS: PostedTopic[] = [
  { name: "Budget meal prep", count: 6 },
  { name: "One-pan dinners", count: 4 },
  { name: "Student kitchen tips", count: 2 },
];

// ─── @leo.makes: another creator ────────────────────────────────────────────

const LEO_GROUPS: readonly Read[] = [
  ["saver", 0.14, "Saving the cut list for when I have a garage.", "Keeps what they could build themselves one day: sizes, joints, the tools.", "Saves run 2.6× the category on the build videos with a cut list."],
  ["lurker", 0.12, "Ten minutes of sanding and I watched all of it.", "Stays for the process; a cut that skips the hard part loses them.", "Most of the views on the long builds run past the halfway mark."],
  ["niche_deep_scout", 0.11, "Which finish did you use on the top?", "Wants the detail other makers leave out.", "Their comments ask about wood, finish and joints, rarely about the result."],
  ["high_engager", 0.1, "Show the mistake you fixed, that's the best part.", "Judges by whether there is something to say about the build.", "The videos that show a mistake get three times the comments."],
  ["purposeful_viewer", 0.1, "Just show me the joint, I'll skip the rest.", "Wants the one technique, fast.", "Views jump to the middle of the long videos, where the joint is cut."],
  ["sharer", 0.1, "My dad needs to see this bench.", "Shares what someone they know would build.", "Shares climb on the gift builds before the holidays."],
  ["loyalist", 0.09, "Every Friday build, never miss one.", "Comes back for the weekly build; a skipped week is noticed.", "The Friday posts reach most of their views from returning viewers."],
  ["tough_crowd", 0.08, "That joint won't hold a year.", "Tests every claim about strength and price.", "Their comments correct the method more than they praise the piece."],
  ["niche_deep_buyer", 0.08, "Ordered the same clamps.", "Buys the tools a maker keeps reaching for.", "Link taps come mostly from the videos that show one tool again and again."],
  ["cross_niche_curiosity", 0.08, "No idea how to build anything, still satisfying.", "Watches for the calm of the work, not to learn it.", "A share of the views comes from outside the making feed."],
];

const LEO: Audience = {
  ...BASE,
  id: id(2),
  name: "@leo.makes",
  type: "target",
  calibration: { source: "scrape", handle: "leo.makes", scraped_at: "2026-10-03T09:00:00Z", thin: false },
  signature: signature(
    "leo.makes",
    "2026-10-03T09:00:00Z",
    15,
    readGroups(LEO_GROUPS),
    "Builds that show the hard part and the fix keep them to the end. A cut list or a size on screen gets saved.",
    "A finished piece with no process feels like an advert. Fast cuts over the joinery lose the makers.",
  ),
  created_at: "2026-10-03T09:00:00Z",
};

// ─── Busy parents who meal-prep: described by the creator ───────────────────

const PARENTS_GROUPS: readonly Read[] = [
  ["purposeful_viewer", 0.15, "Give me dinner for five nights, not a story.", "Wants the plan and the cost before anything else.", "Described as short on time: a list up front matters most."],
  ["saver", 0.13, "Screenshotting the list for the shop on Saturday.", "Keeps what they can use on the next shop.", "A list on screen is what they come for."],
  ["lurker", 0.11, "Watching with the sound off after bedtime.", "Watches late and quietly; captions carry it.", "Described as watching after the kids are asleep."],
  ["loyalist", 0.1, "The Sunday plan is my week now.", "Comes back for a routine that works.", "A weekly plan suits a weekly shop."],
  ["sharer", 0.1, "Sending this to the school parents' chat.", "Shares what saves another parent an evening.", "Other parents are the first people they tell."],
  ["tough_crowd", 0.09, "My kids would never eat that.", "Doubts a meal survives a picky eater.", "Picky eaters are the test every recipe has to pass."],
  ["high_engager", 0.09, "Can I make this nut-free for school?", "Asks how to change it for their family.", "Swaps for allergies and fussy eaters come up first."],
  ["niche_deep_scout", 0.08, "Is there a way to do this without an oven?", "Looks for the shortcut that saves washing up.", "One pan and no gadgets matter."],
  ["niche_deep_buyer", 0.08, "Which containers are those?", "Buys what makes the routine stick.", "Containers that stack and freeze are part of the routine."],
  ["cross_niche_curiosity", 0.07, "Not a parent, still stealing this plan.", "Comes for the order of it, not the food.", "Anyone cooking for a week finds it useful."],
];

const PARENTS_DESCRIPTION =
  "Parents who cook for the whole week on a Sunday. They want cheap meals that keep for five days and need one pan. They watch late, with the sound off, and save anything with a shopping list on screen.";

const PARENTS: Audience = {
  ...BASE,
  id: id(3),
  name: "Busy parents who meal-prep",
  type: "target",
  platform: "custom",
  goal_label: PARENTS_DESCRIPTION,
  calibration: { source: "description", scraped_at: "2026-09-02T18:00:00Z", thin: false },
  signature: signature(
    "busy parents who meal-prep",
    "2026-09-02T18:00:00Z",
    10,
    readGroups(PARENTS_GROUPS),
    "A full week planned in one video wins them. The cost of the whole shop, shown once, gets saved.",
    "Single recipes with no plan around them feel like work. Anything that needs a special tool is skipped.",
  ),
  created_at: "2026-09-02T18:00:00Z",
};

// ─── An older read: the legacy groups only ──────────────────────────────────

const LEGACY_SHARES: readonly [Archetype, number][] = [
  ["lurker", 0.14],
  ["saver", 0.12],
  ["high_engager", 0.11],
  ["sharer", 0.1],
  ["loyalist", 0.1],
  ["purposeful_viewer", 0.1],
  ["niche_deep_scout", 0.09],
  ["tough_crowd", 0.08],
  ["niche_deep_buyer", 0.08],
  ["cross_niche_curiosity", 0.08],
];

const LEGACY_GROUPS: CalibratedPersona[] = LEGACY_SHARES.map(([archetype, share]) => ({
  archetype,
  share,
  repaint: "",
  temperature: "warm",
  disposition: "scanner",
}));

const BARE: Audience = {
  ...BASE,
  id: id(4),
  name: "@nia.tests",
  type: "personal",
  source_account_id: DEV_ACCOUNT.id,
  personas: LEGACY_GROUPS,
  calibration: { source: "scrape", handle: "nia.tests", scraped_at: "2026-03-02T10:00:00Z", thin: false },
  signature: null,
  created_at: "2026-03-02T10:00:00Z",
};

// ─── The pages ──────────────────────────────────────────────────────────────

/** The creator's audiences the switcher would list (the legacy read is a page of its own). */
export const DEV_AUDIENCES: readonly Audience[] = [NIA, LEO, PARENTS];

export type DevPageName = "own" | "other" | "described" | "few" | "bare" | "not-default";
export const DEV_PAGE_NAMES: readonly DevPageName[] = ["own", "other", "described", "few", "bare", "not-default"];

export interface DevPage {
  /** What the server read would hand the model. */
  input: PageInput;
  /** The model's page of it, at `DEV_NOW`. */
  page: AudiencePage;
  /** Opened by its own address: the shell's Back and title. */
  pushed: boolean;
  /** The switcher's rows for it (the pill's sheet lists them). */
  choices: SwitcherChoice[];
}

function devPage(input: PageInput, pushed: boolean): DevPage {
  return {
    input,
    page: audiencePageOf(input, DEV_NOW),
    pushed,
    choices: switcherChoicesOf(input.audiences, input.accounts, input.defaultId),
  };
}

const accounts = [DEV_ACCOUNT];
const read = { snapshot: DEV_SNAPSHOT, posts: DEV_POSTS, pillars: DEV_TOPICS };
const nothingRead = { snapshot: null, posts: [], pillars: [] };

export const DEV_PAGES: Readonly<Record<DevPageName, DevPage>> = {
  own: devPage({ audience: NIA, audiences: DEV_AUDIENCES, accounts, defaultId: NIA.id, ...read }, false),
  other: devPage({ audience: LEO, audiences: DEV_AUDIENCES, accounts, defaultId: LEO.id, ...nothingRead }, false),
  described: devPage({ audience: PARENTS, audiences: DEV_AUDIENCES, accounts, defaultId: PARENTS.id, ...nothingRead }, false),
  few: devPage({ audience: NIA, audiences: DEV_AUDIENCES, accounts, defaultId: NIA.id, ...read, posts: DEV_POSTS.slice(0, 2) }, false),
  bare: devPage({ audience: BARE, audiences: [BARE], accounts, defaultId: BARE.id, ...nothingRead }, false),
  "not-default": devPage({ audience: NIA, audiences: DEV_AUDIENCES, accounts, defaultId: LEO.id, ...read }, true),
};
