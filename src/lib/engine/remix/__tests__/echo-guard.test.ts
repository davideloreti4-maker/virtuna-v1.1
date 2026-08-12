import { describe, it, expect } from "vitest";
import { sharedContentTokens, survivingSubjectTokens } from "../echo-guard";

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

// ---------------------------------------------------------------------------
// Contraction fragments are not content.
//
// MEASURED 2026-08-12 (spec §11): a live echo check failed on the tokens
// `years, ve, never, once`. `ve` came from BOTH lines using "we've" — tokenize()
// stripped the apostrophe before splitting, so "we've" became "we ve", `we` fell
// out as a stopword and `ve` survived as a "content token". Any two lines sharing
// a contraction collide, and the gate is "more than one shared token".
// ---------------------------------------------------------------------------

describe("sharedContentTokens — contractions", () => {
  it("does not count `ve` from a shared \"we've\"", () => {
    expect(sharedContentTokens("we've spent thousands of hours", "we've run fifty miles")).toEqual([]);
  });

  it("does not count the stem of a shared negation", () => {
    expect(sharedContentTokens("he doesn't know my name", "she doesn't care at all")).toEqual([]);
    expect(sharedContentTokens("I can't stop now", "you can't start here")).toEqual([]);
    expect(sharedContentTokens("we won't quit", "they won't stop")).toEqual([]);
  });

  it("does not count `ll` / `re` / `s` / `m` fragments", () => {
    expect(sharedContentTokens("they'll regret it", "we'll remember it")).toEqual([]);
    expect(sharedContentTokens("you're early", "they're late")).toEqual([]);
    expect(sharedContentTokens("I'm ready", "she's ready")).toEqual(["ready"]);
  });

  it("still catches a REAL topical echo carried on a contracted line", () => {
    const shared = sharedContentTokens("we've tracked creatine timing", "we've measured creatine timing");
    expect(shared).toContain("creatine");
    expect(shared).toContain("timing");
    expect(shared).not.toContain("ve");
  });
});

// ---------------------------------------------------------------------------
// Rhetorical frame is the echo this lane WANTS.
//
// echo-guard.ts's own contract: "STRUCTURAL echo (duration, cadence, beat count)
// is what we want; TOPICAL echo is the failure." The same live run flagged
// `never`, `once`, `together` and `years` — the frame of the turn beat
// ("we've done X together for N years... and he still doesn't know Y"), not its
// subject. Reproducing that frame is the product working.
// ---------------------------------------------------------------------------

describe("sharedContentTokens — rhetorical frame", () => {
  it("does not count time units or comparison adverbs as topic", () => {
    expect(sharedContentTokens(
      "in our sixteen years of friendship we've never once talked about it",
      "we've trained together for three years and he still never once asked",
    )).toEqual([]);
  });

  it("still separates the SUBJECTS of those two lines", () => {
    // Same frame, different topic — the shape the adapt call is supposed to produce.
    const shared = sharedContentTokens(
      "my best friend John forgot my birthday",
      "my gym trainer forgot my protein macros",
    );
    expect(shared).toEqual(["forgot"]);
  });
});

// ---------------------------------------------------------------------------
// survivingSubjectTokens — the gate that matches what remix is FOR.
//
// OWNER RULING 2026-08-12: "remix should copy the original video pretty much 1:1
// and just replace for the niche/request. otherwise the reason the video went
// viral doesn't retain." That is D2 in the spec, which explicitly rejected a
// narrower structure-only fidelity.
//
// `sharedContentTokens` implements spec §7 — "no adapted beat shares more than
// one content token" — which contradicts D2 outright. Measured against real
// output it failed the model for reproducing the joke's skeleton:
//
//   src : "My best friend is John.   What's his last name? I have no idea."
//   new : "My workout buddy is Mark. Where does he live?   I have no idea."
//
// That is the product working. What must NOT survive is the source's SUBJECT —
// the people, places and brands the original was about. Nothing else is leakage
// under a 1:1 doctrine.
// ---------------------------------------------------------------------------

describe("survivingSubjectTokens", () => {
  it("flags a source name that reached the adapted line", () => {
    expect(survivingSubjectTokens(
      "My best friend is Emily Rose Johnson.",
      "My gym partner is Emily and she never misses leg day.",
    )).toEqual(["emily"]);
  });

  it("passes a line whose names were properly swapped", () => {
    expect(survivingSubjectTokens(
      "My best friend is John.",
      "My workout buddy is Mark.",
    )).toEqual([]);
  });

  it("does NOT flag the shared scaffolding that 1:1 remixing depends on", () => {
    // The exact pair spec §7's gate failed. Under D2 this is a faithful remix.
    expect(survivingSubjectTokens(
      "My best friend is John. What's his last name? I have no idea.",
      "My workout buddy is Mark. Where does he live? I have no idea.",
    )).toEqual([]);
  });

  it("does not mistake a sentence-opening capital for a name", () => {
    expect(survivingSubjectTokens("Best friends forever.", "Best results ever.")).toEqual([]);
  });

  it("does not treat the pronoun I as a name", () => {
    expect(survivingSubjectTokens("I love this part.", "I hate that part.")).toEqual([]);
  });

  it("excludes names the creator asked for in the brief", () => {
    expect(survivingSubjectTokens(
      "Emily swears by creatine.",
      "Emily loads creatine every morning.",
      "Emily",
    )).toEqual([]);
  });

  it("treats an empty side as no leakage", () => {
    expect(survivingSubjectTokens("", "Emily")).toEqual([]);
    expect(survivingSubjectTokens("Emily", "")).toEqual([]);
  });
});
