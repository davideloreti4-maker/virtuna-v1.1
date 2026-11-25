/**
 * The result page's address and the board's old address, with the flag off and on (spec §8).
 * The flag is a build-time constant, so each case loads the route modules fresh with the flag set
 * the way that build would have it. Nothing else is stood in for.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement } from "react";

// Each case loads the route modules (and the result screen behind them) fresh: slow under load.
vi.setConfig({ testTimeout: 30_000 });

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  const simulation = await import("../[id]/page");
  const analyze = await import("../../analyze/[id]/page");
  return { SimulationPage: simulation.default, AnalyzePage: analyze.default };
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

/** What Next throws for notFound() / redirect(): an error whose digest names the outcome. */
async function thrown(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    return String((error as { digest?: string }).digest ?? error);
  }
  return "nothing thrown";
}

afterEach(() => {
  vi.doUnmock("@/lib/flags/new-look");
  vi.resetModules();
});

describe("flag off", () => {
  it("/simulation/[id] answers not found", async () => {
    const { SimulationPage } = await load(false);
    expect(await thrown(() => SimulationPage(params("run-1")))).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it("/analyze/[id] is unchanged: no redirect, the board renders it", async () => {
    const { AnalyzePage } = await load(false);
    await expect(AnalyzePage(params("run-1"))).resolves.toBeNull();
  });
});

describe("flag on", () => {
  it("/simulation/[id] renders the result screen for that id", async () => {
    const { SimulationPage } = await load(true);
    const element = await SimulationPage(params("run-1"));
    expect(isValidElement(element)).toBe(true);
    expect((element as { props: { id: string } }).props.id).toBe("run-1");
  });

  it("/analyze/[id] redirects to /simulation/[id]", async () => {
    const { AnalyzePage } = await load(true);
    const digest = await thrown(() => AnalyzePage(params("run-1")));
    expect(digest).toMatch(/^NEXT_REDIRECT;/);
    expect(digest).toContain("/simulation/run-1");
  });
});
