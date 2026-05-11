import { describe, it, expect } from "vitest";
import {
  parseBuildCorpusArgs,
  BuildCorpusArgsError,
  BUILD_CORPUS_USAGE,
  type BuildMode,
} from "../cli/build-corpus-args";

describe("parseBuildCorpusArgs — version validation", () => {
  it("requires --version", () => {
    expect(() => parseBuildCorpusArgs([])).toThrow(BuildCorpusArgsError);
    expect(() => parseBuildCorpusArgs(["--smoke"])).toThrow(/--version is required/);
  });

  it("requires valid version format pilot.YYYY-MM-DD or full.YYYY-MM-DD", () => {
    expect(() =>
      parseBuildCorpusArgs(["--version", "invalid", "--smoke"])
    ).toThrow(/must match pilot\.YYYY-MM-DD or full\.YYYY-MM-DD/);
  });

  it("accepts pilot.YYYY-MM-DD version", () => {
    const args = parseBuildCorpusArgs(["--version", "pilot.2026-05-12", "--smoke"]);
    expect(args.version).toBe("pilot.2026-05-12");
  });

  it("accepts full.YYYY-MM-DD version", () => {
    const args = parseBuildCorpusArgs(["--version", "full.2026-05-12", "--scrape"]);
    expect(args.version).toBe("full.2026-05-12");
  });

  it("rejects versions without date suffix", () => {
    expect(() =>
      parseBuildCorpusArgs(["--version", "pilot", "--smoke"])
    ).toThrow(BuildCorpusArgsError);
  });
});

describe("parseBuildCorpusArgs — mode flags", () => {
  it("requires exactly one mode flag", () => {
    expect(() =>
      parseBuildCorpusArgs(["--version", "full.2026-05-12"])
    ).toThrow(/exactly one mode/);
  });

  it("parses --smoke mode", () => {
    const args = parseBuildCorpusArgs(["--version", "full.2026-05-12", "--smoke"]);
    expect(args.mode).toBe("smoke" as BuildMode);
    expect(args.isPilot).toBe(true);
  });

  it("parses --scrape mode", () => {
    const args = parseBuildCorpusArgs(["--version", "full.2026-05-12", "--scrape"]);
    expect(args.mode).toBe("scrape" as BuildMode);
    expect(args.isPilot).toBe(false);
  });

  it("parses --calibrate mode", () => {
    const args = parseBuildCorpusArgs(["--version", "full.2026-05-12", "--calibrate"]);
    expect(args.mode).toBe("calibrate" as BuildMode);
  });

  it("parses --build mode", () => {
    const args = parseBuildCorpusArgs(["--version", "full.2026-05-12", "--build"]);
    expect(args.mode).toBe("build" as BuildMode);
    expect(args.isPilot).toBe(false);
  });

  it("rejects multiple mode flags", () => {
    expect(() =>
      parseBuildCorpusArgs(["--version", "full.2026-05-12", "--smoke", "--scrape"])
    ).toThrow(/mutually exclusive/);

    expect(() =>
      parseBuildCorpusArgs(["--version", "full.2026-05-12", "--scrape", "--build"])
    ).toThrow(/mutually exclusive/);

    expect(() =>
      parseBuildCorpusArgs(["--version", "full.2026-05-12", "--calibrate", "--build"])
    ).toThrow(/mutually exclusive/);
  });
});

describe("parseBuildCorpusArgs — legacy flags", () => {
  it("--pilot is a deprecated alias for --smoke (sets mode=smoke, isPilot=true)", () => {
    const args = parseBuildCorpusArgs(["--version", "pilot.2026-05-12", "--pilot"]);
    expect(args.mode).toBe("smoke" as BuildMode);
    expect(args.isPilot).toBe(true);
  });

  it("--full is a deprecated alias for --scrape (sets mode=scrape)", () => {
    const args = parseBuildCorpusArgs(["--version", "full.2026-05-12", "--full"]);
    expect(args.mode).toBe("scrape" as BuildMode);
  });

  it("--pilot conflicts with --smoke (both map to smoke — treated as duplicate mode)", () => {
    expect(() =>
      parseBuildCorpusArgs(["--version", "pilot.2026-05-12", "--pilot", "--smoke"])
    ).toThrow(/mutually exclusive/);
  });
});

