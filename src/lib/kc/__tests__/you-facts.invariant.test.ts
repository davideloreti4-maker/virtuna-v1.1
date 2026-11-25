/**
 * What a creator wrote on You rides on top of the cap and is never shed (the controller's ruling 14,
 * 2026-11-24, plan 2026-11-24-you).
 *
 * THE INVARIANT. For every mode and every input of `you-facts.fixtures.ts` (they reach every path of
 * the cap: whole, profile lines shed, the fenced rebuild), for a row that is not thin without its
 * facts: the bundle with facts, less each fact line and its joining newline, is character for
 * character the bundle of the same row with the facts null; and the bundle is exactly its cap's
 * worth longer than that, `bundleCharCap(the fact lines it prints)`, so it never passes its cap.
 * When every other profile line has been shed, the fact lines bring the profile block's header back
 * with them, so removing them removes that block too (and `bundleCharCap(…, true)` counts it).
 *
 * A row that is thin without its facts (nothing but facts) is not thin with them: it gets its facts
 * and the platform line, never the cold-start lines, and no fact is shed for any ask size.
 *
 * Every input runs twice: as it is (no fixture ask asks to sell) and with "sell: " before its ask.
 * In hooks, idea and script "What you sell" is a fact line of the bundle only in the second run
 * (ruling 15); in chat it is in both. A line that is not printed is not a fact line: it adds nothing.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { YOU_FACT_KEYS, YOU_FACT_LIMITS, type YouFactKey } from "@/lib/you/facts";
import { BUNDLE_CHAR_CAP, MODE_ROLES, assembleBundle, bundleCharCap, type AssemblerInput } from "../assembler";
import { asksToSell } from "../asks-to-sell";
import { PROFILE_ROLE_MAP, YOU_ROLES, isProfileThin, roleLineFor, type ProfileRow } from "../profile-role-map";
import { FIVE_EMPTY, INPUTS, MODES, ROWS } from "./you-facts.fixtures";

type Facts = Partial<Record<YouFactKey, string | null>>;

const AT_LIMIT = Object.fromEntries(
  YOU_FACT_KEYS.map((k) => [k, `${k} at its limit `.padEnd(YOU_FACT_LIMITS[k], "x")]),
) as Record<YouFactKey, string>;
/** The spec's own examples: facts of ordinary length. */
const ORDINARY: Record<YouFactKey, string> = {
  about: "Nurse, mum of two, started posting last year.",
  sells: "A 12-week meal plan, $49. Affiliate for two blender brands.",
  writing_voice_description: "Dry, short sentences, a bit of swearing. Never say 'guys'.",
  can_film: "Phone only, my kitchen, on camera. No b-roll, no editing beyond cuts.",
  never_do: "No before/after bodies. No giveaways. Never name a competitor.",
};
const FACT_SETS: Record<string, Facts> = {
  "all five at their limits": AT_LIMIT,
  "all five, ordinary length": ORDINARY,
  ...Object.fromEntries(YOU_FACT_KEYS.map((k) => [`only ${k}, at its limit`, { [k]: AT_LIMIT[k] }])),
};

const NOT_THIN = Object.entries(ROWS).filter(([, row]) => row !== null && !isProfileThin(row)) as [string, ProfileRow][];

/** The fixture inputs as they are, and each with an ask that asks to sell. */
const RUNS: { selling: boolean; inputs: [string, (typeof INPUTS)[string]][] }[] = [
  { selling: false, inputs: Object.entries(INPUTS) },
  {
    selling: true,
    inputs: Object.entries(INPUTS).map(([name, input]) => [`${name}, asking to sell`, { ...input, ask: `sell: ${input.ask}` }]),
  },
];

/**
 * The fact lines a mode prints for a row, in the mode's order: the offer only for an ask to sell,
 * except in chat; never under the mode's own header (chat has its own).
 */
const factLines = (mode: AssemblerInput["mode"], row: ProfileRow, selling: boolean) =>
  MODE_ROLES[mode]
    .filter((role) => YOU_ROLES.includes(role))
    .filter((role) => role !== "sells" || selling || mode === "chat")
    .map((role) => roleLineFor(mode, role, row))
    .filter((line): line is string => line !== null);

const PROFILE_HEADER = "### Creator Profile\n";

/** The bundle less its fact lines, each with its joining newline (and the block they opened alone). */
function withoutFactLines(bundle: string, lines: string[]): { rest: string; alone: boolean } {
  if (lines.length === 0) return { rest: bundle, alone: false };
  const aloneBlock = `${PROFILE_HEADER}${lines.join("\n")}\n\n`;
  if (bundle.includes(aloneBlock)) return { rest: bundle.replace(aloneBlock, ""), alone: true };
  let rest = bundle;
  for (const line of lines) {
    expect(rest, "every fact line is in the bundle").toContain(`${line}\n`);
    rest = rest.replace(`${line}\n`, "");
  }
  return { rest, alone: false };
}

