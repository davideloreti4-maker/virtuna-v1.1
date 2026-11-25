import { describe, expect, it } from "vitest";
import { partsOf, hasResultCard, RESULT_TYPES } from "@/lib/thread-next/answer-parts";
import {
  accountRead,
  broughtCard,
  composed,
  corpus,
  hook,
  idea,
  inputRequest,
  md,
  outlierGrid,
  personaChatTurn,
  remix,
  runHeader,
  script,
  video,
} from "@/components/thread-next/__tests__/fixtures/answers";

describe("partsOf", () => {
  it("groups a run of hook cards into one pack and keeps original indices", () => {
    const blocks = [runHeader("hooks"), hook("A"), hook("B"), hook("C"), md("Hook #1 wins by a mile.", "chat-agent")];
    const parts = partsOf(blocks);
    expect(parts).toHaveLength(1);
    expect(parts[0]?.kind).toBe("hooks");
    expect(parts[0]?.kind === "hooks" && parts[0].items.map((i) => i.index)).toEqual([1, 2, 3]);
  });
  it("drops narration markdown in a turn with a result card, live (no origin) or persisted", () => {
    expect(partsOf([md("On it, generating a few angles"), hook("A"), md("The first one lands best.")]).map((p) => p.kind)).toEqual(["hooks"]);
  });
  it("keeps a plain chat answer and its sources", () => {
    expect(partsOf([md("The contrast opens a gap."), corpus()]).map((p) => p.kind)).toEqual(["text", "fallback"]);
  });
  it("two runs separated by prose are two packs", () => {
    expect(partsOf([hook("A"), hook("B"), md("And five more:"), hook("C")]).map((p) => p.kind)).toEqual(["hooks", "hooks"]);
  });
  it("interactive blocks stay legacy; others fall back", () => {
    expect(partsOf([inputRequest(), composed()]).map((p) => p.kind)).toEqual(["legacy", "fallback"]);
    expect(hasResultCard([inputRequest(), md("x")])).toBe(false);
  });
  it("a run of remix cards is one part", () => {
    const p = partsOf([remix("x"), remix("y"), remix("z")]);
    expect(p).toHaveLength(1);
    expect(p[0]?.kind === "remix" && p[0].items).toHaveLength(3);
  });
  it("an ideas pack is one part", () => {
    expect(partsOf([idea("T1"), idea("T2"), idea("T3"), idea("T4")])).toHaveLength(1);
  });

  // ── beyond the core cases ──

  it("carries the block itself and its original index on every part", () => {
    const blocks = [runHeader("script"), md("Here it is."), script(), md("Shoot it today.")];
    const parts = partsOf(blocks);
    expect(parts).toHaveLength(1);
    const p = parts[0];
    expect(p?.kind).toBe("script");
    if (p?.kind !== "script") throw new Error("expected a script part");
    expect(p.item.index).toBe(2);
    expect(p.item.block.type).toBe("script-card");
    expect(p.item.block.props.beats.length).toBeGreaterThan(0);
  });

  it("a video card is its own part", () => {
    const parts = partsOf([runHeader("test"), video("vid-fixture-1"), md("Half leave early.")]);
    expect(parts).toHaveLength(1);
    const p = parts[0];
    if (p?.kind !== "video") throw new Error("expected a video part");
    expect(p.item.index).toBe(1);
    expect(p.item.block.props.analysisId).toBe("vid-fixture-1");
  });

  it("a different card type in between closes a run", () => {
    expect(partsOf([hook("A"), idea("T"), hook("B")]).map((p) => p.kind)).toEqual(["hooks", "ideas", "hooks"]);
  });

  it("a run-header in between closes a run but yields nothing", () => {
    const parts = partsOf([hook("A"), runHeader("hooks"), hook("B")]);
    expect(parts.map((p) => p.kind)).toEqual(["hooks", "hooks"]);
    expect(parts.map((p) => (p.kind === "hooks" ? p.items.map((i) => i.index) : []))).toEqual([[0], [2]]);
  });

  it("an invalid block becomes an unknown fallback at its own index and closes a run", () => {
    const broken = { type: "hook-card", props: { hookLine: "missing everything else" } };
    const parts = partsOf([hook("A"), broken, hook("B")]);
    expect(parts.map((p) => p.kind)).toEqual(["hooks", "fallback", "hooks"]);
    expect(parts[1]).toEqual({ kind: "fallback", index: 1, block: { type: "unknown", props: {} } });
  });

  it("garbage entries fall back as unknown, never throw", () => {
    const parts = partsOf([null, 42, "text", { type: 7 }, { type: "no-such-block", props: {} }]);
    expect(parts.map((p) => (p.kind === "fallback" ? p.block.type : p.kind))).toEqual([
      "unknown",
      "unknown",
      "unknown",
      "unknown",
      "unknown",
    ]);
    expect(parts.map((p) => (p.kind === "fallback" ? p.index : -1))).toEqual([0, 1, 2, 3, 4]);
  });

  it("an outlier grid is legacy and carries the validated block", () => {
    const grid = outlierGrid();
    const parts = partsOf([md("Found these."), grid]);
    expect(parts.map((p) => p.kind)).toEqual(["legacy"]);
    expect(parts[0]).toEqual({ kind: "legacy", index: 1, block: grid });
  });

  it("an input request alone keeps its markdown (it is not a result card)", () => {
    const parts = partsOf([md("Paste the link and I will adapt it.", "chat-agent"), inputRequest()]);
    expect(parts.map((p) => p.kind)).toEqual(["text", "legacy"]);
    expect(parts[0]).toEqual({ kind: "text", index: 0, text: "Paste the link and I will adapt it." });
  });

  it("other result cards fall back with their own type and drop the narration", () => {
    const parts = partsOf([md("Here is your read."), accountRead(), md("Want ideas next?")]);
    expect(parts).toHaveLength(1);
    const p = parts[0];
    if (p?.kind !== "fallback") throw new Error("expected a fallback part");
    expect(p.index).toBe(1);
    expect(p.block.type).toBe("account-read");
  });

  it("a persona chat turn does not make a result card", () => {
    expect(partsOf([md("They said:"), personaChatTurn()]).map((p) => p.kind)).toEqual(["text", "fallback"]);
  });

  it("Sources blocks in a row become ONE Sources card, without repeats; a visible part between keeps them apart", () => {
    const a = corpus();
    const b = corpus({ sources: [a.props.sources[1]!, { ...a.props.sources[0]!, handle: "new.one", views: 9000 }] });
    const parts = partsOf([a, md("narration", "chat-agent"), b, composed()]);
    expect(parts.map((p) => p.kind)).toEqual(["fallback", "fallback"]);
    const merged = (parts[0] as Extract<(typeof parts)[number], { kind: "fallback" }>).block as typeof a;
    expect(merged.type).toBe("corpus-references");
    expect(merged.props.sources.map((s) => s.handle)).toEqual(["dij.arc", "lacapture", "nia.tests", "new.one"]);

    const apart = partsOf([a, md("Shown text"), b]);
    expect(apart.map((p) => p.kind)).toEqual(["fallback", "text", "fallback"]);
  });

  it("a repeat is the same video: two videos of one creator with no views both stay", () => {
    const base = corpus().props.sources[0]!;
    const a = corpus({ sources: [{ ...base, handle: "x", views: null, videoUrl: "https://v/1" }] });
    const b = corpus({ sources: [{ ...base, handle: "x", views: null, videoUrl: "https://v/2" }] });
    const [part] = partsOf([a, b]);
    expect(((part as { block: typeof a }).block).props.sources.map((s) => s.videoUrl)).toEqual(["https://v/1", "https://v/2"]);
  });

  it("an empty turn has no parts", () => {
    expect(partsOf([])).toEqual([]);
  });
});

describe("hasResultCard", () => {
  it("is true for each result card type", () => {
    for (const b of [hook("A"), idea("T"), script(), remix("x"), video("vid-fixture-1"), composed(), outlierGrid(), accountRead(), broughtCard()]) {
      expect(hasResultCard([md("x"), b])).toBe(true);
    }
  });
  it("is false for prose, sources, persona turns, input requests and run headers", () => {
    expect(hasResultCard([md("x"), corpus(), personaChatTurn(), inputRequest(), runHeader("chat")])).toBe(false);
    expect(hasResultCard([])).toBe(false);
  });
  it("lists exactly the drawn result types", () => {
    expect([...RESULT_TYPES].sort()).toEqual(
      [
        "hook-card",
        "idea-card",
        "script-card",
        "remix-card",
        "video-test-card",
        "edit",
        "composed-card",
        "outlier-grid",
        "account-read",
        "profile-read",
        "multi-audience-read",
        "brought-card",
        "reaction-distribution",
        "prediction-gauge",
        "band",
        "personas",
      ].sort(),
    );
  });
});
