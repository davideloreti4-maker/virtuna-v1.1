/**
 * page.test.tsx — the dev page that proves part 2 is held to the same creators as the edit tool's routes (A1): signed
 * in, and named in EDIT_CREATORS. The page's client part is stood in; what it calls are the routes, tested apart.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("../worker", () => ({ WorkerPage: () => null }));

import { createClient } from "@/lib/supabase/server";
import { WorkerPage } from "../worker";
import DevEditWorkerPage from "../page";

const USER = "11111111-1111-4111-8111-111111111111";
const page = () => DevEditWorkerPage({ searchParams: Promise.resolve({}) }) as Promise<ReactElement<{ children?: unknown }>>;

beforeEach(() => {
  vi.mocked(createClient).mockImplementation(async () => ({ auth: { getUser: async () => ({ data: { user: { id: USER, is_anonymous: false } }, error: null }) } }) as never);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("/dev-edit/worker", () => {
  it("shows the page to a creator named in EDIT_CREATORS", async () => {
    vi.stubEnv("EDIT_CREATORS", USER);
    const shown = await page();
    expect(isValidElement(shown) && shown.type).toBe(WorkerPage);
  });

  it.each([["not set", undefined], ["naming another", "99999999-9999-4999-8999-999999999999"]])(
    "says the edit tool is not open to a creator when EDIT_CREATORS is %s, and shows nothing of it",
    async (_, creators) => {
      if (creators !== undefined) vi.stubEnv("EDIT_CREATORS", creators);
      else vi.stubEnv("EDIT_CREATORS", "");
      const shown = await page();
      expect(shown.type).not.toBe(WorkerPage);
      expect(JSON.stringify(shown)).toContain("the edit tool is not open to this account yet");
    },
  );

  it("asks a visitor who is not signed in to sign in", async () => {
    vi.stubEnv("EDIT_CREATORS", USER);
    vi.mocked(createClient).mockImplementation(async () => ({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } }) as never);
    expect(JSON.stringify(await page())).toContain("sign in to use the edit tool");
  });
});
