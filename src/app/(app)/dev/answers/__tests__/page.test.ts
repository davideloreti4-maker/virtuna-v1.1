/**
 * /dev/answers exists in the new look only. The flag is a build-time constant, so each case loads
 * the page fresh with the flag set the way that build would have it (as /dev/field's test does).
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

type Props = { state: string; skin: string; frames: string | null };
const propsOf = (element: unknown) => (element as { props: Props }).props;

afterEach(() => {
  vi.doUnmock("@/lib/flags/new-look");
  vi.resetModules();
});

describe("/dev/answers", () => {
  it("is not found with the flag off", async () => {
    const Page = await load(false);
    expect(await thrown(() => Page(search({ state: "p3" })))).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it.each(["p3", "p4", "p5", "p12", "p8", "p9", "p9b", "p10", "p10b", "p11", "p11b", "p13", "d3", "p7", "p7l", "p7n", "p6", "p6b", "p6i"])("with the flag on renders %s", async (state) => {
    const Page = await load(true);
    const element = await Page(search({ state }));
    expect(isValidElement(element)).toBe(true);
    expect(propsOf(element)).toMatchObject({ state, skin: "light" });
  });

  it("opens on p3, light, without parameters", async () => {
    const Page = await load(true);
    expect(propsOf(await Page(search()))).toMatchObject({ state: "p3", skin: "light" });
  });

  it("passes a frames base on, and none without it", async () => {
    const Page = await load(true);
    expect(propsOf(await Page(search({ state: "p9", frames: "/dev-frames" })))).toMatchObject({ state: "p9", frames: "/dev-frames" });
    expect(propsOf(await Page(search({ state: "p9" })))).toMatchObject({ frames: null });
  });

  it("takes the dark skin", async () => {
    const Page = await load(true);
    expect(propsOf(await Page(search({ state: "p5", skin: "dark" })))).toMatchObject({ state: "p5", skin: "dark" });
  });

  it("an unknown state or skin is not found", async () => {
    const Page = await load(true);
    expect(await thrown(() => Page(search({ state: "nope" })))).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404/);
    expect(await thrown(() => Page(search({ state: "p3", skin: "sepia" })))).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });
});
