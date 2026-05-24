// @vitest-environment happy-dom
/**
 * Stub test file for the ResultCard client component (D-11 — Plan 01-07).
 *
 * Plan 01-01 ships placeholders; Plan 01-07 fills assertions when ResultCard
 * + skeleton scaffold ships.
 */
import { describe, it } from "vitest";

describe("ResultCard", () => {
  it.todo("renders skeleton for every panel when panelReady = all 'idle'");
  it.todo("flips skeleton to real content when panelReady[id] === 'ready'");
  it.todo("skips stream open when initialData.overall_score !== null (Pitfall #3)");
  it.todo("opens stream when initialData=null (fresh analysis)");
  it.todo("opens stream when initialData.overall_score === null (in-flight row)");
  it.todo("optimal_post panel renders result.optimal_post_window value when panelReady['optimal_post']==='ready' (B3)");
  it.todo("emotion_arc panel renders first/last result.emotion_arc data points when panelReady['emotion_arc']==='ready' (B3)");
});