describe("parseBuildCorpusArgs — options", () => {
  it("parses --dry-run", () => {
    const args = parseBuildCorpusArgs(["--version", "full.2026-05-12", "--smoke", "--dry-run"]);
    expect(args.dryRun).toBe(true);
  });

  it("dry-run defaults to false", () => {
    const args = parseBuildCorpusArgs(["--version", "full.2026-05-12", "--smoke"]);
    expect(args.dryRun).toBe(false);
  });

  it("parses --cache path", () => {
    const args = parseBuildCorpusArgs([
      "--version", "full.2026-05-12",
      "--scrape",
      "--cache", "/tmp/my-cache.jsonl",
    ]);
    expect(args.cachePath).toBe("/tmp/my-cache.jsonl");
  });

  it("cache path defaults to undefined (CLI resolves to defaultCachePath)", () => {
    const args = parseBuildCorpusArgs(["--version", "full.2026-05-12", "--scrape"]);
    expect(args.cachePath).toBeUndefined();
  });

  it("parses --niches as a comma-separated list", () => {
    const args = parseBuildCorpusArgs([
      "--version", "full.2026-05-12",
      "--smoke",
      "--niches", "beauty,fitness",
    ]);
    expect(args.niches).toEqual(["beauty", "fitness"]);
  });

  it("trims whitespace from --niches entries", () => {
    const args = parseBuildCorpusArgs([
      "--version", "full.2026-05-12",
      "--smoke",
      "--niches", "beauty , fitness ",
    ]);
    expect(args.niches).toEqual(["beauty", "fitness"]);
  });

  it("parses --max-cost-cents", () => {
    const args = parseBuildCorpusArgs([
      "--version", "full.2026-05-12",
      "--smoke",
      "--max-cost-cents", "1000",
    ]);
    expect(args.maxCostCents).toBe(1000);
  });

  it("rejects non-integer --max-cost-cents", () => {
    expect(() =>
      parseBuildCorpusArgs(["--version", "full.2026-05-12", "--smoke", "--max-cost-cents", "abc"])
    ).toThrow(BuildCorpusArgsError);
    expect(() =>
      parseBuildCorpusArgs(["--version", "full.2026-05-12", "--smoke", "--max-cost-cents", "-5"])
    ).toThrow(BuildCorpusArgsError);
  });

  it("zero maxCostCents is valid (non-negative integer)", () => {
    const args = parseBuildCorpusArgs([
      "--version", "full.2026-05-12",
      "--smoke",
      "--max-cost-cents", "0",
    ]);
    expect(args.maxCostCents).toBe(0);
  });

  it("rejects conflicting flags (value missing or another flag taken as value)", () => {
    expect(() =>
      parseBuildCorpusArgs(["--version", "--smoke"])
    ).toThrow(/requires a value/);
    expect(() =>
      parseBuildCorpusArgs(["--version", "full.2026-05-12", "--smoke", "--max-cost-cents"])
    ).toThrow(/requires a value/);
  });

  it("supports `--flag=value` syntax", () => {
    const args = parseBuildCorpusArgs([
      "--version=full.2026-05-12",
      "--scrape",
      "--max-cost-cents=1500",
    ]);
    expect(args.version).toBe("full.2026-05-12");
    expect(args.maxCostCents).toBe(1500);
  });
});

describe("parseBuildCorpusArgs — usage string", () => {
  it("BUILD_CORPUS_USAGE contains all four mode flags", () => {
    expect(BUILD_CORPUS_USAGE).toContain("--smoke");
    expect(BUILD_CORPUS_USAGE).toContain("--scrape");
    expect(BUILD_CORPUS_USAGE).toContain("--calibrate");
    expect(BUILD_CORPUS_USAGE).toContain("--build");
  });

  it("BUILD_CORPUS_USAGE contains legacy flags with deprecation note", () => {
    expect(BUILD_CORPUS_USAGE).toContain("--pilot");
    expect(BUILD_CORPUS_USAGE).toContain("--full");
    expect(BUILD_CORPUS_USAGE).toContain("DEPRECATED");
  });

  it("BUILD_CORPUS_USAGE contains --version", () => {
    expect(BUILD_CORPUS_USAGE).toContain("--version");
  });

  it("BUILD_CORPUS_USAGE contains --cache and --niches", () => {
    expect(BUILD_CORPUS_USAGE).toContain("--cache");
    expect(BUILD_CORPUS_USAGE).toContain("--niches");
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
});
