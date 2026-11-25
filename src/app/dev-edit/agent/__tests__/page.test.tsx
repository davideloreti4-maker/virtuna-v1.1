/**
 * page.test.tsx — the page where the edit agent is tried is held to the same creators as the edit tool's routes (A1): signed
 * in, and named in EDIT_CREATORS. The page's client part is stood in; what it calls are the routes, tested apart.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("../agent", () => ({ AgentPage: () => null }));

import { createClient } from "@/lib/supabase/server";
import { AgentPage } from "../agent";
import DevEditAgentPage from "../page";

const USER = "11111111-1111-4111-8111-111111111111";
const page = () => DevEditAgentPage() as Promise<ReactElement<{ children?: unknown }>>;

beforeEach(() => {
  vi.mocked(createClient).mockImplementation(async () => ({ auth: { getUser: async () => ({ data: { user: { id: USER, is_anonymous: false } }, error: null }) } }) as never);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("/dev-edit/agent", () => {
  it("shows the page to a creator named in EDIT_CREATORS", async () => {
    vi.stubEnv("EDIT_CREATORS", USER);
    const shown = await page();
    expect(isValidElement(shown) && shown.type).toBe(AgentPage);
  });

  it.each([["not set", ""], ["naming another", "99999999-9999-4999-8999-999999999999"]])(
    "says the edit tool is not open to a creator when EDIT_CREATORS is %s, and shows nothing of it",
    async (_, creators) => {
      vi.stubEnv("EDIT_CREATORS", creators);
      const shown = await page();
      expect(shown.type).not.toBe(AgentPage);
      expect(JSON.stringify(shown)).toContain("the edit tool is not open to this account yet");
    },
  );

  it("asks a visitor who is not signed in to sign in", async () => {
    vi.stubEnv("EDIT_CREATORS", USER);
    vi.mocked(createClient).mockImplementation(async () => ({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } }) as never);
    expect(JSON.stringify(await page())).toContain("sign in to use the edit tool");
  });

  it("is not there in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EDIT_CREATORS", USER);
    await expect(page()).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });
});
