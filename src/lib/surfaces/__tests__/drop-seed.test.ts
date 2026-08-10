import { describe, it, expect } from "vitest";
import { dropCardToRemixBlocks, dropUserTurnText } from "../drop-seed";
import { RemixCardBlockSchema } from "@/lib/tools/blocks";
import type { LiveDropCard } from "../live-cards";
import type { AdaptConcept } from "@/lib/engine/remix/decode-types";

const concepts: AdaptConcept[] = [
  {
    hook: "Strong adapted hook",
    angle: "angle one",
    who_its_for: "who one",
    format_borrowed: "format one",
    personaStops: 8,
    stopQuote: "wait, that's me",
    production: { shots: "s", onScreenText: "o", setup: "g" },
  },
  {
    hook: "Mid adapted hook",
    angle: "angle two",
    who_its_for: "who two",
    format_borrowed: "format two",
    personaStops: 5,
    stopQuote: "hm, tell me more",
  },
  {
    hook: "Weak adapted hook",
    angle: "angle three",
    who_its_for: "who three",
    format_borrowed: "format three",
    personaStops: 2,
    stopQuote: "one more scroll",
  },
];

const card: LiveDropCard = {
  contentId: "t1",
  hook: "Strong adapted hook",
  coverUrl: "https://x.supabase.co/storage/v1/object/public/covers/c.jpg",
  videoUrl: "https://tiktok.example/v/1",
  views: "5.3M",
  viewsRaw: 5_300_000,
  handle: "conor_harris_",
  archetype: "trap-mistake",
  hookTemplate: "If you have [problem], don't just [fix].",
  concepts,
  personas: [{ archetype: "a", verdict: "stop", quote: "real" }],
};

describe("dropCardToRemixBlocks", () => {
  it("emits one validated remix-card per concept, winner leading, provenance projected", () => {
    const blocks = dropCardToRemixBlocks(card, null);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]!.props.adaptedHook).toBe("Strong adapted hook");
    expect(blocks[1]!.props.adaptedHook).toBe("Mid adapted hook");
    for (const b of blocks) {
      expect(RemixCardBlockSchema.safeParse(b).success).toBe(true);
      expect(b.props.provenance).toBe("projected");
      expect(b.props.model).toBe("sim1-flash");
      expect(b.props.sourceDecode).toBeUndefined(); // never fabricated
      expect(b.props.personas).toBeUndefined(); // angles arrive UNSCORED (v8 rule)
      expect(b.props.population).toBeUndefined();
    }
  });

  it("receipt: @handle, real views, madlib, archetype — multiplier/baseline/fit ALWAYS null", () => {
    const p = dropCardToRemixBlocks(card, null)[0]!.props.proof!;
    expect(p.handle).toBe("@conor_harris_");
    expect(p.videoUrl).toBe("https://tiktok.example/v/1");
    expect(p.coverUrl).toBe(card.coverUrl);
    expect(p.views).toBe(5_300_000);
    expect(p.hookTemplate).toBe("If you have [problem], don't just [fix].");
    expect(p.archetype).toBe("trap-mistake");
    expect(p.multiplier).toBeNull();
    expect(p.baselineLabel).toBeNull();
    expect(p.fitLabel).toBeNull();
  });

  it("keeps an already-@-prefixed handle un-doubled", () => {
    const p = dropCardToRemixBlocks({ ...card, handle: "@already" }, null)[0]!.props.proof!;
    expect(p.handle).toBe("@already");
  });

  it("band/fraction derive from each concept's own projection", () => {
    const blocks = dropCardToRemixBlocks(card, null);
    expect(blocks[0]!.props.fraction).toBe("8/10 stop");
    expect(blocks[0]!.props.band).toBe("Strong");
    expect(blocks[2]!.props.fraction).toBe("2/10 stop");
    expect(blocks[2]!.props.band).toBe("Weak");
  });

  it("carries the concept's production block when present, omits when absent", () => {
    const blocks = dropCardToRemixBlocks(card, null);
    expect(blocks[0]!.props.production).toEqual({ shots: "s", onScreenText: "o", setup: "g" });
    expect(blocks[1]!.props.production).toBeUndefined();
  });

  it("keeps a concept whose stopQuote is empty or missing — quote-less, never dropped", () => {
    // stopQuote is OPTIONAL in AdaptConcept by design; a missing quote must not delete the
    // angle from the seeded stack (the 2026-08-09 handoff's Phase-3 finding, fixed here).
    const withEmpty = {
      ...card,
      concepts: [
        concepts[0]!,
        { ...concepts[1]!, stopQuote: "  " },
        { ...concepts[2]!, stopQuote: undefined },
      ],
    };
    const blocks = dropCardToRemixBlocks(withEmpty, null);
    expect(blocks).toHaveLength(3);
    expect(blocks[1]!.props.scrollQuote).toBe("");
    expect(blocks[2]!.props.scrollQuote).toBe("");
  });

  it("stamps audienceName only when calibrated", () => {
    expect(dropCardToRemixBlocks(card, "Your people")[0]!.props.audienceName).toBe("Your people");
    expect(dropCardToRemixBlocks(card, null)[0]!.props.audienceName).toBeUndefined();
  });

  it("user turn text carries the adapted hook, not the donor's data", () => {
    const text = dropUserTurnText(card);
    expect(text).toContain("Strong adapted hook");
    expect(text).not.toContain("conor_harris_");
  });
});
