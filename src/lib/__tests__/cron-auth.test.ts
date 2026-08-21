import { afterEach, describe, expect, it } from "vitest";

import { verifyCronAuth } from "../cron-auth";

const ORIGINAL_SECRET = process.env.CRON_SECRET;

function requestWithAuth(header?: string): Request {
  return new Request("http://localhost/api/cron/test", {
    headers: header ? { authorization: header } : {},
  });
}

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = ORIGINAL_SECRET;
  }
});

describe("verifyCronAuth", () => {
  it("rejects 'Bearer undefined' when CRON_SECRET is unset (fail closed)", () => {
    delete process.env.CRON_SECRET;
    const result = verifyCronAuth(requestWithAuth("Bearer undefined"));
    expect(result?.status).toBe(401);
  });

  it("rejects any request when CRON_SECRET is empty", () => {
    process.env.CRON_SECRET = "";
    const result = verifyCronAuth(requestWithAuth("Bearer "));
    expect(result?.status).toBe(401);
  });

  it("accepts the correct bearer token", () => {
    process.env.CRON_SECRET = "test-secret";
    const result = verifyCronAuth(requestWithAuth("Bearer test-secret"));
    expect(result).toBeNull();
  });

  it("rejects a wrong bearer token", () => {
    process.env.CRON_SECRET = "test-secret";
    const result = verifyCronAuth(requestWithAuth("Bearer wrong"));
    expect(result?.status).toBe(401);
  });

  it("rejects a missing authorization header", () => {
    process.env.CRON_SECRET = "test-secret";
    const result = verifyCronAuth(requestWithAuth());
    expect(result?.status).toBe(401);
  });
});
