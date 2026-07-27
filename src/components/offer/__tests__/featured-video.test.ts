import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VideoTestCardBlockSchema } from "@/lib/tools/blocks";
import { FEATURED_VIDEO } from "../featured-video";
import { FEATURED_ROOM_TEMPLATE } from "../featured-room-template";
import { TEST_CARD_FIXTURE } from "../test-card-fixture";

/**
 * The /go page is attributed to ONE real clip, and the owner swaps that clip by replacing the
 * files under `public/offer/featured/` and editing `featured-video.ts`. These assertions are
 * the swap's safety net: a missing frame, an inconsistent drop label or an outcome that no
 * longer reads as an improvement fails here instead of shipping a broken filmstrip to the one
 * page that has to convert.
 */

const publicPath = (url: string) => join(process.cwd(), "public", url.replace(/^\//, ""));

describe("featured video — the /go page's one clip", () => {
  it("composes a Test card that satisfies the strict block schema", () => {
    // `.strict()` — this also catches a field smuggled in from Simulation (a retention %, a
    // "would stop" fraction), which belongs to the room and never to the craft card.
    expect(() => VideoTestCardBlockSchema.parse(TEST_CARD_FIXTURE)).not.toThrow();
  });

  it("ships every frame it references", () => {
    const referenced = [
      FEATURED_VIDEO.cover,
      ...FEATURED_VIDEO.beats.map((b) => b.still),
      ...TEST_CARD_FIXTURE.props.filmstrip.map((f) => f.keyframeUrl),
      ...TEST_CARD_FIXTURE.props.fixes.map((f) => f.keyframeUrl),
    ].filter((u): u is string => typeof u === "string");

    const missing = referenced.filter((url) => !existsSync(publicPath(url)));
    expect(missing).toEqual([]);
  });

  it("labels the drop at a beat it actually marked weak", () => {
    const { dropLabel } = FEATURED_VIDEO;
    const weakBeats = FEATURED_VIDEO.beats.filter((b) => b.mark === "weak");
    expect(weakBeats.length).toBeGreaterThan(0);

    // "0:12 drop" → 12_000ms must be one of the marked beats, or the timeline points the
    // visitor at a frame the card never flagged.
    const [mm, ss] = dropLabel.split(" ")[0]!.split(":").map(Number);
    const dropMs = (mm! * 60 + ss!) * 1000;
    expect(weakBeats.map((b) => b.atMs)).toContain(dropMs);
  });

  it("keeps every beat inside the stated runtime, in cut order", () => {
    const [mm, ss] = FEATURED_VIDEO.durationLabel.split(":").map(Number);
    const durationMs = (mm! * 60 + ss!) * 1000;

    const times = FEATURED_VIDEO.beats.map((b) => b.atMs);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(Math.max(...times)).toBeLessThanOrEqual(durationMs);
  });

  it("carries an outcome that reads as an improvement", () => {
    const { viewsBefore, viewsAfter } = FEATURED_VIDEO.outcome;
    expect(viewsBefore).toBeGreaterThan(0);
    expect(viewsAfter).toBeGreaterThan(viewsBefore);
  });

  it("carries none of the retired fixture's video into the room read", () => {
    // FEATURED_ROOM_TEMPLATE inherits from CREATOR_TEMPLATE, which narrates a DIFFERENT video
    // in detail. Two rounds of this leaked in review — the brain page still said "the $400
    // stake holds half" under a business Q&A, and the audience page still clustered in
    // "builders". Inheritance is the right call, but it silently carries prose, so pin it.
    const prose = JSON.stringify(FEATURED_ROOM_TEMPLATE);
    for (const ghost of ["$400", "9-5", "builders", "month one"]) {
      expect(prose).not.toContain(ghost);
    }
  });

  it("threads the audience's coded reason to a brain moment that exists", () => {
    // `thread.toMoment` is matched by STRING against the brain's moment to jump tabs and flash
    // the beat. A stale value doesn't throw — it just silently stops working.
    const moment = FEATURED_ROOM_TEMPLATE.brain?.whyThisSecond?.moment;
    expect(moment).toBeTruthy();

    const threaded = (FEATURED_ROOM_TEMPLATE.population?.voices?.reasons ?? [])
      .map((r) => (r as { thread?: { toMoment?: string } }).thread?.toMoment)
      .filter(Boolean);

    expect(threaded.length).toBeGreaterThan(0);
    for (const target of threaded) expect(target).toBe(moment);
  });

  it("attaches no fabricated corpus receipt to a fix", () => {
    // Honest absence is contractual: a fix without a real corpus match shows no receipt. The
    // retired fixture attached invented multipliers to named third-party TikTok accounts.
    for (const fix of TEST_CARD_FIXTURE.props.fixes) {
      expect(fix.proof).toBeNull();
    }
  });
});
