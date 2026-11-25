/**
 * `asksToSell(ask, sells)`: whether a writer's ask is about selling, so the "What you sell" line may be
 * printed (the controller's ruling 15, 2026-11-24, from real runs on the writers' model: printed for
 * every ask, an idea for cooking for flatmates pitched the offer with its price). Real asks from those
 * runs; the offer is the spec's example.
 */
import { describe, expect, it } from "vitest";

import { asksToSell } from "../asks-to-sell";

const OFFER = "A 12-week budget meal plan, $19.";

describe("asksToSell", () => {
  it.each([
    ["5 hooks to sell my meal plan", true],
    ["5 hooks about cooking for flatmates", false],
    ["5 video ideas to sell my meal plan", true],
    ["5 video ideas about cooking for flatmates", false],
    ["write a script from: I fed four flatmates for $40 this week. Here is the list.", false],
    ["what should I post this week", false],
    ["", false],
  ])("%j → %s", (ask, expected) => {
    expect(asksToSell(ask, OFFER)).toBe(expected);
  });

  it("an ask that names the offer asks to sell it, without a selling word", () => {
    expect(asksToSell("ideas about my meal plan", OFFER)).toBe(true);
    expect(asksToSell("hooks for the Budget Meal plan!", OFFER)).toBe(true); // any case, any punctuation
  });

  it("naming the offer takes two consecutive words of three letters or more, not function words", () => {
    expect(asksToSell("ideas about my meal", OFFER)).toBe(false); // one word is not a name
    expect(asksToSell("a plan for my meal", OFFER)).toBe(false); // both words, not in a run
    expect(asksToSell("hooks for the week", "Coaching for the week ahead")).toBe(false); // "for the" is function words
    expect(asksToSell("12 week plans", "A 12-week budget meal plan")).toBe(false); // "12" is under three
    expect(asksToSell("ideas about my meal plan", "")).toBe(false); // nothing to name
  });

  it("a selling word counts only as a whole word", () => {
    expect(asksToSell("hooks for a counsel session", OFFER)).toBe(false);
    expect(asksToSell("hooks about resale value", OFFER)).toBe(false);
    expect(asksToSell("hooks about wholesale flour", OFFER)).toBe(false);
    expect(asksToSell("hooks about my presale", OFFER)).toBe(false);
  });

  it.each([
    "sell", "sells", "selling", "sold", "sale", "sales",
    "promote", "promotes", "promoting", "promo", "promotion",
    "launch", "launches", "launching", "pitch", "pitching", "advertise", "advertising",
    "buy", "buying", "buyers", "purchase", "purchasing", "customers", "clients",
    "sign-ups", "signups", "sign ups", "convert", "converting", "conversion", "conversions",
    "checkout", "discount", "discounting", "waitlist", "pre-order", "preorder", "preordering",
    "affiliate", "sponsor", "sponsored", "sponsoring", "sponsorship",
    "monetise", "monetize", "monetising", "monetizing", "monetisation", "monetization",
  ])("%j is a selling word, in any case", (word) => {
    expect(asksToSell(`5 hooks to ${word} it`, "")).toBe(true);
    expect(asksToSell(`5 HOOKS TO ${word.toUpperCase()} IT`, "")).toBe(true);
  });
});
