/** Flag off, POST /api/onboarding/start does not exist (plan 01-start-and-profile, Task 5). */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: false }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => { throw new Error("no session read with the flag off"); }) }));

import { POST } from "../route";

describe("flag off", () => {
  it("404, before any session read", async () => {
    const res = await POST(new Request("https://app.test/api/onboarding/start", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }));
    expect(res.status).toBe(404);
  });
});
