/** @vitest-environment happy-dom */

/**
 * Save keeps its message ref under the new turn (plan 2026-11-21, Task 5): every part is drawn inside
 * `BlockOriginContext` with the origin of its ORIGINAL block (a pack or a remix card: its first
 * item's), so the dropped run stamp, narration and closing line never shift a ref.
 *
 * The cards are the real ones. Each card module is wrapped (never replaced) so a probe drawn beside
 * the real card reads the context value the card itself receives: the new cards carry no Save yet
 * (it comes with the sheet in step 2), so the probe is the only reader there is.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

/** A sibling drawn by each wrapped card: what `BlockOriginContext` holds where the card renders. */
async function probe(name: string) {
  const { useContext } = await import("react");
  const { BlockOriginContext } = await import("@/lib/save-provenance-context");
  const { blockRefId } = await import("@/components/app/home/rehydrate-thread");
  return function Probe() {
    const origin = useContext(BlockOriginContext);
    return <i data-testid={`origin-${name}`} data-ref={blockRefId(origin) ?? "none"} />;
  };
}

vi.mock("../pack-answer", async (importOriginal) => {
  const real = await importOriginal<typeof import("../pack-answer")>();
  const Probe = await probe("pack");
  return { ...real, PackAnswer: (p: Parameters<typeof real.PackAnswer>[0]) => (<><Probe /><real.PackAnswer {...p} /></>) };
});
vi.mock("../remix-answer", async (importOriginal) => {
  const real = await importOriginal<typeof import("../remix-answer")>();
  const Probe = await probe("remix");
  return { ...real, RemixAnswer: (p: Parameters<typeof real.RemixAnswer>[0]) => (<><Probe /><real.RemixAnswer {...p} /></>) };
});
vi.mock("../script-answer", async (importOriginal) => {
  const real = await importOriginal<typeof import("../script-answer")>();
  const Probe = await probe("script");
  return { ...real, ScriptAnswer: (p: Parameters<typeof real.ScriptAnswer>[0]) => (<><Probe /><real.ScriptAnswer {...p} /></>) };
});
vi.mock("../fallback-answer", async (importOriginal) => {
  const real = await importOriginal<typeof import("../fallback-answer")>();
  const Probe = await probe("fallback");
  return { ...real, FallbackAnswer: (p: Parameters<typeof real.FallbackAnswer>[0]) => (<><Probe /><real.FallbackAnswer {...p} /></>) };
});

import { ThreadTurn } from "@/components/thread/thread-turn";
import type { BlockOrigin } from "@/components/app/home/rehydrate-thread";
import { MEAL_PREP_HOOKS, REMIX_CAMERA, SCRIPT_AI, corpus, md, remix, runHeader } from "./fixtures/answers";

afterEach(cleanup);

const refs = (name: string) => screen.queryAllByTestId(`origin-${name}`).map((el) => el.getAttribute("data-ref"));

/** One message per entry: `[messageId, blockCount]` → the origins `orderedTurns` builds. */
function originsOf(messages: [string, number][]): BlockOrigin[] {
  return messages.flatMap(([messageId, n]) => Array.from({ length: n }, (_, index) => ({ messageId, index })));
}

describe("each part's Save ref is its original block's", () => {
  it("a pack after the run stamp: its first hook's index (m1:1), not 0", () => {
    // [run-header, hook, hook, hook] in m1, then the closing line alone in m2.
    const blocks = [runHeader("hooks"), ...MEAL_PREP_HOOKS, md("#1 is your strongest.")];
    render(<ThreadTurn userTurn="hooks" blocks={blocks} blockOrigins={originsOf([["m1", 4], ["m2", 1]])} />);
    expect(refs("pack")).toEqual(["m1:1"]);
    // The card is the real one, beside the probe.
    expect(screen.getAllByRole("button", { name: /^Simulate: / })).toHaveLength(3);
  });

  it("two packs and a remix run in one turn: each its own first block", () => {
    const blocks = [runHeader("hooks"), MEAL_PREP_HOOKS[0], MEAL_PREP_HOOKS[1], md("narration"), MEAL_PREP_HOOKS[2], REMIX_CAMERA, remix("Second remix")];
    render(<ThreadTurn userTurn="mixed" blocks={blocks} blockOrigins={originsOf([["m1", 4], ["m2", 3]])} />);
    expect(refs("pack")).toEqual(["m1:1", "m2:0"]);
    expect(refs("remix")).toEqual(["m2:1"]);
  });

  it("a script, and a fallback card after text", () => {
    render(<ThreadTurn userTurn="script" blocks={[runHeader("script"), SCRIPT_AI]} blockOrigins={originsOf([["m7", 2]])} />);
    expect(refs("script")).toEqual(["m7:1"]);
    cleanup();
    render(<ThreadTurn userTurn="sources" blocks={[md("Cheap wins."), corpus()]} blockOrigins={originsOf([["m3", 1], ["m4", 1]])} />);
    expect(refs("fallback")).toEqual(["m4:0"]);
  });

  it("a live turn has no origins: the ref is none, never a neighbour's", () => {
    render(<ThreadTurn userTurn="hooks" blocks={[runHeader("hooks"), ...MEAL_PREP_HOOKS]} live={{ skill: "hooks", isStreaming: false, stages: [] }} />);
    expect(refs("pack")).toEqual(["none"]);
  });
});