describe("the facts ride on top of the cap", () => {
  it("the runs are what they say: no fixture ask (read with its anchor, as the gate reads it) asks to sell, every prefixed one does", () => {
    for (const { selling, inputs } of RUNS) {
      for (const [name, input] of inputs) {
        expect(asksToSell([input.ask, input.anchor ?? ""].join(" "), ORDINARY.sells), name).toBe(selling);
      }
    }
  });

  it("all five facts: four fact lines in script and idea for an ask that does not sell, five for one that does", () => {
    for (const mode of ["script", "idea"] as const) {
      const row = { ...ROWS["a full row"], ...AT_LIMIT } as ProfileRow;
      for (const { selling, inputs } of RUNS) {
        const bundle = assembleBundle({ ...inputs[0]![1], mode }, row);
        expect(factLines(mode, row, selling)).toHaveLength(selling ? 5 : 4);
        expect(factLines(mode, row, selling).every((line) => bundle.includes(line))).toBe(true);
        expect(bundle.includes(PROFILE_ROLE_MAP.sells(row)!)).toBe(selling);
      }
    }
  });

  it("there is a row of each kind to test on", () => {
    expect(NOT_THIN.map(([name]) => name)).toEqual([
      "a full row",
      "a full row, the five absent",
      "a full row, the five blank",
      "niche only",
      "an audience of nulls",
    ]);
  });

  describe.each(Object.entries(FACT_SETS))("%s", (_set, facts) => {
    it.each(MODES)("%s: less its fact lines, every bundle is the bundle without facts, and no longer than its cap", (mode) => {
      let alone = 0;
      for (const [rowName, row] of NOT_THIN) {
        const withFacts = { ...row, ...facts } as ProfileRow;
        const without = { ...row, ...FIVE_EMPTY } as ProfileRow;
        for (const { selling, inputs } of RUNS) for (const [inputName, input] of inputs) {
          const lines = factLines(mode, withFacts, selling);
          const where = `${rowName} · ${inputName}`;
          const bundle = assembleBundle({ ...input, mode }, withFacts);
          const { rest, alone: isAlone } = withoutFactLines(bundle, lines);
          expect(rest, where).toBe(assembleBundle({ ...input, mode }, without));
          const cap = bundleCharCap(lines, isAlone);
          expect(bundle.length - rest.length, where).toBe(cap - BUNDLE_CHAR_CAP);
          expect(bundle.length, where).toBeLessThanOrEqual(cap);
          if (isAlone) alone += 1;
        }
      }
      // The overflowing inputs reach the case where the facts are the only profile lines left.
      if (factLines(mode, { ...facts } as ProfileRow, true).length > 0) expect(alone).toBeGreaterThan(0);
    });
  });
});

describe("a creator who wrote only facts", () => {
  /** A row whose only line is the platform line: what a facts-only creator gets besides their facts. */
  const PLATFORM_ONLY = ROWS["an audience of nulls"]!;

  it.each(MODES)("%s: their facts and the platform line, never the cold-start lines, for every input", (mode) => {
    for (const facts of [AT_LIMIT, ORDINARY]) {
      for (const row of [{ ...facts }, { ...ROWS["an empty row"]!, ...facts }] as ProfileRow[]) {
        for (const { selling, inputs } of RUNS) for (const [inputName, input] of inputs) {
          const lines = factLines(mode, row, selling);
          const bundle = assembleBundle({ ...input, mode }, row);
          expect(bundle, inputName).not.toContain("Creator profile: thin");
          const { rest, alone } = withoutFactLines(bundle, lines);
          expect(rest, inputName).toBe(assembleBundle({ ...input, mode }, PLATFORM_ONLY));
          expect(bundle.length, inputName).toBeLessThanOrEqual(bundleCharCap(lines, alone));
        }
      }
    }
  });

  it.each(MODES)("%s: no fact is shed for any ask size", (mode) => {
    const lines = factLines(mode, AT_LIMIT as ProfileRow, true);
    for (let size = 1000; size <= 9000; size += 100) {
      const bundle = assembleBundle({ ask: `sell ${"y".repeat(size)}`, platform: "tiktok", mode }, AT_LIMIT as ProfileRow);
      for (const line of lines) expect(bundle, `ask ${size}`).toContain(line);
      expect(bundle).not.toContain("Creator profile: thin");
    }
  });
});
