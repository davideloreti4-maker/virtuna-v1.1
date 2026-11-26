/**
 * The one request for a Whop membership (spec 2026-11-26-settings, 3.1). Whop is the boundary: the
 * stand-in is the `fetch` handed in; everything after the response is the real code.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWhopMembership, membershipRenews, type LiveMembership } from "../membership";

const ID = "mem_test_1";

function whop(status: number, body: unknown = {}) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));
}

let savedKey: string | undefined;

beforeEach(() => {
  savedKey = process.env.WHOP_API_KEY;
  process.env.WHOP_API_KEY = "test-key";
});

afterEach(() => {
  if (savedKey === undefined) delete process.env.WHOP_API_KEY;
  else process.env.WHOP_API_KEY = savedKey;
});

describe("fetchWhopMembership", () => {
  it("asks Whop's v1 membership resource with the key", async () => {
    const f = whop(200, { id: ID, status: "active", renewal_period_end: null });
    await fetchWhopMembership(ID, f as unknown as typeof fetch);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("https://api.whop.com/api/v1/memberships/mem_test_1");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-key");
  });

  it("encodes the id into the path", async () => {
    const f = whop(200, { id: "x", status: "active" });
    await fetchWhopMembership("a/b c", f as unknown as typeof fetch);
    expect(f.mock.calls[0]![0]).toBe("https://api.whop.com/api/v1/memberships/a%2Fb%20c");
  });

  it("404: Whop has no such membership → null", async () => {
    expect(await fetchWhopMembership(ID, whop(404, { error: "not found" }) as unknown as typeof fetch)).toBeNull();
  });

  it("200 with the period end in seconds → an ISO time", async () => {
    const seconds = Date.UTC(2026, 11, 14, 10, 0, 0) / 1000;
    const m = await fetchWhopMembership(
      ID,
      whop(200, { id: ID, status: "active", cancel_at_period_end: true, renewal_period_end: seconds }) as unknown as typeof fetch,
    );
    expect(m).toEqual<LiveMembership>({ status: "active", cancelAtPeriodEnd: true, renewsAt: "2026-12-14T10:00:00.000Z" });
  });

  it("200 with the period end as an ISO string → that time", async () => {
    const m = await fetchWhopMembership(
      ID,
      whop(200, { id: ID, status: "trialing", cancel_at_period_end: false, renewal_period_end: "2026-11-29T08:30:00.000Z" }) as unknown as typeof fetch,
    );
    expect(m).toEqual<LiveMembership>({ status: "trialing", cancelAtPeriodEnd: false, renewsAt: "2026-11-29T08:30:00.000Z" });
  });

  it("no period end, or one that is not a time → null", async () => {
    const none = await fetchWhopMembership(ID, whop(200, { id: ID, status: "active" }) as unknown as typeof fetch);
    expect(none?.renewsAt).toBeNull();
    const junk = await fetchWhopMembership(ID, whop(200, { id: ID, status: "active", renewal_period_end: "soon" }) as unknown as typeof fetch);
    expect(junk?.renewsAt).toBeNull();
  });

  it("cancel_at_period_end missing → false", async () => {
    const m = await fetchWhopMembership(ID, whop(200, { id: ID, status: "active", renewal_period_end: null }) as unknown as typeof fetch);
    expect(m?.cancelAtPeriodEnd).toBe(false);
  });

  it("500 throws", async () => {
    await expect(fetchWhopMembership(ID, whop(500) as unknown as typeof fetch)).rejects.toThrow(/500/);
  });

  it("401 throws (not a missing membership)", async () => {
    await expect(fetchWhopMembership(ID, whop(401) as unknown as typeof fetch)).rejects.toThrow(/401/);
  });

  it("200 with no string status throws (an unreadable answer, not a membership)", async () => {
    await expect(fetchWhopMembership(ID, whop(200, { id: ID, renewal_period_end: null }) as unknown as typeof fetch)).rejects.toThrow(/status/);
    await expect(fetchWhopMembership(ID, whop(200, { id: ID, status: 3 }) as unknown as typeof fetch)).rejects.toThrow(/status/);
    await expect(fetchWhopMembership(ID, whop(200, null) as unknown as typeof fetch)).rejects.toThrow(/status/);
  });

  it("a network failure throws", async () => {
    const f = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(fetchWhopMembership(ID, f as unknown as typeof fetch)).rejects.toThrow(/fetch failed/);
  });

  it("a missing key throws before asking Whop", async () => {
    delete process.env.WHOP_API_KEY;
    const f = whop(200, { id: ID, status: "active" });
    await expect(fetchWhopMembership(ID, f as unknown as typeof fetch)).rejects.toThrow(/WHOP_API_KEY/);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("membershipRenews", () => {
  const m = (status: string, cancelAtPeriodEnd = false): LiveMembership => ({ status, cancelAtPeriodEnd, renewsAt: null });

  it("active, trialing and past_due renew", () => {
    expect(membershipRenews(m("active"))).toBe(true);
    expect(membershipRenews(m("trialing"))).toBe(true);
    expect(membershipRenews(m("past_due"))).toBe(true);
  });

  it("canceled (either spelling), expired and completed do not", () => {
    expect(membershipRenews(m("canceled"))).toBe(false);
    expect(membershipRenews(m("cancelled"))).toBe(false);
    expect(membershipRenews(m("expired"))).toBe(false);
    expect(membershipRenews(m("completed"))).toBe(false);
  });

  it("an unknown status renews (fails closed): unresolved, drafted, empty", () => {
    expect(membershipRenews(m("unresolved"))).toBe(true);
    expect(membershipRenews(m("drafted"))).toBe(true);
    expect(membershipRenews(m(""))).toBe(true);
  });

  it("an unknown status cancelled at the period's end does not renew", () => {
    expect(membershipRenews(m("unresolved", true))).toBe(false);
  });

  it("a cancel at the period's end stops it renewing", () => {
    expect(membershipRenews(m("active", true))).toBe(false);
    expect(membershipRenews(m("trialing", true))).toBe(false);
    expect(membershipRenews(m("past_due", true))).toBe(false);
  });
});
