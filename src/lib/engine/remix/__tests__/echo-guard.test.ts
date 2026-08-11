import { describe, it, expect } from "vitest";
import { sharedContentTokens } from "../echo-guard";

describe("sharedContentTokens", () => {
  it("finds no overlap between two lines on different topics", () => {
    expect(sharedContentTokens(
      "Your protein shake is making you fatter",
      "Your onboarding flow is losing you signups",
    )).toEqual([]);
  });

  it("ignores stopwords entirely", () => {
    // Only stopwords are shared here.
    expect(sharedContentTokens(
      "the and of a to is",
      "the and of a to is",
    )).toEqual([]);
  });

  it("catches a topical echo", () => {
    const shared = sharedContentTokens(
      "I tested creatine on 40 lifters",
      "I tested creatine with 40 athletes",
    );
    expect(shared).toContain("creatine");
    expect(shared).toContain("tested");
  });

  it("is case and punctuation insensitive", () => {
    expect(sharedContentTokens("Creatine, actually!", "creatine")).toEqual(["creatine"]);
  });

  it("excludes terms the creator asked for via the brief", () => {
    const shared = sharedContentTokens(
      "creatine timing is wrong",
      "creatine timing changes everything",
      "creatine timing",
    );
    expect(shared).toEqual([]);
  });

  it("treats an empty or null-ish input as no overlap", () => {
    expect(sharedContentTokens("", "anything")).toEqual([]);
    expect(sharedContentTokens("anything", "")).toEqual([]);
  });
});
