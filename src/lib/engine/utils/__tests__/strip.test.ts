/**
 * stripModelOutput — robustness for the wrapper variants real Qwen models emit.
 *
 * Load-bearing for deepseek.ts (Apollo) AND fold.ts (runFold, wired 2026-06-11 to fix the
 * latent bare-JSON.parse bug). The fold-audio-ab harness proved qwen3.5-omni-flash emits
 * inconsistent wrappers: full ```json fences one run, a STRAY TRAILING ``` (no opener) the
 * next, sometimes trailing prose. Each must reduce to the clean balanced JSON object.
 */
import { describe, it, expect } from "vitest";
import { stripModelOutput } from "../strip";

const OBJ = '{"personas":[{"a":1}],"ok":true}';

describe("stripModelOutput — JSON wrapper variants", () => {
  it("passes clean JSON through unchanged (omni-plus path — no-op)", () => {
    expect(stripModelOutput(OBJ)).toBe(OBJ);
    expect(() => JSON.parse(stripModelOutput(OBJ))).not.toThrow();
  });

  it("strips a full ```json … ``` fence (omni-flash variant A)", () => {
    const wrapped = "```json\n" + OBJ + "\n```";
    expect(JSON.parse(stripModelOutput(wrapped))).toEqual(JSON.parse(OBJ));
  });

  it("salvages a STRAY TRAILING ``` with no opening fence (omni-flash variant B — the prod crash)", () => {
    const wrapped = OBJ + "\n```";
    // bare JSON.parse on this throws — the exact runFold failure before the fix
    expect(() => JSON.parse(wrapped)).toThrow();
    expect(JSON.parse(stripModelOutput(wrapped))).toEqual(JSON.parse(OBJ));
  });

  it("discards trailing prose after a complete JSON object", () => {
    const wrapped = OBJ + "\n\nHope this helps!";
    expect(JSON.parse(stripModelOutput(wrapped))).toEqual(JSON.parse(OBJ));
  });

  it("strips a <think> block then the fence (Qwen thinking-mode)", () => {
    const wrapped = "<think>reasoning here</think>\n```json\n" + OBJ + "\n```";
    expect(JSON.parse(stripModelOutput(wrapped))).toEqual(JSON.parse(OBJ));
  });

  it("handles leading prose + fence together", () => {
    const wrapped = "Here is the result:\n```json\n" + OBJ + "\n```";
    expect(JSON.parse(stripModelOutput(wrapped))).toEqual(JSON.parse(OBJ));
  });
});
