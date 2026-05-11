import { describe, it, expect } from "vitest";
import {
  parseBuildCorpusArgs,
  BuildCorpusArgsError,
  BUILD_CORPUS_USAGE,
} from "../cli/build-corpus-args";

describe("parseBuildCorpusArgs", () => {
  it("requires --version", () => {
    expect(() => parseBuildCorpusArgs([])).toThrow(BuildCorpusArgsError);
    expect(() => parseBuildCorpusArgs(["--pilot"])).toThrow(/--version is required/);
  });

  it("requires exactly one of --pilot or --full", () => {
    expect(() => parseBuildCorpusArgs(["--version", "v1"])).toThrow(
      /--pilot or --full/,
    );
    expect(() =>
      parseBuildCorpusArgs(["--version", "v1", "--pilot", "--full"]),
    ).toThrow(/exactly one/);
  });

  it("parses pilot mode", () => {
    const args = parseBuildCorpusArgs(["--version", "pilot.2026-05-12", "--pilot"]);
    expect(args.version).toBe("pilot.2026-05-12");
    expect(args.isPilot).toBe(true);
    expect(args.dryRun).toBe(false);
    expect(args.maxCostCents).toBeUndefined();
  });

  it("parses full mode", () => {
    const args = parseBuildCorpusArgs(["--version", "full.2026-05-12", "--full"]);
    expect(args.version).toBe("full.2026-05-12");
    expect(args.isPilot).toBe(false);
  });

  it("parses --dry-run", () => {
    const args = parseBuildCorpusArgs(["--version", "v1", "--pilot", "--dry-run"]);
    expect(args.dryRun).toBe(true);
  });

  it("parses --max-cost-cents", () => {
    const args = parseBuildCorpusArgs([
      "--version",
      "v1",
      "--pilot",
      "--max-cost-cents",
      "1000",
    ]);
    expect(args.maxCostCents).toBe(1000);
  });

  it("rejects non-integer --max-cost-cents", () => {
    expect(() =>
      parseBuildCorpusArgs(["--version", "v1", "--pilot", "--max-cost-cents", "abc"]),
    ).toThrow(BuildCorpusArgsError);
    expect(() =>
      parseBuildCorpusArgs(["--version", "v1", "--pilot", "--max-cost-cents", "-5"]),
    ).toThrow(BuildCorpusArgsError);
  });

  it("rejects conflicting flags (value missing or another flag taken as value)", () => {
    expect(() => parseBuildCorpusArgs(["--version", "--pilot"])).toThrow(
      /requires a value/,
    );
    expect(() =>
      parseBuildCorpusArgs(["--version", "v1", "--pilot", "--max-cost-cents"]),
    ).toThrow(/requires a value/);
  });

  it("supports `--flag=value` syntax", () => {
    const args = parseBuildCorpusArgs([
      "--version=pilot.2026-05-12",
      "--pilot",
      "--max-cost-cents=1500",
    ]);
    expect(args.version).toBe("pilot.2026-05-12");
    expect(args.maxCostCents).toBe(1500);
  });

  it("BUILD_CORPUS_USAGE contains the required documentation strings", () => {
    expect(BUILD_CORPUS_USAGE).toContain("--version");
    expect(BUILD_CORPUS_USAGE).toContain("--pilot");
    expect(BUILD_CORPUS_USAGE).toContain("--full");
  });

  it("BuildCorpusArgsError includes the usage string", () => {
    try {
      parseBuildCorpusArgs([]);
    } catch (err) {
      expect(err).toBeInstanceOf(BuildCorpusArgsError);
      if (err instanceof BuildCorpusArgsError) {
        expect(err.usage).toBe(BUILD_CORPUS_USAGE);
      }
    }
  });

  it("zero maxCostCents is valid (non-negative integer)", () => {
    const args = parseBuildCorpusArgs([
      "--version",
      "v1",
      "--pilot",
      "--max-cost-cents",
      "0",
    ]);
    expect(args.maxCostCents).toBe(0);
  });
});
