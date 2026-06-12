/**
 * DATA-02 (D-12) — the identical-render contract test (the crux).
 *
 * RED state (Wave 0): `../view-model` and `../from-persisted-row` do NOT exist
 * yet — the Wave 2–4 build plans create them. This file is collected by vitest
 * and FAILS until then. That is the expected Wave-0 state.
 *
 * The contract: a live Reading and its re-opened resting document must be
 * structurally identical. `toReadingBlocks` is pure (no React/no fetch), so the
 * same canonical input → the same blocks regardless of which path produced it.
 *
 * Fixtures are REAL captures (success criteria 1+2 forbid hand-authored mocks).
 * They are produced by `scripts/smoke-tiktok-pipeline.ts` — see
 * `./fixtures/README.md`. The live half is the live PredictionResult; the
 * persisted half is the RAW analysis_results row (fromPersistedRow consolidates
 * the [id]/route.ts reload shims per D-11, so it consumes the raw row).
 *
 * The fixture filenames embed the analysis id (`live-<id>.json` /
 * `persisted-<id>.json`); we glob the dir so the test never hardcodes an id.
 */
import { readdirSync, readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect } from "vitest";
import type { PredictionResult } from "@/lib/engine/types";
// RED until Wave 2–4 create these modules:
import { toReadingBlocks, canonicalFromLive } from "../view-model";
import { fromPersistedRow } from "../from-persisted-row";

const FIXTURES_DIR = resolve(__dirname, "fixtures");

function readFixturePair(): { live: unknown; persisted: unknown } | null {
  let files: string[] = [];
  try {
    files = readdirSync(FIXTURES_DIR);
  } catch {
    return null;
  }
  const liveFile = files.find((f) => /^live-.+\.json$/.test(f));
  const persistedFile = files.find((f) => /^persisted-.+\.json$/.test(f));
  if (!liveFile || !persistedFile) return null;
  const live = JSON.parse(readFileSync(resolve(FIXTURES_DIR, liveFile), "utf8"));
  const persisted = JSON.parse(
    readFileSync(resolve(FIXTURES_DIR, persistedFile), "utf8")
  );
  return { live, persisted };
}

describe("DATA-02 identical-render contract", () => {
  const pair = readFixturePair();

  it("a real (live, persisted) fixture pair exists on disk", () => {
    // Guards success criterion 1: the fixtures must be captured, not mocked.
    // RED until scripts/smoke-tiktok-pipeline.ts has run (Task 2 human-action).
    expect(pair).not.toBeNull();
  });

  it("live Reading deep-equals re-opened resting document", () => {
    if (!pair) {
      throw new Error(
        "No captured fixture pair in src/lib/reading/__tests__/fixtures/ — " +
          "run scripts/smoke-tiktok-pipeline.ts to capture a real pair (see fixtures/README.md)."
      );
    }
    const liveBlocks = toReadingBlocks(
      canonicalFromLive(pair.live as PredictionResult)
    );
    const replayBlocks = toReadingBlocks(fromPersistedRow(pair.persisted));
    expect(replayBlocks).toEqual(liveBlocks); // deep structural equality
  });
});
