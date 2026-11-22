import { describe, expect, it } from "vitest";
import { validateBlock } from "@/lib/tools/block-registry";
import { readSimSeals } from "@/lib/threads/sim-seals";
import {
  IDEAS_4,
  MEAL_PREP_HOOKS,
  REMIX_CAMERA,
  SCRIPT_AI,
  SEALS_DONE,
  accountRead,
  broughtCard,
  composed,
  corpus,
  hook,
  idea,
  inputRequest,
  md,
  multiAudienceRead,
  outlierGrid,
  personaChatTurn,
  population,
  predictionGauge,
  profileRead,
  reactionDistribution,
  remix,
  runHeader,
  script,
  video,
} from "./answers";

// Every fixture is a block the real registry accepts, so a test built on them exercises the
// renderer's real input, not a shape the server could never send.
const BUILT: Array<[string, unknown]> = [
  ["hook", hook("A hook")],
  ["idea", idea("An idea")],
  ["idea with angle", idea("An idea", "An angle")],
  ["script", script()],
  ["script with beats", script([{ content: "Open.", timing: "0–3s" }, { content: "Close.", timing: "3–6s", label: "CTA" }])],
  ["remix", remix("An adapted hook")],
  ["remix with proof", remix("An adapted hook", { proof: REMIX_CAMERA.props.proof })],
  ["video", video("vid-fixture-1")],
  ["md", md("Some prose.")],
  ["md with origin", md("Some prose.", "chat-agent")],
  ["runHeader", runHeader("hooks")],
  ["runHeader with audience", runHeader("hooks", "@nia.tests")],
  ["corpus", corpus()],
  ["inputRequest", inputRequest()],
  ["composed", composed()],
  ["outlierGrid", outlierGrid()],
  ["accountRead", accountRead()],
  ["accountRead thin", accountRead({ fallback: "thin", patterns: undefined, profile: undefined })],
  ["profileRead", profileRead()],
  ["multiAudienceRead", multiAudienceRead()],
  ["reactionDistribution person", reactionDistribution("person")],
  ["reactionDistribution panel", reactionDistribution("panel")],
  ["predictionGauge", predictionGauge()],
  ["personaChatTurn", personaChatTurn()],
  ["broughtCard", broughtCard()],
  ...MEAL_PREP_HOOKS.map((b, i): [string, unknown] => [`MEAL_PREP_HOOKS[${i}]`, b]),
  ...IDEAS_4.map((b, i): [string, unknown] => [`IDEAS_4[${i}]`, b]),
  ["SCRIPT_AI", SCRIPT_AI],
  ["REMIX_CAMERA", REMIX_CAMERA],
];

describe("fixtures", () => {
  it.each(BUILT)("%s passes validateBlock", (_name, block) => {
    expect(validateBlock(block).ok).toBe(true);
  });

  it("validation keeps every prop the builders set (nothing stripped)", () => {
    for (const [, block] of BUILT) {
      const v = validateBlock(block);
      if (!v.ok) throw new Error("invalid fixture");
      expect(JSON.parse(JSON.stringify(v.block))).toEqual(JSON.parse(JSON.stringify(block)));
    }
  });

  it("the drawing's packs carry the drawing's content", () => {
    expect(MEAL_PREP_HOOKS).toHaveLength(3);
    expect(MEAL_PREP_HOOKS[0]?.props.hookLine).toMatch(/^I spent \$40 on meal prep/);
    expect(MEAL_PREP_HOOKS[0]?.props.proof?.handle).toBe("dij.arc");
    expect(MEAL_PREP_HOOKS[0]?.props.visualHook?.onScreen).toBeTruthy();
    expect(IDEAS_4.map((b) => b.props.title)).toHaveLength(4);
    expect(SCRIPT_AI.props.beats.map((b) => b.timing)).toEqual(["0–3s", "3–8s", "8–14s", "14–20s", "20–24s"]);
    expect(SCRIPT_AI.props.openingBeatSeed).toBe(SCRIPT_AI.props.beats[0]?.content);
    expect(REMIX_CAMERA.props.formatBorrowed).toBe("Visual Hook → Concept → Tools → Footage");
    expect(REMIX_CAMERA.props.proof).toMatchObject({ handle: "lacapture", views: 154000, multiplier: 10.4, baselineLabel: "their average" });
  });

  it("SEALS_DONE is a seal store the real reader keeps whole, keyed by each hook's text", () => {
    const read = readSimSeals({ sim_seals: SEALS_DONE as never });
    expect(Object.keys(read)).toEqual(MEAL_PREP_HOOKS.map((b) => b.props.hookLine.trim()));
    expect(Object.values(read).map((s) => s.population?.stopPct)).toEqual([30, 22, 45]);
    expect(Object.values(read).every((s) => s.pct === 70)).toBe(true);
  });

  it("population(stopPct) is internally consistent", () => {
    const p = population(29.6);
    expect(p.stopPct).toBe(29.6);
    expect(p.stop + p.scroll).toBe(p.total);
    expect(p.stop).toBe(296);
  });

  it("contains no colour literals and no absolute links", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(__dirname, "answers.ts"), "utf8");
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(/);
    expect(src).not.toMatch(/https?:\/\//);
  });
});
