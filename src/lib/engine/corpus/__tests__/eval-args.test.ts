import { describe, it, expect } from "vitest";
import { parseEvalArgs, EvalArgsError, EVAL_USAGE } from "../cli/eval-args";

describe("parseEvalArgs", () => {
  it("requires --corpus-version", () => {
    expect(() => parseEvalArgs([])).toThrow(EvalArgsError);
    expect(() => parseEvalArgs(["--baseline"])).toThrow(/--corpus-version is required/);
  });

  it("parses the minimum-viable invocation", () => {
    const args = parseEvalArgs(["--corpus-version", "full.2026-05-12"]);
    expect(args.corpusVersion).toBe("full.2026-05-12");
    expect(args.baseline).toBe(false);
    expect(args.leaveOneOut).toBe(false);
    expect(args.maxTotalCostCents).toBe(5000);
    expect(args.delayMs).toBe(2000);
    expect(args.output).toBeUndefined();
    expect(args.engineVersion).toBeUndefined();
  });

  it("parses --baseline mode", () => {
    const args = parseEvalArgs(["--corpus-version", "v1", "--baseline"]);
    expect(args.baseline).toBe(true);
  });

  it("parses --leave-one-out", () => {
    const args = parseEvalArgs(["--corpus-version", "v1", "--leave-one-out"]);
    expect(args.leaveOneOut).toBe(true);
  });

  it("parses --max-total-cost-cents as integer", () => {
    const args = parseEvalArgs(["--corpus-version", "v1", "--max-total-cost-cents", "3000"]);
    expect(args.maxTotalCostCents).toBe(3000);
  });

  it("parses --delay-ms (W7) as integer with 2000 default", () => {
    const defaultArgs = parseEvalArgs(["--corpus-version", "v1"]);
    expect(defaultArgs.delayMs).toBe(2000);
    const overridden = parseEvalArgs(["--corpus-version", "v1", "--delay-ms", "500"]);
    expect(overridden.delayMs).toBe(500);
  });

  it("parses --output path", () => {
    const args = parseEvalArgs(["--corpus-version", "v1", "--output", "/tmp/report.json"]);
    expect(args.output).toBe("/tmp/report.json");
  });

  it("parses --engine-version override", () => {
    const args = parseEvalArgs(["--corpus-version", "v1", "--engine-version", "2.1.1"]);
    expect(args.engineVersion).toBe("2.1.1");
  });

  it("rejects non-integer --max-total-cost-cents", () => {
    expect(() => parseEvalArgs(["--corpus-version", "v1", "--max-total-cost-cents", "abc"])).toThrow(EvalArgsError);
    expect(() => parseEvalArgs(["--corpus-version", "v1", "--max-total-cost-cents", "-5"])).toThrow(EvalArgsError);
  });

  it("rejects non-integer --delay-ms", () => {
    expect(() => parseEvalArgs(["--corpus-version", "v1", "--delay-ms", "abc"])).toThrow(EvalArgsError);
  });

  it("rejects conflicting flags (value missing or another flag taken as value)", () => {
    // --corpus-version with no value and --baseline next
    expect(() => parseEvalArgs(["--corpus-version", "--baseline"])).toThrow(/requires a value/);
    // --output at end with no path
    expect(() => parseEvalArgs(["--corpus-version", "v1", "--output"])).toThrow(/requires a value/);
  });

  it("supports `--flag=value` syntax", () => {
    const args = parseEvalArgs(["--corpus-version=full.2026-05-12", "--max-total-cost-cents=2500"]);
    expect(args.corpusVersion).toBe("full.2026-05-12");
    expect(args.maxTotalCostCents).toBe(2500);
  });

  it("EVAL_USAGE contains the required documentation strings", () => {
    expect(EVAL_USAGE).toContain("--corpus-version");
    expect(EVAL_USAGE).toContain("--delay-ms");
    expect(EVAL_USAGE).toContain("rate-limit");
  });
});
