/**
 * The text result page's address with the flag off and on (spec §4). The flag is a build-time
 * constant, so each case loads the route module fresh with the flag set as that build would have it.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement } from "react";

vi.setConfig({ testTimeout: 30_000 });

async function load(flag: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: flag }));
  return (await import("../hook/[threadId]/[key]/page")).default;
}

const args = (search: Record<string, string | string[]> = {}) => ({
  params: Promise.resolve({ threadId: "t-1", key: "VvK87Bp1dO" }),
  searchParams: Promise.resolve(search),
});

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

type Props = { threadId: string; sealKey: string; as: string };
const propsOf = (element: unknown) => (element as { props: Props }).props;

describe("/simulation/hook/[threadId]/[key]", () => {
  it("flag off: not found", async () => {
    const Page = await load(false);
    expect(await thrown(() => Page(args()))).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it("flag on: the screen for that thread and key, a hook by default", async () => {
    const Page = await load(true);
    const element = await Page(args());
    expect(isValidElement(element)).toBe(true);
    expect(propsOf(element)).toEqual({ threadId: "t-1", sealKey: "VvK87Bp1dO", as: "hook" });
  });

  it.each([
    [{ as: "idea" }, "idea"],
    [{ as: "opening" }, "opening"],
    [{ as: ["opening", "idea"] }, "opening"],
    [{ as: "nope" }, "hook"],
  ] as const)("?as=%j → %s", async (search, as) => {
    const Page = await load(true);
    expect(propsOf(await Page(args(search as Record<string, string | string[]>))).as).toBe(as);
  });
});
