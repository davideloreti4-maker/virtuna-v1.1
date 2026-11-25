/**
 * The calls to Whop (ruling 12), asserted exactly on a recording `fetch` (address, method, the
 * `Authorization` header's shape with a made-up key, the JSON body). Real: the client, its reading of the
 * answers, its settings. Stood in for: `fetch` (`whop-fetch.ts`) and the environment it reads.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { EARN_RATE_PCT } from "../earn";
import {
  WHOP_DEFAULT_BASE,
  WhopError,
  centsOfUsd,
  createAffiliate,
  createOverride,
  getAffiliate,
  listOverrides,
  whopBaseUrl,
  whopSettings,
} from "../whop-affiliates";
import { TEST_BASE, TEST_COMPANY, TEST_KEY, affiliateJson, whopFetch } from "./whop-fetch";

const SETTINGS = { baseUrl: TEST_BASE, apiKey: TEST_KEY, companyId: TEST_COMPANY };
const ENV = ["WHOP_API_BASE_URL", "WHOP_API_KEY", "WHOP_COMPANY_ID"] as const;
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of ENV) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("the settings come from the environment, read when used", () => {
  it("the base address defaults to Whop's documented one", () => {
    process.env.WHOP_API_KEY = TEST_KEY;
    process.env.WHOP_COMPANY_ID = TEST_COMPANY;
    expect(WHOP_DEFAULT_BASE).toBe("https://api.whop.com/api/v1");
    expect(whopSettings()).toEqual({ baseUrl: "https://api.whop.com/api/v1", apiKey: TEST_KEY, companyId: TEST_COMPANY });
  });

  it("WHOP_API_BASE_URL wins (the sandbox), a trailing slash dropped", () => {
    process.env.WHOP_API_KEY = TEST_KEY;
    process.env.WHOP_COMPANY_ID = TEST_COMPANY;
    process.env.WHOP_API_BASE_URL = "https://sandbox-api.whop.com/api/v1/";
    expect(whopSettings()?.baseUrl).toBe("https://sandbox-api.whop.com/api/v1");
  });

  it.each([
    ["no key", { WHOP_COMPANY_ID: TEST_COMPANY }],
    ["no company id", { WHOP_API_KEY: TEST_KEY }],
    ["a blank key", { WHOP_API_KEY: "  ", WHOP_COMPANY_ID: TEST_COMPANY }],
    ["an address that is not https (the key would travel in the clear)", { WHOP_API_KEY: TEST_KEY, WHOP_COMPANY_ID: TEST_COMPANY, WHOP_API_BASE_URL: "http://api.whop.com/api/v1" }],
  ])("%s: not configured (null)", (_why, env) => {
    Object.assign(process.env, env);
    expect(whopSettings()).toBeNull();
  });
});

describe("POST /affiliates: create or find the affiliate", () => {
  it("sends the company and the identifier, with the key as a bearer token, and reads the answer", async () => {
    const { http, calls } = whopFetch([{ method: "POST", path: "/affiliates", answer: { status: 200, json: affiliateJson() } }]);
    const affiliate = await createAffiliate(http, SETTINGS, "nia.cooks");
    expect(calls).toEqual([
      {
        url: "https://whop.example.test/api/v1/affiliates",
        method: "POST",
        headers: { authorization: `Bearer ${TEST_KEY}`, "content-type": "application/json" },
        body: { account_id: TEST_COMPANY, user_identifier: "nia.cooks" },
        hasSignal: true,
      },
    ]);
    expect(affiliate).toEqual({ id: "aff_test1", username: "nia.cooks", earnedCents: 1250 });
  });

  it("Whop's 404 (nothing matches the identifier) is not_found", async () => {
    const { http } = whopFetch([{ method: "POST", path: "/affiliates", answer: { status: 404, json: { error: { message: "not found" } } } }]);
    await expect(createAffiliate(http, SETTINGS, "nobody.here")).rejects.toMatchObject({ kind: "not_found", status: 404 });
  });

  it.each([
    ["a refusal", { status: 500, json: {} }, "refused"],
    ["a refused key", { status: 401, json: {} }, "refused"],
    ["an answer that is not JSON", { status: 200, text: "<html>" }, "malformed"],
    ["an answer without an affiliate id", { status: 200, json: { user: { username: "nia.cooks" } } }, "malformed"],
    ["an affiliate id of another form", { status: 200, json: affiliateJson({ id: "user_test1" }) }, "malformed"],
  ] as const)("%s is a WhopError (%s)", async (_why, answer, kind) => {
    const { http } = whopFetch([{ method: "POST", path: "/affiliates", answer }]);
    await expect(createAffiliate(http, SETTINGS, "nia.cooks")).rejects.toMatchObject({ kind });
  });

  it("a network failure and a call that runs out of time are unreachable", async () => {
    const down = whopFetch([{ method: "POST", path: "/affiliates", answer: "network-error" }]);
    await expect(createAffiliate(down.http, SETTINGS, "nia.cooks")).rejects.toMatchObject({ kind: "unreachable" });
    const slow = whopFetch([{ method: "POST", path: "/affiliates", answer: "hang" }]);
    await expect(createAffiliate(slow.http, { ...SETTINGS, timeoutMs: 20 }, "nia.cooks")).rejects.toMatchObject({ kind: "unreachable" });
  });

  it("a username of another form is answered as none; a missing earnings field as an unknown number", async () => {
    const { http } = whopFetch([{ method: "POST", path: "/affiliates", answer: { status: 200, json: affiliateJson({ username: "nia cooks", earned: undefined }) } }]);
    expect(await createAffiliate(http, SETTINGS, "user_test1")).toEqual({ id: "aff_test1", username: null, earnedCents: null });
  });

  it("an error never carries the key or Whop's own words", async () => {
    const { http } = whopFetch([{ method: "POST", path: "/affiliates", answer: { status: 422, json: { error: `bad ${TEST_KEY} nia.cooks` } } }]);
    const err = (await createAffiliate(http, SETTINGS, "nia.cooks").catch((e: unknown) => e)) as WhopError;
    expect(err).toBeInstanceOf(WhopError);
    expect(`${err.message} ${String(err.stack)}`).not.toMatch(new RegExp(`${TEST_KEY}|nia\\.cooks`));
    expect(err.message).toBe("whop refused 422");
  });
});

describe("GET /affiliates/{id}: the affiliate, for what it has earned", () => {
  it("reads the affiliate by its id, with the key and no body", async () => {
    const { http, calls } = whopFetch([{ method: "GET", path: "/affiliates/aff_test1", answer: { status: 200, json: affiliateJson({ earned: "24.50" }) } }]);
    expect(await getAffiliate(http, SETTINGS, "aff_test1")).toEqual({ id: "aff_test1", username: "nia.cooks", earnedCents: 2450 });
    expect(calls).toEqual([
      { url: "https://whop.example.test/api/v1/affiliates/aff_test1", method: "GET", headers: { authorization: `Bearer ${TEST_KEY}` }, body: undefined, hasSignal: true },
    ]);
  });

  it("an id of another form is never sent", async () => {
    const { http, calls } = whopFetch();
    await expect(getAffiliate(http, SETTINGS, "aff_../companies")).rejects.toMatchObject({ kind: "malformed" });
    expect(calls).toEqual([]);
  });
});

describe("the overrides: the commission per plan", () => {
  it("GET /affiliates/{id}/overrides lists the plans that have one", async () => {
    const { http, calls } = whopFetch([
      {
        method: "GET",
        path: "/affiliates/aff_test1/overrides",
        answer: {
          status: 200,
          json: {
            data: [
              { id: "ovr_1", override_type: "standard", plan_id: "plan_full_starter", commission_type: "percentage", commission_value: 50, applies_to_payments: "first_payment" },
              { id: "ovr_2", override_type: "standard", plan_id: null, commission_type: "flat_fee", commission_value: 5 },
            ],
          },
        },
      },
    ]);
    expect(await listOverrides(http, SETTINGS, "aff_test1")).toEqual([{ planId: "plan_full_starter" }, { planId: null }]);
    expect(calls).toEqual([
      { url: "https://whop.example.test/api/v1/affiliates/aff_test1/overrides", method: "GET", headers: { authorization: `Bearer ${TEST_KEY}` }, body: undefined, hasSignal: true },
    ]);
  });

  it("a list that is not one is malformed", async () => {
    const { http } = whopFetch([{ method: "GET", path: "/affiliates/aff_test1/overrides", answer: { status: 200, json: { items: [] } } }]);
    await expect(listOverrides(http, SETTINGS, "aff_test1")).rejects.toMatchObject({ kind: "malformed" });
  });

  it("POST /affiliates/{id}/overrides sets the standard percentage on the first payment, exactly as documented", async () => {
    const { http, calls } = whopFetch([{ method: "POST", path: "/affiliates/aff_test1/overrides", answer: { status: 200, json: { id: "ovr_3" } } }]);
    await createOverride(http, SETTINGS, "aff_test1", "plan_trial_pro");
    expect(calls).toEqual([
      {
        url: "https://whop.example.test/api/v1/affiliates/aff_test1/overrides",
        method: "POST",
        headers: { authorization: `Bearer ${TEST_KEY}`, "content-type": "application/json" },
        body: {
          override_type: "standard",
          id: "aff_test1",
          plan_id: "plan_trial_pro",
          commission_type: "percentage",
          commission_value: EARN_RATE_PCT,
          applies_to_payments: "first_payment",
        },
        hasSignal: true,
      },
    ]);
    expect(EARN_RATE_PCT).toBe(50);
  });

  it("a refused override is a WhopError", async () => {
    const { http } = whopFetch([{ method: "POST", path: "/affiliates/aff_test1/overrides", answer: { status: 400, json: {} } }]);
    await expect(createOverride(http, SETTINGS, "aff_test1", "plan_trial_pro")).rejects.toMatchObject({ kind: "refused", status: 400 });
  });

  it.each([
    ["no body", { status: 201, text: "" }],
    ["a body that is not JSON", { status: 200, text: "created" }],
  ])("an override answered 2xx with %s is set: only the status is read", async (_why, answer) => {
    const { http } = whopFetch([{ method: "POST", path: "/affiliates/aff_test1/overrides", answer }]);
    await expect(createOverride(http, SETTINGS, "aff_test1", "plan_trial_pro")).resolves.toBeUndefined();
  });

  it("the affiliate and the list still need their JSON: a 2xx without one is malformed", async () => {
    const { http } = whopFetch([
      { method: "GET", path: "/affiliates/aff_test1", answer: { status: 200, text: "" } },
      { method: "GET", path: "/affiliates/aff_test1/overrides", answer: { status: 200, text: "" } },
    ]);
    await expect(getAffiliate(http, SETTINGS, "aff_test1")).rejects.toMatchObject({ kind: "malformed" });
    await expect(listOverrides(http, SETTINGS, "aff_test1")).rejects.toMatchObject({ kind: "malformed" });
  });
});

describe("the base address alone, for the checkout (ruling 25)", () => {
  it("absent or blank: Whop's documented one", () => {
    expect(whopBaseUrl()).toBe("https://api.whop.com/api/v1");
    process.env.WHOP_API_BASE_URL = "  ";
    expect(whopBaseUrl()).toBe(WHOP_DEFAULT_BASE);
  });

  it("set (the sandbox): that one, a trailing slash dropped, with or without the key and the company id", () => {
    process.env.WHOP_API_BASE_URL = "https://sandbox-api.whop.com/api/v1/";
    expect(whopBaseUrl()).toBe("https://sandbox-api.whop.com/api/v1");
    expect(whopSettings()).toBeNull();
  });

  it("an address that is not https is not used: the documented one", () => {
    process.env.WHOP_API_BASE_URL = "http://sandbox-api.whop.com/api/v1";
    expect(whopBaseUrl()).toBe(WHOP_DEFAULT_BASE);
  });
});

describe("centsOfUsd: what Whop says was earned, in whole cents (ruling 16)", () => {
  it.each([
    ["12.50", 1250],
    ["12.5", 1250],
    ["0", 0],
    ["0.00", 0],
    ["1240.05", 124005],
    [" 24.50 ", 2450],
    ["12.505", 1251],
    ["12.504", 1250],
    [12.5, 1250],
    [7, 700],
    [0.29, 29],
  ] as const)("%j is %i", (value, cents) => {
    expect(centsOfUsd(value)).toBe(cents);
  });

  it.each([["abc"], [""], ["-1.00"], [-1], ["1e3"], ["12,50"], [null], [undefined], [Number.NaN], [Number.POSITIVE_INFINITY], [{ usd: "1" }]])("%j is null", (value) => {
    expect(centsOfUsd(value)).toBeNull();
  });
});
