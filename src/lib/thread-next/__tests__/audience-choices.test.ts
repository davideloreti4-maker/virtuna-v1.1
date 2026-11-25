import { describe, expect, it } from "vitest";

import type { Audience } from "@/lib/audience/audience-types";
import { audienceChoices, estimateNote } from "@/lib/thread-next/audience-choices";

/** One complete audience; each fixture spreads its own fields over it. */
const BASE: Audience = {
  id: "base",
  user_id: "u1",
  name: "Base",
  type: "target",
  mode: "socials",
  platform: "tiktok",
  goal_label: null,
  goal_intent: null,
  is_general: false,
  is_preset: false,
  source_account_id: null,
  persona_weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
  personas: [],
  profile: null,
  calibration: null,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
};
const aud = (over: Partial<Audience>): Audience => ({ ...BASE, ...over });

const NIA = aud({ id: "nia", name: "@nia", type: "personal", platform: "tiktok", source_account_id: "x" });
const GYM = aud({ id: "gym", name: "Gym people" });
const GENERAL = aud({ id: "general", name: "General", is_general: true });
const GROWTH = aud({ id: "preset-growth", name: "Growth Audience", is_preset: true });
const CONVERSION = aud({ id: "preset-conversion", name: "Conversion Audience", is_preset: true });

const names = (rows: ReturnType<typeof audienceChoices>) => rows.map((r) => r.audience.name);
const selected = (rows: ReturnType<typeof audienceChoices>) => rows.map((r) => r.selected);

describe("audienceChoices", () => {
  it("lists the creator's own audiences first, in list order, and leaves the shipped ones out", () => {
    const rows = audienceChoices([NIA, GYM, GENERAL, GROWTH], "nia");
    expect(names(rows)).toEqual(["@nia", "Gym people"]);
    expect(selected(rows)).toEqual([true, false]);
  });

  it("without an own audience, lists General and every preset, General in use when nothing is picked", () => {
    const rows = audienceChoices([GENERAL, GROWTH, CONVERSION], null);
    expect(names(rows)).toEqual(["General", "Growth Audience", "Conversion Audience"]);
    expect(selected(rows)).toEqual([true, false, false]);
  });

  it.each([null, "general"])("with own audiences and General in use (%j), adds General after them, selected", (selectedId) => {
    const rows = audienceChoices([NIA, GENERAL, GROWTH], selectedId);
    expect(names(rows)).toEqual(["@nia", "General"]);
    expect(selected(rows)).toEqual([false, true]);
  });

  it("with own audiences and a preset in use, adds that one preset after them, selected; not General", () => {
    const rows = audienceChoices([GENERAL, GROWTH, CONVERSION, NIA, GYM], "preset-conversion");
    expect(names(rows)).toEqual(["@nia", "Gym people", "Conversion Audience"]);
    expect(selected(rows)).toEqual([false, false, true]);
  });

  it("never lists an audience in general mode", () => {
    const analyst = aud({ id: "tpl-analyst", name: "Analyst panel", mode: "general", is_preset: true });
    const ownGeneralMode = aud({ id: "own-general", name: "Hiring panel", mode: "general" });
    expect(names(audienceChoices([GENERAL, GROWTH, analyst], null))).toEqual(["General", "Growth Audience"]);
    expect(names(audienceChoices([NIA, analyst, ownGeneralMode], "tpl-analyst"))).toEqual(["@nia"]);
  });

  it("says what each audience is modeled on", () => {
    const ig = aud({ id: "ig", name: "@nia.ig", platform: "instagram", source_account_id: "y" });
    const lines = (list: Audience[], id: string | null) =>
      Object.fromEntries(audienceChoices(list, id).map((r) => [r.audience.name, r.line]));
    expect(lines([NIA, ig, GYM], "nia")).toEqual({
      "@nia": "TikTok",
      "@nia.ig": "Instagram",
      "Gym people": "Described by you",
    });
    expect(lines([GENERAL, GROWTH], null)).toEqual({ General: "General viewers", "Growth Audience": "Preset" });
  });
});

describe("estimateNote", () => {
  it("says, in plain words, that a run for another platform than the audience's is an estimate", () => {
    expect(estimateNote("tiktok", "instagram")).toBe("Modeled on TikTok. On Instagram this is an estimate.");
    expect(estimateNote("instagram", "youtube")).toBe("Modeled on Instagram. On YouTube this is an estimate.");
  });

  it("says nothing when they match, or when the audience is modeled on no platform", () => {
    expect(estimateNote("tiktok", "tiktok")).toBeNull();
    expect(estimateNote(null, "instagram")).toBeNull();
  });
});
