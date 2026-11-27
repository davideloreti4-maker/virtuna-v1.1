/**
 * start-profile.ts (plan 01-start-and-profile, Task 4): what the account step writes to the profile, and where
 * the creator goes next: the app with a plan, their audience when they have one, else the building screen with
 * the first build (their TikTok account read, else an audience described by their niche words).
 * The write: the niche once (never over one /start wrote); the reused columns (primary_goal, in its own set, and
 * target_platforms) and the handles only where empty; consent only from the ticked box, and it only turns on.
 * The audiences are the app's real constants and one own row made from a real template.
 */
import { describe, expect, it } from "vitest";

import { GENERAL_AUDIENCE, GENERAL_TEMPLATES, PRESET_AUDIENCES } from "@/lib/audience/audience-repo";
import type { Audience } from "@/lib/audience/audience-types";

import { GOALS, type CompleteAnswers } from "../answers";
import {
  afterSaveOf,
  firstBuildRequestOf,
  hasCalibratedAudience,
  hasPlanOf,
  profileWriteOf,
  type ExistingProfile,
} from "../start-profile";

const NOW = "2026-11-26T10:00:00.000Z";
const TIKTOK: CompleteAnswers = { platforms: ["tiktok"], tiktokHandle: "niacooks", niche: "budget meals for students", nicheSource: "typed", goal: "growth" };
const INSTAGRAM: CompleteAnswers = { platforms: ["instagram"], instagramHandle: "nia.cooks", niche: "budget meals for students", nicheSource: "typed", goal: "brand_deals" };
const FROM_ACCOUNT: CompleteAnswers = { platforms: ["tiktok", "instagram"], tiktokHandle: "niacooks", nicheSource: "account", goal: "engagement" };
const KEPT: ExistingProfile = {
  niche_source: "typed",
  primary_goal: "conversion",
  target_platforms: ["youtube"],
  tiktok_handle: "old.handle",
  instagram_handle: null,
  email_consent: true,
  onboarding_completed_at: "2026-11-01T00:00:00.000Z",
};
/** The app's own set for primary_goal (src/lib/schemas/creator-profile.ts, primaryGoalEnum). */
const APP_GOALS = ["growth", "engagement", "brand_deals", "conversion"];

const panel = GENERAL_TEMPLATES.find((t) => (t.personas?.length ?? 0) > 0);
const own = (personas: boolean): Audience => ({
  ...(panel as Audience),
  id: personas ? "00000000-0000-4000-8000-0000000000a1" : "00000000-0000-4000-8000-0000000000a2",
  user_id: "u-1",
  is_general: false,
  is_preset: false,
  personas: personas ? (panel as Audience).personas : [],
});

describe("the goal is the app's own primary_goal set", () => {
  it("GOALS is exactly that set, so it is stored as is", () => {
    expect([...GOALS]).toEqual(APP_GOALS);
  });
});

describe("profileWriteOf", () => {
  it("a new profile: the niche, the goal as is, the platforms, the handle, the box's consent, onboarding done now", () => {
    expect(profileWriteOf("u-1", TIKTOK, null, true, NOW)).toEqual({
      user_id: "u-1",
      onboarding_step: "completed",
      onboarding_completed_at: NOW,
      email_consent: true,
      niche: "budget meals for students",
      niche_source: "typed",
      primary_goal: "growth",
      target_platforms: ["tiktok"],
      tiktok_handle: "niacooks",
    });
  });

  it("the box left unticked: no consent", () => {
    expect(profileWriteOf("u-1", TIKTOK, null, false, NOW).email_consent).toBe(false);
  });

  it("'work it out': no niche yet, its source 'account'", () => {
    const write = profileWriteOf("u-1", FROM_ACCOUNT, null, false, NOW);
    expect(write.niche).toBeNull();
    expect(write.niche_source).toBe("account");
    expect(write.target_platforms).toEqual(["tiktok", "instagram"]);
    expect(write.primary_goal).toBe("engagement");
  });

  it.each(["growth", "engagement", "brand_deals", "conversion"] as const)("%s is written as is", (goal) => {
    expect(profileWriteOf("u-1", { ...TIKTOK, goal }, null, false, NOW).primary_goal).toBe(goal);
  });

  it("a profile with its own values keeps them, its handle, its date and its consent", () => {
    const write = profileWriteOf("u-1", INSTAGRAM, KEPT, false, NOW);
    expect(write).toEqual({
      user_id: "u-1",
      onboarding_step: "completed",
      onboarding_completed_at: KEPT.onboarding_completed_at,
      email_consent: true,
      instagram_handle: "nia.cooks",
    });
  });

  it("an empty platforms list counts as empty", () => {
    expect(profileWriteOf("u-1", TIKTOK, { ...KEPT, target_platforms: [] }, false, NOW).target_platforms).toEqual(["tiktok"]);
  });
});

describe("hasPlanOf", () => {
  it("a plan is any tier but free", () => {
    expect(hasPlanOf(null)).toBe(false);
    expect(hasPlanOf({})).toBe(false);
    expect(hasPlanOf({ virtuna_tier: "free" })).toBe(false);
    expect(hasPlanOf({ virtuna_tier: "starter" })).toBe(true);
  });
});

describe("hasCalibratedAudience", () => {
  it("the virtual rows are no audience, though two templates carry personas (the 2026-08-04 bug)", () => {
    expect(panel).toBeDefined();
    expect(hasCalibratedAudience([GENERAL_AUDIENCE, ...PRESET_AUDIENCES, ...GENERAL_TEMPLATES])).toBe(false);
  });
  it("an own row with personas is one; a draft without is not", () => {
    expect(hasCalibratedAudience([GENERAL_AUDIENCE, own(true)])).toBe(true);
    expect(hasCalibratedAudience([GENERAL_AUDIENCE, own(false)])).toBe(false);
  });
});

describe("firstBuildRequestOf and afterSaveOf", () => {
  it("a TikTok handle: their own account read", () => {
    expect(firstBuildRequestOf(TIKTOK)).toEqual({ handle: "niacooks", type: "personal", platform: "tiktok", goalIntent: "grow", name: "@niacooks" });
    expect(firstBuildRequestOf(FROM_ACCOUNT)).toMatchObject({ handle: "niacooks", type: "personal" });
  });

  it("no TikTok handle: an audience described by their niche words", () => {
    expect(firstBuildRequestOf(INSTAGRAM)).toEqual({
      description: "budget meals for students",
      type: "target",
      platform: "custom",
      goalIntent: "grow",
      name: "budget meals for students",
    });
  });

  it("with a plan: the app, no build", () => {
    expect(afterSaveOf({ hasPlan: true, hasAudience: false, answers: TIKTOK })).toEqual({ next: "/home", build: null });
  });

  it("with an audience: their audience, guided, no build", () => {
    expect(afterSaveOf({ hasPlan: false, hasAudience: true, answers: TIKTOK })).toEqual({ next: "/audience?guide=1", build: null });
  });

  it("else: the building screen, guided, with the first build", () => {
    expect(afterSaveOf({ hasPlan: false, hasAudience: false, answers: INSTAGRAM })).toEqual({
      next: "/audience/new?guide=1",
      build: firstBuildRequestOf(INSTAGRAM),
    });
  });
});
