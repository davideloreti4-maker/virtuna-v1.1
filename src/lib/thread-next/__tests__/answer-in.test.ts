import { describe, expect, it } from "vitest";
import { answerIsIn } from "@/lib/thread-next/answer-in";
import { hook, md, outlierGrid, runHeader, script } from "@/components/thread-next/__tests__/fixtures/answers";

const done = (name: string) => ({ name, status: "done" as const });
const active = (name: string) => ({ name, status: "active" as const });

describe("answerIsIn (thread feel §4.1, §4.3, §4.6): the one rule the turn, the settle and the field read", () => {
  it("nothing yet: not in, streaming or not", () => {
    expect(answerIsIn({ isStreaming: true, stages: [], blocks: [] })).toBe(false);
    expect(answerIsIn({ isStreaming: false, stages: [], blocks: [] })).toBe(false);
  });

  it("a run's cards with every stage it reported done: in, though its stream is still open (billing, the closing line)", () => {
    const blocks = [runHeader("hooks"), hook("A"), hook("B"), hook("C")];
    expect(answerIsIn({ isStreaming: true, stages: [done("Generating"), done("Ranking")], blocks })).toBe(true);
  });

  it("a run's cards while a stage is still working: not in", () => {
    const blocks = [hook("A"), hook("B")];
    expect(answerIsIn({ isStreaming: true, stages: [done("Generating"), active("Ranking")], blocks })).toBe(false);
  });

  it("cards with no stage reported (a fresh dispatch cleared them, or the stream reports none): not in until the stream ends", () => {
    const blocks = [hook("A"), hook("B")];
    expect(answerIsIn({ isStreaming: true, stages: [], blocks })).toBe(false);
    expect(answerIsIn({ isStreaming: false, stages: [], blocks })).toBe(true);
  });

  it("every stage done but no card yet (the run bills before it writes them): not in", () => {
    expect(answerIsIn({ isStreaming: true, stages: [done("Generating")], blocks: [md("On it")] })).toBe(false);
  });

  it("a plain answer is in when its stream has ended, not while its words stream", () => {
    expect(answerIsIn({ isStreaming: true, stages: [], blocks: [md("Post the gym myth one first.")] })).toBe(false);
    expect(answerIsIn({ isStreaming: true, stages: [done("Thinking")], blocks: [md("Post the gym myth one first.")] })).toBe(false);
    expect(answerIsIn({ isStreaming: false, stages: [], blocks: [md("Post the gym myth one first.")] })).toBe(true);
  });

  it("any result card counts (a script, an outlier grid), not only a pack", () => {
    expect(answerIsIn({ isStreaming: true, stages: [done("Generating")], blocks: [script()] })).toBe(true);
    expect(answerIsIn({ isStreaming: true, stages: [done("Pulling outliers"), done("Scoring for your audience")], blocks: [outlierGrid()] })).toBe(true);
  });
});
