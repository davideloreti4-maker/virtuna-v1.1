/**
 * search-budget.test.ts — the rule that stops a turn drowning in its own searches.
 *
 * Measured 2026-08-12 (docs/superpowers/specs/2026-08-12-composed-card-spike-rerun.md): qwen3.7-flash
 * — the SHIPPED chat model — spent all 6 spike rounds calling search_corpus and never answered.
 * On `hooks` it re-ran the IDENTICAL query four times; on `angles` it rephrased six times and was
 * never satisfied. Production caps rounds at 4, so the same turn returns an empty answer there.
 */
import { describe, it, expect } from "vitest";
import { createSearchGovernor, MAX_CORPUS_SEARCHES_PER_TURN } from "@/lib/grounding/search-budget";

describe("createSearchGovernor", () => {
  it("allows a first search", () => {
    const g = createSearchGovernor();
    expect(g.check({ query: "raising SaaS prices" }).allow).toBe(true);
  });

  it("refuses the IDENTICAL query a second time — flash re-ran one query four times", () => {
    const g = createSearchGovernor();
    g.check({ query: "raising SaaS prices" });
    const second = g.check({ query: "raising SaaS prices" });

    expect(second.allow).toBe(false);
    expect(second.refusal?.repeat).toBe(true);
    // The model has to be told it ALREADY HAS these rows, or it reads the refusal as a failure
    // and searches again with a synonym.
    expect(second.refusal?.note).toMatch(/already/i);
  });

  it("treats whitespace and case as the same query — a model retypes, it does not copy", () => {
    const g = createSearchGovernor();
    g.check({ query: "Raising SaaS Prices" });
    expect(g.check({ query: "  raising   saas prices " }).allow).toBe(false);
  });

  it("separates queries that differ by axis or filter — those are genuinely different searches", () => {
    const g = createSearchGovernor();
    expect(g.check({ query: "pricing", axis: "topical" }).allow).toBe(true);
    expect(g.check({ query: "pricing", axis: "structural" }).allow).toBe(true);
    expect(g.check({ query: "pricing", axis: "structural", niche: "finance" }).allow).toBe(true);
  });

  it("a repeat does NOT consume the budget — it never ran", () => {
    const g = createSearchGovernor(2);
    g.check({ query: "a" });
    g.check({ query: "a" });
    g.check({ query: "a" });
    expect(g.spent()).toBe(1);
    expect(g.check({ query: "b" }).allow).toBe(true);
  });

  it("spends out after the budget and says what to do instead", () => {
    const g = createSearchGovernor(2);
    expect(g.check({ query: "a" }).allow).toBe(true);
    expect(g.check({ query: "b" }).allow).toBe(true);

    const third = g.check({ query: "c" });
    expect(third.allow).toBe(false);
    expect(third.refusal?.repeat).toBeUndefined();
    // "Stop" is not an instruction a model can act on; "answer with what you have" is.
    expect(third.refusal?.note).toMatch(/answer/i);
    expect(g.exhausted()).toBe(true);
  });

  it("is not exhausted before the budget is spent", () => {
    const g = createSearchGovernor(3);
    g.check({ query: "a" });
    expect(g.exhausted()).toBe(false);
  });

  it("defaults to a budget that lets a competent model finish — plus used 3", () => {
    // qwen3.7-plus searched 3-5 times per case and always emitted; the cap must not cut it off
    // before its normal working range.
    expect(MAX_CORPUS_SEARCHES_PER_TURN).toBeGreaterThanOrEqual(3);
  });

  it("ignores a missing or unusable query rather than throwing at the caller", () => {
    const g = createSearchGovernor();
    expect(() => g.check({})).not.toThrow();
    expect(() => g.check({ query: 42 })).not.toThrow();
  });
});
