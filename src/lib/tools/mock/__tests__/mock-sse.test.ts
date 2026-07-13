/**
 * Layer 2 mock replay — the fixture→SSE-frame mapping is the logic most likely to drift, so
 * it is pinned here (pure, no DB/cookies). Guards that each streamed skill emits the exact
 * contract the client hooks parse: stage(active) → content(all blocks) → score(per scorable
 * card, band/fraction) → stage(done) → done(count). A block without a `band` (explore's grid)
 * emits NO score frame — matching the real /api/tools/explore contract.
 */
import { describe, it, expect } from "vitest";
import { buildMockFrames, type MockFrame } from "../mock-sse";
import { FIXTURE_BLOCKS_BY_SKILL } from "../fixtures";

const STREAMED = ["explore", "hooks", "ideas", "script", "remix"] as const;

function eventsOf(frames: MockFrame[]): string[] {
  return frames.map((f) => f.event);
}
function scoreFrames(frames: MockFrame[]): MockFrame[] {
  return frames.filter((f) => f.event === "score");
}

describe("buildMockFrames — SSE contract per streamed skill", () => {
  for (const skill of STREAMED) {
    const blocks = FIXTURE_BLOCKS_BY_SKILL[skill];
    const frames = buildMockFrames(blocks);

    it(`${skill}: opens with stage(active), then content carrying all blocks`, () => {
      expect(frames[0]).toEqual({
        event: "stage",
        data: { name: "Replaying mock fixture", status: "active" },
      });
      expect(frames[1]!.event).toBe("content");
      expect((frames[1]!.data as { blocks: unknown[] }).blocks).toBe(blocks);
    });

    it(`${skill}: ends with stage(done) then done(count=${blocks.length})`, () => {
      const last = frames[frames.length - 1]!;
      const penultimate = frames[frames.length - 2]!;
      expect(penultimate).toEqual({
        event: "stage",
        data: { name: "Replaying mock fixture", status: "done" },
      });
      expect(last).toEqual({ event: "done", data: { count: blocks.length } });
    });

    it(`${skill}: emits exactly one score frame per card that carries a band`, () => {
      const scorable = blocks.filter(
        (b) => typeof (b as { props?: { band?: unknown } }).props?.band === "string",
      );
      expect(scoreFrames(frames)).toHaveLength(scorable.length);
    });
  }

  it("hooks: score frames carry the seedHook + band from each fixture card (client matches by seedHook)", () => {
    const blocks = FIXTURE_BLOCKS_BY_SKILL.hooks;
    const scores = scoreFrames(buildMockFrames(blocks)).map((f) => f.data as { seedHook?: string; band?: string });
    for (const b of blocks) {
      const props = (b as { props: { seedHook: string; band: string } }).props;
      const match = scores.find((s) => s.seedHook === props.seedHook);
      expect(match, `no score frame for seedHook="${props.seedHook}"`).toBeDefined();
      expect(match!.band).toBe(props.band);
    }
  });

  it("explore: the outlier-grid carries no band, so ZERO score frames (matches the real route)", () => {
    const frames = buildMockFrames(FIXTURE_BLOCKS_BY_SKILL.explore);
    expect(scoreFrames(frames)).toHaveLength(0);
    // Contract is exactly: stage, content, stage, done — no score in between.
    expect(eventsOf(frames)).toEqual(["stage", "content", "stage", "done"]);
  });

  it("empty block set still produces a well-formed timeline (done count 0)", () => {
    const frames = buildMockFrames([]);
    expect(eventsOf(frames)).toEqual(["stage", "content", "stage", "done"]);
    expect(frames[frames.length - 1]!.data).toEqual({ count: 0 });
  });
});
