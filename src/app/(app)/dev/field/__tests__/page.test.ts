/**
 * /dev/field exists in the new look only. The flag is a build-time constant, so each case loads
 * the page fresh with the flag set the way that build would have it (simulation-route.test.ts).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement } from "react";

vi.setConfig({ testTimeout: 30_000 });

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  return (await import("../page")).default;
}

const search = (params: Record<string, string> = {}) => ({ searchParams: Promise.resolve(params) });

/** What Next throws for notFound(): an error whose digest names the outcome. */
async function thrown(run: () => unknown): Promise<string> {
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

describe("/dev/field", () => {
  it("is not found with the flag off", async () => {
    const Page = await load(false);
    expect(await thrown(() => Page(search({ state: "rest" })))).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it("with the flag on renders the field in the asked state", async () => {
    const Page = await load(true);
    const element = await Page(search({ state: "more" }));
    expect(isValidElement(element)).toBe(true);
    expect((element as { props: { state: string } }).props.state).toBe("more");
  });

  it("an unknown state is not found", async () => {
    const Page = await load(true);
    expect(await thrown(() => Page(search({ state: "nope" })))).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });
});
