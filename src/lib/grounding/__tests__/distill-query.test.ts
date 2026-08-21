import { describe, expect, it, vi } from "vitest";
import { DISTILL_THRESHOLD, distillSearchQuery } from "../distill-query";

const LONG_ASK =
  "give me 3 hooks i can use for my new video about this new crazy platform that " +
  "lets you simulate how your personal audience will react to your video before you post it";

describe("distillSearchQuery", () => {
  it("passes short queries through without calling the LLM", async () => {
    const complete = vi.fn();
    const out = await distillSearchQuery("high protein breakfast", { complete });
    expect(out).toBe("high protein breakfast");
    expect(complete).not.toHaveBeenCalled();
  });

  it("threshold is inclusive: exactly 80 chars passes through", async () => {
    const complete = vi.fn();
    const q = "x".repeat(DISTILL_THRESHOLD);
    expect(await distillSearchQuery(q, { complete })).toBe(q);
    expect(complete).not.toHaveBeenCalled();
  });

  it("distills a long ask via the LLM", async () => {
    const complete = vi.fn().mockResolvedValue('{"query": "AI audience simulation tool"}');
    expect(await distillSearchQuery(LONG_ASK, { complete })).toBe("AI audience simulation tool");
  });

  it("distills a long ask the model wrapped in markdown fences", async () => {
    // DashScope appends fences/prose despite response_format:json_object — a bare
    // JSON.parse would throw here and silently degrade to the raw ask forever.
    const complete = vi
      .fn()
      .mockResolvedValue('```json\n{"query": "AI audience simulation tool"}\n```');
    expect(await distillSearchQuery(LONG_ASK, { complete })).toBe("AI audience simulation tool");
  });

  it("accepts a distilled query of exactly the max length", async () => {
    const max = "z".repeat(60);
    const complete = vi.fn().mockResolvedValue(`{"query": "${max}"}`);
    expect(await distillSearchQuery(LONG_ASK, { complete })).toBe(max);
  });

  /**
   * Every fallback that runs through the `catch` must SAY so. Without the warn, a distiller failing
   * on 100% of calls leaves exactly the log signature of a run whose asks were all short enough to
   * skip the LLM — nothing, either way. The three tests below assert the noise, not just the value.
   */
  it("falls back to the raw query on malformed JSON, and says so", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const complete = vi.fn().mockResolvedValue("not json at all");
    expect(await distillSearchQuery(LONG_ASK, { complete })).toBe(LONG_ASK);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("distill error"));
    warn.mockRestore();
  });

  it("falls back on LLM throw, and names the error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const complete = vi.fn().mockRejectedValue(new Error("boom"));
    expect(await distillSearchQuery(LONG_ASK, { complete })).toBe(LONG_ASK);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("boom"));
    warn.mockRestore();
  });

  /**
   * The VALIDATION rejects, which are a separate silence from the `catch` above: these return the
   * raw ask without throwing anything, so a model that fails this way on every call is
   * indistinguishable from one that is working perfectly on already-short asks. Each reject now
   * names WHICH rule it broke — "empty" and "61 chars > 60" send a reader to different fixes.
   */
  it("falls back on empty, over-long, multi-line, or non-string results — and says which", async () => {
    const cases: Array<[string, string]> = [
      ['{"query": ""}', "empty"],
      [`{"query": "${"y".repeat(61)}"}`, "61 chars > 60"],
      ['{"query": "two\\nlines"}', "multi-line"],
      ['{"query": 42}', "not a string (number)"],
      ['{"nope": 1}', "no query field"],
    ];
    for (const [bad, reason] of cases) {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const complete = vi.fn().mockResolvedValue(bad);
      expect(await distillSearchQuery(LONG_ASK, { complete })).toBe(LONG_ASK);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("distill rejected"));
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(reason));
      warn.mockRestore();
    }
  });

  /**
   * The log names the reject; it does not paste the evidence. What gets rejected here is raw model
   * output, which on a bad day is a wall of reasoning text — a warn that echoes it whole buries the
   * signal it exists to provide, on the hot path of every long ask.
   */
  it("never dumps the model's full output into the log — the preview is bounded", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const huge = "z".repeat(500);
    const complete = vi.fn().mockResolvedValue(`{"query": "${huge}"}`);

    expect(await distillSearchQuery(LONG_ASK, { complete })).toBe(LONG_ASK);

    const logged = warn.mock.calls[0]![0] as string;
    expect(logged).not.toContain(huge);
    expect(logged).toContain("…"); // truncated, and visibly so
    // Bounded, not merely shorter: a full dump of this fixture would run ~570 chars.
    expect(logged.length).toBeLessThan(160);
    warn.mockRestore();
  });

  it("falls back when the LLM never resolves (timeout), and says which failure it was", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const complete = vi.fn().mockImplementation(() => new Promise<string>(() => {}));
    expect(await distillSearchQuery(LONG_ASK, { complete, timeoutMs: 20 })).toBe(LONG_ASK);
    // The timeout rejects INTO the same catch, so it is logged like any other failure — and named,
    // which is what separates "the model is slow" from "the model is broken" in a log sweep.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("distill timeout"));
    warn.mockRestore();
  });
});
