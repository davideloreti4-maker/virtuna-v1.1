/**
 * A creator with none of the five facts of You gets, byte for byte, the bundle they got before the
 * writers learned to read them (plan 2026-11-24-you, Task 8), flag on or flag off.
 *
 * The snapshot was recorded BEFORE `profile-role-map.ts`, `assembler.ts`, `grounding-line.ts` and
 * `chat-runner.ts` were touched: every bundle below, built by the code of that day, as its length and
 * sha256, plus each row's three thin checks and the ideas card line. If it fails, a writer's prompt
 * changed for a creator who never filled You in: fix the code. Never update this snapshot with `-u`.
 *
 * Rows and inputs live in `you-facts.fixtures.ts` (shared with the invariant test, values unchanged).
 * Rows are the shapes the live `creator_profiles` table hands back (`select("*")`): the five columns
 * exist there and are all empty. Inputs are the shapes the routes send, including the largest each
 * lets through (ask 2,000, anchor 5,000) and the plain chat's 20-turn history: those overflow the
 * cap, so they are the cases that catch a cap raised for everyone.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { INPUTS, LONG_HISTORY, MODES, ROWS } from "./you-facts.fixtures";

const digest = (s: string) => `${s.length} ${createHash("sha256").update(s).digest("hex")}`;

// The recorded snapshot's entries are keyed by these two titles. Vitest writes a missing entry
// anew without failing (outside CI), so the last test below reads the file and holds its entries.
const SUITE = "a creator with none of the five facts: the writers' prompts as before";
const RECORDED = "flag off: every bundle, thin check and card line is the one recorded before Task 8";
/** Two entries, both from RECORDED: the bundles, then the checks. */
const ENTRIES = [`${SUITE} > ${RECORDED} 1`, `${SUITE} > ${RECORDED} 2`];

async function build(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  const { assembleBundle } = await import("../assembler");
  const { buildGroundingLine, isThin } = await import("../grounding-line");
  const { isColdStart } = await import("@/lib/tools/runners/chat-runner");

  const bundles: Record<string, string> = {};
  const checks: Record<string, unknown> = {};
  for (const [rowName, row] of Object.entries(ROWS)) {
    for (const mode of MODES) {
      for (const [inputName, input] of Object.entries(INPUTS)) {
        bundles[`${rowName} · ${mode} · ${inputName}`] = assembleBundle({ ...input, mode }, row);
      }
    }
    checks[rowName] = {
      chatColdStart: isColdStart(row),
      ideasThin: isThin(row),
      ideasCardLine: buildGroundingLine(row, "tiktok"),
    };
  }
  vi.doUnmock("@/lib/flags/new-look");
  return { bundles, checks };
}

describe(SUITE, () => {
  it(RECORDED, async () => {
    const { bundles, checks } = await build(false);
    expect(Object.fromEntries(Object.entries(bundles).map(([k, v]) => [k, digest(v)]))).toMatchSnapshot();
    expect(checks).toMatchSnapshot();
  });

  it("flag on: the same, character for character", async () => {
    const off = await build(false);
    const on = await build(true);
    expect(Object.keys(on.bundles)).toHaveLength(Object.keys(ROWS).length * MODES.length * Object.keys(INPUTS).length);
    for (const key of Object.keys(off.bundles)) expect(on.bundles[key], key).toBe(off.bundles[key]);
    expect(on.checks).toEqual(off.checks);
  });

  it("the inputs reach every path of the cap: some fit whole, some shed profile lines, some overflow to the fenced rebuild", async () => {
    // Without this a fixture drift could leave every case comfortably under the cap and the
    // snapshot above would prove nothing about the shedding steps.
    const { bundles } = await build(false);
    const full = (mode: string, input: string) => bundles[`a full row · ${mode} · ${input}`]!;
    expect(full("hooks", "the worst grounded run")).toContain("Grounded examples");
    expect(full("hooks", "a long ask that sheds profile lines")).toContain("Niche: ");
    expect(full("hooks", "a long ask that sheds profile lines")).not.toContain("Target platform: ");
    expect(full("chat", "a 20-turn chat history")).not.toContain("### Creator Profile");
    expect(full("script", "the largest a route lets through")).not.toContain("### Creator Profile");
    expect(LONG_HISTORY.length).toBeGreaterThan(6000);
  });

  it("the recorded snapshot holds exactly its two entries: none missing, so none can be written anew unnoticed", () => {
    const snap = readFileSync(join(__dirname, "__snapshots__", "you-facts.unchanged.test.ts.snap"), "utf8");
    const entries = [...snap.matchAll(/^exports\[`(.*)`\] = /gm)].map((m) => m[1]);
    expect(entries).toHaveLength(2);
    expect(entries).toEqual(ENTRIES);
  });
});
